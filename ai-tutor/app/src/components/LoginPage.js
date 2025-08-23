import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles.css';


function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    
    // Simple authentication - just check if username is "Alex"
    if (username.toLowerCase() === 'alex') {
      // Pass the login data to the parent component
      onLogin({ username: username, password: password });
      navigate('/app');
    } else {
      alert('Please enter "Alex" as username');
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className="app login-screen">
      <div className="login-card">
        <button 
          className="back-to-home-btn"
          onClick={handleBackToHome}
        >
          ← Back to Home
        </button>
        
        <h1 className="login-title">Sign in to AI Tutor</h1>
        <p className="login-subtitle">Welcome back to your personalized learning companion</p>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          
          <button type="submit" className="login-button">
            Sign In
          </button>
        </form>
        
        <div className="login-hint">
          <p>Demo: Username "Alex" with any password</p>
          <p>Don't have an account? <button 
            type="button" 
            onClick={() => navigate('/signup')} 
            className="signup-link"
          >
            Sign up here
          </button></p>
        </div>
        
        <p className="login-footer">Year 7 Mathematics • NSW Curriculum</p>
      </div>
    </div>
  );
}

export default LoginPage;