const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3001;

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
  
  // Topic detection patterns
  const topicPatterns = {
    'Algebra & Equations': [
      'equation', 'solve', 'x', 'y', 'variable', 'unknown', 'algebra',
      'linear', 'expression', 'coefficient', 'term', 'simplify',
      'substitute', 'formula', 'function', '=', 'equals'
    ],
    'Geometry & Measurement': [
      'angle', 'triangle', 'rectangle', 'circle', 'area', 'perimeter',
      'volume', 'measurement', 'length', 'width', 'height', 'degrees',
      'polygon', 'coordinate', 'transformation', 'shape'
    ],
    'Fractions & Decimals': [
      'fraction', 'decimal', 'percentage', 'numerator', 'denominator',
      'equivalent', 'convert', 'ratio', 'proportion', '/', 'percent'
    ],
    'Numbers & Indices': [
      'power', 'exponent', 'square', 'cube', 'root', 'index', 'indices',
      'scientific notation', 'standard form', '^', 'squared', 'cubed'
    ],
    'Statistics & Data': [
      'statistics', 'data', 'graph', 'chart', 'mean', 'median', 'mode',
      'range', 'probability', 'survey', 'sample', 'population', 'average'
    ]
  };
  
  // Count matches for each topic
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
  
  // Define ALL off-topic keywords/phrases - much more comprehensive
  const offTopicKeywords = [
    // Personal/inappropriate
    'religion', 'politics', 'political', 'vote', 'election', 'government',
    'sex', 'dating', 'boyfriend', 'girlfriend', 'drugs', 'alcohol',
    'personal information', 'address', 'phone number', 'password',
    
    // Non-educational
    'video games', 'movies', 'tv show', 'celebrity', 'music', 'sports',
    'social media', 'instagram', 'tiktok', 'youtube',
    
    // Inappropriate requests
    'homework answers', 'do my homework', 'give me the answer',
    'write my essay', 'complete this for me',
    
    // Personal advice/counseling (NEW - STRICT)
    'my teacher', 'teacher said', 'teacher thinks', 'teacher gave me',
    'bad marks', 'poor grades', 'failing', 'study habits', 'study tips',
    'how to study', 'motivation', 'feeling sad', 'upset about',
    'parents said', 'mom said', 'dad said', 'family thinks',
    'friends think', 'classmates', 'bullying', 'stress',
    'anxiety about', 'worried about', 'scared of', 'nervous',
    'life advice', 'what should i do', 'personal problem',
    'relationship', 'friendship', 'argument with',
    'career advice', 'future plans', 'what job', 'university',
    'personal story', 'tell you about', 'happened to me',
    'advice about', 'help me with my', 'opinion on',
    'thoughts on', 'what do you think about me'
  ];
  
  // Check for off-topic content
  const containsOffTopic = offTopicKeywords.some(keyword => 
    message_lower.includes(keyword)
  );
  
  if (containsOffTopic) {
    return false;
  }
  
  // STRICT: Only allow if it contains MATHEMATICAL content
  const mathKeywords = {
    'Algebra & Equations': [
      'equation', 'solve', 'x', 'y', 'variable', 'unknown', 'algebra',
      'linear', 'expression', 'coefficient', 'term', 'simplify',
      'substitute', 'formula', 'function', 'graph', 'slope',
      '+', '-', '=', 'equals', 'add', 'subtract', 'multiply', 'divide'
    ],
    'Mathematics': [
      'math', 'maths', 'calculate', 'number', 'equation', 'fraction',
      'decimal', 'percentage', 'geometry', 'area', 'perimeter', 'volume',
      'algebra', 'statistics', 'probability', 'graph', 'measurement',
      '+', '-', '×', '÷', '=', 'equals', 'formula', 'solve'
    ]
  };
  
  const relevantKeywords = mathKeywords[subject] || mathKeywords['Mathematics'];
  
  // Must contain mathematical content
  const containsMath = relevantKeywords.some(keyword => 
    message_lower.includes(keyword)
  );
  
  // Only allow specific mathematical help phrases
  const allowedHelpPhrases = [
    'solve this', 'help with this equation', 'explain this formula',
    'how do i solve', 'what is the answer to', 'step by step',
    'show me how', 'work through this', 'calculate this',
    'find the value', 'what does this equal'
  ];
  
  const containsValidHelp = allowedHelpPhrases.some(phrase => 
    message_lower.includes(phrase)
  );
  
  // Must contain either math keywords OR valid mathematical help request
  return containsMath || containsValidHelp;
}

// Function to create curriculum-specific system prompt
function createSystemPrompt(subject, yearLevel, curriculum) {
  const basePrompt = `You are StudyBuddy, an AI learning companion helping Year ${yearLevel} students with ${subject} following the ${curriculum} curriculum.

STUDENT CONTEXT:
- Year Level: ${yearLevel} (ages ${yearLevel + 5}-${yearLevel + 6})
- Curriculum: ${curriculum} Education Standards Authority
- Subject Focus: ${subject}
- Location: Australia`;

  // Subject-specific curriculum details
  const subjectDetails = {
    'Algebra & Equations': `
ALGEBRA & EQUATIONS CURRICULUM (Year ${yearLevel}):
- Solving linear equations with one variable
- Substitution into algebraic expressions
- Expanding and factoring simple expressions
- Understanding variables and unknowns
- Graphing linear relationships
- Number patterns and sequences

Key Skills to Develop:
- Using pronumerals to represent variables
- Solving equations by inspection and systematic methods
- Understanding the balance method for equations
- Connecting algebra to real-world contexts`,

    'Geometry & Measurement': `
GEOMETRY & MEASUREMENT CURRICULUM (Year ${yearLevel}):
- Angle relationships and properties
- Area and perimeter of composite shapes
- Volume and surface area of prisms
- Coordinate geometry basics
- Geometric transformations
- Scale and similarity

Key Skills to Develop:
- Using geometric reasoning
- Applying measurement formulas
- Understanding geometric properties`,

    'Numbers & Indices': `
NUMBERS & INDICES CURRICULUM (Year ${yearLevel}):
- Index notation and laws
- Powers and roots
- Scientific notation
- Rational and irrational numbers
- Number operations and order
- Estimation and approximation

Key Skills to Develop:
- Understanding index laws
- Working with powers of 10
- Converting between forms`,

    'Mathematics': `
MATHEMATICS CURRICULUM (Year ${yearLevel}):
- Number and Algebra: integers, fractions, decimals, percentages, basic algebra
- Measurement and Geometry: area, perimeter, volume, angles, coordinate geometry  
- Statistics and Probability: data collection, graphing, basic probability

Key Skills to Develop:
- Mathematical reasoning and problem-solving
- Communication of mathematical ideas
- Connection between mathematical concepts`
  };

  const curriculumDetail = subjectDetails[subject] || subjectDetails['Mathematics'];

  return basePrompt + curriculumDetail + `

TEACHING APPROACH:
- Use ${curriculum} curriculum terminology and Australian contexts
- Guide discovery learning through questioning (Socratic method)
- Break problems into Year ${yearLevel} appropriate steps
- Encourage mathematical reasoning and explanation of working
- Connect new learning to prior Year ${yearLevel - 1} knowledge
- Build readiness for Year ${yearLevel + 1} concepts
- Reference real Australian examples when helpful

RESPONSE STYLE:
- Ask guiding questions: "What do you notice?" "How might we start?"
- Use encouraging language: "You're on the right track!" "Let's think together!"
- Suggest multiple approaches when appropriate
- Help students self-check through questioning
- Keep responses concise and age-appropriate
- ONLY discuss ${subject} topics - redirect off-topic questions

IMPORTANT RESTRICTIONS:
- ONLY discuss mathematical problems, equations, and calculations
- DO NOT provide personal advice, study tips, or life guidance
- DO NOT discuss teachers, grades, personal feelings, or school experiences
- DO NOT answer questions about motivation, study habits, or academic performance
- Redirect ALL non-mathematical questions back to ${subject} problems
- Focus exclusively on mathematical concepts and problem-solving
- If asked about anything personal or non-mathematical, respond: "I can only help with ${subject} problems. Please share a mathematical equation or problem for me to help with."

Remember: You are STRICTLY a ${subject} problem-solving assistant for Year ${yearLevel} students. Nothing else.`;
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

// Chat route with Claude integration and all protections
app.post('/api/chat', async (req, res) => {
  console.log('\n🚀 === CHAT REQUEST ===');
  console.log('📋 Body:', req.body);
  
  const { message, subject, yearLevel = 7, curriculum = 'NSW', conversationHistory, userId } = req.body;
  
  // Detect specific mathematical topic from the message content
  const detectedTopic = detectMathematicalTopic(message);
  console.log(`🎯 Auto-detected topic: ${detectedTopic} (frontend sent: ${subject})`);
  
  // Use detected topic for more precise tutoring
  const actualSubject = detectedTopic;
  
  // Log the detected context
  console.log(`🎓 Context: Year ${yearLevel} ${curriculum} ${actualSubject}`);
  
  // Check token limits for input
  const inputTokens = estimateTokens(message);
  if (inputTokens > 3000) {
    console.log('❌ Input too long:', inputTokens, 'tokens');
    return res.json({
      response: "That message is quite long! Could you break it down into a shorter question? I work best with messages under 3000 characters.",
      subject: actualSubject,
      yearLevel: yearLevel,
      error: 'input_too_long'
    });
  }
  
  // Check if the message is on-topic
  if (!isOnTopic(message, actualSubject)) {
    console.log('❌ Off-topic message detected');
    return res.json({
      response: `I can only help with Year ${yearLevel} mathematics problems. Please share a mathematical equation or problem for me to help with.`,
      subject: actualSubject,
      yearLevel: yearLevel,
      error: 'off_topic'
    });
  }
  
  // If no Claude API, send fallback
  if (!anthropic) {
    console.log('⚠️  Using fallback response (no Claude API)');
    return res.json({
      response: `I'm ready to help with Year ${yearLevel} ${actualSubject}! You asked: "${message}". (Note: Add CLAUDE_API_KEY to .env for full AI responses)`,
      subject: actualSubject,
      yearLevel: yearLevel,
      fallback: true
    });
  }
  
  try {
    console.log('🤖 Calling Claude API...');
    console.log('📚 Conversation history length:', conversationHistory ? conversationHistory.length : 0);
    console.log('🔢 Input tokens estimate:', inputTokens);
    
    // Create context-aware system prompt with detected topic
    const systemPrompt = createSystemPrompt(actualSubject, yearLevel, curriculum);
    console.log('📝 System prompt created for:', actualSubject, 'Year', yearLevel, curriculum);

    // Use conversation history if available, otherwise just the current message
    const messages = conversationHistory && conversationHistory.length > 0 
      ? conversationHistory 
      : [{ role: 'user', content: message }];

    console.log('📝 Sending to Claude with auto-detected topic prompt');

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 3000, // Limited to 3000 tokens output
      system: systemPrompt,
      messages: messages
    });

    const responseText = response.content[0].text;
    const outputTokens = estimateTokens(responseText);
    
    console.log('✅ Claude responded successfully!');
    console.log('📝 Response length:', responseText.length);
    console.log('🔢 Output tokens estimate:', outputTokens);
    
    // Log token usage for user tracking
    if (userId) {
      console.log(`👤 User ${userId} used ${inputTokens + outputTokens} tokens this request`);
    }
    
    // Double-check output isn't too long (though max_tokens should handle this)
    if (outputTokens > 3000) {
      console.log('⚠️  Response too long, truncating...');
      const truncatedResponse = responseText.substring(0, 2800) + "... (I'll keep my responses shorter next time!)";
      
      return res.json({
        response: truncatedResponse,
        subject: actualSubject,
        detectedTopic: detectedTopic,
        yearLevel: yearLevel,
        curriculum: curriculum,
        powered_by: 'Claude API',
        truncated: true,
        tokens: {
          input: inputTokens,
          output: estimateTokens(truncatedResponse)
        }
      });
    }
    
    res.json({
      response: responseText,
      subject: actualSubject,
      detectedTopic: detectedTopic,
      yearLevel: yearLevel,
      curriculum: curriculum,
      powered_by: 'Claude API',
      tokens: {
        input: inputTokens,
        output: outputTokens
      }
    });
    
  } catch (error) {
    console.error('❌ Claude API Error:', error.message);
    
    // Send fallback response on error
    res.json({
      response: `I'm having a technical issue right now, but I'm still here to help with Year ${yearLevel} mathematics! You asked: "${message}". Could you try rephrasing your question?`,
      subject: actualSubject,
      detectedTopic: detectedTopic,
      yearLevel: yearLevel,
      curriculum: curriculum,
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
    nodeVersion: process.version,
    features: {
      tokenLimiting: 'Enabled ✅',
      topicFiltering: 'Enabled ✅',
      contextAwareness: 'Enabled ✅',
      curriculumAlignment: 'NSW Year 7 ✅',
      autoTopicDetection: 'Enabled ✅',
      userTracking: 'Enabled ✅'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/`);
  console.log(`🔍 Debug info: http://localhost:${PORT}/debug`);
  
  if (anthropic) {
    console.log('🤖 Claude AI ready to help students!');
  } else {
    console.log('📝 Running in fallback mode - add CLAUDE_API_KEY to enable AI');
  }
  
  console.log('\n🛡️  PROTECTIONS ENABLED:');
  console.log('✅ Input token limiting (3000 max)');
  console.log('✅ Output token limiting (3000 max)');
  console.log('✅ Topic filtering (blocks off-topic)');
  console.log('✅ Context awareness (Year 7 NSW)');
  console.log('✅ Curriculum alignment');
  console.log('✅ Auto topic detection');
  console.log('✅ User tracking');
});

module.exports = app;