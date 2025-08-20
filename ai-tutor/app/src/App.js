import React, { useState } from 'react';
import './styles.css';

function App() {
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(true); // Simulate logged in state
  const [userProfile, setUserProfile] = useState({
    name: 'Alex',
    subscription: 'Premium',
    tokensUsed: 1247,
    tokensLimit: 5000,
    streakDays: 5
  });

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setSelectedSubject(null);
    setMessages([]);
  };

  const handleSubjectClick = (subject) => {
    setSelectedSubject(subject);
    // Add initial bot message with context awareness
    setMessages([
      {
        id: 1,
        text: `Hi there! I'm StudyBuddy, your AI learning companion! I can see you're a Year 7 student wanting to work on ${subject}.\n\nI'm here to help you think through problems and discover answers together. I won't just give you answers - instead, I'll guide you to figure things out yourself. That's how real learning happens!\n\nWhat ${subject.toLowerCase()} problem are you working on today?`,
        sender: 'bot',
        timestamp: new Date()
      }
    ]);
  };

  const handleSendMessage = async () => {
    if (inputMessage.trim()) {
      console.log('Frontend: Starting to send message...');
      console.log('Message:', inputMessage);
      console.log('Subject:', selectedSubject);
      
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
        console.log('About to make API call to: http://localhost:3001/api/chat');
        
        // Prepare conversation history for Claude
        const conversationHistory = updatedMessages
          .filter(msg => msg.sender !== 'bot' || !msg.text.includes('StudyBuddy, your AI learning companion')) // Skip initial welcome message
          .map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          }));
        
        console.log('Sending conversation history:', conversationHistory);
        
        // Call your backend API - send "Mathematics" instead of specific subject
        const response = await fetch('http://localhost:3001/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: currentMessage,
            subject: 'Mathematics', // Backend will tune this to specific topics
            yearLevel: 7, // Automatically set Year 7
            curriculum: 'NSW', // Automatically set NSW curriculum
            conversationHistory: conversationHistory,
            userId: userProfile.name // For token tracking
          })
        });

        console.log('Response received, status:', response.status);
        console.log('Response ok:', response.ok);

        const data = await response.json();
        console.log('Response data:', data);
        
        if (response.ok) {
          // Update token usage if provided
          if (data.tokens) {
            setUserProfile(prev => ({
              ...prev,
              tokensUsed: prev.tokensUsed + (data.tokens.input + data.tokens.output)
            }));
          }

          // Add Claude's response
          const botResponse = {
            id: updatedMessages.length + 1,
            text: data.response,
            sender: 'bot',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, botResponse]);
          console.log('Success: Bot response added');
        } else {
          // Handle error response
          console.log('Error response from server:', data);
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
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        
        // Add error message to chat
        const errorResponse = {
          id: updatedMessages.length + 1,
          text: "I'm having trouble connecting right now. Please check that the backend is running!",
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorResponse]);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleBackToSubjects = () => {
    setSelectedSubject(null);
    setMessages([]);
  };

  // Calculate token usage percentage
  const tokenPercentage = Math.round((userProfile.tokensUsed / userProfile.tokensLimit) * 100);

  // Login screen
  if (!isLoggedIn) {
    return (
      <div className="app login-screen">
        <div className="login-card">
          <h1 className="login-title">Welcome to AI Tutor</h1>
          <p className="login-subtitle">Your personalized learning companion</p>
          <button onClick={handleLogin} className="login-button">
            Sign In
          </button>
          <p className="login-footer">Year 7 Mathematics • NSW Curriculum</p>
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
            🤖 {selectedSubject}
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
                  {message.sender === 'bot' ? 'SB' : userProfile.name.charAt(0)}
                </div>
                <div className="message-content">
                  <div className="message-text">{message.text}</div>
                  <div className="message-time">
                    {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="chat-input-container">
            <div className="input-wrapper">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Tell me what you're working on..."
                className="chat-input"
              />
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
          <span className="user-name">Welcome back, {userProfile.name}!</span>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* Subscription and Usage Info */}
      <div className="subscription-card">
        <div className="subscription-info">
          <div className="subscription-tier">
            <span className="tier-badge">{userProfile.subscription}</span>
            <span className="tier-description">Unlimited AI tutoring</span>
          </div>
          <div className="usage-info">
            <div className="tokens-usage">
              <span className="usage-label">Tokens Used</span>
              <span className="usage-count">{userProfile.tokensUsed.toLocaleString()} / {userProfile.tokensLimit.toLocaleString()}</span>
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
          🔥 {userProfile.streakDays} Day Streak!<br/>
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
            <div className="subject-icon">🤖</div>
            <h3 className="subject-title">AI Tutor</h3>
            <p className="subject-description">
              Get personalized help with any mathematics topic
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;