import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './components/Landing';
import TutorApp from './components/TutorApp';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import './styles.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const handleSignup = (signupData) => {
    console.log('User signed up:', signupData);
    
    // Create user profile from signup data
    const profile = {
      parentName: signupData.parentName,
      email: signupData.email,
      phone: signupData.phone,
      childName: signupData.childName,
      yearLevel: signupData.yearLevel,
      mathsCompetency: signupData.mathsCompetency,
      subscription: signupData.subscription,
      tokensUsed: 0,
      tokensLimit: signupData.subscription === 'basic' ? 1000 : 5000,
      streakDays: 0,
      joinDate: new Date().toISOString()
    };
    
    setUserProfile(profile);
    setIsLoggedIn(true);
  };

  const handleLogin = (loginData) => {
    console.log('User logged in:', loginData);
    setIsLoggedIn(true);
    
    // For demo purposes, set a default profile if none exists
    if (!userProfile) {
      setUserProfile({
        parentName: 'Demo Parent',
        childName: loginData.username || 'Alex',
        yearLevel: '7',
        subscription: 'Premium',
        tokensUsed: 1247,
        tokensLimit: 5000,
        streakDays: 5
      });
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserProfile(null);
  };

  return (
    <Router>
      <Routes>
        {/* Landing page */}
        <Route path="/" element={<Landing />} />
        
        {/* Signup page - for new users */}
        <Route 
          path="/signup" 
          element={
            isLoggedIn ? 
            <Navigate to="/app" replace /> : 
            <SignupPage onSignup={handleSignup} />
          } 
        />
        
        {/* Login page - for existing users */}
        <Route 
          path="/login" 
          element={
            isLoggedIn ? 
            <Navigate to="/app" replace /> : 
            <LoginPage onLogin={handleLogin} />
          } 
        />
        
        {/* Main tutor app - only accessible when logged in */}
        <Route 
          path="/app" 
          element={
            isLoggedIn ? 
            <TutorApp userProfile={userProfile} onLogout={handleLogout} setUserProfile={setUserProfile} /> : 
            <Navigate to="/login" replace />
          } 
        />
        
        {/* Redirect any unknown routes to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;