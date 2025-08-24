// Enhanced TutorApp.js with mobile width fix
import React, { useEffect, useState, useRef } from 'react';
import './chat.css';
import InlineGeometryCanvas from './InlineGeometryCanvas';
import { detectMathDiagram, DiagramPopup } from './diagramDetector';
import InlineDiagramConfirm from './InlineDiagramConfirm';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function TutorApp({ userProfile, onLogout, setUserProfile }) {
  // App state
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(null);
  const [showTopicSelection, setShowTopicSelection] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTranscripts, setShowTranscripts] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [transcriptStats, setTranscriptStats] = useState(null);
  const [lastSessionTopics, setLastSessionTopics] = useState([]);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Diagram detection state
  const [diagramDetection, setDiagramDetection] = useState(null);
  const [showDiagramPopup, setShowDiagramPopup] = useState(false);
  const [pendingMessage, setPendingMessage] = useState(null);

  // Refs for auto-scroll
  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);

  const [worksheetSettings, setWorksheetSettings] = useState({
    topic: 'algebra',
    difficulty: 'medium',
    questionCount: 10,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState('');

  // Mobile detection effect
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll function
  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (messagesAreaRef.current) {
        messagesAreaRef.current.scrollTop = messagesAreaRef.current.scrollHeight;
      }
    });
  };

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch token usage on mount and periodically
  useEffect(() => {
    const fetchTokenUsage = async () => {
      const userId = userProfile?.childName || userProfile?.name || 'Alex';
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/${userId}/tokens`);
        const data = await res.json();
        if (res.ok && setUserProfile) {
          setUserProfile(prev => ({
            ...prev,
            tokensUsed: data.tokensUsed || 0,
            tokensLimit: data.tokensLimit || 5000,
          }));
          
          console.log(`Frontend: Fetched token usage ${data.tokensUsed}/${data.tokensLimit}`);
        }
      } catch (e) {
        console.error('Error fetching token usage:', e);
      }
    };

    // Fetch immediately on mount
    fetchTokenUsage();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(fetchTokenUsage, 30000);
    
    return () => clearInterval(interval);
  }, [userProfile?.name, userProfile?.childName, setUserProfile]);

  // Load last session data
  useEffect(() => {
    const loadLastSessionData = () => {
      try {
        const savedTopics = localStorage.getItem('lastSessionTopics');
        if (savedTopics) {
          const topics = JSON.parse(savedTopics);
          setLastSessionTopics(topics);
          console.log('Loaded last session topics:', topics);
        }
      } catch (error) {
        console.error('Error loading last session data:', error);
      }
    };

    loadLastSessionData();
  }, []);

  // Profile fallbacks - MOVED TO BE DYNAMIC
  const profile = userProfile || {
    name: 'Alex',
    subscription: 'Premium',
    tokensUsed: 1247,
    tokensLimit: 5000,
    streakDays: 5,
    lastSession: lastSessionTopics.length > 0 
      ? lastSessionTopics.join(', ') 
      : 'Indices' // fallback
  };

  const tokenPercentage =
    profile.tokensLimit > 0 ? Math.round((profile.tokensUsed / profile.tokensLimit) * 100) : 0;

  // Year 7 mathematics topics
  const year7Topics = [
    { id: 'integers', name: 'Integers', description: 'Operations with positive and negative numbers' },
    { id: 'fractions', name: 'Fractions & Percentages', description: 'Adding, subtracting, multiplying, and dividing fractions' },
    { id: 'algebra_basics', name: 'Algebra & Equations', description: 'Variables, expressions, and simple equations' },
    { id: 'angles', name: 'Angles & Parallel Lines', description: 'Types of angles, angle relationships' },
    { id: 'decimals', name: 'Decimals', description: 'Operations with decimals and place value' },
    { id: 'area_volume', name: 'Area & Volume', description: 'Area, perimeter, and properties of shapes' },
    { id: 'data', name: 'Analysing Data', description: 'Mean, median, mode, range, and data interpretation' },
    { id: 'probability', name: 'Probability', description: 'Basic probability concepts and calculations' },
    { id: 'ratios_rates', name: 'Ratios, Rates & Time', description: 'Understanding and solving ratio problems' }
  ];

  const fetchTranscripts = async () => {
    try {
      const userId = profile.childName || profile.name || 'Alex';
      const [transcriptsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/user/${userId}/transcripts`),
        fetch(`${API_BASE_URL}/api/user/${userId}/transcript-stats`)
      ]);
      
      if (transcriptsRes.ok && statsRes.ok) {
        const transcriptsData = await transcriptsRes.json();
        const statsData = await statsRes.json();
        setTranscripts(transcriptsData.transcripts);
        setTranscriptStats(statsData);
      }
    } catch (error) {
      console.error('Error fetching transcripts:', error);
    }
  };
  
  const downloadTranscript = (transcript) => {
    const content = `
  StudyBuddy Learning Session Transcript
  =====================================
  
  Student: ${transcript.userId}
  Date: ${new Date(transcript.timestamp).toLocaleString()}
  Subject: ${transcript.metadata.subject}
  Topic: ${transcript.metadata.detectedTopic}
  
  Conversation:
  -------------
  
  Student: ${transcript.message}
  
  StudyBuddy: ${transcript.response}
  
  Session Details:
  - Year Level: ${transcript.metadata.yearLevel}
  - Curriculum: ${transcript.metadata.curriculum}
  - Tokens Used: ${transcript.metadata.tokensUsed}
  ${transcript.metadata.diagramContext ? '- Visual Diagram Used: Yes' : ''}
  
  Generated by StudyBuddy AI Tutor
    `;
  
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StudyBuddy-Transcript-${new Date(transcript.timestamp).toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // TTS
  const speakMessage = (text, messageId) => {
    window.speechSynthesis.cancel();
    if (isPlaying === messageId) {
      setIsPlaying(null);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 1.0;
    u.volume = 0.8;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      v => v.name.includes('Google') || v.name.includes('Microsoft') || v.lang === 'en-AU'
    );
    if (preferred) u.voice = preferred;

    u.onstart = () => setIsPlaying(messageId);
    u.onend = () => setIsPlaying(null);
    u.onerror = () => setIsPlaying(null);
    window.speechSynthesis.speak(u);
  };

  // Enhanced send message with inline confirmation
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const detection = detectMathDiagram(inputMessage);
    
    const userMsg = {
      id: messages.length + 1,
      text: inputMessage,
      sender: 'user',
      timestamp: new Date(),
    };
    
    const history = [...messages, userMsg];
    setMessages(history);
    setInputMessage('');

    if (detection && detection.confidence > 0.3) {
      const geometryMsg = {
        id: history.length + 1,
        sender: 'geometry_confirm',
        timestamp: new Date(),
        shape: detection.shape,
        dimensions: detection.dimensions,
        detection: detection,
        collapsed: false,
        pendingMessage: userMsg.text
      };
      
      setMessages(prev => [...prev, geometryMsg]);
      return;
    }

    await sendMessageToAI(userMsg.text, '', history.length + 1);
  };

  // Handle diagram confirmation
  const handleConfirmInlineDiagram = (messageId, userMessage) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, sender: 'geometry_confirmed', confirmed: true }
        : msg
    ));
    
    const detection = messages.find(m => m.id === messageId)?.detection;
    const diagramContext = `[DIAGRAM SHOWN: ${detection.template} - ${detection.shape}]`;
    sendMessageToAI(userMessage, diagramContext, messageId + 1);
  };

  const handleDismissInlineDiagram = (messageId, userMessage) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
    sendMessageToAI(userMessage, '', messageId);
  };

  const handleCollapseDiagram = (messageId) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, collapsed: !msg.collapsed }
        : msg
    ));
  };

  // Diagram popup handlers
  const handleConfirmDiagram = async (detection) => {
    setShowDiagramPopup(false);
    
    const userMsg = {
      id: messages.length + 1,
      text: pendingMessage.text,
      sender: 'user',
      timestamp: pendingMessage.timestamp,
    };
    
    const history = [...messages, userMsg];
    setMessages(history);

    const geometryMsg = {
      id: history.length + 1,
      sender: 'geometry',
      timestamp: new Date(),
      shape: detection.shape,
      dimensions: detection.dimensions
    };
    
    setMessages(prev => [...prev, geometryMsg]);
    setInputMessage('');

    const diagramContext = `[DIAGRAM SHOWN: ${detection.template} - ${detection.shape} with dimensions: ${JSON.stringify(detection.dimensions)}]`;
    await sendMessageToAI(pendingMessage.text, diagramContext, history.length + 2);
    
    setDiagramDetection(null);
    setPendingMessage(null);
  };

  const handleUseWithoutDiagram = async () => {
    setShowDiagramPopup(false);
    await sendMessageToAI(pendingMessage.text);
    
    setDiagramDetection(null);
    setPendingMessage(null);
  };

  const handleEditDiagram = (detection) => {
    handleConfirmDiagram(detection);
  };

  const handleDismissDiagram = () => {
    setShowDiagramPopup(false);
    setDiagramDetection(null);
    setPendingMessage(null);
  };

  // Core AI communication
  const sendMessageToAI = async (
    messageText,
    diagramContext = '',
    nextMessageId = null,
    selectedTopicsParam = []
  ) => {
    if (!messageText || !String(messageText).trim()) return;
  
    // Build the user message object
    const newMsg = {
      id: nextMessageId || messages.length + 1,
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };
  
    // Decide whether to immediately append the user message
    // If nextMessageId was provided, we assume the caller already queued it in messages
    let history;
    if (nextMessageId) {
      history = messages;
    } else {
      history = [...messages, newMsg];
      setMessages(history);
      setInputMessage('');
    }
  
    // Ensure the chat scrolls down as we add messages
    setTimeout(scrollToBottom, 50);
  
    try {
      // If a diagram context exists, prepend it to the message so the backend sees it
      const contextualMessage = diagramContext
        ? `${diagramContext}\n\nStudent question: ${messageText}`
        : messageText;
  
      const resp = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: contextualMessage,
          subject: 'Mathematics',
          yearLevel: 7,
          curriculum: 'NSW',
          userId: profile.childName || profile.name || 'Alex',
          selectedTopics: Array.isArray(selectedTopicsParam) ? selectedTopicsParam : []
        }),
      });
  
      // Try to parse JSON, but fall back to text if the server returned HTML
      const contentType = resp.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const payload = isJson ? await resp.json() : { error: true, message: await resp.text() };
  
      if (resp.ok) {
        // Update token usage in profile (if server included it)
        if (payload.tokens && setUserProfile) {
          setUserProfile(prev => ({
            ...prev,
            tokensUsed: payload.tokens.used || prev.tokensUsed,
            tokensLimit: payload.tokens.limit || prev.tokensLimit,
          }));
          
          console.log(`Frontend: Token usage updated to ${payload.tokens.used}/${payload.tokens.limit}`);
        }
  
        // Append assistant/bot reply
        setMessages(prev => [
          ...prev,
          {
            id: prev.length + 1,
            text: payload.response || "I've processed your request.",
            sender: 'bot',
            timestamp: new Date(),
            debug: payload.debug,
            conversationLength: payload.conversationLength
          },
        ]);
      } else {
        console.error('Chat API error:', payload);
        setMessages(prev => [
          ...prev,
          {
            id: prev.length + 1,
            text:
              (payload && (payload.error || payload.message)) ||
              "Sorry, I'm having trouble right now. Please try again!",
            sender: 'bot',
            timestamp: new Date(),
          },
        ]);
      }
    } catch (e) {
      console.error('Frontend API Error:', e);
      setMessages(prev => [
        ...prev,
        {
          id: prev.length + 1,
          text: "I'm having trouble connecting right now. Please check that the backend is running!",
          sender: 'bot',
          timestamp: new Date(),
        },
      ]);
    }
  
    setTimeout(scrollToBottom, 100);
  };

  // Worksheet generation
  const handleGenerateWorksheet = async () => {
    setIsGenerating(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/generate-worksheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: worksheetSettings.topic,
          difficulty: worksheetSettings.difficulty,
          questionCount: worksheetSettings.questionCount,
          yearLevel: 7,
          curriculum: 'NSW',
          userId: profile.childName || profile.name || 'Alex',
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
      }

      const data = await resp.json();
      if (typeof data.html === 'string') {
        setGeneratedHtml(data.html);
      } else if (Array.isArray(data.questions)) {
        const html = `<ol>${data.questions.map(q => `<li>${String(q)}</li>`).join('')}</ol>`;
        setGeneratedHtml(html);
      } else {
        setGeneratedHtml('<p>Could not build preview.</p>');
      }
    } catch (e) {
      console.error(e);
      alert('Error generating worksheet: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

 
// Replace your handleConfirmTopics function with this corrected version:

const handleConfirmTopics = async () => {
  console.log('🔍 DEBUG: handleConfirmTopics called');
  console.log('🔍 selectedTopics:', selectedTopics);
  
  // Hide the topic selection interface
  setShowTopicSelection(false);

  // Get the topic objects from the selected topic IDs
  const topicContext = selectedTopics
    .map(id => {
      const found = year7Topics.find(t => t.id === id);
      console.log(`🔍 Looking for topic ID "${id}":`, found);
      return found;
    })
    .filter(Boolean);

  console.log('🔍 topicContext:', topicContext);

  // Extract topic names for display and storage
  const topicNames = topicContext.map(t => t.name);
  console.log('🔍 topicNames:', topicNames);
  
  // Save the last session topics to localStorage and state
  setLastSessionTopics(topicNames);
  localStorage.setItem('lastSessionTopics', JSON.stringify(topicNames));
  localStorage.setItem('lastSessionDate', new Date().toISOString());

  // Create the user message text
  const userMsg = `I'd like to focus on: ${topicNames.join(', ')}`;
  console.log('🔍 Final userMsg:', userMsg);
  
  // Use proper ID generation to avoid duplicates
  setMessages(prev => {
    const nextId = Math.max(...prev.map(m => m.id), 0) + 1;
    
    const userMessage = {
      id: nextId,
      text: userMsg,
      sender: 'user',
      timestamp: new Date(),
    };
    
    const confirmationMsg = {
      id: nextId + 1,
      text: `Perfect! You've chosen to focus on: ${topicNames.join(', ')}. Let me tailor my responses to help you with these specific areas.`,
      sender: 'bot',
      timestamp: new Date(),
    };
    
    const newMessages = [...prev, userMessage, confirmationMsg];
    
    // Schedule the Claude API call with the correct next ID
    setTimeout(async () => {
      console.log('🔍 About to call sendMessageToAI with:', {
        message: userMsg,
        selectedTopics: selectedTopics
      });
      await sendMessageToAI(userMsg, '', nextId + 2, selectedTopics);
    }, 1000);
    
    return newMessages;
  });
};

const handleTopicToggle = (topicId, topicName) => {
  console.log('🔍 handleTopicToggle called with:', { topicId, topicName });
  console.log('🔍 Current selectedTopics before toggle:', selectedTopics);
  
  setSelectedTopics(prev => {
    console.log('🔍 Previous selectedTopics:', prev);
    
    let newTopics;
    if (prev.includes(topicId)) {
      // Remove topic
      newTopics = prev.filter(id => id !== topicId);
      console.log('🔍 Removing topic, new array:', newTopics);
    } else {
      // Add topic
      newTopics = [...prev, topicId];
      console.log('🔍 Adding topic, new array:', newTopics);
    }
    
    return newTopics;
  });
};
  
  const handleRemoveTopic = (topicId) => {
    setSelectedTopics(prev => prev.filter(id => id !== topicId));
  };

  async function downloadWorksheetFile(fmt) {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/generate-worksheet-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: worksheetSettings.topic,
          difficulty: worksheetSettings.difficulty,
          questionCount: worksheetSettings.questionCount,
          yearLevel: 7,
          format: fmt,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${resp.status}`);
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fmt === 'docx' ? 'worksheet.docx' : 'worksheet.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to generate file: ' + e.message);
    }
  }

  const handleResetContext = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/chat/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.childName || profile.name || 'Alex',
          subject: 'Mathematics',
          yearLevel: 7
        }),
      });
      
      // Clear selected topics
      setSelectedTopics([]);
      
      // Set the messages to show topic selection again with unique IDs
      setMessages([
        {
          id: 1,
          text: `Great! I've cleared our conversation history. Let's start fresh!
  
  I'm here to help you think through problems step by step. I won't just give you answers - instead, I'll guide you to discover solutions yourself. That's how real learning happens!
  
  I can also show you helpful diagrams when I detect geometry or visual problems.
  
  What mathematics topic would you like to focus on today?`,
          sender: 'bot',
          timestamp: new Date(),
        },
        {
          id: 2,
          sender: 'topic_selection',
          timestamp: new Date(),
        },
      ]);
      
      // Show topic selection
      setShowTopicSelection(true);
      
    } catch (e) {
      console.error('Error resetting context:', e);
    }
  };
  const handleKeyPress = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Navigation / logout
  const handleSubjectClick = subject => {
    setSelectedSubject(subject);
    if (subject === 'AI Tutor') {
      setMessages([
        {
          id: 1,
          text: `Hi there! I'm StudyBuddy, your AI learning companion! I can see you're a Year 7 student wanting to work on ${subject}.

I'm here to help you think through problems step by step. I won't just give you answers - instead, I'll guide you to discover solutions yourself. That's how real learning happens!

I can also show you helpful diagrams when I detect geometry or visual problems.

What mathematics topic would you like to focus on today?`,
          sender: 'bot',
          timestamp: new Date(),
        },
        {
          id: 2,
          sender: 'topic_selection',
          timestamp: new Date(),
        },
      ]);
      setShowTopicSelection(true);
    } else {
      setMessages([]);
    }
  };

  const handleSkipTopicSelection = () => {
    setShowTopicSelection(false);
    setSelectedTopics([]); // Clear selected topics when skipping
    
    setMessages(prev => {
      const nextId = Math.max(...prev.map(m => m.id), 0) + 1;
      
      return [
        ...prev,
        {
          id: nextId,
          text: `I'll work on whatever comes up`,
          sender: 'user',
          timestamp: new Date(),
        },
        {
          id: nextId + 1,
          text: `That's great! I'm here to help with any Year 7 mathematics topic. Just type your question naturally and I'll guide you through it step by step. What would you like to work on?`,
          sender: 'bot',
          timestamp: new Date(),
        }
      ];
    });
  };

  // Filter topics based on search
  const filteredTopics = year7Topics.filter(topic =>
    !selectedTopics.includes(topic.id) && // Hide selected topics
    (topic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     topic.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleBackToSubjects = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(null);
    setSelectedSubject(null);
    setMessages([]);
    setShowDiagramPopup(false);
    setDiagramDetection(null);
    setPendingMessage(null);
    setSelectedTopics([]); 
    setShowTopicSelection(false); 
  };

  const handleLogout = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(null);
    setSelectedSubject(null);
    setMessages([]);
    setShowDiagramPopup(false);
    setDiagramDetection(null);
    setPendingMessage(null);
    onLogout?.();
  };

  // Mobile styles for full width
  const mobileContainerStyles = isMobile ? {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    maxWidth: '100vw',
    margin: 0,
    padding: 0,
    zIndex: 9999,
    boxSizing: 'border-box'
  } : {};

  const mobileFullWidthStyles = isMobile ? {
    width: '100vw',
    maxWidth: '100vw',
    boxSizing: 'border-box'
  } : {};

  // Worksheet Generator
  if (selectedSubject === 'Worksheet Generator') {
    return (
      <div className="app chat-mode" style={mobileContainerStyles}>
        <div className="chat-header" style={mobileFullWidthStyles}>
          <button className="back-button" onClick={handleBackToSubjects}>
            ← Back
          </button>
          <div className="topic-badge">Worksheet Generator</div>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="worksheet-container">
          <div className="worksheet-settings">
            <h2>Create Custom Worksheet</h2>

            <div className="setting-group">
              <label htmlFor="topic">Topic</label>
              <select
                id="topic"
                value={worksheetSettings.topic}
                onChange={e =>
                  setWorksheetSettings(prev => ({ ...prev, topic: e.target.value }))
                }
              >
                <option value="algebra">Algebra & Equations</option>
                <option value="geometry">Geometry & Measurement</option>
                <option value="fractions">Fractions & Decimals</option>
                <option value="indices">Numbers & Indices</option>
                <option value="statistics">Statistics & Data</option>
              </select>
            </div>

            <div className="setting-group">
              <label htmlFor="difficulty">Difficulty</label>
              <select
                id="difficulty"
                value={worksheetSettings.difficulty}
                onChange={e =>
                  setWorksheetSettings(prev => ({ ...prev, difficulty: e.target.value }))
                }
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="setting-group">
              <label htmlFor="questionCount">Number of Questions</label>
              <select
                id="questionCount"
                value={worksheetSettings.questionCount}
                onChange={e =>
                  setWorksheetSettings(prev => ({
                    ...prev,
                    questionCount: parseInt(e.target.value, 10),
                  }))
                }
              >
                <option value="5">5 Questions</option>
                <option value="10">10 Questions</option>
                <option value="15">15 Questions</option>
                <option value="20">20 Questions</option>
              </select>
            </div>

            <button
              className="generate-button"
              onClick={handleGenerateWorksheet}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Worksheet'}
            </button>
          </div>

          <div className="worksheet-preview">
            <h3>Preview</h3>
            <div id="worksheet-content" className="preview-content">
              {generatedHtml ? (
                <>
                  <h4>
                    Year 7 {worksheetSettings.topic} — {worksheetSettings.difficulty} Level
                  </h4>

                  <div dangerouslySetInnerHTML={{ __html: generatedHtml }} />

                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    <button
                      className="export-button"
                      onClick={() => downloadWorksheetFile('docx')}
                    >
                      Download Word (.docx)
                    </button>
                    <button
                      className="export-button"
                      onClick={() => downloadWorksheetFile('pdf')}
                    >
                      Download PDF
                    </button>
                  </div>
                </>
              ) : (
                <p>
                  Select your preferences and click <strong>Generate Worksheet</strong> to create
                  custom practice problems.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Transcript View
  if (showTranscripts) {
    return (
      <div className="app transcript-mode" style={mobileContainerStyles}>
        <div className="chat-header" style={mobileFullWidthStyles}>
          <button className="back-button" onClick={() => setShowTranscripts(false)}>
            ← Back
          </button>
          <div className="topic-badge">Learning History</div>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="transcript-container">
        {transcriptStats && (
          <div className="transcript-stats-card">
            <h2>Your Learning Journey</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-number">{transcriptStats.totalTranscripts}</span>
                <span className="stat-label">Total Sessions</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{transcriptStats.last7DaysCount}</span>
                <span className="stat-label">This Week</span>
              </div>
            </div>
          </div>
        )}

          <div className="transcript-list">
            <h3>Session History</h3>
            {transcripts.length === 0 ? (
              <p>No learning sessions yet. Start a conversation with StudyBuddy!</p>
            ) : (
              transcripts.map((transcript) => (
                <div key={transcript.id} className="transcript-item">
                  <div className="transcript-header">
                    <span className="transcript-date">
                      {new Date(transcript.timestamp).toLocaleDateString()}
                    </span>
                    <span className="transcript-topic">
                      {transcript.metadata.detectedTopic}
                    </span>
                  </div>
                  <div className="transcript-preview">
                    <strong>You asked:</strong> {transcript.message.substring(0, 100)}...
                  </div>
                  <div className="transcript-actions">
                    <button 
                      className="download-transcript-btn"
                      onClick={() => downloadTranscript(transcript)}
                    >
                      Download
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Chat Mode
  if (selectedSubject) {
    return (
      <div className="app chat-mode" style={mobileContainerStyles}>
        {showDiagramPopup && (
          <DiagramPopup
            detection={diagramDetection}
            onConfirm={handleConfirmDiagram}
            onEdit={handleEditDiagram}
            onDismiss={handleDismissDiagram}
            onUseWithoutDiagram={handleUseWithoutDiagram}
          />
        )}

        <div className="chat-header" style={mobileFullWidthStyles}>
          <button className="back-button" onClick={handleBackToSubjects}>
            ← Back
          </button>
          <div className="topic-badge">{selectedSubject}</div>
          <div className="chat-controls">
            <button 
              className="reset-button" 
              onClick={handleResetContext}
              title="Start fresh conversation"
            >
              Reset
            </button>
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className="chat-container" style={mobileFullWidthStyles}>
          <div 
            className="messages-area" 
            ref={messagesAreaRef}
            style={{
              ...mobileFullWidthStyles,
              ...(isMobile ? { padding: '12px' } : {})
            }}
          >
    {messages.map(m => (
    <div key={m.id} className={`message ${m.sender}`}>
      {(m.sender === 'user' || m.sender === 'bot') && (
        <>
          <div className="message-avatar">
            {m.sender === 'bot'
              ? 'SB'
              : (profile.childName || profile.name || 'U').charAt(0)}
          </div>
          <div className="message-content">
            <div className="message-text">{m.text}</div>
            <div className="message-footer">
              <div className="message-time">
                {m.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              {m.sender === 'bot' && (
                <button
                  className={`voice-button ${isPlaying === m.id ? 'playing' : ''}`}
                  onClick={() => speakMessage(m.text, m.id)}
                  title={isPlaying === m.id ? 'Stop audio' : 'Listen to message'}
                >
                  {isPlaying === m.id ? '⏸️' : '🔊'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
      
      {m.sender === 'topic_selection' && showTopicSelection && (
        <>
          <div className="message-avatar">SB</div>
          <div className="message-content">
            <div className="topic-selection-inline">
              <h3 className="topic-selection-title">Choose Your Focus Topics</h3>
              <p className="topic-selection-subtitle">Select one or more mathematics topics you'd like to work on, or skip to ask about anything</p>
              
              {/* Selected Topics Display */}
              {selectedTopics.length > 0 && (
                <div className="selected-topics-display">
                  <h4>Selected Topics:</h4>
                  <div className="selected-topics-list">
                    {selectedTopics.map((topicId) => {
                      const topic = year7Topics.find(t => t.id === topicId);
                      return (
                        <div key={topicId} className="selected-topic-chip">
                          <span className="selected-topic-name">{topic?.name}</span>
                          <button 
                            className="remove-topic-btn"
                            onClick={() => handleRemoveTopic(topicId)}
                            title={`Remove ${topic?.name}`}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="topic-search-container">
                <input
                  type="text"
                  placeholder="Search topics... (e.g., fractions, algebra, geometry)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="topic-search-input"
                />
              </div>
              
              <div className="topics-grid">
                {filteredTopics.map((topic) => (
                  <div
                  key={topic.id}
                  className={`topic-item ${selectedTopics.includes(topic.id) ? 'selected' : ''}`}
                  onClick={() => {
                    console.log('🔍 Topic clicked:', topic.id, topic.name);
                    handleTopicToggle(topic.id, topic.name);
                  }}
                >
                  <div className="topic-item-name">{topic.name}</div>
                  <div className="topic-item-description">{topic.description}</div>
                  {selectedTopics.includes(topic.id) && (
                    <div className="topic-selected-indicator">✓</div>
                  )}
                </div>
                ))}
              </div>
              
              {filteredTopics.length === 0 && (
                <div className="no-topics-found">
                  <p>No topics found matching "{searchTerm}"</p>
                  <p>Try searching for: algebra, fractions, geometry, or statistics</p>
                </div>
              )}
              
              <div className="topic-selection-actions">
                {selectedTopics.length > 0 && (
                  <button 
                    className="confirm-topics-button"
                    onClick={handleConfirmTopics}
                  >
                    Continue with {selectedTopics.length} topic{selectedTopics.length > 1 ? 's' : ''}
                  </button>
                )}
                <button 
                  className="skip-topic-button"
                  onClick={handleSkipTopicSelection}
                >
                  Skip - I'll ask about anything
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      
      {m.sender === 'geometry' && (
        <div className="message-content" style={{ marginLeft: '0px', maxWidth: '100%' }}>
          <InlineGeometryCanvas 
            shape={m.shape} 
            dimensions={m.dimensions} 
          />
        </div>
      )}

      {(m.sender === 'geometry_confirm' || m.sender === 'geometry_confirmed') && (
        <div className="message-content" style={{ marginLeft: '0px', maxWidth: '100%' }}>
          <InlineDiagramConfirm
            shape={m.shape}
            dimensions={m.dimensions}
            detection={m.detection}
            collapsed={m.collapsed}
            confirmed={m.sender === 'geometry_confirmed'}
            pendingMessage={m.pendingMessage}
            onConfirm={handleConfirmInlineDiagram}
            onDismiss={handleDismissInlineDiagram}
            onCollapse={handleCollapseDiagram}
            messageId={m.id}
          />
        </div>
      )}
    </div>
  ))}
              <div ref={messagesEndRef} />
            </div>

            <div 
              className="chat-input-container" 
              style={{
                ...mobileFullWidthStyles,
                ...(isMobile ? { padding: '12px' } : {})
              }}
            >
              <div 
                className="input-wrapper"
                style={isMobile ? { width: '100%', maxWidth: '100%' } : {}}
              >
                <div className="input-section">
                  <textarea
                    className="math-text-input"
                    rows="2"
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Tell me what you're working on or type your solution step by step..."
                    disabled={showDiagramPopup}
                    style={isMobile ? { width: '100%', maxWidth: '100%' } : {}}
                  />
                </div>
                <button
                  className="send-button"
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || showDiagramPopup}
                >
                  Send
                </button>
              </div>
              
              {showDiagramPopup && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#e7f3ff',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#0066cc'
                }}>
                  📊 I detected a diagram-worthy problem! Check the popup above to continue.
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Continue Session Feature
    const handleContinueLastSession = () => {
      if (lastSessionTopics.length === 0) return;
      
      // Find the topic IDs from names
      const topicIds = lastSessionTopics
        .map(name => year7Topics.find(t => t.name === name)?.id)
        .filter(Boolean);
      
      setSelectedTopics(topicIds);
      handleSubjectClick('AI Tutor');
      
      // Auto-confirm the last session topics
      setTimeout(() => {
        if (topicIds.length > 0) {
          handleConfirmTopics();
        }
      }, 500);
    };

    // Landing Page
    return (
      <div className="app">
        <div className="app-header">
          <div className="user-info">
            <span className="user-name">
              Welcome back, {profile.childName || profile.name}!
            </span>
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className="subscription-card">
          <div className="subscription-info">
            <div className="subscription-tier">
              <span className="tier-badge">{profile.subscription}</span>
              <span className="tier-description">Unlimited AI tutoring</span>
            </div>
            <div className="usage-info">
              <div className="tokens-usage">
                <span className="usage-label">Tokens Used</span>
                <span className="usage-count">
                  {profile.tokensUsed.toLocaleString()} / {profile.tokensLimit.toLocaleString()}
                </span>
                <div className="usage-bar">
                  <div className="usage-fill" style={{ width: `${tokenPercentage}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="welcome-card">
          <div className="streak-badge">
            {profile.streakDays} Day Streak!
            <br />
            <span>Keep it up!</span>
          </div>
          <h1 className="welcome-title">Ready to learn?</h1>
          <p className="welcome-subtitle">Year 7 Mathematics • Last session: {profile.lastSession}</p>
          
          {lastSessionTopics.length > 0 && (
            <div className="continue-session-section">
              <button 
                className="continue-session-button"
                onClick={handleContinueLastSession}
              >
                Continue with: {lastSessionTopics.join(', ')}
              </button>
            </div>
          )}
        </div>

        <div className="main-section">
          <h2 className="section-title">What would you like to work on today?</h2>

          <div className="subject-grid">
            <div className="subject-card" onClick={() => handleSubjectClick('AI Tutor')}>
              <div className="subject-icon">AI</div>
              <h3 className="subject-title">AI Tutor</h3>
              <p className="subject-description">
                Get personalized help with any mathematics topic
              </p>
            </div>

            <div className="subject-card" onClick={() => handleSubjectClick('Worksheet Generator')}>
              <div className="subject-icon">📄</div>
              <h3 className="subject-title">Worksheet Generator</h3>
              <p className="subject-description">
                Create custom practice worksheets for Year 7 mathematics
              </p>
            </div>
          </div>
        </div>

        <div className="transcripts-section">
          <div className="subject-card" onClick={() => {
            setShowTranscripts(true);
            fetchTranscripts();
          }} style={{ marginTop: '20px', maxWidth: '500px' }}>
            <div className="subject-icon">📋</div>
            <h3 className="subject-title">Transcripts</h3>
            <p className="subject-description">
              View and download your past learning sessions
            </p>
          </div>
        </div>
      </div>
    );
  }

  export default TutorApp;