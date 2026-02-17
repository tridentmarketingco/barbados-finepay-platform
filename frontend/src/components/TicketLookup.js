/**
 * Barbados PayFine Platform - Enhanced Ticket Lookup Component
 * Search for tickets and initiate payment with improved UX
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ticketAPI, handleAPIError } from '../services/api';
import { gamificationAPI } from '../services/gamificationApi';
import HPPIframe from './HPPIframe';
import TridentVerification from './TridentVerification';
import ChallengeTicket from './ChallengeTicket';
import EarlyPaymentIncentive from './citizen/EarlyPaymentIncentive';

function TicketLookup({ onPaymentSuccess }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchSerial, setSearchSerial] = useState('');
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [showHPPIframe, setShowHPPIframe] = useState(false);
  const [spiData, setSpiData] = useState(null);
  const [showVerification, setShowVerification] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [challengeStatus, setChallengeStatus] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showStatusLegend, setShowStatusLegend] = useState(false);
  const [discountPreview, setDiscountPreview] = useState(null);
  const inputRef = useRef(null);

  // Load search history from localStorage on mount
  useEffect(() => {
    const history = localStorage.getItem('ticketSearchHistory');
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch (e) {
        console.error('Failed to load search history:', e);
      }
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Esc to clear
      if (e.key === 'Escape' && !showHPPIframe) {
        handleClear();
      }
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showHPPIframe]);

  // Auto-dismiss alerts after 5 seconds
  useEffect(() => {
    if (alert && alert.type === 'success') {
      const timer = setTimeout(() => setAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Handle URL parameters for shared ticket links
  useEffect(() => {
    const ticketParam = searchParams.get('ticket');
    if (ticketParam && !ticket) {
      const validatedParam = ticketParam.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (/^[A-Z][0-9]{6}$/.test(validatedParam)) {
        setSearchSerial(validatedParam);
        // Trigger search after a short delay to ensure component is ready
        setTimeout(() => {
          handleSearch(null, validatedParam);
        }, 100);
      }
    }
  }, [searchParams, ticket]);

  // Validate ticket number format (A459778 - Letter + 6 digits)
  const validateTicketNumber = (value) => {
    const pattern = /^[A-Z][0-9]{6}$/;
    return pattern.test(value);
  };

  // Handle input change (uppercase only, no formatting)
  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Limit to 7 characters (1 letter + 6 digits)
    setSearchSerial(value.slice(0, 7));
  };

  // Add to search history
  const addToSearchHistory = (serialNumber) => {
    const newHistory = [
      serialNumber,
      ...searchHistory.filter(s => s !== serialNumber)
    ].slice(0, 5); // Keep only last 5
    
    setSearchHistory(newHistory);
    localStorage.setItem('ticketSearchHistory', JSON.stringify(newHistory));
  };

  // Clear search history
  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('ticketSearchHistory');
  };

  // Clear input and results
  const handleClear = () => {
    setSearchSerial('');
    setTicket(null);
    setAlert(null);
    setShowVerification(false);
    setChallengeStatus(null);
    inputRef.current?.focus();
  };

  // Handle search form submission
  const handleSearch = async (e, serialToSearch = null) => {
    if (e) e.preventDefault();
    
    const searchValue = serialToSearch || searchSerial.trim();
    
    if (!searchValue) {
      setAlert({
        type: 'error',
        message: 'Please enter a ticket serial number'
      });
      return;
    }

    // Validate format
    if (!validateTicketNumber(searchValue)) {
      setAlert({
        type: 'error',
        message: 'Invalid ticket format. Expected format: A459778 (Letter + 6 digits)'
      });
      return;
    }

    setLoading(true);
    setAlert(null);
    setShowHPPIframe(false);
    setShowChallengeForm(false);

    try {
      const response = await ticketAPI.lookup(searchValue);
      setTicket(response.ticket);
      setRequiresVerification(response.requires_verification || false);
      
      // Add to search history
      addToSearchHistory(searchValue);
      
      // Load early payment discount preview
      try {
        const discountData = await gamificationAPI.getDiscountPreview(searchValue);
        setDiscountPreview(discountData);
      } catch (err) {
        console.error('Failed to load discount preview:', err);
        setDiscountPreview(null);
      }
      
      // Check for challenge status
      if (response.ticket.has_challenge) {
        try {
          const challengeData = await ticketAPI.getChallengeStatus(searchValue);
          setChallengeStatus(challengeData);
        } catch (err) {
          console.error('Failed to load challenge status:', err);
        }
      } else {
        setChallengeStatus(null);
      }
      
      // Show verification step if required
      if (response.requires_verification) {
        setShowVerification(true);
        setAlert({
          type: 'info',
          message: 'Ticket found! Please verify your identity to proceed.'
        });
      } else {
        setShowVerification(false);
        setAlert({
          type: 'success',
          message: 'Ticket found successfully!'
        });
      }
      
    } catch (error) {
      const errorInfo = handleAPIError(error);
      setAlert(errorInfo);
      setTicket(null);
      setShowVerification(false);
      setChallengeStatus(null);
    } finally {
      setLoading(false);
    }
  };

  // Print ticket details
  const handlePrint = () => {
    window.print();
  };

  // Share ticket link
  const handleShare = async () => {
    // Safety check - make sure ticket exists
    if (!ticket || !ticket.serial_number) {
      setAlert({
        type: 'error',
        message: 'No ticket to share'
      });
      return;
    }

    const shareUrl = `/ticket-lookup?ticket=${ticket.serial_number}`;
    
    // Update the browser URL without navigating away
    setSearchParams({ ticket: ticket.serial_number });
    
    // Get full URL for sharing - handle different browser environments
    let fullUrl;
    try {
      const origin = window.location.origin || `${window.location.protocol}//${window.location.host}`;
      fullUrl = `${origin}${shareUrl}`;
    } catch (e) {
      fullUrl = shareUrl;
    }
    
    // Try native share first, fall back to clipboard
    if (navigator && navigator.share && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Traffic Ticket ${ticket.serial_number}`,
          url: fullUrl
        });
      } catch (err) {
        // User cancelled or share failed - don't show error for AbortError
        if (err.name !== 'AbortError') {
          // Fall back to clipboard
          copyToClipboard(fullUrl);
        }
      }
    } else {
      // Fall back to clipboard
      copyToClipboard(fullUrl);
    }
  };


  // Copy to clipboard
  const copyToClipboard = (text) => {
    if (!text) {
      setAlert({
        type: 'error',
        message: 'Nothing to copy'
      });
      return;
    }
    
    // Use modern clipboard API with fallback
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setAlert({
          type: 'success',
          message: 'Link copied to clipboard!'
        });
      }).catch(() => {
        // Fallback: use execCommand
        try {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          document.body.appendChild(textArea);
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (successful) {
            setAlert({
              type: 'success',
              message: 'Link copied to clipboard!'
            });
          } else {
            throw new Error('execCommand failed');
          }
        } catch (e) {
          setAlert({
            type: 'error',
            message: 'Failed to copy link. Please copy manually.'
          });
        }
      });
    } else {
      setAlert({
        type: 'error',
        message: 'Clipboard not supported. Please copy manually.'
      });
    }
  };


  // Handle Trident verification success
  const handleVerificationSuccess = (verifiedTicket) => {
    setTicket(verifiedTicket);
    setShowVerification(false);
    setRequiresVerification(false);
    setAlert({
      type: 'success',
      message: 'Identity verified! You can now proceed with payment.'
    });
  };

  // Handle verification skip (for tickets without Trident ID)
  const handleVerificationSkip = () => {
    setShowVerification(false);
    setRequiresVerification(false);
  };

  // Handle challenge button click
  const handleChallengeClick = () => {
    setShowChallengeForm(true);
  };

  // Handle challenge cancel
  const handleChallengeCancel = () => {
    setShowChallengeForm(false);
  };

  // Handle challenge submission success
  const handleChallengeSubmitted = async (result) => {
    setShowChallengeForm(false);
    // Reload ticket to get updated status
    try {
      const response = await ticketAPI.lookup(ticket.serial_number);
      setTicket(response.ticket);
      const challengeData = await ticketAPI.getChallengeStatus(ticket.serial_number);
      setChallengeStatus(challengeData);
    } catch (err) {
      console.error('Failed to reload ticket:', err);
    }
  };

  // Handle payment success
  const handlePaymentSuccess = (receipt) => {
    setShowHPPIframe(false);
    setSpiData(null);
    setTicket(null);
    setSearchSerial('');
    setShowVerification(false);
    onPaymentSuccess(receipt);
  };

  // Handle HPP payment initiation
  const initiateHPPPayment = async () => {
    setLoading(true);
    setAlert(null);

    try {
      // Call SPI initiate endpoint
      const response = await ticketAPI.initiateSPI(ticket.serial_number, {
        email: '',
        billing_address: {}
      });

      if (response.success && response.RedirectData) {
        setSpiData({
          spiToken: response.SpiToken,
          redirectData: response.RedirectData,
          transactionId: response.TransactionIdentifier,
          expiresAt: response.expires_at
        });
        setShowHPPIframe(true);
      } else {
        setAlert({
          type: 'error',
          message: response.message || 'Failed to initiate secure payment'
        });
      }
    } catch (error) {
      const errorInfo = handleAPIError(error);
      setAlert(errorInfo);
    } finally {
      setLoading(false);
    }
  };

  // Handle HPP error
  const handleHPPError = (error) => {
    setAlert({
      type: 'error',
      message: error.message || 'Payment failed. Please try again.'
    });
    setShowHPPIframe(false);
    setSpiData(null);
  };

  // Handle HPP cancel
  const handleHPPCancel = () => {
    setShowHPPIframe(false);
    setSpiData(null);
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'status-paid';
      case 'overdue':
        return 'status-overdue';
      default:
        return 'status-unpaid';
    }
  };

  // Helper to check if ticket is in a payable status (case-insensitive)
  const isPayableStatus = (status) => {
    const s = status?.toLowerCase();
    return ['unpaid', 'overdue', 'challenged', 'adjusted', 'payable', 'issued', 'verified'].includes(s);
  };

  // Show challenge form if requested
  if (showChallengeForm && ticket) {
    return (
      <ChallengeTicket
        ticket={ticket}
        onChallengeSubmitted={handleChallengeSubmitted}
        onCancel={handleChallengeCancel}
      />
    );
  }

  // Show verification component if needed
  if (showVerification && ticket) {
    return (
      <TridentVerification
        ticket={ticket}
        onVerified={handleVerificationSuccess}
        onSkip={handleVerificationSkip}
      />
    );
  }

  return (
    <div>
      {/* Search Form */}
      <div className="card">
        <div className="card-header">
          <h2>🔍 Look Up Traffic Ticket</h2>
          <p>Enter the ticket serial number (e.g., A459778)</p>
        </div>

        <form onSubmit={handleSearch}>
          <div className="form-group">
            <label htmlFor="serial">Ticket Serial Number</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <input
                type="text"
                id="serial"
                value={searchSerial}
                onChange={handleInputChange}
                placeholder="Enter ticket serial number"
                style={{ flex: 1 }}
                disabled={loading}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="loading"></span>
                    Searching...
                  </>
                ) : (
                  <>
                    🔍 Search
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Sample Serial Numbers */}
        <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <strong>Try these sample tickets:</strong>
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['A459778', 'B123456', 'C789012'].map(serial => (
              <button
                key={serial}
                type="button"
                onClick={() => setSearchSerial(serial)}
                style={{
                  padding: '0.25rem 0.75rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.target.style.background = 'var(--bg-primary)'}
              >
                {serial}
              </button>
            ))}
          </div>
        </div>

        {/* Search History */}
        {searchHistory.length > 0 && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--primary-blue)', margin: 0 }}>
                <strong>📋 Recent Searches:</strong>
              </p>
              <button
                type="button"
                onClick={clearSearchHistory}
                style={{
                  padding: '0.25rem 0.5rem',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--primary-blue)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  textDecoration: 'underline'
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {searchHistory.map((serial, index) => (
                <button
                  key={`${serial}-${index}`}
                  type="button"
                  onClick={() => handleSearch(null, serial)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    border: '1px solid var(--primary-blue)',
                    borderRadius: '4px',
                    background: 'var(--bg-primary)',
                    color: 'var(--primary-blue)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'var(--primary-blue)';
                    e.target.style.color = 'var(--white)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'var(--bg-primary)';
                    e.target.style.color = 'var(--primary-blue)';
                  }}
                >
                  {serial}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowStatusLegend(!showStatusLegend)}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span>ℹ️</span>
            Status Guide
          </button>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span>❓</span>
            Help & FAQ
          </button>
        </div>

        {/* Status Legend */}
        {showStatusLegend && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--warning-orange)' }}>
              📊 Ticket Status Guide
            </h4>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="status-badge status-unpaid" style={{ fontSize: '0.75rem' }}>UNPAID</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ticket issued, payment pending</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="status-badge status-overdue" style={{ fontSize: '0.75rem' }}>OVERDUE</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Payment deadline passed</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="status-badge status-paid" style={{ fontSize: '0.75rem' }}>PAID</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Payment completed successfully</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="status-badge status-Challenged" style={{ fontSize: '0.75rem' }}>CHALLENGED</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Under review, payment blocked</span>
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        {showHelp && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#e8f5e9', borderRadius: '8px', border: '1px solid #4caf50' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--success-green)' }}>
              ❓ Frequently Asked Questions
            </h4>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <details style={{ fontSize: '0.85rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: 'var(--success-green)' }}>
                  Where can I find my ticket number?
                </summary>
                <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', paddingLeft: '1rem' }}>
                  Your ticket number is printed at the top of your traffic ticket. It follows the format A459778 (one letter followed by 6 digits).
                </p>
              </details>
              <details style={{ fontSize: '0.85rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: 'var(--success-green)' }}>
                  What payment methods are accepted?
                </summary>
                <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', paddingLeft: '1rem' }}>
                  We accept all major credit and debit cards through our secure 3D-Secure payment system powered by PowerTranz.
                </p>
              </details>
              <details style={{ fontSize: '0.85rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: 'var(--success-green)' }}>
                  Can I challenge a ticket?
                </summary>
                <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', paddingLeft: '1rem' }}>
                  Yes! After looking up your ticket, click the "Challenge Ticket" button to submit your challenge with supporting evidence.
                </p>
              </details>
              <details style={{ fontSize: '0.85rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: 'var(--success-green)' }}>
                  What if my ticket is overdue?
                </summary>
                <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', paddingLeft: '1rem' }}>
                  You can still pay overdue tickets online. Additional penalties may apply. For questions, contact the Magistrate Court at +1-246-228-2503.
                </p>
              </details>
              <details style={{ fontSize: '0.85rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: 'var(--success-green)' }}>
                  Need more help?
                </summary>
                <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', paddingLeft: '1rem' }}>
                  📞 Magistrate Court: +1-246-228-2503<br />
                  📍 Coleridge Street, Bridgetown, Barbados<br />
                  📧 traffic@gov.bb
                </p>
              </details>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Hint */}
        <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          💡 <strong>Tip:</strong> Press <kbd style={{ padding: '0.1rem 0.3rem', background: 'white', border: '1px solid #dee2e6', borderRadius: '3px' }}>Esc</kbd> to clear | 
          <kbd style={{ padding: '0.1rem 0.3rem', background: 'white', border: '1px solid #dee2e6', borderRadius: '3px', marginLeft: '0.5rem' }}>Ctrl+K</kbd> to focus search
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

      {/* Ticket Details */}
      {ticket && !showHPPIframe && (
        <div className="card">
          <div className="card-header">
            <h2>🎫 Ticket Details</h2>
            <span className={`status-badge ${getStatusBadgeClass(ticket.status)}`}>
              {ticket.status?.toUpperCase() || 'UNKNOWN'}
            </span>
          </div>

          {/* Verification Status Badge */}
          {ticket.verification_status && (
            <div style={{ marginBottom: '1rem' }}>
              <span className={`status-badge status-${ticket.verification_status}`}>
                {ticket.verification_status === 'issued' && '📋 Issued'}
                {ticket.verification_status === 'unverified' && '🔒 Unverified'}
                {ticket.verification_status === 'verified' && '✓ Verified'}
                {ticket.verification_status === 'paid' && '✓ Paid'}
              </span>
            </div>
          )}

          {/* Ticket Info */}
          <div className="ticket-details">
            <div className="detail-row">
              <span className="detail-label">Serial Number</span>
              <span className="detail-value">{ticket.serial_number}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Service</span>
              <span className="detail-value">{ticket.service?.name}</span>
            </div>
            
            {/* Offence Information (NEW) */}
            {ticket.offence ? (
              <>
                <div className="detail-row">
                  <span className="detail-label">Offence</span>
                  <span className="detail-value"><strong>{ticket.offence.name}</strong></span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Category</span>
                  <span className="detail-value">{ticket.offence.category?.name}</span>
                </div>
                {ticket.measured_value && (
                  <div className="detail-row">
                    <span className="detail-label">Measured Value</span>
                    <span className="detail-value">
                      {ticket.measured_value} {ticket.offence.unit}
                    </span>
                  </div>
                )}
                {ticket.points > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Demerit Points</span>
                    <span className="detail-value">
                      <span style={{ color: 'var(--danger-red)', fontWeight: 'bold' }}>
                        {ticket.points} points
                      </span>
                    </span>
                  </div>
                )}
                {ticket.is_repeat_offence && (
                  <div className="detail-row">
                    <span className="detail-label">Repeat Offence</span>
                    <span className="detail-value">
                      <span style={{ color: 'var(--danger-red)' }}>
                        ⚠️ Yes ({ticket.repeat_count} prior offence{ticket.repeat_count > 1 ? 's' : ''})
                      </span>
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="detail-row">
                <span className="detail-label">Offense</span>
                <span className="detail-value">{ticket.offense_description}</span>
              </div>
            )}
            
            <div className="detail-row">
              <span className="detail-label">Location</span>
              <span className="detail-value">{ticket.location}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Vehicle Plate</span>
              <span className="detail-value">{ticket.vehicle_plate}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Officer Badge</span>
              <span className="detail-value">{ticket.officer_badge}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Issue Date</span>
              <span className="detail-value">
                {new Date(ticket.issue_date).toLocaleDateString()}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Due Date</span>
              <span className="detail-value">
                {new Date(ticket.due_date).toLocaleDateString()}
                {ticket.days_until_due > 0 && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    ({ticket.days_until_due} days left)
                  </span>
                )}
                {ticket.days_until_due <= 0 && ticket.status?.toLowerCase() !== 'paid' && (
                  <span style={{ color: 'var(--danger-red)', marginLeft: '0.5rem' }}>
                    (Overdue!)
                  </span>
                )}
              </span>
            </div>
            <div className="detail-row" style={{ background: '#e3f2fd', margin: '0 -1.5rem', padding: '1rem 1.5rem' }}>
              <span className="detail-label" style={{ fontSize: '1.1rem' }}>Fine Amount</span>
              <span className="detail-value amount-highlight">
                ${ticket.fine_amount.toFixed(2)} BBD
              </span>
            </div>
          </div>

          {/* Challenge Status Display (ENHANCED) */}
          {challengeStatus && challengeStatus.has_challenge && (
            <div className={`alert ${
              challengeStatus.challenge.outcome === 'Dismissed' ? 'alert-success' :
              challengeStatus.challenge.outcome === 'FineAdjusted' ? 'alert-info' :
              challengeStatus.challenge.outcome === 'Upheld' ? 'alert-warning' :
              'alert-info'
            }`} style={{ marginTop: '1.5rem' }}>
              <span className="alert-icon">
                {challengeStatus.challenge.outcome === 'Dismissed' ? '✅' :
                 challengeStatus.challenge.outcome === 'FineAdjusted' ? '💰' :
                 challengeStatus.challenge.outcome === 'Upheld' ? '⚖️' :
                 '⚖️'}
              </span>
              <div className="alert-content">
                {/* Determine if challenge has been resolved based on outcome or ticket status */}
                {(challengeStatus.admin_decision || challengeStatus.challenge.outcome || 
                  ['Payable', 'Dismissed', 'Adjusted'].includes(ticket.status)) ? (
                  /* Admin Decision Details or Resolved Status */
                  <div>
                    <p><strong>
                      {(challengeStatus.challenge.outcome === 'Dismissed' || ticket.status === 'Dismissed') && 'Challenge Approved - Ticket Dismissed'}
                      {(challengeStatus.challenge.outcome === 'FineAdjusted' || ticket.status === 'Adjusted') && 'Challenge Approved - Fine Adjusted'}
                      {(challengeStatus.challenge.outcome === 'Upheld' || ticket.status === 'Payable') && 'Challenge Reviewed - Ticket is Now Payable'}
                    </strong></p>
                    
                    {challengeStatus.outcome_message && (
                      <p style={{ marginTop: '0.5rem' }}>{challengeStatus.outcome_message}</p>
                    )}
                    
                    {/* Show adjusted fine details */}
                    {challengeStatus.admin_decision?.outcome === 'FineAdjusted' && challengeStatus.admin_decision.adjusted_fine && (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(33, 150, 243, 0.1)', borderRadius: '4px' }}>
                        <p style={{ margin: 0 }}>
                          <strong>Original Fine:</strong> ${challengeStatus.admin_decision.original_fine?.toFixed(2)} BBD<br />
                          <strong>Adjusted Fine:</strong> ${challengeStatus.admin_decision.adjusted_fine.toFixed(2)} BBD
                        </p>
                      </div>
                    )}
                    
                    {/* Admin Notes */}
                    {challengeStatus.admin_decision?.admin_notes && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', fontWeight: 'bold' }}>Administrator's Notes:</p>
                        <p style={{ 
                          margin: 0, 
                          padding: '0.75rem', 
                          background: 'rgba(0,0,0,0.05)', 
                          borderRadius: '4px',
                          fontStyle: 'italic',
                          fontSize: '0.9rem',
                          lineHeight: '1.5'
                        }}>
                          "{challengeStatus.admin_decision.admin_notes}"
                        </p>
                      </div>
                    )}
                    
                    {/* Review Details */}
                    {challengeStatus.admin_decision?.reviewed_at && (
                      <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Reviewed on {new Date(challengeStatus.admin_decision.reviewed_at).toLocaleDateString()}
                        {challengeStatus.admin_decision.reviewed_by && ` by ${challengeStatus.admin_decision.reviewed_by}`}
                      </p>
                    )}
                    
                    {/* Show message for Payable status when challenge was upheld */}
                    {ticket.status === 'Payable' && !challengeStatus.admin_decision?.admin_notes && (
                      <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                        Your challenge has been reviewed. The original fine has been upheld and the ticket is now available for payment.
                      </p>
                    )}
                  </div>
                ) : (
                  /* Pending/Under Review Messages (only shown when challenge is truly pending) */
                  <div>
                    <p><strong>Challenge Status: {challengeStatus.challenge.status}</strong></p>
                    {challengeStatus.challenge.status === 'Pending' && (
                      <p style={{ marginTop: '0.5rem' }}>Your challenge is pending review. Payment is blocked until resolved.</p>
                    )}
                    {challengeStatus.challenge.status === 'UnderReview' && (
                      <p style={{ marginTop: '0.5rem' }}>Your challenge is currently under review. Payment is blocked until resolved.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Early Payment Incentive */}
          {discountPreview && discountPreview.has_discount && !ticket.is_overdue && ticket.can_pay_online && (
            <EarlyPaymentIncentive discountPreview={discountPreview} />
          )}

          {/* Court Required Notice (NEW) */}
          {ticket.court_required && (
            <div className="alert alert-warning" style={{ marginTop: '1.5rem' }}>
              <span className="alert-icon">⚖️</span>
              <div className="alert-content">
                <p><strong>Court Appearance Required</strong></p>
                <p>This offence requires a court appearance. Online payment is not available.</p>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  📞 Magistrate Court: +1-246-228-2503<br />
                  📍 Coleridge Street, Bridgetown, Barbados
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons - Print & Share */}
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={handlePrint}
              className="btn btn-secondary"
              style={{ flex: '1', minWidth: '120px' }}
            >
              🖨️ Print Details
            </button>
            <button
              onClick={handleShare}
              className="btn btn-secondary"
              style={{ flex: '1', minWidth: '120px' }}
            >
              🔗 Share Link
            </button>
          </div>

          {/* Payment Button or Status */}
          {/* FIXED: Using isPayableStatus helper which handles 'issued' and 'verified' statuses */}
          {isPayableStatus(ticket.status) && !ticket.court_required && (
            <div style={{ marginTop: '1.5rem' }}>
              {/* Overdue Warning */}
              {ticket.is_overdue && !ticket.has_challenge && (
                <div className="alert alert-warning">
                  <span className="alert-icon">⚠️</span>
                  <div className="alert-content">
                    <p><strong>This ticket is OVERDUE!</strong></p>
                    <p>You can still pay online, but additional penalties may apply. For questions, please contact the Magistrate Court.</p>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                      📞 +1-246-228-2503 | 📍 Coleridge Street, Bridgetown, Barbados
                    </p>
                  </div>
                </div>
              )}

              {/* Secure Payment Notice */}
              {!ticket.is_overdue && !ticket.has_challenge && ticket.can_pay_online && (
                <div className="alert alert-info">
                  <span className="alert-icon">🔐</span>
                  <div className="alert-content">
                    <p><strong>Secure 3D-Secure Payment</strong></p>
                    <p>Your payment will be processed securely using PowerTranz with 3D-Secure authentication.</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                {/* Challenge Button */}
                {!ticket.has_challenge && ticket.can_pay_online && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleChallengeClick}
                    style={{ flex: '1', minWidth: '150px' }}
                  >
                    ⚖️ Challenge Ticket
                  </button>
                )}

                {/* Pay Now Button */}
                {ticket.can_pay_online && ticket.status?.toLowerCase() !== 'dismissed' && (
                  <button
                    className="btn btn-success"
                    onClick={initiateHPPPayment}
                    disabled={loading}
                    style={{ flex: ticket.has_challenge ? '1' : '2', minWidth: '150px' }}
                  >
                    {loading ? (
                      <>
                        <span className="loading"></span>
                        Processing...
                      </>
                    ) : (
                      <>
                        💳 Pay ${ticket.fine_amount.toFixed(2)} BBD
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Payment Blocked Notice */}
              {!ticket.can_pay_online && !ticket.court_required && (
                <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
                  <span className="alert-icon">🚫</span>
                  <div className="alert-content">
                    <p><strong>Payment Currently Blocked</strong></p>
                    <p>
                      {ticket.has_challenge 
                        ? 'This ticket has an active challenge. Payment is blocked until the challenge is resolved.'
                        : 'Online payment is not available for this ticket at this time.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Paid Status */}
          {ticket.status?.toLowerCase() === 'paid' && (
            <div className="alert alert-success" style={{ marginTop: '1.5rem' }}>
              <span className="alert-icon">✅</span>
              <div className="alert-content">
                <p><strong>This ticket has been paid!</strong></p>
                <p>Payment Date: {new Date(ticket.paid_date).toLocaleString()}</p>
                <p>Reference: {ticket.payment_reference}</p>
              </div>
            </div>
          )}

          {/* Dismissed Status */}
          {ticket.status?.toLowerCase() === 'dismissed' && (
            <div className="alert alert-success" style={{ marginTop: '1.5rem' }}>
              <span className="alert-icon">✅</span>
              <div className="alert-content">
                <p><strong>This ticket has been dismissed!</strong></p>
                <p>Your challenge was approved and no payment is required.</p>
                {challengeStatus?.admin_decision?.reviewed_at && (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Dismissed on {new Date(challengeStatus.admin_decision.reviewed_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* HPP Iframe Payment Flow */}
      {showHPPIframe && spiData && (
        <HPPIframe
          redirectData={spiData.redirectData}
          spiToken={spiData.spiToken}
          onAuthenticationComplete={handlePaymentSuccess}
          onError={handleHPPError}
          onCancel={handleHPPCancel}
        />
      )}
    </div>
  );
}

export default TicketLookup;
