/**
 * Barbados PayFine Platform - HPP Callback Page Component
 * Handles the redirect from PowerTranz HPP after 3DS authentication
 * 
 * This component is displayed when PowerTranz redirects back to the merchant
 * after the cardholder completes 3DS authentication on the hosted payment page.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { spiAPI } from '../services/api';

function HPPCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);

  // Get callback data from URL parameters
  const getCallbackData = useCallback(() => {
    const data = {};
    
    // PowerTranz typically sends these parameters
    const params = ['SpiToken', 'IsoResponseCode', 'ResponseMessage', 'TransactionIdentifier', 
                    'Eci', 'Cavv', 'Xid', 'AuthenticationStatus', 'ThreeDServerTransactionId'];
    
    params.forEach(param => {
      const value = searchParams.get(param);
      if (value) {
        data[param] = value;
      }
    });

    return data;
  }, [searchParams]);

  // Process the HPP callback
  useEffect(() => {
    const processCallback = async () => {
      try {
        const callbackData = getCallbackData();
        
        // Validate we have required data
        if (!callbackData.SpiToken) {
          setError('No authentication token received');
          setStatus('error');
          return;
        }

        // Store the callback data on the backend
        // This allows the polling endpoint to pick up the result
        await spiAPI.hppCallback(callbackData);

        // Navigate to the HPP completion page with the token
        navigate(`/hpp-complete?token=${callbackData.SpiToken}`, { replace: true });
        
      } catch (err) {
        console.error('HPP Callback error:', err);
        setError('Failed to process payment authentication');
        setStatus('error');
      }
    };

    processCallback();
  }, [getCallbackData, navigate]);

  // Render
  if (status === 'error') {
    return (
      <div className="callback-container">
        <div className="callback-card error">
          <div className="callback-icon">❌</div>
          <h2>Authentication Failed</h2>
          <p>{error}</p>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/')}
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="callback-container">
      <div className="callback-card processing">
        <div className="loading-spinner"></div>
        <h2>Processing Your Payment</h2>
        <p>Please wait while we complete your secure payment...</p>
      </div>

      <style jsx>{`
        .callback-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .callback-card {
          background: white;
          border-radius: 16px;
          padding: 3rem;
          text-align: center;
          max-width: 400px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .callback-card.processing {
          animation: pulse 2s ease-in-out infinite;
        }

        .callback-icon {
          font-size: 4rem;
          margin-bottom: 1.5rem;
        }

        h2 {
          color: #333;
          margin: 0 0 1rem 0;
          font-size: 1.5rem;
        }

        p {
          color: #666;
          margin: 0;
          line-height: 1.6;
        }

        .btn {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          margin-top: 1.5rem;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }

        .loading-spinner {
          width: 60px;
          height: 60px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1.5rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

export default HPPCallback;

