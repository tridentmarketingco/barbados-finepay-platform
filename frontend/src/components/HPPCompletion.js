/**
 * Barbados PayFine Platform - HPP Completion Component
 * Completes the payment after 3DS authentication is complete
 * Enhanced with receipt download and print functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { spiAPI, handleAPIError } from '../services/api';

function HPPCompletion() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const spiToken = searchParams.get('token');

  // Complete the payment
  const completePayment = useCallback(async () => {
    if (!spiToken) {
      setError('No payment token found');
      setStatus('error');
      return;
    }

    try {
      setStatus('processing');
      
      // Poll for 3DS status first
      let statusResponse;
      for (let i = 0; i < 30; i++) { // Try for up to 60 seconds
        statusResponse = await spiAPI.getStatus(spiToken);
        
        if (statusResponse.status === 'completed' || statusResponse['3ds_result']) {
          break;
        }
        
        if (statusResponse.status === 'expired') {
          setError('Payment session has expired');
          setStatus('error');
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Complete the payment
      const paymentResponse = await spiAPI.completePayment(spiToken);
      
      if (paymentResponse.success && paymentResponse.Approved) {
        setPaymentResult(paymentResponse);
        setReceipt(paymentResponse.receipt);
        setStatus('success');
      } else {
        setError(paymentResponse.message || 'Payment was declined');
        setStatus('declined');
      }
      
    } catch (err) {
      const errorInfo = handleAPIError(err);
      setError(errorInfo.message);
      setStatus('error');
    }
  }, [spiToken]);

  useEffect(() => {
    completePayment();
  }, [completePayment]);

  // Download receipt as text file
  const downloadReceipt = useCallback(() => {
    if (!receipt) return;
    
    setDownloading(true);
    
    try {
      const receiptText = `
PAYMENT RECEIPT
================================================================================

Receipt Number: ${receipt.receipt_number}
Ticket Number: ${receipt.ticket_serial}
Payment Date: ${new Date(receipt.payment_date).toLocaleString()}

PAYMENT DETAILS
--------------------------------------------------------------------------------
Amount Paid: $${receipt.amount_paid.toFixed(2)} ${receipt.currency}
Transaction ID: ${receipt.transaction_id}
Payment Reference: ${receipt.payment_reference || 'N/A'}
Service: ${receipt.service}
Offense: ${receipt.offense || 'N/A'}
Vehicle Plate: ${receipt.vehicle_plate || 'N/A'}

STATUS
--------------------------------------------------------------------------------
Payment Status: ${receipt.status}

IMPORTANT NOTICE
--------------------------------------------------------------------------------
${receipt.note || 'Keep this receipt for your records. This is an official payment confirmation.'}

Issued by: PayFine Platform
Generated: ${new Date().toLocaleString()}

================================================================================
      `.trim();
      
      const blob = new Blob([receiptText], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${receipt.receipt_number}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download receipt. Please try again.');
    } finally {
      setDownloading(false);
    }
  }, [receipt]);

  // Print receipt
  const printReceipt = useCallback(() => {
    if (!receipt) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the receipt.');
      return;
    }
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Receipt - ${receipt.receipt_number}</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            max-width: 800px;
            margin: 20px auto;
            padding: 20px;
            line-height: 1.6;
          }
          h1 {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .section {
            margin: 20px 0;
          }
          .section-title {
            font-weight: bold;
            border-bottom: 1px solid #666;
            margin-bottom: 10px;
            padding-bottom: 5px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
          }
          .label {
            font-weight: bold;
          }
          .status {
            background: #28a745;
            color: white;
            padding: 2px 8px;
            border-radius: 3px;
            display: inline-block;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 0.9em;
            color: #666;
            border-top: 1px solid #ccc;
            padding-top: 10px;
          }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <h1>PAYMENT RECEIPT</h1>
        
        <div class="section">
          <div class="row">
            <span class="label">Receipt Number:</span>
            <span>${receipt.receipt_number}</span>
          </div>
          <div class="row">
            <span class="label">Ticket Number:</span>
            <span>${receipt.ticket_serial}</span>
          </div>
          <div class="row">
            <span class="label">Payment Date:</span>
            <span>${new Date(receipt.payment_date).toLocaleString()}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">PAYMENT DETAILS</div>
          <div class="row">
            <span class="label">Amount Paid:</span>
            <span>$${receipt.amount_paid.toFixed(2)} ${receipt.currency}</span>
          </div>
          <div class="row">
            <span class="label">Transaction ID:</span>
            <span>${receipt.transaction_id}</span>
          </div>
          <div class="row">
            <span class="label">Service:</span>
            <span>${receipt.service}</span>
          </div>
          ${receipt.offense ? `
          <div class="row">
            <span class="label">Offense:</span>
            <span>${receipt.offense}</span>
          </div>
          ` : ''}
          ${receipt.vehicle_plate ? `
          <div class="row">
            <span class="label">Vehicle Plate:</span>
            <span>${receipt.vehicle_plate}</span>
          </div>
          ` : ''}
        </div>

        <div class="section">
          <div class="section-title">STATUS</div>
          <div class="row">
            <span class="label">Payment Status:</span>
            <span class="status">${receipt.status}</span>
          </div>
        </div>

        <div class="footer">
          <p><strong>IMPORTANT:</strong> ${receipt.note || 'Keep this receipt for your records.'}</p>
          <p>Issued by PayFine Platform | Generated: ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load before printing
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }, [receipt]);

  // Render success state
  if (status === 'success' && receipt) {
    return (
      <div className="completion-container">
        <div className="completion-card success">
          <div className="completion-icon">✅</div>
          <h2>Payment Successful!</h2>
          <p className="success-message">Your payment has been processed successfully.</p>
          
          <div className="receipt-section">
            <h3>Payment Receipt</h3>
            <div className="receipt-details">
              <div className="receipt-row">
                <span className="label">Receipt Number:</span>
                <span className="value">{receipt.receipt_number}</span>
              </div>
              <div className="receipt-row">
                <span className="label">Ticket:</span>
                <span className="value">{receipt.ticket_serial}</span>
              </div>
              <div className="receipt-row">
                <span className="label">Amount Paid:</span>
                <span className="value amount">${receipt.amount_paid.toFixed(2)} {receipt.currency}</span>
              </div>
              <div className="receipt-row">
                <span className="label">Payment Date:</span>
                <span className="value">{new Date(receipt.payment_date).toLocaleString()}</span>
              </div>
              <div className="receipt-row">
                <span className="label">Transaction ID:</span>
                <span className="value">{receipt.transaction_id}</span>
              </div>
              <div className="receipt-row">
                <span className="label">Service:</span>
                <span className="value">{receipt.service}</span>
              </div>
              {receipt.offense && (
                <div className="receipt-row">
                  <span className="label">Offense:</span>
                  <span className="value">{receipt.offense}</span>
                </div>
              )}
              {receipt.vehicle_plate && (
                <div className="receipt-row">
                  <span className="label">Vehicle Plate:</span>
                  <span className="value">{receipt.vehicle_plate}</span>
                </div>
              )}
              <div className="receipt-row">
                <span className="label">Status:</span>
                <span className="status-badge">{receipt.status}</span>
              </div>
            </div>
          </div>

          <div className="completion-actions">
            <button 
              className="btn btn-secondary"
              onClick={printReceipt}
              title="Print receipt"
            >
              🖨️ Print Receipt
            </button>
            <button 
              className="btn btn-secondary"
              onClick={downloadReceipt}
              disabled={downloading}
              title="Download receipt as text file"
            >
              {downloading ? '⏳ Downloading...' : '📥 Download Receipt'}
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/')}
            >
              ✓ Return to Home
            </button>
          </div>

          <div className="important-notice">
            <p className="note">
              <strong>📋 Important:</strong> {receipt.note || 'Keep this receipt for your records. This is an official payment confirmation.'}
            </p>
          </div>
        </div>

        <style jsx>{`
          .completion-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
          }

          .completion-card {
            background: white;
            border-radius: 16px;
            padding: 3rem;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }

          .completion-card.success {
            border-top: 5px solid #28a745;
          }

          .completion-icon {
            font-size: 4rem;
            text-align: center;
            margin-bottom: 1rem;
          }

          h2 {
            color: #333;
            margin: 0 0 0.5rem 0;
            font-size: 1.8rem;
            text-align: center;
          }

          .success-message {
            color: #666;
            text-align: center;
            margin: 0 0 2rem 0;
            font-size: 1.1rem;
          }

          .receipt-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 1.5rem;
            margin: 2rem 0;
          }

          .receipt-section h3 {
            margin: 0 0 1rem 0;
            color: #333;
            font-size: 1.2rem;
            border-bottom: 2px solid #dee2e6;
            padding-bottom: 0.5rem;
          }

          .receipt-details {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .receipt-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
            border-bottom: 1px solid #e9ecef;
          }

          .receipt-row:last-child {
            border-bottom: none;
          }

          .receipt-row .label {
            font-weight: 600;
            color: #495057;
          }

          .receipt-row .value {
            color: #212529;
            text-align: right;
          }

          .receipt-row .value.amount {
            font-size: 1.2rem;
            font-weight: bold;
            color: #28a745;
          }

          .status-badge {
            background: #28a745;
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-size: 0.9rem;
            font-weight: 600;
          }

          .completion-actions {
            display: flex;
            gap: 1rem;
            margin-top: 2rem;
            flex-wrap: wrap;
            justify-content: center;
          }

          .btn {
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
            flex: 1;
            min-width: 150px;
          }

          .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          }

          .btn-secondary {
            background: #6c757d;
            color: white;
          }

          .btn-secondary:hover:not(:disabled) {
            background: #5a6268;
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(108, 117, 125, 0.4);
          }

          .important-notice {
            margin-top: 2rem;
            padding: 1rem;
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            border-radius: 4px;
          }

          .note {
            margin: 0;
            color: #856404;
            font-size: 0.95rem;
            line-height: 1.5;
          }

          @media (max-width: 600px) {
            .completion-card {
              padding: 2rem 1.5rem;
            }

            .completion-actions {
              flex-direction: column;
            }

            .btn {
              width: 100%;
            }

            .receipt-row {
              flex-direction: column;
              align-items: flex-start;
              gap: 0.25rem;
            }

            .receipt-row .value {
              text-align: left;
            }
          }
        `}</style>
      </div>
    );
  }

  // Render declined state
  if (status === 'declined') {
    return (
      <div className="completion-container">
        <div className="completion-card declined">
          <div className="completion-icon">⚠️</div>
          <h2>Payment Declined</h2>
          <p>{error}</p>
          
          <div className="completion-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => navigate('/')}
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (status === 'error') {
    return (
      <div className="completion-container">
        <div className="completion-card error">
          <div className="completion-icon">❌</div>
          <h2>Payment Error</h2>
          <p>{error}</p>
          
          <div className="completion-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => navigate('/')}
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render processing state
  return (
    <div className="completion-container">
      <div className="completion-card processing">
        <div className="loading-spinner"></div>
        <h2>Completing Your Payment</h2>
        <p>Please wait while we finalize your secure payment...</p>
        <div className="progress-info">
          <p>🔐 3D-Secure authentication complete</p>
          <p>Processing payment with your bank...</p>
        </div>
      </div>
    </div>
  );
}

export default HPPCompletion;

