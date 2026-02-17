/**
 * Barbados PayFine Platform - Payment Receipt Component
 * Displays digital receipt after successful payment
 */

import React from 'react';

function PaymentReceipt({ receipt, onBackToLookup }) {
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-BB', {
      style: 'currency',
      currency: 'BBD'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-BB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="receipt-container">
      <div className="card" style={{ margin: 0 }}>
        {/* Receipt Header */}
        <div className="receipt-header">
          <h2>🇧🇧 Payment Receipt</h2>
          <div className="receipt-number">
            Receipt #{receipt.receipt_number}
          </div>
        </div>

        {/* Receipt Body */}
        <div className="receipt-body">
          {/* Payment Summary */}
          <div className="receipt-section">
            <h3>💰 Payment Summary</h3>
            <div className="receipt-total">
              <div className="receipt-total-label">Amount Paid</div>
              <div className="receipt-total-amount">{formatCurrency(receipt.amount_paid)}</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9, marginTop: '0.5rem' }}>
                {receipt.currency} - {receipt.service}
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="receipt-section">
            <h3>📄 Transaction Details</h3>
            <div className="receipt-grid">
              <div className="receipt-item">
                <div className="receipt-item-label">Receipt Number</div>
                <div className="receipt-item-value">{receipt.receipt_number}</div>
              </div>
              <div className="receipt-item">
                <div className="receipt-item-label">Ticket Serial</div>
                <div className="receipt-item-value">{receipt.ticket_serial}</div>
              </div>
              <div className="receipt-item">
                <div className="receipt-item-label">Transaction ID</div>
                <div className="receipt-item-value">{receipt.transaction_id}</div>
              </div>
              <div className="receipt-item">
                <div className="receipt-item-label">Payment Date</div>
                <div className="receipt-item-value">{formatDate(receipt.payment_date)}</div>
              </div>
            </div>
          </div>

          {/* Ticket Information */}
          <div className="receipt-section">
            <h3>🎫 Ticket Information</h3>
            <div className="receipt-grid">
              <div className="receipt-item">
                <div className="receipt-item-label">Service</div>
                <div className="receipt-item-value">{receipt.service}</div>
              </div>
              <div className="receipt-item">
                <div className="receipt-item-label">Offense</div>
                <div className="receipt-item-value">{receipt.offense}</div>
              </div>
              {receipt.vehicle_plate && (
                <div className="receipt-item">
                  <div className="receipt-item-label">Vehicle Plate</div>
                  <div className="receipt-item-value">{receipt.vehicle_plate}</div>
                </div>
              )}
              <div className="receipt-item">
                <div className="receipt-item-label">Status</div>
                <div className="receipt-item-value" style={{ color: 'var(--success-green)', fontWeight: 'bold' }}>
                  {receipt.status}
                </div>
              </div>
            </div>
          </div>

          {/* Important Note */}
          <div className="receipt-note">
            <h4>📋 Important Notice</h4>
            <p>{receipt.note}</p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              <strong>Keep this receipt safe.</strong> You may need to present it as proof of payment.
            </p>
          </div>

          {/* Actions */}
          <div className="receipt-actions">
            <button
              onClick={handlePrint}
              className="btn btn-secondary"
            >
              🖨️ Print Receipt
            </button>
            <button
              onClick={onBackToLookup}
              className="btn btn-primary"
            >
              🔍 Lookup Another Ticket
            </button>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        <p>
          This is an official receipt from the Government of Barbados.
          <br />
          For any questions, contact the Magistrate Court at +1-246-228-2503
        </p>
      </div>
    </div>
  );
}

export default PaymentReceipt;
