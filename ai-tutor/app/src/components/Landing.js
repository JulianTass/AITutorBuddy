import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

function Landing() {
  const navigate = useNavigate();

  const handleLogin = () => {
    console.log('Navigating to login page...');
    navigate('/login');
  };

  const handleSignup = () => {
    console.log('Navigating to signup page...');
    navigate('/signup');
  };

  return (
    <div className="landing">
      {/* Navigation */}
      <nav className="navbar">
        <div className="logo">AI Tutor</div>
        <div className="nav-buttons">
          <a href="#features" className="btn btn-outline">About</a>
          <a href="#pricing" className="btn btn-outline">Pricing</a>
          <button onClick={handleSignup} className="btn btn-outline">Sign Up</button>
          <button onClick={handleLogin} className="btn btn-primary">Login</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <h1>Your AI Learning Companion</h1>
        <p>Personalized tutoring for Year 7 NSW Mathematics. Get instant help, step-by-step guidance, and build confidence in your learning journey.</p>
        <div className="hero-buttons">
          <button onClick={handleSignup} className="btn btn-primary btn-hero">Start Learning Now</button>
          <a href="#features" className="btn btn-outline btn-hero">Learn More</a>
        </div>
      </section>

      {/* Features Section */}
      <section className="features" id="features">
        <div className="features-container">
          <h2>Why Choose AI Tutor?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Personalized Learning</h3>
              <p>Tailored to NSW Year 7 curriculum with intelligent topic detection that adapts to your specific needs.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🧠</div>
              <h3>Socratic Method</h3>
              <p>Learn through discovery with guided questions that help you understand concepts, not just memorize answers.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Instant Help</h3>
              <p>Get immediate assistance with algebra, geometry, fractions, and more. Available 24/7 whenever you need support.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Track Progress</h3>
              <p>Monitor your learning journey with detailed analytics and celebrate achievements along the way.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🛡️</div>
              <h3>Safe & Focused</h3>
              <p>Strictly educational content with robust filtering to keep conversations on-topic and appropriate.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎓</div>
              <h3>Curriculum Aligned</h3>
              <p>Perfectly matched to NSW Education Standards Authority requirements for Year 7 Mathematics.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="cta">
        <h2>Ready to Transform Your Learning?</h2>
        <p>Join thousands of students already improving their mathematics skills with AI Tutor.</p>
        <button onClick={handleSignup} className="btn btn-cta">Start Your Free Trial</button>
      </section>
    </div>
  );
}

export default Landing;