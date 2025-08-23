import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './signup.css'; // Import the dedicated signup styles

/* eslint-disable no-mixed-operators */
function SignUp({ onSignup }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Parent Information
    parentName: '',
    email: '',
    phone: '',
    
    // Children Information (array)
    children: [
      {
        id: 1,
        name: '',
        yearLevel: '7',
        mathsCompetency: '',
        helpAreas: []
      }
    ],
    
    // Subscription
    subscription: 'premium',
    
    // Payment Information
    payment: {
      cardNumber: '',
      expiryDate: '',
      cvv: '',
      cardholderName: '',
      billingAddress: {
        street: '',
        city: '',
        state: '',
        postcode: '',
        country: 'Australia'
      }
    }
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleChildChange = (childIndex, field, value) => {
    setFormData(prev => ({
      ...prev,
      children: prev.children.map((child, index) => 
        index === childIndex 
          ? { ...child, [field]: value }
          : child
      )
    }));
  };

  const handleHelpAreaChange = (childIndex, area, checked) => {
    setFormData(prev => ({
      ...prev,
      children: prev.children.map((child, index) => 
        index === childIndex 
          ? { 
              ...child, 
              helpAreas: checked 
                ? [...child.helpAreas, area]
                : child.helpAreas.filter(a => a !== area)
            }
          : child
      )
    }));
  };

  const addChild = () => {
    if (formData.children.length < 4) {
      setFormData(prev => ({
        ...prev,
        children: [
          ...prev.children,
          {
            id: Date.now(),
            name: '',
            yearLevel: '7',
            mathsCompetency: '',
            helpAreas: []
          }
        ]
      }));
    }
  };

  const removeChild = (childIndex) => {
    if (formData.children.length > 1) {
      setFormData(prev => ({
        ...prev,
        children: prev.children.filter((_, index) => index !== childIndex)
      }));
    }
  };

  const handlePaymentChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        payment: {
          ...prev.payment,
          [parent]: {
            ...prev.payment[parent],
            [child]: value
          }
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        payment: {
          ...prev.payment,
          [field]: value
        }
      }));
    }
  };

  const formatCardNumber = (value) => {
    // Remove all non-digit characters
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    // Add space every 4 digits
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value) => {
    // Remove all non-digit characters
    const v = value.replace(/\D/g, '');
    // Add slash after 2 digits
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handleNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isStep2Valid = () => {
    return formData.children.every(child => 
      child.name.trim() && child.mathsCompetency
    );
  };

  const isStep3Valid = () => {
    return formData.subscription;
  };

  const isStep4Valid = () => {
    const { payment } = formData;
    const cardNumberValid = payment.cardNumber.replace(/\s/g, '').length >= 16;
    const expiryValid = payment.expiryDate.length === 5;
    const cvvValid = payment.cvv.length >= 3;
    const nameValid = payment.cardholderName.trim().length > 0;
    const streetValid = payment.billingAddress.street.trim().length > 0;
    const cityValid = payment.billingAddress.city.trim().length > 0;
    const stateValid = payment.billingAddress.state.trim().length > 0;
    const postcodeValid = payment.billingAddress.postcode.trim().length > 0;
    
    return (
      cardNumberValid && 
      expiryValid && 
      cvvValid && 
      nameValid && 
      streetValid && 
      cityValid && 
      stateValid && 
      postcodeValid
    );
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
        'Email support',
        '1 child only'
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
        'Weekly progress reports',
        'Up to 2 children'
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
        'Custom learning plans',
        'Sibling comparison reports'
      ]
    }
  ];

  const helpAreaOptions = [
    { value: 'algebra', label: 'Algebra & Equations' },
    { value: 'geometry', label: 'Geometry & Measurement' },
    { value: 'fractions', label: 'Fractions & Decimals' },
    { value: 'statistics', label: 'Statistics & Probability' },
    { value: 'indices', label: 'Numbers & Indices' },
    { value: 'trigonometry', label: 'Trigonometry' }
  ];

  return (
    <div className="signup-page">
      <div className="signup-wrapper">
        <div className="signup-header">
          <button onClick={handleBackToHome} className="back-home-link">
            ← Back to Home
          </button>
          
          <h1 className="signup-title">Sign Up</h1>
          <p className="signup-subtitle">Create your AI tutoring account today</p>
          
          <div className="step-indicator">
            <div className="step-section">
              <div className="step-label">Parent Details</div>
              <div className={`step-dot ${currentStep >= 1 ? 'active' : ''}`}></div>
            </div>
            <div className="step-section">
              <div className="step-label">Children Info</div>
              <div className={`step-dot ${currentStep >= 2 ? 'active' : ''}`}></div>
            </div>
            <div className="step-section">
              <div className="step-label">Choose Plan</div>
              <div className={`step-dot ${currentStep >= 3 ? 'active' : ''}`}></div>
            </div>
            <div className="step-section">
              <div className="step-label">Payment</div>
              <div className={`step-dot ${currentStep >= 4 ? 'active' : ''}`}></div>
            </div>
          </div>
        </div>

        <div className="signup-form-container">
          <form onSubmit={handleSubmit}>
            {/* Step 1: Parent Information */}
            {currentStep === 1 && (
              <div className="form-step">
                <h2 className="step-title">Parent Information</h2>
                <p className="step-description">Let's start with your contact details</p>
                
                <div className="form-grid">
                  <div className="input-group">
                    <label className="input-label" htmlFor="parentName">Full Name *</label>
                    <input
                      type="text"
                      id="parentName"
                      name="parentName"
                      value={formData.parentName}
                      onChange={handleInputChange}
                      placeholder="Enter your full name"
                      className="input-field"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label" htmlFor="email">Email Address *</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="your.email@example.com"
                      className="input-field"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label" htmlFor="phone">Phone Number *</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="04XX XXX XXX"
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div className="form-navigation">
                  <div></div>
                  <button 
                    type="button" 
                    onClick={handleNextStep}
                    className="nav-btn nav-btn-primary"
                    disabled={!formData.parentName || !formData.email || !formData.phone}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Children Information */}
            {currentStep === 2 && (
              <div className="form-step">
                <h2 className="step-title">Your Children</h2>
                <p className="step-description">Tell us about each child you'd like to enroll</p>

                <div className="children-section">
                  <div className="children-grid">
                    {formData.children.map((child, index) => (
                      <div key={child.id} className="child-card">
                        <div className="child-header">
                          <h3 className="child-number">Child {index + 1}</h3>
                          {formData.children.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeChild(index)}
                              className="remove-child"
                              title="Remove child"
                            >
                              ×
                            </button>
                          )}
                        </div>

                        <div className="child-form-grid">
                          <div className="input-group">
                            <label className="input-label" htmlFor={`childName${index}`}>Child's Name *</label>
                            <input
                              type="text"
                              id={`childName${index}`}
                              value={child.name}
                              onChange={(e) => handleChildChange(index, 'name', e.target.value)}
                              placeholder="Enter child's name"
                              className="input-field"
                              required
                            />
                          </div>

                          <div className="input-group">
                            <label className="input-label" htmlFor={`yearLevel${index}`}>Year Level *</label>
                            <select
                              id={`yearLevel${index}`}
                              value={child.yearLevel}
                              onChange={(e) => handleChildChange(index, 'yearLevel', e.target.value)}
                              className="input-field"
                              required
                            >
                              <option value="6">Year 6</option>
                              <option value="7">Year 7</option>
                              <option value="8">Year 8</option>
                              <option value="9">Year 9</option>
                              <option value="10">Year 10</option>
                              <option value="11">Year 11</option>
                              <option value="12">Year 12</option>
                            </select>
                          </div>

                          <div className="input-group full-width">
                            <label className="input-label" htmlFor={`mathsCompetency${index}`}>Mathematics Level *</label>
                            <select
                              id={`mathsCompetency${index}`}
                              value={child.mathsCompetency}
                              onChange={(e) => handleChildChange(index, 'mathsCompetency', e.target.value)}
                              className="input-field"
                              required
                            >
                              <option value="">Select competency level</option>
                              <option value="below">Below Grade Level</option>
                              <option value="approaching">Approaching Grade Level</option>
                              <option value="at">At Grade Level</option>
                              <option value="above">Above Grade Level</option>
                              <option value="advanced">Advanced</option>
                            </select>
                          </div>

                          <div className="input-group full-width">
                            <label className="input-label">Areas where {child.name || 'this child'} needs help:</label>
                            <div className="help-areas">
                              {helpAreaOptions.map((area) => (
                                <div 
                                  key={area.value} 
                                  className={`help-area-item ${child.helpAreas.includes(area.value) ? 'selected' : ''}`}
                                  onClick={() => handleHelpAreaChange(index, area.value, !child.helpAreas.includes(area.value))}
                                >
                                  <input 
                                    type="checkbox" 
                                    checked={child.helpAreas.includes(area.value)}
                                    onChange={(e) => handleHelpAreaChange(index, area.value, e.target.checked)}
                                    className="help-checkbox"
                                  />
                                  <span className="help-label">{area.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {formData.children.length < 4 && (
                    <button
                      type="button"
                      onClick={addChild}
                      className="add-child-btn"
                      disabled={formData.children.length >= 4}
                    >
                      + Add Another Child
                    </button>
                  )}
                </div>

                <div className="form-navigation">
                  <button type="button" onClick={handlePrevStep} className="nav-btn nav-btn-secondary">
                    Back
                  </button>
                  <button 
                    type="button" 
                    onClick={handleNextStep}
                    className="nav-btn nav-btn-primary"
                    disabled={!isStep2Valid()}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}            {/* Step 3: Subscription Plans */}
            {currentStep === 3 && (
              <div className="form-step">
                <h2 className="step-title">Choose Your Plan</h2>
                <p className="step-description">Select the perfect plan for your family</p>
                
                <div className="plans-container">
                  {formData.children.length > 1 && (
                    <div className="plans-note">
                      You have {formData.children.length} children to enroll.
                      {formData.children.length > 2 && ' Family plan required for 3+ children.'}
                    </div>
                  )}
                  
                  <div className="plans-grid">
                    {subscriptionPlans.map((plan) => {
                      let isDisabled = false;
                      if (formData.children.length > 1 && plan.id === 'basic') {
                        isDisabled = true;
                      }
                      if (formData.children.length > 2 && plan.id === 'premium') {
                        isDisabled = true;
                      }
                      
                      return (
                        <div 
                          key={plan.id}
                          className={`plan-card ${formData.subscription === plan.id ? 'selected' : ''} ${plan.recommended ? 'recommended' : ''} ${isDisabled ? 'disabled' : ''}`}
                          onClick={() => !isDisabled && setFormData(prev => ({ ...prev, subscription: plan.id }))}
                        >
                          <h3 className="plan-name">{plan.name}</h3>
                          <div className="plan-price">{plan.price}</div>
                          <div className="plan-period">{plan.period}</div>
                          
                          <ul className="plan-features">
                            {plan.features.map((feature, index) => (
                              <li key={index} className="plan-feature">{feature}</li>
                            ))}
                          </ul>
                          
                          {!isDisabled && (
                            <input
                              type="radio"
                              name="subscription"
                              value={plan.id}
                              checked={formData.subscription === plan.id}
                              onChange={handleInputChange}
                              style={{ display: 'none' }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="form-navigation">
                  <button type="button" onClick={handlePrevStep} className="nav-btn nav-btn-secondary">
                    Back
                  </button>
                  <button 
                    type="button" 
                    onClick={handleNextStep}
                    className="nav-btn nav-btn-primary"
                    disabled={!isStep3Valid()}
                  >
                    Continue to Payment
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Payment Information */}
            {currentStep === 4 && (
              <div className="form-step">
                <h2 className="step-title">Payment Information</h2>
                <p className="step-description">Secure payment details for your subscription</p>
                
                <div className="payment-container">
                  <div className="payment-summary">
                    <h3>Order Summary</h3>
                    <div className="summary-item">
                      <span>Plan: {subscriptionPlans.find(p => p.id === formData.subscription)?.name}</span>
                      <span>{subscriptionPlans.find(p => p.id === formData.subscription)?.price}/month</span>
                    </div>
                    <div className="summary-item">
                      <span>Children: {formData.children.length}</span>
                    </div>
                    <div className="summary-total">
                      <span>7-Day Free Trial</span>
                      <span>$0.00</span>
                    </div>
                  </div>

                  <div className="payment-form">
                    <h3>Card Information</h3>
                    <div className="form-grid">
                      <div className="input-group full-width">
                        <label className="input-label" htmlFor="cardNumber">Card Number *</label>
                        <input
                          type="text"
                          id="cardNumber"
                          value={formData.payment.cardNumber}
                          onChange={(e) => handlePaymentChange('cardNumber', formatCardNumber(e.target.value))}
                          placeholder="1234 5678 9012 3456"
                          className="input-field"
                          maxLength="19"
                          required
                        />
                      </div>

                      <div className="input-group">
                        <label className="input-label" htmlFor="expiryDate">Expiry Date *</label>
                        <input
                          type="text"
                          id="expiryDate"
                          value={formData.payment.expiryDate}
                          onChange={(e) => handlePaymentChange('expiryDate', formatExpiryDate(e.target.value))}
                          placeholder="MM/YY"
                          className="input-field"
                          maxLength="5"
                          required
                        />
                      </div>

                      <div className="input-group">
                        <label className="input-label" htmlFor="cvv">CVV *</label>
                        <input
                          type="text"
                          id="cvv"
                          value={formData.payment.cvv}
                          onChange={(e) => handlePaymentChange('cvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="123"
                          className="input-field"
                          maxLength="4"
                          required
                        />
                      </div>

                      <div className="input-group full-width">
                        <label className="input-label" htmlFor="cardholderName">Cardholder Name *</label>
                        <input
                          type="text"
                          id="cardholderName"
                          value={formData.payment.cardholderName}
                          onChange={(e) => handlePaymentChange('cardholderName', e.target.value)}
                          placeholder="John Smith"
                          className="input-field"
                          required
                        />
                      </div>
                    </div>

                    <h3>Billing Address</h3>
                    <div className="form-grid">
                      <div className="input-group full-width">
                        <label className="input-label" htmlFor="street">Street Address *</label>
                        <input
                          type="text"
                          id="street"
                          value={formData.payment.billingAddress.street}
                          onChange={(e) => handlePaymentChange('billingAddress.street', e.target.value)}
                          placeholder="123 Main Street"
                          className="input-field"
                          required
                        />
                      </div>

                      <div className="input-group">
                        <label className="input-label" htmlFor="city">City *</label>
                        <input
                          type="text"
                          id="city"
                          value={formData.payment.billingAddress.city}
                          onChange={(e) => handlePaymentChange('billingAddress.city', e.target.value)}
                          placeholder="Sydney"
                          className="input-field"
                          required
                        />
                      </div>

                      <div className="input-group">
                        <label className="input-label" htmlFor="state">State *</label>
                        <select
                          id="state"
                          value={formData.payment.billingAddress.state}
                          onChange={(e) => handlePaymentChange('billingAddress.state', e.target.value)}
                          className="input-field"
                          required
                        >
                          <option value="">Select State</option>
                          <option value="NSW">New South Wales</option>
                          <option value="VIC">Victoria</option>
                          <option value="QLD">Queensland</option>
                          <option value="WA">Western Australia</option>
                          <option value="SA">South Australia</option>
                          <option value="TAS">Tasmania</option>
                          <option value="ACT">Australian Capital Territory</option>
                          <option value="NT">Northern Territory</option>
                        </select>
                      </div>

                      <div className="input-group">
                        <label className="input-label" htmlFor="postcode">Postcode *</label>
                        <input
                          type="text"
                          id="postcode"
                          value={formData.payment.billingAddress.postcode}
                          onChange={(e) => handlePaymentChange('billingAddress.postcode', e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="2000"
                          className="input-field"
                          maxLength="4"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-navigation">
                  <button type="button" onClick={handlePrevStep} className="nav-btn nav-btn-secondary">
                    Back
                  </button>
                  <button 
                    type="submit" 
                    className="nav-btn nav-btn-primary nav-btn-large"
                    disabled={!isStep4Valid()}
                  >
                    Start Free Trial
                  </button>
                </div>

                <div className="trial-note">
                  Your trial starts today. You won't be charged until day 8.
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default SignUp;