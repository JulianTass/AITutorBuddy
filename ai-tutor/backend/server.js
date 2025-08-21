const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3001;

// In-memory token storage (use database in production)
const userTokenUsage = new Map();

// Initialize Claude - only if API key exists
let anthropic = null;
try {
  if (process.env.CLAUDE_API_KEY) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });
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

// Helper function to count tokens (rough estimate)
function estimateTokens(text) {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

// Function to detect mathematical topic from message content
function detectMathematicalTopic(message) {
  const message_lower = message.toLowerCase();
  
  const topicPatterns = {
    'Algebra': ['equation', 'solve', 'x', 'y', 'variable', 'algebra', '='],
    'Geometry': ['angle', 'triangle', 'area', 'perimeter', 'shape'],
    'Fractions': ['fraction', 'decimal', 'percentage', '/', 'percent'],
    'Indices': ['power', 'exponent', 'square', 'cube', '^'],
    'Statistics': ['data', 'graph', 'mean', 'median', 'average']
  };
  
  let bestTopic = 'Mathematics';
  let bestScore = 0;
  
  for (const [topic, keywords] of Object.entries(topicPatterns)) {
    const score = keywords.filter(keyword => message_lower.includes(keyword)).length;
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }
  
  return bestTopic;
}

// Helper function to check if content is on-topic
function isOnTopic(message, subject) {
  const message_lower = message.toLowerCase();
  
  // Allow homework help
  const homeworkHelp = ['help with homework', 'homework help', 'need help with', 'stuck on homework'];
  if (homeworkHelp.some(phrase => message_lower.includes(phrase))) {
    return true;
  }
  
  // Block off-topic
  const offTopic = ['religion', 'politics', 'dating', 'video games', 'movies', 'do my homework for me'];
  if (offTopic.some(keyword => message_lower.includes(keyword))) {
    return false;
  }
  
  // Must contain math content
  const mathKeywords = ['math', 'equation', 'solve', 'calculate', 'x', 'y', '+', '-', '=', 'formula'];
  return mathKeywords.some(keyword => message_lower.includes(keyword));
}

// Optimized system prompt - much shorter
function createSystemPrompt(subject, yearLevel, curriculum) {
  return `You are StudyBuddy, a Year ${yearLevel} ${curriculum} ${subject} tutor. Use Socratic questioning - ask "What do you notice?" instead of giving answers. Guide discovery learning. Keep responses under 150 words. Only discuss mathematics.`;
}

// Health check
app.get('/', (req, res) => {
  console.log('✅ Health check called');
  res.json({ 
    message: 'AI Tutor Backend is running!',
    claudeConfigured: !!anthropic,
    timestamp: new Date().toISOString()
  });
});

// Add to your server.js
app.post('/api/generate-worksheet', async (req, res) => {
  const { topic, difficulty, questionCount, yearLevel, curriculum, userId } = req.body;
  
  if (!anthropic) {
    return res.json({
      questions: [`Sample ${topic} question 1`, `Sample ${topic} question 2`],
      fallback: true
    });
  }

  try {
    const prompt = `Generate ${questionCount} ${difficulty} level ${topic} questions for Year ${yearLevel} ${curriculum} mathematics. 

Format as a numbered list with:
1. Clear, age-appropriate questions
2. Include answer space (Answer: _____) 
3. Ensure questions test different concepts within ${topic}
4. Match ${curriculum} curriculum standards

Topic: ${topic}
Difficulty: ${difficulty}
Student Level: Year ${yearLevel}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const questions = response.content[0].text;
    
    res.json({
      questions: questions,
      topic: topic,
      difficulty: difficulty,
      count: questionCount
    });
    
  } catch (error) {
    res.json({
      questions: "Error generating worksheet. Please try again.",
      error: true
    });
  }
});

// Get user token usage
app.get('/api/user/:userId/tokens', (req, res) => {
  const { userId } = req.params;
  const usage = userTokenUsage.get(userId) || { used: 0, limit: 5000 };
  
  res.json({
    tokensUsed: usage.used,
    tokensLimit: usage.limit,
    percentage: Math.round((usage.used / usage.limit) * 100)
  });
});

// Chat route with Claude 3.5 Haiku and optimized prompts
app.post('/api/chat', async (req, res) => {
  console.log('\n🚀 === CHAT REQUEST ===');
  
  const { message, subject, yearLevel = 7, curriculum = 'NSW', conversationHistory, userId } = req.body;
  
  // Detect topic
  const detectedTopic = detectMathematicalTopic(message);
  console.log(`🎯 Topic: ${detectedTopic}`);
  
  // Check token limits
  const inputTokens = estimateTokens(message);
  if (inputTokens > 1000) {
    return res.json({
      response: "Please keep your message shorter - I work best with concise questions.",
      error: 'input_too_long'
    });
  }
  
  // Check if on-topic
  if (!isOnTopic(message, detectedTopic)) {
    return res.json({
      response: `I can only help with Year ${yearLevel} mathematics problems. Please share a math question.`,
      error: 'off_topic'
    });
  }
  
  // Fallback if no API
  if (!anthropic) {
    return res.json({
      response: `I'm ready to help with ${detectedTopic}! You asked: "${message}". (Add CLAUDE_API_KEY for AI responses)`,
      fallback: true
    });
  }
  
  try {
    // Create short system prompt
    const systemPrompt = createSystemPrompt(detectedTopic, yearLevel, curriculum);
    console.log('📝 System prompt length:', systemPrompt.length, 'chars');

    // Limit conversation history to last 4 exchanges to control token usage
    const limitedHistory = conversationHistory && conversationHistory.length > 8 
      ? conversationHistory.slice(-8) 
      : conversationHistory || [];

    const messages = limitedHistory.length > 0 
      ? limitedHistory 
      : [{ role: 'user', content: message }];

    console.log('📝 Sending to Claude Haiku...');

    const claudeResponse = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Using Haiku instead of Sonnet
      max_tokens: 300, // Reduced from 3000
      system: systemPrompt,
      messages: messages
    });

    const responseText = claudeResponse.content[0].text;
    
    // Get actual token usage
    const actualInputTokens = claudeResponse.usage?.input_tokens || inputTokens;
    const actualOutputTokens = claudeResponse.usage?.output_tokens || estimateTokens(responseText);
    
    console.log('✅ Claude Haiku responded!');
    console.log('🔢 Tokens - Input:', actualInputTokens, 'Output:', actualOutputTokens);
    
    // Update token usage
    const currentUsage = userTokenUsage.get(userId) || { used: 0, limit: 5000 };
    currentUsage.used += (actualInputTokens + actualOutputTokens);
    userTokenUsage.set(userId, currentUsage);
    
    console.log(`👤 User ${userId} used ${actualInputTokens + actualOutputTokens} tokens this request`);
    console.log(`📊 Total usage: ${currentUsage.used}/${currentUsage.limit}`);
    
    res.json({
      response: responseText,
      subject: detectedTopic,
      detectedTopic: detectedTopic,
      yearLevel: yearLevel,
      curriculum: curriculum,
      powered_by: 'Claude 3.5 Haiku',
      tokens: {
        input: actualInputTokens,
        output: actualOutputTokens,
        totalUsed: currentUsage.used,
        limit: currentUsage.limit
      }
    });
    
  } catch (error) {
    console.error('❌ Claude API Error:', error.message);
    
    res.json({
      response: `I'm having a technical issue right now, but I'm still here to help with Year ${yearLevel} mathematics! Could you try rephrasing your question?`,
      error: true,
      fallback: true
    });
  }
  
  console.log('=== CHAT REQUEST COMPLETE ===\n');
});

app.post('/api/login', (req, res) => {
  // Handle login logic
});

app.post('/api/register', (req, res) => {
  // Handle registration
});

app.get('/api/user', (req, res) => {
  // Get user profile
});

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    claudeApiKey: process.env.CLAUDE_API_KEY ? 'Configured ✅' : 'Missing ❌',
    claudeClient: !!anthropic,
    port: PORT,
    model: 'claude-3-5-haiku-20241022',
    features: {
      optimizedPrompts: 'Enabled ✅',
      limitedHistory: 'Enabled ✅',
      reducedTokens: 'Enabled ✅'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('🤖 Claude 3.5 Haiku ready - optimized for low token usage!');
  
  console.log('\n🛡️  OPTIMIZATIONS ENABLED:');
  console.log('✅ Short system prompts (~25 tokens vs 1800)');
  console.log('✅ Claude 3.5 Haiku (80% cheaper)');
  console.log('✅ Limited conversation history');
  console.log('✅ Reduced max output tokens');
});

module.exports = app;