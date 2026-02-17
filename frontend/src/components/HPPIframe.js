/**
 * Barbados PayFine Platform - HPP Iframe Component
 * Handles PowerTranz Hosted Payment Page 3DS authentication flow
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { spiAPI } from '../services/api';

function HPPIframe({ 
  redirectData, 
  spiToken, 
  onAuthenticationComplete, 
  onError,
  onCancel 
}) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('initializing');
  const iframeRef = useRef(null);
  const navigate = useNavigate();
  const pollingIntervalRef = useRef(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Start polling for payment completion
  useEffect(() => {
    if (!redirectData || !spiToken) {
      setStatus('error');
      setLoading(false);
      return;
    }

    setLoading(false);
    setStatus('ready');

    // Start polling the backend to check if payment completed
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const statusResponse = await spiAPI.getStatus(spiToken);
        
        // Check if payment completed successfully
        if (statusResponse.status === 'completed' || statusResponse['3ds_result']) {
          clearInterval(pollingIntervalRef.current);
          
          // Try to complete the payment
          try {
            const paymentResponse = await spiAPI.completePayment(spiToken);
            
            if (paymentResponse.success && paymentResponse.Approved) {
              // Payment successful! Redirect to thank you page
              setStatus('redirecting');
              setTimeout(() => {
                navigate(`/hpp-complete?token=${spiToken}`, { replace: true });
              }, 1000);
            }
          } catch (err) {
            // If completion fails, still redirect - the completion page will handle it
            console.log('Payment completion check:', err);
            setStatus('redirecting');
            setTimeout(() => {
              navigate(`/hpp-complete?token=${spiToken}`, { replace: true });
            }, 1000);
          }
        }
      } catch (err) {
        // Continue polling on errors
        console.log('Polling for payment status...');
      }
    }, 3000); // Poll every 3 seconds

  }, [redirectData, spiToken, navigate]);

  // Get status message
  const getStatusMessage = () => {
    switch (status) {
      case 'initializing':
        return 'Initializing secure payment...';
      case 'ready':
        return 'Please complete the payment form below';
      case 'redirecting':
        return 'Payment successful! Redirecting to confirmation...';
      case 'error':
        return 'An error occurred loading the payment form.';
      default:
        return 'Processing...';
    }
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (status) {
      case 'initializing':
      case 'ready':
        return '⏳';
      case 'redirecting':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '💳';
    }
  };

  return (
    <div className="hpp-container">
      {/* Status Display */}
      <div className="hpp-status">
        <div className="status-icon">{getStatusIcon()}</div>
        <div className="status-message">
          <p className="status-text">{getStatusMessage()}</p>
          
          {status === 'ready' && (
            <div className="status-details">
              <p>🔒 Your payment is secured by 3D-Secure</p>
              <p>Please look at the payment window above and complete the authentication.</p>
              <p className="small-text">
                If you don't see the payment window, please ensure pop-ups are allowed.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* HPP Iframe */}
      {redirectData && status !== 'redirecting' && (
        <div className="hpp-iframe-container">
          <iframe
            ref={iframeRef}
            srcDoc={redirectData}
            title="PowerTranz Secure Payment"
            className="hpp-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </div>
      )}

      {/* Redirecting Message */}
      {status === 'redirecting' && (
        <div className="hpp-iframe-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f9ff' }}>
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="success-icon" style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ color: 'var(--success-green)', margin: '0 0 0.5rem 0' }}>Payment Successful!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', margin: '0 0 1.5rem 0' }}>
              Redirecting to your receipt...
            </p>
            <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
          </div>
        </div>
      )}

      {/* Error Actions */}
      {status === 'error' && (
        <div className="hpp-actions">
          <button
            className="btn btn-secondary"
            onClick={() => onCancel?.()}
          >
            Back to Payment
          </button>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Security Notice */}
      <div className="security-notice">
        <span className="security-icon">🔐</span>
        <div className="security-text">
          <p><strong>Secure 3D-Secure Payment</strong></p>
          <p>Your payment is protected by industry-standard encryption and 3D-Secure authentication.</p>
          <p className="small">Powered by PowerTranz</p>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        .hpp-container {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .hpp-status {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.5rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .status-icon {
          font-size: 2.5rem;
        }

        .status-message {
          flex: 1;
        }

        .status-text {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
        }

        .status-details {
          font-size: 0.9rem;
          opacity: 0.9;
        }

        .status-details p {
          margin: 0.25rem 0;
        }

        .small-text {
          font-size: 0.8rem;
          opacity: 0.7;
          margin-top: 0.5rem;
        }

        .hpp-iframe-container {
          background: #f5f5f5;
          min-height: 500px;
          border-bottom: 1px solid #e0e0e0;
        }

        .hpp-iframe {
          width: 100%;
          height: 500px;
          border: none;
          background: white;
        }

        .hpp-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          padding: 1.5rem;
          background: #f8f9fa;
        }

        .security-notice {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.5rem;
          background: #e8f5e9;
          border-top: 1px solid #c8e6c9;
        }

        .security-icon {
          font-size: 1.5rem;
        }

        .security-text p {
          margin: 0;
          font-size: 0.85rem;
          color: #2e7d32;
        }

        .security-text .small {
          font-size: 0.75rem;
          opacity: 0.8;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
          flex: 1;
        }

        .btn-secondary:hover {
          background: #5a6268;
          transform: translateY(-2px);
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          flex: 1;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }

        .loading-spinner {
          width: 60px;
          height: 60px;
          border: 4px solid #e0e0e0;
          border-top: 4px solid #28a745;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .success-icon {
          animation: scaleIn 0.5s ease-out;
        }

        @keyframes scaleIn {
          0% { transform: scale(0); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default HPPIframe;

