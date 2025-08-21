import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function TutorApp({ userProfile, onLogout, setUserProfile }) {
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(null);
  const [worksheetSettings, setWorksheetSettings] = useState({
    topic: 'algebra',
    difficulty: 'medium',
    questionCount: 10
  });
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Use userProfile from props or fallback to default
  const profile = userProfile || {
    name: 'Alex',
    subscription: 'Premium',
    tokensUsed: 1247,
    tokensLimit: 5000,
    streakDays: 5
  };

  // Fetch current token usage when component loads or user changes
  useEffect(() => {
    const fetchTokenUsage = async () => {
      if (profile.childName || profile.name) {
        try {
          const userId = profile.childName || profile.name || 'Alex';
          const response = await fetch(`http://localhost:3001/api/user/${userId}/tokens`);
          const data = await response.json();
          
          if (response.ok && setUserProfile) {
            setUserProfile(prev => ({
              ...prev,
              tokensUsed: data.tokensUsed,
              tokensLimit: data.tokensLimit
            }));
          }
        } catch (error) {
          console.error('Error fetching token usage:', error);
        }
      }
    };

    fetchTokenUsage();
  }, [profile.name, profile.childName, setUserProfile]);

  // Text-to-Speech function
  const speakMessage = (text, messageId) => {
    window.speechSynthesis.cancel();
    
    if (isPlaying === messageId) {
      setIsPlaying(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Google') || 
      voice.name.includes('Microsoft') ||
      voice.lang === 'en-AU'
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setIsPlaying(messageId);
    utterance.onend = () => setIsPlaying(null);
    utterance.onerror = () => setIsPlaying(null);

    window.speechSynthesis.speak(utterance);
  };

  const handleGenerateWorksheet = async () => {
    setIsGenerating(true);
    
    try {
      const response = await fetch('http://localhost:3001/api/generate-worksheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: worksheetSettings.topic,
          difficulty: worksheetSettings.difficulty,
          questionCount: worksheetSettings.questionCount,
          yearLevel: 7,
          curriculum: 'NSW',
          userId: profile.childName || profile.name || 'Alex'
        })
      });
  
      const data = await response.json();
      
      if (response.ok) {
        setGeneratedQuestions(data.questions);
      }
    } catch (error) {
      console.error('Error generating worksheet:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogout = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(null);
    setSelectedSubject(null);
    setMessages([]);
    
    if (onLogout) {
      onLogout();
    }
  };

  const handleSubjectClick = (subject) => {
    setSelectedSubject(subject);
    
    if (subject === 'AI Tutor') {
      const welcomeMessage = {
        id: 1,
        text: `Hi there! I'm StudyBuddy, your AI learning companion! I can see you're a Year 7 student wanting to work on ${subject}.

I'm here to help you think through problems step by step. I won't just give you answers - instead, I'll guide you to discover solutions yourself. That's how real learning happens!

You can type math expressions naturally like "2x + 5 = 15" or "x^2 + 3x - 4" and I'll understand them.

What ${subject.toLowerCase()} problem are you working on today?`,
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    } else if (subject === 'Worksheet Generator') {
      // Initialize worksheet generator mode
      setMessages([]);
    }
  };

  // Add to TutorApp


const exportToPDF = async () => {
  const element = document.getElementById('worksheet-content');
  const canvas = await html2canvas(element);
  const imgData = canvas.toDataURL('image/png');
  
  const pdf = new jsPDF();
  const imgWidth = 210;
  const pageHeight = 295;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  
  let position = 0;
  
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  
  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  
  pdf.save(`${worksheetSettings.topic}-worksheet.pdf`);
};

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    console.log('Frontend: Starting to send message...');
    console.log('Message:', inputMessage);
    
    const newMessage = {
      id: messages.length + 1,
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };
    
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    const currentMessage = inputMessage;
    setInputMessage('');
    
    try {
      // Prepare conversation history for Claude
      const conversationHistory = updatedMessages
        .filter(msg => msg.sender !== 'bot' || !msg.text.includes('StudyBuddy, your AI learning companion'))
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));
      
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentMessage,
          subject: 'Mathematics',
          yearLevel: 7,
          curriculum: 'NSW',
          conversationHistory: conversationHistory,
          userId: profile.childName || profile.name || 'Alex',
          messageType: 'structured_text'
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Update token usage from backend response
        if (data.tokens && userProfile && setUserProfile) {
          setUserProfile(prev => ({
            ...prev,
            tokensUsed: data.tokens.totalUsed || prev.tokensUsed,
            tokensLimit: data.tokens.limit || prev.tokensLimit
          }));
        }
        
        const botResponse = {
          id: updatedMessages.length + 1,
          text: data.response,
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botResponse]);
      } else {
        const errorResponse = {
          id: updatedMessages.length + 1,
          text: data.error || "Sorry, I'm having trouble right now. Please try again!",
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorResponse]);
      }
    } catch (error) {
      console.error('Frontend API Error:', error);
      
      const errorResponse = {
        id: updatedMessages.length + 1,
        text: "I'm having trouble connecting right now. Please check that the backend is running!",
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorResponse]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleBackToSubjects = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(null);
    setSelectedSubject(null);
    setMessages([]);
  };

  // Calculate token usage percentage
  const tokenPercentage = Math.round((profile.tokensUsed / profile.tokensLimit) * 100);

  if (selectedSubject === 'Worksheet Generator') {
    return (
      <div className="app chat-mode">
        {/* Header */}
        <div className="chat-header">
          <button className="back-button" onClick={handleBackToSubjects}>
            ← Back
          </button>
          <div className="topic-badge">
            Worksheet Generator
          </div>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>

        {/* Worksheet Generator Interface */}
        <div className="worksheet-container">
          <div className="worksheet-settings">
            <h2>Create Custom Worksheet</h2>
            
            <div className="setting-group">
              <label htmlFor="topic">Topic</label>
              <select 
                id="topic"
                value={worksheetSettings.topic}
                onChange={(e) => setWorksheetSettings(prev => ({...prev, topic: e.target.value}))}
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
                onChange={(e) => setWorksheetSettings(prev => ({...prev, difficulty: e.target.value}))}
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
                onChange={(e) => setWorksheetSettings(prev => ({...prev, questionCount: parseInt(e.target.value)}))}
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
    {generatedQuestions.length > 0 ? (
      <div>
        <h4>Year 7 {worksheetSettings.topic} - {worksheetSettings.difficulty} Level</h4>
        <div dangerouslySetInnerHTML={{ __html: generatedQuestions }} />
        <button onClick={exportToPDF} className="export-button">
          Download PDF
        </button>
      </div>
    ) : (
      <p>Select your preferences and click "Generate Worksheet" to create custom practice problems.</p>
    )}
  </div>
</div>
        </div>
      </div>
    );
  }

  if (selectedSubject) {
    return (
      <div className="app chat-mode">
        {/* Chat Header */}
        <div className="chat-header">
          <button className="back-button" onClick={handleBackToSubjects}>
            ← Back
          </button>
          <div className="topic-badge">
            {selectedSubject}
          </div>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>

        {/* Chat Messages */}
        <div className="chat-container">
          <div className="messages-area">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.sender}`}>
                <div className="message-avatar">
                  {message.sender === 'bot' ? 'SB' : (profile.childName || profile.name || 'User').charAt(0)}
                </div>
                <div className="message-content">
                  <div className="message-text">
                    {message.text}
                  </div>
                  <div className="message-footer">
                    <div className="message-time">
                      {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    {message.sender === 'bot' && (
                      <button 
                        className={`voice-button ${isPlaying === message.id ? 'playing' : ''}`}
                        onClick={() => speakMessage(message.text, message.id)}
                        title={isPlaying === message.id ? 'Stop audio' : 'Listen to message'}
                      >
                        {isPlaying === message.id ? '⏸️' : '🔊'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="chat-input-container">
            <div className="input-wrapper">
              <div className="input-section">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Tell me what you're working on or type your solution step by step..."
                  className="math-text-input"
                  rows="2"
                />
              </div>
              
              <button 
                onClick={handleSendMessage}
                className="send-button"
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

  return (
    <div className="app">
      {/* Header with user info */}
      <div className="app-header">
        <div className="user-info">
          <span className="user-name">Welcome back, {profile.childName || profile.name}!</span>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* Subscription and Usage Info */}
      <div className="subscription-card">
        <div className="subscription-info">
          <div className="subscription-tier">
            <span className="tier-badge">{profile.subscription}</span>
            <span className="tier-description">Unlimited AI tutoring</span>
          </div>
          <div className="usage-info">
            <div className="tokens-usage">
              <span className="usage-label">Tokens Used</span>
              <span className="usage-count">{profile.tokensUsed.toLocaleString()} / {profile.tokensLimit.toLocaleString()}</span>
              <div className="usage-bar">
                <div 
                  className="usage-fill" 
                  style={{width: `${tokenPercentage}%`}}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Welcome Section */}
      <div className="welcome-card">
        <div className="streak-badge">
          {profile.streakDays} Day Streak!<br/>
          <span>Keep it up!</span>
        </div>
        <h1 className="welcome-title">Ready to learn?</h1>
        <p className="welcome-subtitle">Year 7 Mathematics • Last session: Indices</p>
      </div>

      {/* Main Learning Section */}
      <div className="main-section">
        <h2 className="section-title">What would you like to work on today?</h2>
        
        <div className="subject-grid">
          <div 
            className="subject-card"
            onClick={() => handleSubjectClick('AI Tutor')}
          >
            <div className="subject-icon">AI</div>
            <h3 className="subject-title">AI Tutor</h3>
            <p className="subject-description">
              Get personalized help with any mathematics topic
            </p>
          </div>
          
          <div 
            className="subject-card"
            onClick={() => handleSubjectClick('Worksheet Generator')}
          >
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