/**
 * Trident ID Verification Component
 * Allows citizens to verify ownership of a ticket using partial Trident ID information
 * 
 * SECURITY:
 * - Only requests last 4 digits or Date of Birth
 * - Never displays or stores full National ID numbers
 * - Verification happens server-side
 */

import React, { useState } from 'react';
import { ticketAPI } from '../services/api';

function TridentVerification({ ticket, onVerified, onSkip }) {
  const [verificationMethod, setVerificationMethod] = useState('last_four'); // 'last_four' or 'dob'
  const [lastFourDigits, setLastFourDigits] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const verificationData = verificationMethod === 'last_four'
        ? { last_four_digits: lastFourDigits }
        : { date_of_birth: dateOfBirth };

      const result = await ticketAPI.verifyTridentId(ticket.serial_number, verificationData);

      if (result.verified) {
        setMessage(result.message);
        // Wait a moment to show success message
        setTimeout(() => {
          onVerified(result.ticket);
        }, 1500);
      } else {
        setError(result.message || 'Verification failed. Please check your information.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // If ticket doesn't require verification, show option to skip
  if (!ticket.requires_verification) {
    return (
      <div className="verification-container">
        <div className="verification-card">
          <h3>🔓 Verification Optional</h3>
          <p>This ticket is not linked to a Trident ID. You can proceed directly to payment.</p>
          <button onClick={onSkip} className="btn-primary">
            Proceed to Payment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="verification-container">
      <div className="verification-card">
        <h2>🔐 Trident ID Verification Required</h2>
        <p className="verification-info">
          This ticket is linked to a Barbados National ID (Trident ID).
          Please verify your identity to proceed with payment.
        </p>

        <div className="verification-status">
          <div className="status-badge status-unverified">
            Status: Unverified
          </div>
        </div>

        <form onSubmit={handleVerify} className="verification-form">
          <div className="verification-method-selector">
            <label>
              <input
                type="radio"
                value="last_four"
                checked={verificationMethod === 'last_four'}
                onChange={(e) => setVerificationMethod(e.target.value)}
              />
              <span>Last 4 digits of Trident ID</span>
            </label>
            <label>
              <input
                type="radio"
                value="dob"
                checked={verificationMethod === 'dob'}
                onChange={(e) => setVerificationMethod(e.target.value)}
              />
              <span>Date of Birth</span>
            </label>
          </div>

          {verificationMethod === 'last_four' ? (
            <div className="form-group">
              <label htmlFor="lastFourDigits">Last 4 Digits of Trident ID</label>
              <input
                type="text"
                id="lastFourDigits"
                value={lastFourDigits}
                onChange={(e) => setLastFourDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                maxLength="4"
                pattern="\d{4}"
                required
                className="form-control"
              />
              <small className="form-text">
                Enter the last 4 digits of your National ID number
              </small>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="dateOfBirth">Date of Birth</label>
              <input
                type="date"
                id="dateOfBirth"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
                className="form-control"
                max={new Date().toISOString().split('T')[0]}
              />
              <small className="form-text">
                Enter your date of birth as registered with your Trident ID
              </small>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <strong>Verification Failed:</strong> {error}
            </div>
          )}

          {message && (
            <div className="alert alert-success">
              <strong>✓ Verified!</strong> {message}
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              disabled={loading || (verificationMethod === 'last_four' && lastFourDigits.length !== 4)}
              className="btn-primary"
            >
              {loading ? 'Verifying...' : 'Verify Identity'}
            </button>
          </div>
        </form>

        <div className="verification-help">
          <h4>Need Help?</h4>
          <p>
            <strong>Don't have your Trident ID?</strong><br />
            Contact the Magistrate Court: +1-246-228-2503
          </p>
          <p>
            <strong>Ticket not linked to your ID?</strong><br />
            You may be able to claim this ticket using the "Claim Ticket" option.
          </p>
        </div>

        <style jsx>{`
          .verification-container {
            max-width: 500px;
            margin: 40px auto;
            padding: 20px;
          }

          .verification-card {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }

          .verification-card h2 {
            color: #00267F;
            margin-bottom: 10px;
          }

          .verification-info {
            color: #666;
            margin-bottom: 20px;
            line-height: 1.6;
          }

          .verification-status {
            margin: 20px 0;
          }

          .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 14px;
          }

          .status-unverified {
            background: #FFC726;
            color: #00267F;
          }

          .verification-form {
            margin: 30px 0;
          }

          .verification-method-selector {
            display: flex;
            gap: 20px;
            margin-bottom: 25px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
          }

          .verification-method-selector label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            font-weight: 500;
          }

          .verification-method-selector input[type="radio"] {
            width: 18px;
            height: 18px;
          }

          .form-group {
            margin-bottom: 20px;
          }

          .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            color: #333;
          }

          .form-control {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 6px;
            font-size: 16px;
            transition: border-color 0.3s;
          }

          .form-control:focus {
            outline: none;
            border-color: #00267F;
          }

          .form-text {
            display: block;
            margin-top: 5px;
            font-size: 13px;
            color: #666;
          }

          .alert {
            padding: 12px 16px;
            border-radius: 6px;
            margin: 15px 0;
          }

          .alert-error {
            background: #fee;
            border: 1px solid #fcc;
            color: #c33;
          }

          .alert-success {
            background: #efe;
            border: 1px solid #cfc;
            color: #3c3;
          }

          .form-actions {
            margin-top: 25px;
          }

          .btn-primary {
            width: 100%;
            padding: 14px;
            background: #00267F;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.3s;
          }

          .btn-primary:hover:not(:disabled) {
            background: #001a5c;
          }

          .btn-primary:disabled {
            background: #ccc;
            cursor: not-allowed;
          }

          .verification-help {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
          }

          .verification-help h4 {
            color: #00267F;
            margin-bottom: 15px;
          }

          .verification-help p {
            margin-bottom: 15px;
            font-size: 14px;
            line-height: 1.6;
          }

          .verification-help strong {
            color: #333;
          }
        `}</style>
      </div>
    </div>
  );
}

export default TridentVerification;
