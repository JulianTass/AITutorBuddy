import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function SignupPage({ onSignup }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Parent Information
    parentName: '',
    email: '',
    phone: '',
    
    // Child Information
    childName: '',
    yearLevel: '7',
    mathsCompetency: '',
    
    // Subscription
    subscription: 'premium'
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Signup data:', formData);
    
    // Call the parent's signup handler
    if (onSignup) {
      onSignup(formData);
    }
    
    // Navigate to the app
    navigate('/app');
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const subscriptionPlans = [
    {
      id: 'basic',
      name: 'Basic',
      price: '$9.99',
      period: '/month',
      features: [
        '1,000 AI interactions per month',
        'Basic progress tracking',
        'Year 7 Mathematics curriculum',
        'Email support'
      ]
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '$19.99',
      period: '/month',
      features: [
        'Unlimited AI interactions',
        'Advanced progress analytics',
        'All year levels (6-12)',
        'Priority support',
        'Parent dashboard',
        'Weekly progress reports'
      ],
      recommended: true
    },
    {
      id: 'family',
      name: 'Family',
      price: '$29.99',
      period: '/month',
      features: [
        'Everything in Premium',
        'Up to 4 children',
        'Family progress overview',
        'Dedicated account manager',
        'Custom learning plans'
      ]
    }
  ];

  return (
    <div className="signup-screen">
      <div className="signup-container">
        <button className="back-to-home-btn" onClick={handleBackToHome}>
          ← Back to Home
        </button>

        <div className="signup-header">
          <h1>Join AI Tutor</h1>
          <p>Start your child's personalized learning journey today</p>
          <div className="progress-bar">
            <div className="progress-steps">
              <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>1</div>
              <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>2</div>
              <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>3</div>
            </div>
            <div className="step-labels">
              <span>Parent Info</span>
              <span>Child Details</span>
              <span>Subscription</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="signup-form">
          {/* Step 1: Parent Information */}
          {currentStep === 1 && (
            <div className="form-step">
              <h2>Parent Information</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="parentName">Parent/Guardian Name *</label>
                  <input
                    type="text"
                    id="parentName"
                    name="parentName"
                    value={formData.parentName}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Phone Number *</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="04XX XXX XXX"
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={handleNextStep}
                  className="btn btn-primary"
                  disabled={!formData.parentName || !formData.email || !formData.phone}
                >
                  Next Step
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Child Information */}
          {currentStep === 2 && (
            <div className="form-step">
              <h2>About Your Child</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="childName">Child's Name *</label>
                  <input
                    type="text"
                    id="childName"
                    name="childName"
                    value={formData.childName}
                    onChange={handleInputChange}
                    placeholder="Enter your child's name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="yearLevel">Current Year Level *</label>
                  <select
                    id="yearLevel"
                    name="yearLevel"
                    value={formData.yearLevel}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="6">Year 6</option>
                    <option value="7">Year 7</option>
                    <option value="8">Year 8</option>
                    <option value="9">Year 9</option>
                    <option value="10">Year 10</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="mathsCompetency">Mathematics Competency Level *</label>
                  <select
                    id="mathsCompetency"
                    name="mathsCompetency"
                    value={formData.mathsCompetency}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select competency level</option>
                    <option value="below">Below Grade Level - Needs significant support</option>
                    <option value="approaching">Approaching Grade Level - Some concepts challenging</option>
                    <option value="at">At Grade Level - Meets most expectations</option>
                    <option value="above">Above Grade Level - Exceeds expectations</option>
                    <option value="advanced">Advanced - Ready for extension work</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>Areas where your child needs the most help:</label>
                  <div className="checkbox-group">
                    <label className="checkbox-item">
                      <input type="checkbox" name="helpAreas" value="algebra" />
                      Algebra & Equations
                    </label>
                    <label className="checkbox-item">
                      <input type="checkbox" name="helpAreas" value="geometry" />
                      Geometry & Measurement
                    </label>
                    <label className="checkbox-item">
                      <input type="checkbox" name="helpAreas" value="fractions" />
                      Fractions & Decimals
                    </label>
                    <label className="checkbox-item">
                      <input type="checkbox" name="helpAreas" value="statistics" />
                      Statistics & Probability
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={handlePrevStep} className="btn btn-outline">
                  Previous
                </button>
                <button 
                  type="button" 
                  onClick={handleNextStep}
                  className="btn btn-primary"
                  disabled={!formData.childName || !formData.mathsCompetency}
                >
                  Next Step
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Subscription Plans */}
          {currentStep === 3 && (
            <div className="form-step">
              <h2>Choose Your Plan</h2>
              <div className="subscription-plans">
                {subscriptionPlans.map((plan) => (
                  <div 
                    key={plan.id}
                    className={`plan-card ${formData.subscription === plan.id ? 'selected' : ''} ${plan.recommended ? 'recommended' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, subscription: plan.id }))}
                  >
                    {plan.recommended && <div className="recommended-badge">Most Popular</div>}
                    <div className="plan-header">
                      <h3>{plan.name}</h3>
                      <div className="plan-price">
                        <span className="price">{plan.price}</span>
                        <span className="period">{plan.period}</span>
                      </div>
                    </div>
                    <ul className="plan-features">
                      {plan.features.map((feature, index) => (
                        <li key={index}>{feature}</li>
                      ))}
                    </ul>
                    <div className="plan-radio">
                      <input
                        type="radio"
                        name="subscription"
                        value={plan.id}
                        checked={formData.subscription === plan.id}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-actions">
                <button type="button" onClick={handlePrevStep} className="btn btn-outline">
                  Previous
                </button>
                <button type="submit" className="btn btn-primary btn-large">
                  Start Free Trial
                </button>
              </div>

              <p className="trial-note">
                Start with a 7-day free trial. Cancel anytime. No setup fees.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default SignupPage;