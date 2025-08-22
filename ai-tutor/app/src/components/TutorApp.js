// src/components/TutorApp.js
import React, { useEffect, useState } from 'react';

function TutorApp({ userProfile, onLogout, setUserProfile }) {
  // ---- App state ----
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(null);

  const [worksheetSettings, setWorksheetSettings] = useState({
    topic: 'algebra',
    difficulty: 'medium',
    questionCount: 10,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState(''); // preview HTML

  // ---- Profile (fallbacks) ----
  const profile = userProfile || {
    name: 'Alex',
    subscription: 'Premium',
    tokensUsed: 1247,
    tokensLimit: 5000,
    streakDays: 5,
  };

  // ---- Fetch token usage on mount / user change ----
  useEffect(() => {
    const fetchTokenUsage = async () => {
      const userId = profile.childName || profile.name;
      if (!userId || !setUserProfile) return;

      try {
        const res = await fetch(`http://localhost:3001/api/user/${userId}/tokens`);
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

  // ---- TTS ----
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

  // ---- Worksheet generation (server returns {html} or {questions}) ----
  const handleGenerateWorksheet = async () => {
    setIsGenerating(true);
    try {
      const resp = await fetch('http://localhost:3001/api/generate-worksheet', {
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

      // Accept { html } OR { questions: string[] }
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

  // ---- Server-rendered file downloads (PDF/DOCX) ----
  async function downloadWorksheetFile(fmt) {
    try {
      const resp = await fetch('http://localhost:3001/api/generate-worksheet-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: worksheetSettings.topic,
          difficulty: worksheetSettings.difficulty,
          questionCount: worksheetSettings.questionCount,
          yearLevel: 7,
          format: fmt, // 'pdf' | 'docx'
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

  // ---- Chat ----
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const newMsg = {
      id: messages.length + 1,
      text: inputMessage,
      sender: 'user',
      timestamp: new Date(),
    };
    const history = [...messages, newMsg];
    setMessages(history);
    setInputMessage('');

    try {
      // The backend now manages conversation history internally
      // We just need to send the current message and user info
      const resp = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newMsg.text,
          subject: 'Mathematics',
          yearLevel: 7,
          curriculum: 'NSW',
          userId: profile.childName || profile.name || 'Alex',
          // Remove conversationHistory - backend manages this now
          // resetContext: false // Only send this if you want to reset
        }),
      });

      const data = await resp.json();
      
      // Log debug info to help troubleshoot
      console.log('Chat response:', {
        conversationLength: data.conversationLength,
        detectedTopic: data.detectedTopic,
        conversationId: data.conversationId,
        debug: data.debug
      });

      if (resp.ok) {
        // Update token usage from backend response
        if (data.tokens && setUserProfile) {
          setUserProfile(prev => ({
            ...prev,
            tokensUsed: data.tokens.totalUsed || data.tokens.userTotal || prev.tokensUsed,
            tokensLimit: data.tokens.limit || prev.tokensLimit,
          }));
        }

        // Add the bot response
        setMessages(prev => [
          ...prev,
          {
            id: prev.length + 1,
            text: data.response,
            sender: 'bot',
            timestamp: new Date(),
            // Store debug info for troubleshooting
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
  };

  const handleResetContext = async () => {
    try {
      await fetch('http://localhost:3001/api/chat/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.childName || profile.name || 'Alex',
          subject: 'Mathematics',
          yearLevel: 7
        }),
      });
      
      // Clear local messages
      setMessages([{
        id: 1,
        text: "Great! I've cleared our conversation history. What new math problem would you like to work on?",
        sender: 'bot',
        timestamp: new Date(),
      }]);
      
      console.log('Conversation context reset successfully');
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

  // ---- Navigation / logout ----
  const handleSubjectClick = subject => {
    setSelectedSubject(subject);
    if (subject === 'AI Tutor') {
      setMessages([
        {
          id: 1,
          text: `Hi there! I'm StudyBuddy, your AI learning companion! I can see you're a Year 7 student wanting to work on ${subject}.

I'm here to help you think through problems step by step. I won't just give you answers - instead, I'll guide you to discover solutions yourself. That's how real learning happens!

You can type math expressions naturally like "2x + 5 = 15" or "x^2 + 3x - 4" and I'll understand them.

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
  };

  const handleLogout = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(null);
    setSelectedSubject(null);
    setMessages([]);
    onLogout?.();
  };

  // ---- Derived ----
  const tokenPercentage =
    profile.tokensLimit > 0 ? Math.round((profile.tokensUsed / profile.tokensLimit) * 100) : 0;

  // ================== Worksheet Generator ==================
  if (selectedSubject === 'Worksheet Generator') {
    return (
      <div className="app chat-mode">
        <div className="chat-header">
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

                  {/* Render worksheet preview */}
                  <div dangerouslySetInnerHTML={{ __html: generatedHtml }} />

                  {/* Export buttons */}
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

  // ================== Chat ==================
  if (selectedSubject) {
    return (
      <div className="app chat-mode">
      <div className="chat-header">
          <button className="back-button" onClick={handleBackToSubjects}>
            ← Back
          </button>
          <div className="topic-badge">{selectedSubject}</div>
          <div className="chat-controls">
            <button 
              className="reset-button" 
              onClick={handleResetContext}
              title="Start fresh conversation"
              style={{
                background: 'none',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '6px 12px',
                marginRight: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🔄 Reset
            </button>
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className="chat-container">
          <div className="messages-area">
            {messages.map(m => (
              <div key={m.id} className={`message ${m.sender}`}>
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
              </div>
            ))}
          </div>

          <div className="chat-input-container">
            <div className="input-wrapper">
              <div className="input-section">
                <textarea
                  className="math-text-input"
                  rows="2"
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Tell me what you're working on or type your solution step by step..."
                />
              </div>
              <button
                className="send-button"
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================== Landing ==================
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
    </div>
  );
}

export default TutorApp;
