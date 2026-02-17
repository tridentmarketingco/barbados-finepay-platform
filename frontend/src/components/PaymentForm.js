/**
 * Barbados PayFine Platform - Payment Form Component
 * PowerTranz payment gateway integration for card checkout
 */

import React, { useState } from 'react';
import { ticketAPI, handleAPIError } from '../services/api';

function PaymentForm({ ticket, onPaymentSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [formData, setFormData] = useState({
    card_number: '',
    expiry_mm: '',
    expiry_yy: '',
    cvv: '',
    card_holder_name: '',
    email: ''
  });

  // Format card number with spaces
  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'card_number') {
      // Format card number
      const formatted = formatCardNumber(value);
      setFormData(prev => ({ ...prev, [name]: formatted }));
    } else if (name === 'expiry_mm' || name === 'cvv') {
      // Only numbers
      const numeric = value.replace(/[^0-9]/g, '');
      setFormData(prev => ({ ...prev, [name]: numeric }));
    } else if (name === 'expiry_yy') {
      // Last 2 digits only
      const numeric = value.replace(/[^0-9]/g, '').slice(0, 2);
      setFormData(prev => ({ ...prev, [name]: numeric }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = [];
    
    if (!formData.card_number || formData.card_number.replace(/\s/g, '').length < 16) {
      errors.push('Please enter a valid card number');
    }
    
    if (!formData.expiry_mm || parseInt(formData.expiry_mm) < 1 || parseInt(formData.expiry_mm) > 12) {
      errors.push('Please enter a valid expiry month (01-12)');
    }
    
    if (!formData.expiry_yy || parseInt(formData.expiry_yy) < 26) {
      errors.push('Please enter a valid expiry year');
    }
    
    if (!formData.cvv || formData.cvv.length < 3) {
      errors.push('Please enter a valid CVV');
    }
    
    if (!formData.card_holder_name.trim()) {
      errors.push('Please enter the card holder name');
    }
    
    if (!formData.email.trim()) {
      errors.push('Please enter your email address');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.push('Please enter a valid email address');
    }
    
    return errors;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);

    // Validate
    const errors = validateForm();
    if (errors.length > 0) {
      setAlert({
        type: 'error',
        message: errors[0]
      });
      setLoading(false);
      return;
    }

    try {
      // Prepare payment data
      const paymentData = {
        card_number: formData.card_number.replace(/\s/g, ''),
        expiry_mm: parseInt(formData.expiry_mm),
        expiry_yy: parseInt('20' + formData.expiry_yy),
        cvv: formData.cvv,
        card_holder_name: formData.card_holder_name,
        email: formData.email,
        payment_method: 'card'
      };

      // Call payment API
      const response = await ticketAPI.pay(ticket.serial_number, paymentData);
      
      // Success - show receipt
      onPaymentSuccess(response.receipt);
      
    } catch (error) {
      const errorInfo = handleAPIError(error);
      setAlert(errorInfo);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>💳 Payment Details</h2>
        <p>Enter your card information to pay the fine</p>
      </div>

      {/* Security Notice */}
      <div className="alert alert-info">
        <span className="alert-icon">🔒</span>
        <div className="alert-content">
          <p><strong>Secure Payment via PowerTranz</strong></p>
          <p>Your card information is encrypted and processed securely.</p>
        </div>
      </div>

      {/* Ticket Summary */}
      <div className="ticket-details">
        <div className="detail-row">
          <span className="detail-label">Ticket Serial</span>
          <span className="detail-value">{ticket.serial_number}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Offense</span>
          <span className="detail-value">{ticket.offense_description}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Amount Due</span>
          <span className="detail-value amount-highlight">
            ${ticket.fine_amount.toFixed(2)} BBD
          </span>
        </div>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`alert alert-${alert.type}`}>
          <span className="alert-icon">
            {alert.type === 'success' ? '✅' : '❌'}
          </span>
          <div className="alert-content">
            <p>{alert.message}</p>
          </div>
        </div>
      )}

      {/* Payment Form */}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="card_holder_name">Card Holder Name</label>
          <input
            type="text"
            id="card_holder_name"
            name="card_holder_name"
            value={formData.card_holder_name}
            onChange={handleInputChange}
            placeholder="John Doe"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="card_number">Card Number</label>
          <input
            type="text"
            id="card_number"
            name="card_number"
            value={formData.card_number}
            onChange={handleInputChange}
            placeholder="4111 1111 1111 1111"
            maxLength="19"
            required
            disabled={loading}
          />
          <small style={{ color: 'var(--text-muted)' }}>
            Test cards: 4111111111111111 (success), 4111111111111112 (decline)
          </small>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="expiry_mm">Expiry Month</label>
            <input
              type="text"
              id="expiry_mm"
              name="expiry_mm"
              value={formData.expiry_mm}
              onChange={handleInputChange}
              placeholder="MM"
              maxLength="2"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="expiry_yy">Expiry Year</label>
            <input
              type="text"
              id="expiry_yy"
              name="expiry_yy"
              value={formData.expiry_yy}
              onChange={handleInputChange}
              placeholder="YY"
              maxLength="2"
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="cvv">CVV</label>
          <input
            type="text"
            id="cvv"
            name="cvv"
            value={formData.cvv}
            onChange={handleInputChange}
            placeholder="123"
            maxLength="4"
            required
            disabled={loading}
            style={{ maxWidth: '150px' }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address (for receipt)</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="john@example.com"
            required
            disabled={loading}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-success"
            disabled={loading}
            style={{ flex: 2 }}
          >
            {loading ? (
              <>
                <span className="loading"></span>
                Processing...
              </>
            ) : (
              <>
                🔒 Pay ${ticket.fine_amount.toFixed(2)} BBD
              </>
            )}
          </button>
        </div>
      </form>

      {/* PowerTranz Branding */}
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          🔐 Powered by <strong>PowerTranz</strong> - Secure Caribbean Payment Gateway
        </p>
      </div>
    </div>
  );
}

export default PaymentForm;

