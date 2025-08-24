/* eslint-disable no-console */
require("dotenv").config();
const key = process.env.CLAUDE_API_KEY;
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Optional: robust HTML parsing. If not installed, we fall back to a regex.
let cheerio = null;
try { cheerio = require('cheerio'); } catch (_) { /* optional */ }


// Add katex for LaTeX rendering
const katex = require('katex');

// Load Year 7 curriculum
const curriculum = require('./year7-curriculum.json');

// For DOCX and PDF outputpost 
const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  AlignmentType,
  TextRun,
} = require('docx');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage (use Redis/DB in production)
const userTokenUsage = new Map();
const conversations = new Map();
const curriculumCache = new Map();
const conversationTranscripts = new Map(); 
const TRANSCRIPT_RETENTION_DAYS = 30;

// --- Curriculum topic resolver (supports either topic_catalog[] or topics{}) ---
function resolveTopicData(topicText = '') {
  const q = String(topicText).toLowerCase();

  // If an array topic_catalog exists, prefer it
  if (Array.isArray(curriculum.topic_catalog)) {
    return curriculum.topic_catalog.find(t =>
      (t.topic && t.topic.toLowerCase().includes(q)) ||
      (Array.isArray(t.subtopics) && t.subtopics.some(s => s.toLowerCase().includes(q)))
    ) || null;
  }

  // Otherwise use topics{} (your current JSON shape)
  if (curriculum.topics && typeof curriculum.topics === 'object') {
    const entries = Object.entries(curriculum.topics).map(([id, t]) => ({ id, ...t }));
    return entries.find(t =>
      (t.displayName && t.displayName.toLowerCase().includes(q)) ||
      (Array.isArray(t.subtopics) && t.subtopics.some(s => s.toLowerCase().includes(q)))
    ) || null;
  }

  return null;
}


// === Anthropic (Claude) init ===
let anthropic = null;
try {
  if (process.env.CLAUDE_API_KEY) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    console.log('✅ Claude API initialized successfully');
  } else {
    console.log('⚠️  CLAUDE_API_KEY not found in .env file');
  }
} catch (error) {
  console.log('❌ Error initializing Claude:', error.message);
}

// Middleware
app.use(cors());
app.use(express.json());

// --- Curriculum Integration Functions ---
function buildYear7SystemPrompt(topic) {
  const topicData = resolveTopicData(topic); // ✅ use resolver

  const coreRules = Array.isArray(curriculum.system_rules)
    ? curriculum.system_rules.join(' ')
    : 'You are a Year 7 maths tutor.';

  const styleGuide = curriculum.style_guidelines
    ? `${curriculum.style_guidelines.tone || 'supportive'}, ${(curriculum.style_guidelines.format || []).join(' then ')}`
    : 'supportive, Goal then Steps then Answer then Check-your-understanding';

  let topicContext = '';
  let scaffoldInstructions = '';

  if (topicData) {
    const topicName = topicData.topic || topicData.displayName || 'Topic';
    const subs = Array.isArray(topicData.subtopics) ? topicData.subtopics.slice(0, 4).join(', ') : '';

    topicContext += `\nTOPIC: ${topicName}`;
    if (subs) topicContext += `\nSCOPE: ${subs}`;

    // Add scaffold instructions if relevant
    const relevantScaffolds = findRelevantScaffolds(topicData, topic || topicName) || [];
    if (relevantScaffolds.length > 0) {
      scaffoldInstructions = '\n\nCRITICAL SCAFFOLD STEPS - YOU MUST GUIDE STUDENTS THROUGH THESE EXACT STEPS:';
      relevantScaffolds.forEach(({ key, steps, priority }) => {
        scaffoldInstructions += `\n\nFor ${key.replace(/_/g, ' ')} problems (Priority: ${priority}):`;
        steps.forEach((step, index) => {
          scaffoldInstructions += `\n  Step ${index + 1}: ${step}`;
        });
        scaffoldInstructions += '\n  → Ask questions to guide students through EACH step';
        scaffoldInstructions += '\n  → Do NOT skip steps or give direct answers';
        scaffoldInstructions += '\n  → Wait for student response before proceeding to next step';
      });
      scaffoldInstructions += '\n\nWhen you recognize a problem that matches these scaffolds:\n1. Identify which scaffold applies\n2. Ask a question that leads to Step 1\n3. Only proceed to the next step after student engagement\n4. Use the scaffold steps as your roadmap for questioning';
    }

    // Add misconception warning
    const mismatch = Array.isArray(curriculum.common_misconceptions)
      ? curriculum.common_misconceptions.find(m =>
          String(topicName).toLowerCase().includes(String(m.topic || '').toLowerCase())
        )
      : null;
    if (mismatch) {
      topicContext += `\nWATCH: ${mismatch.pattern} - fix: ${mismatch.fix}`;
    }
  }

  const fullPrompt =
    'You are StudyBuddy, NSW Year 7 mathematics tutor.\n\n' +
    'CORE RULES: ' + coreRules + '\n' +
    'STYLE: ' + styleGuide +
    topicContext +
    scaffoldInstructions + '\n\n' +
    'CRITICAL: Use Socratic method ONLY - ask guiding questions, NEVER give direct answers or final results.\n' +
    'Never use emojis. Ask ONE question at a time. Guide discovery step by step.\n' +
    'When teaching procedures, ask questions that lead students through the exact scaffold steps.\n' +
    "ALWAYS follow the scaffold steps when they apply to the student's question.";

  return fullPrompt;
}


function buildTopicSpecificPrompt(selectedTopics) {
  if (!Array.isArray(selectedTopics) || selectedTopics.length === 0) {
    console.log('⚠️ No selected topics provided');
    return '';
  }

  console.log('🎯 Processing selected topics:', selectedTopics);

  const topicInstructions = selectedTopics.map(topicId => {
    // Try direct lookup first
    let topic = curriculum.topics[topicId];
    
    // If not found, try with underscores instead of hyphens
    if (!topic) {
      const underscoredId = topicId.replace(/-/g, '_');
      topic = curriculum.topics[underscoredId];
      console.log(`🔄 Tried underscore version: ${underscoredId} -> ${!!topic}`);
    }
    
    // If still not found, try to find by displayName match (fuzzy)
    if (!topic) {
      const topicEntries = Object.entries(curriculum.topics);
      const found = topicEntries.find(([key, topicData]) => {
        if (!topicData.displayName) return false;
        const displayName = topicData.displayName.toLowerCase();
        const searchId = topicId.toLowerCase();
        return displayName.includes(searchId) || searchId.includes(displayName.split(' ')[0]);
      });
      
      if (found) {
        topic = found[1];
        console.log(`🎯 Found by display name: ${topicId} -> ${topic.displayName}`);
      }
    }
    
    if (!topic) {
      console.log(`❌ Topic not found: ${topicId}`);
      return '';
    }
    
    console.log(`✅ Found topic: ${topicId} -> ${topic.displayName}`);
    
    return `TOPIC: ${topic.displayName}
FOCUS: ${topic.instructions}
METHODS: ${topic.methods ? topic.methods.join(', ') : 'N/A'}
START WITH: ${topic.proficiency?.easy?.examples?.[0] || 'Basic concepts'}
VOCABULARY: ${topic.glossary ? topic.glossary.join(', ') : 'N/A'}`;
  }).filter(Boolean).join('\n\n');
  
  console.log('📝 Generated topic instructions:', topicInstructions ? 'Success' : 'Empty');
  return topicInstructions;
}


function createTranscriptEntry(userId, message, response, metadata = {}) {
  return {
    id: `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    timestamp: new Date(),
    message,
    response,
    metadata: {
      subject: metadata.subject || 'Mathematics',
      yearLevel: metadata.yearLevel || 7,
      curriculum: metadata.curriculum || 'NSW',
      conversationId: metadata.conversationId,
      detectedTopic: metadata.detectedTopic,
      ...metadata
    }
  };
}

// Helper function to clean old transcripts
function cleanOldTranscripts() {
  const cutoffDate = new Date(Date.now() - (TRANSCRIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000));
  
  for (const [userId, transcripts] of conversationTranscripts.entries()) {
    const filteredTranscripts = transcripts.filter(t => t.timestamp > cutoffDate);
    
    if (filteredTranscripts.length !== transcripts.length) {
      conversationTranscripts.set(userId, filteredTranscripts);
      console.log(`🧹 Cleaned ${transcripts.length - filteredTranscripts.length} old transcripts for user ${userId}`);
    }
    
    // Remove empty arrays
    if (filteredTranscripts.length === 0) {
      conversationTranscripts.delete(userId);
    }
  }
}

function findRelevantScaffolds(topicData, topic) {
  const scaffolds = [];
  const topicLower = topic.toLowerCase();
  
  // Direct keyword matching with priority scoring
  const scaffoldMatches = [
    { key: 'fractions_to_decimals', keywords: ['fraction to decimal', 'convert fraction', 'decimal conversion', '1/3 to decimal', 'turn fraction into decimal'], priority: 'HIGH' },
    { key: 'fractions_add_sub', keywords: ['add fraction', 'subtract fraction', 'fraction addition', 'fraction subtraction'], priority: 'HIGH' },
    { key: 'two_step_equations', keywords: ['solve equation', 'two step', 'equation with', 'find x'], priority: 'HIGH' },
    { key: 'percent_of_quantity', keywords: ['percent of', 'percentage of', '% of', 'find percentage'], priority: 'HIGH' },
    { key: 'area_rectangle', keywords: ['area rectangle', 'rectangle area', 'length width'], priority: 'MEDIUM' },
    { key: 'area_triangle', keywords: ['area triangle', 'triangle area', 'base height'], priority: 'MEDIUM' },
    { key: 'area_parallelogram', keywords: ['area parallelogram', 'parallelogram area'], priority: 'MEDIUM' },
    { key: 'area_trapezium', keywords: ['area trapezium', 'trapezium area', 'parallel sides'], priority: 'MEDIUM' },
    { key: 'angles_with_parallel_lines', keywords: ['parallel lines', 'corresponding angle', 'alternate angle'], priority: 'MEDIUM' },
    { key: 'solving_proportions', keywords: ['proportion', 'ratio problem', 'cross multiply'], priority: 'MEDIUM' }
  ];
  
  // Check for direct matches
  scaffoldMatches.forEach(({ key, keywords, priority }) => {
    if (keywords.some(keyword => topicLower.includes(keyword))) {
      if (curriculum.scaffolds[key]) {
        scaffolds.push({
          key,
          steps: curriculum.scaffolds[key],
          priority,
          matchType: 'direct'
        });
      }
    }
  });
  
  // If no direct matches, check topic and subtopic matches
  if (scaffolds.length === 0 && topicData) {
    Object.keys(curriculum.scaffolds).forEach(scaffoldKey => {
      const scaffoldTopic = scaffoldKey.replace(/_/g, ' ').toLowerCase();
      
      // Check if scaffold topic is in the main topic or subtopics
      const isRelevant = 
        topicData.topic.toLowerCase().includes(scaffoldTopic) ||
        topicData.subtopics.some(sub => 
          sub.toLowerCase().includes(scaffoldTopic) || 
          scaffoldTopic.includes(sub.toLowerCase())
        );
      
      if (isRelevant) {
        scaffolds.push({
          key: scaffoldKey,
          steps: curriculum.scaffolds[scaffoldKey],
          priority: 'LOW',
          matchType: 'topic'
        });
      }
    });
  }
  
  // Sort by priority and return unique scaffolds
  const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  return scaffolds
    .filter((scaffold, index, self) => 
      index === self.findIndex(s => s.key === scaffold.key)
    )
    .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
    .slice(0, 3); // Limit to top 3 most relevant scaffolds
}



// Enhanced message detection for fraction-to-decimal conversion
function detectFractionToDecimalRequest(message) {
  const patterns = [
    /convert.*(\d+\/\d+).*decimal/i,
    /(\d+\/\d+).*to.*decimal/i,
    /change.*(\d+\/\d+).*decimal/i,
    /turn.*(\d+\/\d+).*decimal/i,
    /(\d+\/\d+).*as.*decimal/i,
    /decimal.*form.*(\d+\/\d+)/i
  ];
  
  return patterns.some(pattern => pattern.test(message));
}


// Function to handle fraction to decimal conversions with scaffold
function handleFractionToDecimalWithScaffold(fraction, conversation) {
  const scaffold = curriculum.scaffolds.fractions_to_decimals;
  
  // Determine which step we're on based on conversation history
  const currentStep = determineCurrentScaffoldStep(conversation, scaffold);
  
  const socraticQuestions = {
    0: `Let's convert ${fraction} to a decimal! First, can you try multiplying the denominator ${fraction.split('/')[1]} by something to make it 10, 100, or 1000? What happens when you try?`,
    1: `Since we can't easily make ${fraction.split('/')[1]} into 10, 100, or 1000, we'll use long division. Can you set up a division bracket like this: ${fraction.split('/')[1]})${fraction.split('/')[0]}.000000 - what do you think the decimal point in the answer should go?`,
    2: `Perfect! Now, since ${fraction.split('/')[1]} is bigger than ${fraction.split('/')[0]}, we can't divide yet. What should we do to the 1 to make it bigger so we can divide by ${fraction.split('/')[1]}?`,
    3: `Right! We use 10 (adding the first zero). Now, what's 10 ÷ ${fraction.split('/')[1]}? What's the quotient and what's the remainder?`,
    4: `Great! So we get ${Math.floor(10/parseInt(fraction.split('/')[1]))} with remainder ${10 % parseInt(fraction.split('/')[1])}. Now what do we do with that remainder ${10 % parseInt(fraction.split('/')[1])}? What's the next step?`,
    5: `Exactly! We bring down the next zero to make ${10 % parseInt(fraction.split('/')[1])}0 again. What do you notice? Are we getting the same division problem again?`,
    6: `You're discovering a pattern! What do you think will happen if we keep dividing? What does this tell us about the decimal?`
  };
  
  return socraticQuestions[currentStep] || socraticQuestions[0];
}

function determineCurrentScaffoldStep(conversation, scaffold) {
  // Simple logic to determine which step based on recent messages
  // This could be enhanced with more sophisticated tracking
  const recentMessages = conversation.messages.slice(-4);
  const lastUserMessage = recentMessages.find(m => m.role === 'user')?.content.toLowerCase() || '';
  
  if (lastUserMessage.includes('division') || lastUserMessage.includes('divide')) {
    return 2;
  }
  if (lastUserMessage.includes('carry') || lastUserMessage.includes('remainder')) {
    return 4;
  }
  if (lastUserMessage.includes('pattern') || lastUserMessage.includes('repeat')) {
    return 5;
  }
  
  return 0; // Start at the beginning
}


function checkYear7Scope(message, topic) {
  const msg = message.toLowerCase();
  
  // Always allow basic arithmetic - these are foundational
  if (/\b\d+\s*[\+\-\*×÷\/]\s*\d+\b/.test(msg) || 
      /what\s+is\s+\d+/.test(msg) ||
      msg.includes('add') || msg.includes('plus') || 
      msg.includes('subtract') || msg.includes('minus') ||
      msg.includes('multiply') || msg.includes('times') ||
      msg.includes('divide')) {
    console.log('✅ Basic arithmetic - always in scope');
    return { inScope: true };
  }

  // Check for definition requests
  const definitionKeywords = ['what is', 'define', 'meaning of', 'explain', 'definition'];
  const isDefinitionRequest = definitionKeywords.some(keyword => msg.includes(keyword));
  
  if (isDefinitionRequest) {
    // ... your existing definition logic ...
  }

  // For everything else, be more lenient - if it contains any math keywords, allow it
  const mathKeywords = ['equation', 'solve', 'calculate', 'find', 'math', 'number', 
                       'fraction', 'decimal', 'angle', 'area', 'perimeter'];
  
  if (mathKeywords.some(keyword => msg.includes(keyword))) {
    console.log('✅ Contains math keywords - allowing');
    return { inScope: true };
  }

  // Only block clearly non-mathematical content
  return { inScope: true }; // Default to allowing rather than blocking
}

function handleTopicChange(conversation, newTopic, message) {
  const topicChanged = conversation.subject !== newTopic;
  
  if (topicChanged) {
    console.log(`📚 Topic changed: ${conversation.subject} → ${newTopic}`);
    
    // Clear old curriculum context
    conversation.curriculumLoaded = false;
    conversation.lastCurriculumTopic = null;
    
    // Update conversation subject
    conversation.subject = newTopic;
    
    return true; // Indicates curriculum context needed
  }
  
  return false;
}

function getYear7Definition(term) {
  const definitions = {
    'coefficient': {
      socratic: "Great question! Look at this expression: 3x + 5. What number do you see in front of the x? What do you think that number might be called?",
      context: "In algebra, it's the number that multiplies the variable"
    },
    'variable': {
      socratic: "Think about this: if you have x apples and I don't tell you how many x is, what would you call x? What makes it different from a regular number?",
      context: "It's a letter that represents an unknown number that can change"
    },
    'constant': {
      socratic: "In the expression 2x + 7, one part changes when x changes, but what about the 7? What stays the same no matter what x equals?",
      context: "It's a number that doesn't change in an expression"
    },
    'term': {
      socratic: "If I write 3x + 5 - 2y, I can break this into separate pieces. How many separate pieces do you see? What would you call each piece?",
      context: "Each separate part of an expression, connected by + or - signs"
    },
    'factor': {
      socratic: "What numbers can you multiply together to get 12? What would you call those numbers that multiply to make 12?",
      context: "Numbers that multiply together to give another number"
    },
    'multiple': {
      socratic: "If you count by 3s: 3, 6, 9, 12... what would you call these numbers in relation to 3?",
      context: "Numbers you get when you multiply by whole numbers"
    }
  };
  
  const def = definitions[term.toLowerCase()];
  return def || null;
}

function getCurriculumContext(topic) {
  try {
    const key = String(topic || '').trim().toLowerCase();
    if (!key) return '';

    if (curriculumCache.has(key)) {
      return curriculumCache.get(key);
    }

    const t = resolveTopicData(key); // ✅ use resolver
    if (!t) {
      curriculumCache.set(key, '');
      return '';
    }

    const name = t.topic || t.displayName || 'Topic';
    const subs = Array.isArray(t.subtopics) ? t.subtopics.slice(0, 3).join(', ') : '';
    const instructions = (t.instructions || '').trim();
    const starter =
      t.proficiency?.easy?.examples?.[0] ||
      t.proficiency?.easy?.concepts?.[0] ||
      '';

    let context = `Y7 ${name}`;
    if (subs) context += ` — focus: ${subs}`;
    if (instructions) context += `\nGuidance: ${instructions}`;
    if (starter) context += `\nStart with: ${starter}`;

    curriculumCache.set(key, context);
    return context;
  } catch (e) {
    console.error('getCurriculumContext error:', e);
    return '';
  }
}


// --- Enhanced Topic Detection with Curriculum ---
// Detects a likely topic name from a free-form message using curriculum keywords.
// Works with either curriculum.topic_catalog[] or curriculum.topics{}.
// Returns a displayable topic string or a sensible default (e.g., 'Mathematics').
function detectMathematicalTopicWithCurriculum(messageText = '', fallback = 'Mathematics') {
  try {
    const msg = String(messageText).toLowerCase().trim();
    if (!msg) return fallback;

    // Build a unified list of topic entries
    const topicsArray = Array.isArray(curriculum.topic_catalog)
      ? curriculum.topic_catalog
      : (curriculum.topics ? Object.values(curriculum.topics) : []);

    // Nothing to scan
    if (!Array.isArray(topicsArray) || topicsArray.length === 0) {
      return fallback;
    }

    // Prepare a list of candidates with keywords
    const candidates = topicsArray.map(t => {
      const name = (t.topic || t.displayName || '').trim();
      const subtopics = Array.isArray(t.subtopics) ? t.subtopics : [];
      // Build a keyword set: topic name + subtopics + a few method hints
      const methods = Array.isArray(t.methods) ? t.methods : [];
      const keywords = [
        name.toLowerCase(),
        ...subtopics.map(s => String(s).toLowerCase()),
        ...methods.map(m => String(m).toLowerCase())
      ].filter(Boolean);

      return { name, keywords, raw: t };
    });

    // Scoring: count how many keywords appear in the message (simple heuristic)
    let best = { score: 0, name: null, raw: null };
    for (const c of candidates) {
      if (!c.name) continue;
      const score = c.keywords.reduce((acc, kw) => acc + (kw && msg.includes(kw) ? 1 : 0), 0);
      if (score > best.score) best = { score, name: c.name, raw: c.raw };
    }

    if (best.score > 0 && best.name) {
      return best.name;
    }

    // Fallback: try a quick resolve on obvious words the user typed
    // (e.g., "fractions", "integers", "angles")
    // This uses your resolveTopicData helper and returns a displayable name if found.
    const quickWords = msg.split(/[^a-z0-9_]+/i).filter(Boolean);
    for (const w of quickWords) {
      const t = resolveTopicData(w);
      if (t) return t.topic || t.displayName || fallback;
    }

    return fallback;
  } catch (e) {
    console.error('detectMathematicalTopicWithCurriculum error:', e);
    return fallback;
  }
}


// --- Helpers ---
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4); // rough
}

function detectMathematicalTopic(message, existingConversation = null) {
  return detectMathematicalTopicWithCurriculum(message, existingConversation);
}

function isOnTopic(message) {
  const msg = (message || '').toLowerCase();
  
  // Always allow homework help requests
  const homeworkHelp = ['help with homework', 'homework help', 'need help with', 'stuck on homework'];
  if (homeworkHelp.some(p => msg.includes(p))) return true;

  // Block obviously off-topic content
  const offTopic = ['religion', 'politics', 'dating', 'video games', 'movies', 'do my homework for me'];
  if (offTopic.some(k => msg.includes(k))) return false;

  // Expanded math keywords - be more inclusive
  const mathKeywords = [
    // Basic operations
    'math', 'equation', 'solve', 'calculate', 'find', 'answer', 'result',
    // Variables and symbols
    'x', 'y', 'z', 'n', '+', '-', '=', '*', '/', '^',
    // Math concepts
    'formula', 'problem', 'number', 'digit', 'value', 'solution',
    // Operations
    'add', 'subtract', 'multiply', 'divide', 'division', 'multiplication', 'addition', 'subtraction',
    // Math terms
    'fraction', 'decimal', 'percent', 'ratio', 'proportion', 'area', 'perimeter', 'angle',
    'triangle', 'square', 'circle', 'graph', 'plot', 'data', 'mean', 'median', 'mode',
    'algebra', 'geometry', 'statistics', 'probability', 'factor', 'multiple', 'prime',
    // Question words in math context
    'how', 'what', 'why', 'when', 'where', 'which', 'can you', 'help',
    // Common student phrases
    'stuck', 'confused', 'understand', 'explain', 'show', 'work out'
  ];

  // If it contains math keywords, it's on topic
  if (mathKeywords.some(k => msg.includes(k))) return true;

  // Check for numbers or mathematical expressions
  if (/\d/.test(msg) || /[+\-*/=^()]/.test(msg)) return true;

  // For very short messages (like "we divide it?"), be more permissive
  // This catches follow-up questions in ongoing conversations
  if (msg.length < 20) {
    const followUpWords = ['it', 'this', 'that', 'we', 'do', 'can', 'should', 'will', 'then', 'next', 'now'];
    if (followUpWords.some(w => msg.includes(w))) return true;
  }

  // Default to false for clearly non-math content
  return false;
}

function createSystemPrompt(subject, yearLevel, curriculum) {
  return buildYear7SystemPrompt(subject);
}

function getConversationKey(userId, subject, yearLevel) {
  return `${userId}_${subject}_${yearLevel}`;
}

function summarizeOldContext(messages, maxLength = 200) {
  // Keep important context while reducing token count
  const importantMessages = messages
    .filter(m => m.role === 'assistant' || (m.role === 'user' && m.content.length > 10))
    .slice(0, 4)
    .map(m => {
      const content = m.content.substring(0, 40);
      return m.role === 'user' ? `Student asked: ${content}` : `I guided: ${content}`;
    })
    .join('. ');
  
  return importantMessages ? `Earlier in our conversation: ${importantMessages}...` : '';
}

// ---------- Enhanced Worksheet generation with LaTeX ----------
async function getWorksheetLatexFromClaude({ topic, difficulty, questionCount, yearLevel }) {
  if (!anthropic) {
    const sample = [];
    for (let i = 0; i < questionCount; i++) {
      const num1 = i + 3;
      const num2 = i + 13;
      sample.push('\\item Solve for $x$: $2x + ' + num1 + ' = ' + num2 + '$');
    }
    return '\\begin{enumerate}\n' + sample.join('\n') + '\n\\end{enumerate}';
  }

  // Enhanced prompt with curriculum awareness
  const topicData = curriculum.topic_catalog.find(t => 
    t.topic.toLowerCase().includes(topic.toLowerCase())
  );

  let curriculumGuidance = '';
  if (topicData) {
    curriculumGuidance = `Focus on: ${topicData.subtopics.slice(0, 3).join(', ')}. Use verbs: ${topicData.allowed_verbs.slice(0, 4).join(', ')}.`;
  }

  const prompt = 'Create ' + questionCount + ' ' + difficulty + ' ' + topic + ' questions for NSW Year ' + yearLevel + ' curriculum.\n' +
    curriculumGuidance + '\n' +
    'Return ONLY valid LaTeX using enumerate environment like:\n\n' +
    '\\begin{enumerate}\n' +
    '  \\item Solve for $x$: $2x + 5 = 15$\n' +
    '  \\item Find the area of a rectangle with length $8$ cm and width $5$ cm\n' +
    '  \\item Simplify: $\\frac{3}{4} + \\frac{1}{8}$\n' +
    '  \\item Calculate: $\\sqrt{144} + 3^2$\n' +
    '\\end{enumerate}\n\n' +
    'Rules:\n' +
    '- Use proper LaTeX math notation with $ for inline math\n' +
    '- Keep questions curriculum-appropriate for Year ' + yearLevel + '\n' +
    '- Use \\item for each question\n' +
    '- No answers, just questions\n' +
    '- Use proper LaTeX: \\frac{a}{b}, \\sqrt{x}, x^2, \\cdot for multiplication';

    const ai = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: contextualMessage }]
    });
    
    // Log actual API usage (if available in response)
    console.log('Actual Claude API usage:', ai.usage);

  return (ai.content?.[0]?.text || '').trim();
}

// Convert LaTeX to HTML for preview using KaTeX
function latexToHtml(latexContent) {
  try {
    let htmlContent = '<ol>';
    
    // Split by \item and process each question
    const items = latexContent.split('\\item').filter(item => item.trim());
    
    items.forEach(item => {
      let content = item.trim();
      
      // Remove any remaining LaTeX structure
      content = content.replace(/\\begin\{enumerate\}|\\end\{enumerate\}/g, '').trim();
      
      // Convert inline math $...$ to HTML with KaTeX
      const htmlLine = content.replace(/\$([^$]+)\$/g, (match, math) => {
        try {
          return katex.renderToString(math, { 
            displayMode: false,
            throwOnError: false 
          });
        } catch (e) {
          console.error('KaTeX error:', e.message);
          return `<span style="color: red; font-style: italic;">[${math}]</span>`;
        }
      });
      
      if (htmlLine.trim()) {
        htmlContent += `<li>${htmlLine}</li>`;
      }
    });
    
    htmlContent += '</ol>';
    return htmlContent;
  } catch (error) {
    console.error('LaTeX to HTML conversion error:', error);
    return '<p style="color: red;">Error converting LaTeX to HTML</p>';
  }
}

// Convert LaTeX questions to plain text for DOCX/PDF
function latexToPlainText(latexContent) {
  const questions = [];
  const items = latexContent.split('\\item').filter(item => item.trim());
  
  items.forEach(item => {
    let content = item.trim();
    content = content.replace(/\\begin\{enumerate\}|\\end\{enumerate\}/g, '').trim();
    
    // Convert common LaTeX to plain text
    content = content
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')  // fractions
      .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')              // square root
      .replace(/\$([^$]+)\$/g, '$1')                           // remove $ signs
      .replace(/\\cdot/g, '×')                                 // multiplication
      .replace(/\\times/g, '×')                                // multiplication
      .replace(/\\div/g, '÷')                                  // division
      .replace(/\^(\d)/g, '^$1')                               // exponents
      .replace(/\\degrees/g, '°')                              // degrees
      .replace(/\\pi/g, 'π')                                   // pi
      .trim();
    
    if (content) {
      questions.push(content);
    }
  });
  
  return questions;
}

function htmlToQuestionsArray(html) {
  if (!html || typeof html !== 'string') return [];
  // Prefer cheerio if available
  if (cheerio) {
    const $ = cheerio.load(html);
    const qs = [];
    $('li').each((_, li) => qs.push($(li).text().trim()));
    if (qs.length) return qs;
    return [$.root().text().trim()].filter(Boolean);
  }

  // Fallback regex (simple)
  const matches = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  if (matches.length) {
    return matches.map(m => String(m[1]).replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  }
  // Last resort: strip tags
  return [html.replace(/<[^>]+>/g, '').trim()].filter(Boolean);
}

// DOCX builder
async function buildDocxBuffer({ title, questions, answers = [] }) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: '' }),
          ...questions.map((q, i) =>
            new Paragraph({
              children: [
                new TextRun({ text: `${i + 1}. `, bold: true }),
                new TextRun(String(q)),
              ],
              spacing: { after: 240 },
            })
          ),
          ...(answers.length
            ? [
                new Paragraph({ text: '' }),
                new Paragraph({ text: 'Answers', heading: HeadingLevel.HEADING_3 }),
                ...answers.map((a, i) =>
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${i + 1}. `, bold: true }),
                      new TextRun(String(a)),
                    ],
                    spacing: { after: 120 },
                  })
                ),
              ]
            : []),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

// PDF builder
function sendPdfResponse(res, { title, questions, answers = [] }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="worksheet.pdf"');

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  doc.fontSize(18).text(title, { align: 'center' });
  doc.moveDown(1);

  doc.fontSize(12);
  questions.forEach((q, i) => {
    doc.text(`${i + 1}. ${String(q)}`);
    doc.moveDown(0.6);
  });

  if (answers.length) {
    doc.addPage();
    doc.fontSize(16).text('Answers', { align: 'left' });
    doc.moveDown(0.6);
    doc.fontSize(12);
    answers.forEach((a, i) => {
      doc.text(`${i + 1}. ${String(a)}`);
      doc.moveDown(0.4);
    });
  }

  doc.end();
}

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'AI Tutor Backend is running!',
    claudeConfigured: !!anthropic,
    timestamp: new Date().toISOString(),
    activeConversations: conversations.size,
    curriculumLoaded: !!curriculum,
  });
});

// ---------- Routes ----------

// Preview route — return HTML for on-screen preview (WITH LATEX)
app.post('/api/generate-worksheet', async (req, res) => {
  const { topic, difficulty, questionCount, yearLevel = 7 } = req.body || {};
  try {
    // Generate LaTeX content
    const latexContent = await getWorksheetLatexFromClaude({ topic, difficulty, questionCount, yearLevel });
    
    // Convert to HTML for preview
    const html = latexToHtml(latexContent);
    
    // Include KaTeX CSS for proper math rendering
    const styledHtml = `
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
      <style>
        .katex { font-size: 1.1em; }
        ol { padding-left: 1.5em; }
        li { margin-bottom: 1em; line-height: 1.6; }
      </style>
      ${html}
    `;
    
    res.json({ 
      html: styledHtml,
      latex: latexContent // Also send raw LaTeX for debugging
    });
  } catch (e) {
    console.error('Worksheet generation error:', e);
    res.status(500).json({ error: true, message: e.message || 'Failed to generate' });
  }
});

// File route — produce DOCX or PDF (WITH LATEX CONVERSION)
app.post('/api/generate-worksheet-file', async (req, res) => {
  const { topic, difficulty, questionCount, yearLevel = 7, format = 'docx' } = req.body || {};
  try {
    // Generate LaTeX content
    const latexContent = await getWorksheetLatexFromClaude({ topic, difficulty, questionCount, yearLevel });
    
    // Convert LaTeX to plain text questions for DOCX/PDF
    const questions = latexToPlainText(latexContent);
    
    const title = `Year ${yearLevel} ${topic} — ${String(difficulty).charAt(0).toUpperCase()}${String(difficulty).slice(1)}`;

    if (format === 'docx') {
      const buffer = await buildDocxBuffer({ title, questions, answers: [] });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', 'attachment; filename="worksheet.docx"');
      return res.send(buffer);
    } else if (format === 'pdf') {
      return sendPdfResponse(res, { title, questions, answers: [] });
    }

    return res.status(400).json({ error: true, message: 'Unsupported format' });
  } catch (e) {
    console.error('File generation error:', e);
    res.status(500).json({ error: true, message: e.message || 'Failed to generate file' });
  }
});

// Tokens
app.get('/api/user/:userId/tokens', (req, res) => {
  const { userId } = req.params;
  const usage = userTokenUsage.get(userId) || { used: 0, limit: 5000 };
  res.json({
    tokensUsed: usage.used,
    tokensLimit: usage.limit,
    percentage: Math.round((usage.used / usage.limit) * 100),
  });
});

// IMPROVED CHAT WITH CURRICULUM INTEGRATION + TRANSCRIPT SAVE
// IMPROVED CHAT WITH CURRICULUM INTEGRATION + TRANSCRIPT SAVE + TOKEN TRACKING
app.post('/api/chat', async (req, res) => {
  try {
    console.log('\n🚀 === CHAT REQUEST ===');

    const {
      message,
      subject = 'Mathematics',
      yearLevel = 7,
      curriculum: curriculumLabel = 'NSW',
      userId = 'anonymous',
      resetContext = false,
      selectedTopics = [],        
      diagramContext = false
    } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: true, message: 'Message is required' });
    }

    // Initialize or get user token usage
    if (!userTokenUsage.has(userId)) {
      userTokenUsage.set(userId, { used: 0, limit: 5000 });
    }
    const tokenData = userTokenUsage.get(userId);

    // Check token limits
    if (tokenData.used >= tokenData.limit) {
      return res.status(429).json({ 
        error: true, 
        message: 'Token limit exceeded. Please upgrade your plan.',
        tokens: tokenData 
      });
    }

    // ---- Detect topic & scope (lightweight, safe) ----
    const detectedTopic = 'Mathematics'; 

    // Conversation bookkeeping
    const conversationKey = `${userId}_${detectedTopic}_${yearLevel}`;
    let conversation = conversations.get(conversationKey);
    if (!conversation) {
      conversation = {
        messages: [],
        totalTokens: 0,
      };
      conversations.set(conversationKey, conversation);
    }

    // ---- Build system prompt first ----
    let systemPrompt = createSystemPrompt(subject, yearLevel, curriculumLabel);

    // ---- Append topic-specific context safely ----
    if (Array.isArray(selectedTopics) && selectedTopics.length > 0) {
      const topicContext = buildTopicSpecificPrompt(selectedTopics);
      if (topicContext && topicContext.trim()) {
        systemPrompt += '\n\n' + topicContext;
        console.log('📚 Added topic-specific context');
      }
    }

    // ---- Build user message ----
    const contextualMessage = diagramContext
      ? `${diagramContext}\n\nStudent question: ${message}`
      : message;

    // ---- If Anthropic not configured, return a safe fallback ----
    if (!anthropic) {
      const fallback = `Great choice! Let's start with a quick, Year 7-friendly step.\n\n` +
        `**Goal:** Understand the problem and choose a method.\n` +
        `**Steps:** (1) Tell me the exact question. (2) I'll guide you step by step.\n` +
        `**Check-your-understanding:** Can you share one example you want to try?`;

      conversation.messages.push({ role: 'user', content: contextualMessage, timestamp: new Date() });
      conversation.messages.push({ role: 'assistant', content: fallback, timestamp: new Date() });

      return res.json({
        response: fallback,
        subject,
        detectedTopic,
        yearLevel,
        curriculum: curriculumLabel,
        conversationLength: conversation.messages.length,
        tokens: tokenData
      });
    }

    // ---- Call Anthropic safely ----
    const ai = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: contextualMessage }]
    });

    const text = (ai && ai.content && ai.content[0] && ai.content[0].text) || 
                 "Let's start! What's the first part of the problem?";

    // Estimate and update token usage
    const estimatedTokens = estimateTokens(systemPrompt + contextualMessage + text);
    tokenData.used += estimatedTokens;
    userTokenUsage.set(userId, tokenData);
    
    console.log(`💰 Token usage updated for ${userId}: ${tokenData.used}/${tokenData.limit}`);

    // Save to conversation
    conversation.messages.push({ role: 'user', content: contextualMessage, timestamp: new Date() });
    conversation.messages.push({ role: 'assistant', content: text, timestamp: new Date() });
    conversation.totalTokens += estimatedTokens;

    // Save transcript
    const transcript = createTranscriptEntry(userId, message, text, {
      subject,
      yearLevel,
      curriculum: curriculumLabel,
      detectedTopic,
      tokensUsed: estimatedTokens,
      conversationId: conversationKey,
      selectedTopics: selectedTopics.length > 0 ? selectedTopics : undefined,
      diagramContext: diagramContext ? true : undefined
    });

    if (!conversationTranscripts.has(userId)) {
      conversationTranscripts.set(userId, []);
    }
    conversationTranscripts.get(userId).push(transcript);

    return res.json({
      response: text,
      subject,
      detectedTopic,
      yearLevel,
      curriculum: curriculumLabel,
      conversationLength: conversation.messages.length,
      tokens: {
        used: tokenData.used,
        limit: tokenData.limit,
        thisRequest: estimatedTokens
      }
    });

  } catch (e) {
    console.error('CHAT ROUTE ERROR:', e);
    return res.status(500).json({ 
      error: true, 
      message: e.message || 'Server error'
    });
  }
});


// Get transcripts for a user
app.get('/api/user/:userId/transcripts', (req, res) => {
  const { userId } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  
  const userTranscripts = conversationTranscripts.get(userId) || [];
  
  // Sort by newest first
  const sortedTranscripts = userTranscripts
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(offset, offset + parseInt(limit));
  
  const totalCount = userTranscripts.length;
  const retentionDate = new Date(Date.now() - (TRANSCRIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000));
  
  res.json({
    transcripts: sortedTranscripts,
    totalCount,
    hasMore: totalCount > (offset + parseInt(limit)),
    retentionPolicy: {
      days: TRANSCRIPT_RETENTION_DAYS,
      cutoffDate: retentionDate
    }
  });
});

// Get transcript statistics
app.get('/api/user/:userId/transcript-stats', (req, res) => {
  const { userId } = req.params;
  const userTranscripts = conversationTranscripts.get(userId) || [];
  
  const last7Days = userTranscripts.filter(t => 
    t.timestamp > new Date(Date.now() - (7 * 24 * 60 * 60 * 1000))
  );
  
  const subjectBreakdown = userTranscripts.reduce((acc, t) => {
    const subject = t.metadata.subject || 'Unknown';
    acc[subject] = (acc[subject] || 0) + 1;
    return acc;
  }, {});
  
  res.json({
    totalTranscripts: userTranscripts.length,
    last7DaysCount: last7Days.length,
    subjectBreakdown,
    retentionDays: TRANSCRIPT_RETENTION_DAYS
  });
});

// Reset conversation context
app.post('/api/chat/reset', (req, res) => {
  const { userId, subject, yearLevel } = req.body || {};
  const conversationKey = getConversationKey(userId || 'anonymous', subject || 'Mathematics', yearLevel || 7);
  
  const existed = conversations.has(conversationKey);
  conversations.delete(conversationKey);
  
  console.log(`🔄 Conversation reset requested for ${conversationKey}`);
  
  res.json({ 
    success: true, 
    message: existed ? 'Conversation context reset - ready for a fresh start!' : 'No existing conversation found',
    conversationId: conversationKey 
  });
});

// Get conversation status
app.get('/api/chat/status/:userId', (req, res) => {
  const { userId } = req.params;
  const userConversations = Array.from(conversations.entries())
    .filter(([key]) => key.startsWith(userId))
    .map(([key, conv]) => ({
      id: key,
      subject: conv.subject,
      yearLevel: conv.yearLevel,
      curriculum: conv.curriculum,
      messageCount: conv.messages.length,
      totalTokens: conv.totalTokens,
      createdAt: conv.createdAt,
      lastActive: conv.lastActive,
      ageInMinutes: Math.round((Date.now() - conv.createdAt) / (1000 * 60)),
      curriculumLoaded: conv.curriculumLoaded,
      lastCurriculumTopic: conv.lastCurriculumTopic
    }))
    .sort((a, b) => b.lastActive - a.lastActive);

  res.json({
    conversations: userConversations,
    totalConversations: userConversations.length,
    totalActiveConversations: conversations.size
  });
});

// Stubs for auth/profile
app.post('/api/login', (req, res) => res.json({ ok: true }));
app.post('/api/register', (req, res) => res.json({ ok: true }));
app.get('/api/user', (req, res) => res.json({ ok: true }));

// Debug
app.get('/debug', (req, res) => {
  const conversationStats = Array.from(conversations.values()).reduce((acc, conv) => {
    acc.totalMessages += conv.messages.length;
    acc.totalTokens += conv.totalTokens;
    acc.subjects[conv.subject] = (acc.subjects[conv.subject] || 0) + 1;
    return acc;
  }, { totalMessages: 0, totalTokens: 0, subjects: {} });

  res.json({
    claudeApiKey: process.env.CLAUDE_API_KEY ? 'Configured ✅' : 'Missing ❌',
    claudeClient: !!anthropic,
    port: PORT,
    model: 'claude-3-5-haiku-20241022',
    features: {
      socraticMethod: 'Enhanced ✅',
      contextManagement: 'Improved ✅',
      conversationPersistence: 'Enabled ✅',
      smartSummarization: 'Enabled ✅',
      optimizedPrompts: 'Enabled ✅',
      limitedHistory: 'Smart Management ✅',
      reducedTokens: 'Enabled ✅',
      latex: 'Enabled with KaTeX ✅',
      docx: 'Enabled ✅',
      pdf: 'Enabled ✅ (pdfkit)',
      mathRendering: 'KaTeX ✅',
      curriculumIntegration: 'Year 7 NSW ✅',
      scopeValidation: 'Enabled ✅',
    },
    conversations: {
      active: conversations.size,
      ...conversationStats
    },
    curriculum: {
      loaded: !!curriculum,
      topics: curriculum?.topic_catalog?.length || 0,
      version: curriculum?.meta?.version || 'unknown'
    }
  });
});

// Cleanup job - run every hour
// Find this existing cleanup job near the end of your server.js file (around line 800+):
setInterval(() => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let cleaned = 0;
  
  for (const [key, conv] of conversations.entries()) {
    if (conv.lastActive < oneWeekAgo) {
      conversations.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} old conversations`);
  }
  
  // ADD THIS: Clean old transcripts
  cleanOldTranscripts();
}, 60 * 60 * 1000); // 1 hour

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('🤖 Claude 3.5 Haiku ready with enhanced Socratic method and context management!');
  console.log('✨ Features: Persistent conversations, smart summarization, progressive learning');
  console.log(`📚 Year 7 NSW Curriculum loaded: ${curriculum?.topic_catalog?.length || 0} topics`);
});

module.exports = app;