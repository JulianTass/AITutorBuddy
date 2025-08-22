/* eslint-disable no-console */
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Optional: robust HTML parsing. If not installed, we fall back to a regex.
let cheerio = null;
try { cheerio = require('cheerio'); } catch (_) { /* optional */ }

// Add katex for LaTeX rendering
const katex = require('katex');

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

// --- Helpers ---
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4); // rough
}

function detectMathematicalTopic(message, existingConversation = null) {
  const msg = (message || '').toLowerCase();
  
  // If we have an existing conversation and this looks like a follow-up,
  // keep the same topic to maintain context
  if (existingConversation && existingConversation.subject !== 'Mathematics') {
    const followUpIndicators = [
      // Short responses that are clearly continuing a conversation
      /^\d+$/, // Just a number
      /^(yes|no|ok|right|correct|wrong)$/,
      /^(we|do|can|should|will|then|next|now|it|this|that)/,
      // Mathematical operations without context
      /^[+\-*/=().\d\s]+$/
    ];
    
    const isFollowUp = followUpIndicators.some(pattern => pattern.test(msg.trim())) || msg.length < 15;
    
    if (isFollowUp) {
      console.log(`🔗 Detected follow-up question, maintaining topic: ${existingConversation.subject}`);
      return existingConversation.subject;
    }
  }
  
  const topicPatterns = {
    Algebra: ['equation', 'solve', 'x', 'y', 'variable', 'algebra', '=', 'unknown'],
    Geometry: ['angle', 'triangle', 'area', 'perimeter', 'shape', 'circle', 'rectangle'],
    Fractions: ['fraction', 'decimal', 'percentage', '/', 'percent', 'ratio'],
    'Number Operations': ['add', 'subtract', 'multiply', 'divide', 'division', 'multiplication', 'times', 'plus', 'minus'],
    Indices: ['power', 'exponent', 'square', 'cube', '^', 'index', 'indices'],
    Statistics: ['data', 'graph', 'mean', 'median', 'average', 'mode', 'range'],
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
  return `You are StudyBuddy, a ${curriculum} Year ${yearLevel} mathematics tutor specializing in ${subject}.

CORE PRINCIPLES:
- Use the Socratic method exclusively - NEVER give direct answers
- Ask guiding questions like "What do you notice?", "What happens if...?", "Can you tell me what this part means?"
- Break complex problems into tiny, manageable steps
- Wait for student responses before moving to the next step
- If student is stuck, give the tiniest hint possible, then ask another question
- Praise effort and thinking process, not just correct answers
- Keep responses under 80 words
- Stay focused on mathematics only
- Remember previous parts of our conversation to build understanding

CONVERSATION STYLE:
- Speak like you're explaining to a friend who's learning
- Use simple, clear language
- Be encouraging and patient
- Ask one question at a time
- Help them discover the answer themselves
- Use phrases like "What do you think?", "Can you spot a pattern?", "What would happen if...?"

EXAMPLE RESPONSES:
Instead of: "To solve 2x + 5 = 15, subtract 5 from both sides"
Say: "I see you have 2x + 5 = 15. What do you think we could do to get x by itself? What's the first step that comes to mind?"

Instead of: "The area of a circle is πr²"
Say: "Great question about circles! If you had a circle with radius 3, what do you think we'd need to know to find how much space it takes up?"

You maintain context of our entire conversation to guide learning progressively.`;
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

  const prompt = 'Create ' + questionCount + ' ' + difficulty + ' ' + topic + ' questions for Year ' + yearLevel + '.\n' +
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

// IMPROVED CHAT WITH BETTER CONTEXT MANAGEMENT
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

  // Detect topic with context awareness
  const detectedTopic = detectMathematicalTopic(message, mostRecentConversation);
  console.log(`🎯 Topic: ${detectedTopic}`);

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
      
      // Update the conversation topic if it changed
      conversation.subject = detectedTopic;
      conversation.lastActive = new Date();
      
      // If the key is different, migrate the conversation
      if (mostRecentKey !== conversationKey) {
        conversations.delete(mostRecentKey);
        conversations.set(conversationKey, conversation);
        console.log(`📝 Migrated conversation from ${mostRecentKey} to ${conversationKey}`);
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
      lastActive: new Date()
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
      response: `I'm here to help you discover answers in mathematics! What specific math problem or concept would you like to explore? What are you curious about?`,
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
      .filter(m => m.role !== 'system' || m.content.startsWith('Earlier in our conversation'))
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
      debug: {
        foundExistingConversations: userConversations.length,
        usedExistingConversation: !!mostRecentConversation,
        totalMessagesInConversation: conversation.messages.length,
        userId: userId,
        originalConversationKey: conversationKey
      }
    });

  } catch (error) {
    console.error('❌ Claude API Error:', error.message);
    res.json({
      response: "Hmm, I'm having a technical hiccup right now. While I sort this out, can you tell me what you were thinking about that problem? What approach were you considering?",
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
      ageInMinutes: Math.round((Date.now() - conv.createdAt) / (1000 * 60))
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
    },
    conversations: {
      active: conversations.size,
      ...conversationStats
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
});

module.exports = app;