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

// For DOCX and PDF output
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
const PORT = 3001;

// In-memory storage (use Redis/DB in production)
const userTokenUsage = new Map();
const conversations = new Map();
const curriculumCache = new Map();

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
  // Find topic-specific data
  const topicData = curriculum.topic_catalog.find(t => 
    t.topic.toLowerCase().includes(topic.toLowerCase()) ||
    t.subtopics.some(sub => topic.toLowerCase().includes(sub.toLowerCase()))
  );
  
  // Build core rules
  const coreRules = curriculum.system_rules.join(' ');
  const styleGuide = curriculum.style_guidelines.tone + ', ' + curriculum.style_guidelines.format.join(' then ');
  
  let topicContext = '';
  let scaffoldInstructions = '';
  
  if (topicData) {
    topicContext = '\nTOPIC: ' + topicData.topic;
    topicContext += '\nSCOPE: ' + topicData.subtopics.slice(0, 4).join(', ');
    topicContext += '\nALLOWED: ' + topicData.allowed_verbs.join(', ');
    
    // Enhanced scaffold matching - more specific and comprehensive
    const relevantScaffolds = findRelevantScaffolds(topicData, topic);
    
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
      
      scaffoldInstructions += '\n\nWhen you recognize a problem that matches these scaffolds:';
      scaffoldInstructions += '\n1. Identify which scaffold applies';
      scaffoldInstructions += '\n2. Ask a question that leads to Step 1';
      scaffoldInstructions += '\n3. Only proceed to the next step after student engagement';
      scaffoldInstructions += '\n4. Use the scaffold steps as your roadmap for questioning';
    }
    
    // Add misconception warning
    const misconception = curriculum.common_misconceptions.find(m => 
      topicData.topic.includes(m.topic)
    );
    if (misconception) {
      topicContext += '\nWATCH: ' + misconception.pattern + ' - fix: ' + misconception.fix;
    }
  }
  
  const fullPrompt = 'You are StudyBuddy, NSW Year 7 mathematics tutor.\n\n' +
    'CORE RULES: ' + coreRules + '\n' +
    'STYLE: ' + styleGuide + 
    topicContext + 
    scaffoldInstructions + '\n\n' +
    'CRITICAL: Use Socratic method ONLY - ask guiding questions, NEVER give direct answers or final results.\n' +
    'Never use emojis. Ask ONE question at a time. Guide discovery step by step.\n' +
    'When teaching procedures, ask questions that lead students through the exact scaffold steps.\n' +
    'ALWAYS follow the scaffold steps when they apply to the student\'s question.';
  
  return fullPrompt;
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
  
  // First check if it's asking for a definition/explanation of a Year 7 term
  const definitionKeywords = ['what is', 'define', 'meaning of', 'explain', 'definition'];
  const isDefinitionRequest = definitionKeywords.some(keyword => msg.includes(keyword));
  
  if (isDefinitionRequest) {
    // Check against curriculum glossary and common Year 7 math terms
    const year7Terms = [
      // From curriculum glossary verbs
      ...curriculum.glossary.verbs.map(v => v.term),
      // Common Year 7 algebra terms
      'coefficient', 'variable', 'constant', 'term', 'expression', 'equation',
      'factor', 'multiple', 'prime', 'fraction', 'decimal', 'percentage',
      'ratio', 'area', 'perimeter', 'angle', 'parallel', 'perpendicular',
      'mean', 'median', 'mode', 'range', 'probability'
    ];
    
    const termRequested = year7Terms.find(term => 
      msg.includes(term.toLowerCase())
    );
    
    if (termRequested) {
      console.log(`📖 Definition request for Year 7 term: ${termRequested}`);
      return { inScope: true, definitionRequest: termRequested };
    }
  }
  
  // Check if topic exists in Year 7 curriculum
  const validTopic = curriculum.topic_catalog.some(t => 
    t.topic.toLowerCase().includes(topic.toLowerCase()) ||
    t.subtopics.some(sub => topic.toLowerCase().includes(sub.toLowerCase()))
  );
  
  if (!validTopic) {
    return {
      inScope: false,
      refusal: curriculum.refusal_messages[0].replace('<prerequisite>', 'basic Year 7 concepts').replace('<suggestion>', 'a Year 7 topic like fractions or basic algebra')
    };
  }
  
  return { inScope: true };
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
  if (curriculumCache.has(topic)) {
    return curriculumCache.get(topic);
  }
  
  const topicData = curriculum.topic_catalog.find(t => 
    t.topic.toLowerCase().includes(topic.toLowerCase())
  );
  
  if (!topicData) {
    curriculumCache.set(topic, '');
    return '';
  }
  
  const context = `Y7 ${topicData.topic}: ${topicData.subtopics.slice(0, 3).join(', ')}`;
  curriculumCache.set(topic, context);
  return context;
}

// --- Enhanced Topic Detection with Curriculum ---
function detectMathematicalTopicWithCurriculum(message, existingConversation = null) {
  const msg = (message || '').toLowerCase();
  
  // If we have an existing conversation and this looks like a follow-up,
  // keep the same topic to maintain context
  if (existingConversation && existingConversation.subject !== 'Mathematics') {
    const followUpIndicators = [
      /^\d+$/, // Just a number
      /^(yes|no|ok|right|correct|wrong)$/,
      /^(we|do|can|should|will|then|next|now|it|this|that)/,
      /^[+\-*/=().\d\s]+$/,
      // Add more follow-up patterns for definitions/explanations
      /^(not sure|don't know|confused|help|what|how)/,
      /^(i think|maybe|perhaps|could it be)/
    ];
    
    const isFollowUp = followUpIndicators.some(pattern => pattern.test(msg.trim())) || msg.length < 20;
    
    if (isFollowUp) {
      console.log(`🔗 Detected follow-up question, maintaining topic: ${existingConversation.subject}`);
      return existingConversation.subject;
    }
  }
  
  // First check against curriculum topics
  for (const topicData of curriculum.topic_catalog) {
    const topicKeywords = [
      ...topicData.subtopics.map(s => s.toLowerCase()),
      ...topicData.allowed_verbs.map(v => v.toLowerCase()),
      topicData.topic.toLowerCase()
    ];
    
    if (topicKeywords.some(keyword => msg.includes(keyword))) {
      console.log(`📖 Curriculum match: ${topicData.topic}`);
      return topicData.topic;
    }
  }
  
  // Fallback to original detection
  const topicPatterns = {
    'Algebra & Equations': ['equation', 'solve', 'x', 'y', 'variable', 'algebra', '=', 'unknown', 'coefficient', 'term', 'constant'],
    'Geometry': ['angle', 'triangle', 'area', 'perimeter', 'shape', 'circle', 'rectangle'],
    'Fractions & Percentages': ['fraction', 'decimal', 'percentage', '/', 'percent', 'ratio'],
    'Number Operations': ['add', 'subtract', 'multiply', 'divide', 'division', 'multiplication', 'times', 'plus', 'minus'],
    'Indices': ['power', 'exponent', 'square', 'cube', '^', 'index', 'indices'],
    'Analysing Data': ['data', 'graph', 'mean', 'median', 'average', 'mode', 'range'],
    'Number Theory': ['prime', 'factor', 'multiple', 'divisible', 'remainder'],
  };
  
  let bestTopic = 'Mathematics';
  let bestScore = 0;
  for (const [topic, keywords] of Object.entries(topicPatterns)) {
    const score = keywords.filter(k => msg.includes(k)).length;
    if (score > bestScore) { bestScore = score; bestTopic = topic; }
  }
  
  return bestTopic;
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
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

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

// IMPROVED CHAT WITH CURRICULUM INTEGRATION
app.post('/api/chat', async (req, res) => {
  console.log('\n🚀 === CHAT REQUEST ===');

  const { 
    message, 
    subject = 'Mathematics', 
    yearLevel = 7, 
    curriculum = 'NSW', 
    userId = 'anonymous',
    resetContext = false,
    // Ignore conversationHistory from frontend - we manage it server-side now
    conversationHistory, // eslint-disable-line no-unused-vars
    messageType // eslint-disable-line no-unused-vars
  } = req.body || {};

  console.log(`📨 Message: "${message}" from user: ${userId}`);

  // First, check ALL existing conversations for this user to find the most recent one
  const userConversations = Array.from(conversations.entries())
    .filter(([key]) => key.startsWith(userId))
    .sort(([,a], [,b]) => b.lastActive - a.lastActive);

  console.log(`👤 Found ${userConversations.length} existing conversations for user ${userId}`);

  let mostRecentConversation = null;
  let mostRecentKey = null;

  if (userConversations.length > 0) {
    [mostRecentKey, mostRecentConversation] = userConversations[0];
    const timeSinceLastActive = Date.now() - mostRecentConversation.lastActive;
    console.log(`⏰ Most recent conversation: ${mostRecentKey}, ${Math.round(timeSinceLastActive / 1000 / 60)} minutes ago`);
  }

  // Detect topic with curriculum awareness
  const detectedTopic = detectMathematicalTopic(message, mostRecentConversation);
  console.log(`🎯 Topic: ${detectedTopic}`);

  // Check Year 7 scope
  const scopeCheck = checkYear7Scope(message, detectedTopic);
  
  // Handle definition requests with Socratic responses BEFORE scope check
  if (scopeCheck.definitionRequest) {
    const definition = getYear7Definition(scopeCheck.definitionRequest);
    if (definition) {
      console.log(`📖 Providing Socratic definition for: ${scopeCheck.definitionRequest}`);
      
      // Create or update conversation for this definition topic
      let definitionConversation = conversations.get(getConversationKey(userId, 'Algebra & Equations', yearLevel));
      if (!definitionConversation) {
        definitionConversation = {
          messages: [],
          totalTokens: 0,
          subject: 'Algebra & Equations',
          yearLevel,
          curriculum,
          createdAt: new Date(),
          lastActive: new Date(),
          curriculumLoaded: true,
          lastCurriculumTopic: 'Algebra & Equations'
        };
      }
      
      // Add the definition exchange to conversation
      definitionConversation.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date()
      });
      
      definitionConversation.messages.push({
        role: 'assistant', 
        content: definition.socratic,
        timestamp: new Date()
      });
      
      definitionConversation.lastActive = new Date();
      conversations.set(getConversationKey(userId, 'Algebra & Equations', yearLevel), definitionConversation);
      
      return res.json({
        response: definition.socratic,
        subject: 'Algebra & Equations',
        detectedTopic: 'Algebra & Equations',
        yearLevel,
        curriculum,
        conversationLength: definitionConversation.messages.length,
        conversationId: getConversationKey(userId, 'Algebra & Equations', yearLevel),
        definitionProvided: scopeCheck.definitionRequest
      });
    }
  }
  
  if (!scopeCheck.inScope) {
    console.log(`🚫 Out of Year 7 scope: ${detectedTopic}`);
    return res.json({
      response: scopeCheck.refusal,
      error: 'out_of_scope',
      detectedTopic,
      yearLevel,
      curriculum
    });
  }

  // Get conversation key
  const conversationKey = getConversationKey(userId, detectedTopic, yearLevel);
  console.log(`🔑 Conversation key: ${conversationKey}`);
  
  // Reset context if requested
  if (resetContext) {
    conversations.delete(conversationKey);
    console.log(`🔄 Reset conversation context for ${conversationKey}`);
  }

  let conversation = conversations.get(conversationKey);

  // If no exact conversation exists, try to continue the most recent one
  if (!conversation && mostRecentConversation) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    // If the most recent conversation is less than 5 minutes old, continue it
    if (mostRecentConversation.lastActive > fiveMinutesAgo) {
      console.log(`🔗 Continuing recent conversation from ${mostRecentKey}`);
      conversation = mostRecentConversation;
      
      // Handle topic change
      const topicChanged = handleTopicChange(conversation, detectedTopic, message);
      if (topicChanged) {
        conversation.lastActive = new Date();
        
        // If the key is different, migrate the conversation
        if (mostRecentKey !== conversationKey) {
          conversations.delete(mostRecentKey);
          conversations.set(conversationKey, conversation);
          console.log(`📝 Migrated conversation from ${mostRecentKey} to ${conversationKey}`);
        }
      }
    }
  }
  
  // If still no conversation, create new one
  if (!conversation) {
    console.log(`✨ Creating new conversation for ${conversationKey}`);
    conversation = {
      messages: [],
      totalTokens: 0,
      subject: detectedTopic,
      yearLevel,
      curriculum,
      createdAt: new Date(),
      lastActive: new Date(),
      curriculumLoaded: false,
      lastCurriculumTopic: null
    };
  } else {
    console.log(`📚 Using existing conversation with ${conversation.messages.length} messages`);
  }

  // Update last active time
  conversation.lastActive = new Date();

  const inputTokens = estimateTokens(message || '');
  if (inputTokens > 1000) {
    return res.json({
      response: 'That\'s quite a lot to work with! Can you break that down and ask me about just one part of your problem? What\'s the main thing you\'re stuck on?',
      error: 'input_too_long',
    });
  }

  if (!isOnTopic(message, detectedTopic)) {
    return res.json({
      response: `I'm here to help you discover answers in Year 7 mathematics! What specific math problem or concept would you like to explore? What are you curious about?`,
      error: 'off_topic',
    });
  }

  if (!anthropic) {
    return res.json({
      response: `Great question about ${detectedTopic}! What do you think might be the first step? What comes to mind when you look at this problem? (Add CLAUDE_API_KEY for AI responses)`,
      fallback: true,
    });
  }

  try {
    // Add new user message to conversation
    conversation.messages.push({ 
      role: 'user', 
      content: message,
      timestamp: new Date()
    });

    console.log(`💬 Added message. Total messages: ${conversation.messages.length}`);

    // Smart context management - keep recent messages but summarize old ones
    let messagesToSend = [...conversation.messages];
    let contextSummary = '';

    // Check if we need curriculum context
    const needsCurriculumContext = !conversation.curriculumLoaded || 
                                   conversation.lastCurriculumTopic !== detectedTopic;

    if (needsCurriculumContext) {
      const curriculumContext = getCurriculumContext(detectedTopic);
      if (curriculumContext) {
        messagesToSend.unshift({
          role: 'system',
          content: `[${curriculumContext}]`
        });
        console.log(`📖 Added curriculum context: ${curriculumContext}`);
      }
      conversation.curriculumLoaded = true;
      conversation.lastCurriculumTopic = detectedTopic;
    }

    // If conversation is getting long, summarize older parts
    if (messagesToSend.length > 14) {
      const oldMessages = messagesToSend.slice(0, -10); // Keep last 10 messages
      contextSummary = summarizeOldContext(oldMessages);
      messagesToSend = messagesToSend.slice(-10);
      
      // Add summary as context if we have old messages
      if (contextSummary) {
        messagesToSend.unshift({ 
          role: 'system', 
          content: contextSummary 
        });
      }
      console.log(`📝 Summarized ${oldMessages.length} old messages, keeping ${messagesToSend.length} recent ones`);
    }

    // Clean messages for Claude (remove timestamps and system messages)
    const cleanMessages = messagesToSend
      .filter(m => m.role !== 'system' || m.content.startsWith('Earlier in our conversation') || m.content.startsWith('[Y7'))
      .map(m => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.role === 'system' ? `[Context: ${m.content}]` : m.content
      }));

    const systemPrompt = createSystemPrompt(conversation.subject, yearLevel, curriculum);

    console.log(`🤖 Sending ${cleanMessages.length} messages to Claude for ${conversation.subject}`);
    console.log(`📋 Recent messages: ${cleanMessages.slice(-3).map(m => `${m.role}: "${m.content.substring(0, 30)}..."`).join(', ')}`);

    const claudeResponse = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 180, // Reduced for more concise responses
      system: systemPrompt,
      messages: cleanMessages,
    });

    const responseText = claudeResponse.content?.[0]?.text || 'What do you think we should try next? What comes to mind?';
    
    // Add assistant response to conversation
    conversation.messages.push({ 
      role: 'assistant', 
      content: responseText,
      timestamp: new Date()
    });

    // Update token usage - be more accurate about what we're actually using
    const actualInputTokens = claudeResponse.usage?.input_tokens || inputTokens;
    const actualOutputTokens = claudeResponse.usage?.output_tokens || estimateTokens(responseText);
    
    conversation.totalTokens += actualInputTokens + actualOutputTokens;

    // Update user token usage
    const currentUsage = userTokenUsage.get(userId) || { used: 0, limit: 5000 };
    currentUsage.used += actualInputTokens + actualOutputTokens;
    userTokenUsage.set(userId, currentUsage);

    console.log(`🪙 Tokens - Input: ${actualInputTokens}, Output: ${actualOutputTokens}, User Total: ${currentUsage.used}/${currentUsage.limit}`);

    // Save updated conversation
    conversations.set(conversationKey, conversation);

    // Clean up very old conversations (keep last 50 per user, remove conversations older than 7 days)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const allUserConversations = Array.from(conversations.entries())
      .filter(([key]) => key.startsWith(userId))
      .sort(([,a], [,b]) => b.lastActive - a.lastActive);
    
    // Remove old conversations
    allUserConversations.forEach(([key, conv], index) => {
      if (index >= 50 || conv.lastActive < oneWeekAgo) {
        conversations.delete(key);
      }
    });

    console.log(`✅ Response generated. Conversation length: ${conversation.messages.length}`);

    res.json({
      response: responseText,
      subject: conversation.subject,
      detectedTopic,
      yearLevel,
      curriculum,
      conversationLength: conversation.messages.length,
      conversationAge: Math.round((Date.now() - conversation.createdAt) / (1000 * 60)), // minutes
      powered_by: 'Claude 3.5 Haiku',
      tokens: {
        input: actualInputTokens,
        output: actualOutputTokens,
        conversationTotal: conversation.totalTokens,
        totalUsed: currentUsage.used,  // This is what frontend expects
        userTotal: currentUsage.used,  // Keep both for compatibility
        limit: currentUsage.limit,
      },
      conversationId: conversationKey,
      curriculum: {
        topicInScope: scopeCheck.inScope,
        detectedTopic: detectedTopic
      },
      debug: {
        foundExistingConversations: userConversations.length,
        usedExistingConversation: !!mostRecentConversation,
        totalMessagesInConversation: conversation.messages.length,
        userId: userId,
        originalConversationKey: conversationKey,
        curriculumLoaded: conversation.curriculumLoaded,
        curriculumTopic: conversation.lastCurriculumTopic
      }
    });

  } catch (error) {
    console.error('❌ Claude API Error:', error.message);
    res.json({
      response: "I'm having a technical hiccup right now. While I sort this out, can you tell me what you were thinking about that problem? What approach were you considering?",
      error: true,
      fallback: true,
    });
  }

  console.log('=== CHAT REQUEST COMPLETE ===\n');
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
}, 60 * 60 * 1000); // 1 hour

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('🤖 Claude 3.5 Haiku ready with enhanced Socratic method and context management!');
  console.log('✨ Features: Persistent conversations, smart summarization, progressive learning');
  console.log(`📚 Year 7 NSW Curriculum loaded: ${curriculum?.topic_catalog?.length || 0} topics`);
});

module.exports = app;