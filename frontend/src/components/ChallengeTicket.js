/**
 * Challenge Ticket Component
 * Allows citizens to submit challenges for tickets
 */

import React, { useState, useEffect } from 'react';
import { ticketAPI } from '../services/api';
import '../styles/ChallengeTicket.css';

function ChallengeTicket({ ticket, onChallengeSubmitted, onCancel }) {
  const [formData, setFormData] = useState({
    reason: '',
    evidence: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [challengeResult, setChallengeResult] = useState(null);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await ticketAPI.submitChallenge(ticket.serial_number, formData);
      setChallengeResult(result);
      setSuccess(true);
      
      // Notify parent component
      if (onChallengeSubmitted) {
        onChallengeSubmitted(result);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to submit challenge');
    } finally {
      setSubmitting(false);
    }
  };

  if (success && challengeResult) {
    return (
      <div className="challenge-success">
        <div className="success-icon">✅</div>
        <h2>Challenge Submitted Successfully</h2>
        
        <div className="challenge-info">
          <p><strong>Ticket:</strong> {ticket.serial_number}</p>
          <p><strong>Status:</strong> <span className="badge badge-warning">Pending Review</span></p>
        </div>

        <div className="next-steps">
          <h3>📋 Next Steps</h3>
          <ul>
            {challengeResult.next_steps?.map((step, index) => (
              <li key={index}>{step}</li>
            )) || (
              <>
                <li>Your challenge has been submitted and is pending review</li>
                <li>An administrator will review your challenge within 5-7 business days</li>
                <li>You will be notified of the outcome via email (if provided)</li>
                <li>Payment is blocked until the challenge is resolved</li>
                <li>You can check the status using the ticket lookup</li>
              </>
            )}
          </ul>
        </div>

        <div className="important-notice">
          <h4>⚠️ Important</h4>
          <p>Your ticket payment is now <strong>blocked</strong> until the challenge is reviewed and resolved.</p>
        </div>

        <button 
          onClick={() => window.location.reload()}
          className="btn btn-primary"
        >
          Return to Ticket Lookup
        </button>
      </div>
    );
  }

  return (
    <div className="challenge-form-container">
      <h2>⚖️ Challenge Ticket</h2>
      
      <div className="ticket-summary">
        <h3>Ticket Information</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <label>Serial Number:</label>
            <span><code>{ticket.serial_number}</code></span>
          </div>
          <div className="summary-item">
            <label>Fine Amount:</label>
            <span><strong>${parseFloat(ticket.fine_amount).toFixed(2)}</strong></span>
          </div>
          {ticket.offence && (
            <div className="summary-item">
              <label>Offence:</label>
              <span>{ticket.offence.name}</span>
            </div>
          )}
          {ticket.points > 0 && (
            <div className="summary-item">
              <label>Demerit Points:</label>
              <span>{ticket.points}</span>
            </div>
          )}
        </div>
      </div>

      <div className="challenge-info-box">
        <h4>ℹ️ About Challenges</h4>
        <p>
          You have the right to challenge this ticket if you believe it was issued in error or 
          if there are mitigating circumstances. An administrator will review your challenge and 
          may dismiss the ticket, adjust the fine, or uphold the original penalty.
        </p>
        <p>
          <strong>Note:</strong> Once you submit a challenge, you will not be able to pay the 
          ticket until the challenge is resolved.
        </p>
      </div>

      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="challenge-form">
        <div className="form-group">
          <label>Reason for Challenge *</label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleInputChange}
            placeholder="Explain why you are challenging this ticket..."
            rows="6"
            required
            className="form-input"
            disabled={submitting}
          />
          <small>
            Be specific and provide as much detail as possible. Examples: "I was not driving the vehicle at the time", 
            "The speed limit sign was obscured", "Emergency situation", etc.
          </small>
        </div>

        <div className="form-group">
          <label>Supporting Evidence (Optional)</label>
          <textarea
            name="evidence"
            value={formData.evidence}
            onChange={handleInputChange}
            placeholder="Provide any supporting evidence (URLs to photos/videos, witness information, etc.)..."
            rows="4"
            className="form-input"
            disabled={submitting}
          />
          <small>
            Include URLs to photos, videos, or documents. You may also describe witness information 
            or other evidence that supports your challenge.
          </small>
        </div>

        <div className="form-actions">
          <button 
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            disabled={submitting}
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !formData.reason.trim()}
          >
            {submitting ? 'Submitting...' : 'Submit Challenge'}
          </button>
        </div>
      </form>

      <div className="legal-notice">
        <p>
          <small>
            By submitting this challenge, you acknowledge that providing false information may 
            result in additional penalties. All challenges are reviewed by authorized personnel.
          </small>
        </p>
      </div>
    </div>
  );
}

export default ChallengeTicket;
