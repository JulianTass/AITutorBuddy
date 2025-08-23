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
  const [transcriptStats, setTranscriptStats] = useState(null);
  
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

  // Profile fallbacks
  const profile = userProfile || {
    name: 'Alex',
    subscription: 'Premium',
    tokensUsed: 1247,
    tokensLimit: 5000,
    streakDays: 5,
  };

  // Mobile detection effect


  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchTranscriptStats = async () => {
      const userId = profile.childName || profile.name;
      if (!userId) return;
  
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/${userId}/transcript-stats`);
        const data = await res.json();
        if (res.ok) {
          setTranscriptStats(data);
        }
      } catch (e) {
        console.error('Error fetching transcript stats:', e);
      }
    };
  
    fetchTranscriptStats();
  }, [profile.name, profile.childName]);

  // 👇 Add this near the top of TutorApp.js (inside your component)
const refreshTranscriptStats = React.useCallback(async () => {
  const rawId = profile.childName || profile.name;
  if (!rawId) return;

  const userId = encodeURIComponent(rawId);
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/${userId}/transcript-stats`);
    const data = await res.json();
    if (res.ok) {
      setTranscriptStats(data);
    }
  } catch (e) {
    console.error('Error fetching transcript stats:', e);
  }
}, [profile.name, profile.childName]);

useEffect(() => {
  refreshTranscriptStats();
}, [refreshTranscriptStats]);


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

  // Fetch token usage on mount
  useEffect(() => {
    const fetchTokenUsage = async () => {
      const userId = profile.childName || profile.name;
      if (!userId || !setUserProfile) return;

      try {
        const res = await fetch(`${API_BASE_URL}/api/user/${userId}/tokens`);
        const data = await res.json();
        if (res.ok) {
          setUserProfile(prev => ({
            ...prev,
            tokensUsed: data.tokensUsed,
            tokensLimit: data.tokensLimit,
          }));
        }
      } catch (e) {
        console.error('Error fetching token usage:', e);
      }
    };

    fetchTokenUsage();
  }, [profile.name, profile.childName, setUserProfile]);

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
  const sendMessageToAI = async (messageText, diagramContext = '', nextMessageId = null) => {
    const newMsg = {
      id: nextMessageId || messages.length + 1,
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };
    
    let history;
    if (nextMessageId) {
      history = messages;
    } else {
      history = [...messages, newMsg];
      setMessages(history);
      setInputMessage('');
    }

    setTimeout(scrollToBottom, 50);

    try {
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
        }),
      });

      const data = await resp.json();

      if (resp.ok) {
        if (data.tokens && setUserProfile) {
          setUserProfile(prev => ({
            ...prev,
            tokensUsed: data.tokens.totalUsed || data.tokens.userTotal || prev.tokensUsed,
            tokensLimit: data.tokens.limit || prev.tokensLimit,
          }));
        }

        setMessages(prev => [
          ...prev,
          {
            id: prev.length + 1,
            text: data.response,
            sender: 'bot',
            timestamp: new Date(),
            debug: data.debug,
            conversationLength: data.conversationLength
          },
        ]);
      } else {
        console.error('Chat API error:', data);
        setMessages(prev => [
          ...prev,
          {
            id: prev.length + 1,
            text: data.error || "Sorry, I'm having trouble right now. Please try again!",
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
      
      setMessages([{
        id: 1,
        text: "Great! I've cleared our conversation history. What new math problem would you like to work on?",
        sender: 'bot',
        timestamp: new Date(),
      }]);
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

I can also show you helpful diagrams when I detect geometry or visual problems. Just type your question naturally!

What ${subject.toLowerCase()} problem are you working on today?`,
          sender: 'bot',
          timestamp: new Date(),
        },
      ]);
    } else {
      setMessages([]);
    }
  };

  const handleBackToSubjects = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(null);
    setSelectedSubject(null);
    setMessages([]);
    setShowDiagramPopup(false);
    setDiagramDetection(null);
    setPendingMessage(null);
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

  const tokenPercentage =
    profile.tokensLimit > 0 ? Math.round((profile.tokensUsed / profile.tokensLimit) * 100) : 0;

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
                    Year 7 {worksheetSettings.topic} – {worksheetSettings.difficulty} Level
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
        <p className="welcome-subtitle">Year 7 Mathematics • Last session: Indices</p>
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
      {transcriptStats && (
  <div className="transcript-info-card">
    <h3>Conversation History</h3>
    <p>Total conversations: {transcriptStats.totalTranscripts}</p>
    <p>Last 7 days: {transcriptStats.last7DaysCount}</p>
    <small>Transcripts available for {transcriptStats.retentionDays} days</small>
  </div>
)}
    </div>
  );
}

export default TutorApp;