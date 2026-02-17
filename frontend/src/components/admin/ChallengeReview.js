/**
 * Challenge Review Component
 * Allows admins to review and process ticket challenges
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';
import '../../styles/Admin.css';

function ChallengeReview() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [adjustedFine, setAdjustedFine] = useState('');
  const [filterStatus, setFilterStatus] = useState('Pending');

  useEffect(() => {
    loadChallenges();
  }, [filterStatus]);

  const loadChallenges = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {};
      if (filterStatus && filterStatus !== 'all') {
        params.status = filterStatus;
      }

      const data = await adminAPI.getChallenges(params);
      setChallenges(data.challenges || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load challenges');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (challenge) => {
    try {
      const data = await adminAPI.getChallenge(challenge.id);
      setSelectedChallenge(data.challenge);
      setShowDetailModal(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to load challenge details');
    }
  };

  const handleStartReview = async (challenge) => {
    if (!window.confirm('Start reviewing this challenge?')) {
      return;
    }

    try {
      await adminAPI.startChallengeReview(challenge.id);
      loadChallenges();
      if (selectedChallenge && selectedChallenge.id === challenge.id) {
        const data = await adminAPI.getChallenge(challenge.id);
        setSelectedChallenge(data.challenge);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start review');
    }
  };

  const handleAction = (challenge, action) => {
    setSelectedChallenge(challenge);
    setActionType(action);
    setAdminNotes('');
    setAdjustedFine('');
    
    if (action === 'adjust' && challenge.ticket) {
      const originalFine = parseFloat(challenge.ticket.calculated_fine || challenge.ticket.fine_amount);
      setAdjustedFine(originalFine.toFixed(2));
    }
    
    setShowActionModal(true);
  };

  const handleSubmitAction = async () => {
    if (!adminNotes.trim()) {
      alert('Admin notes are required');
      return;
    }

    try {
      switch (actionType) {
        case 'dismiss':
          await adminAPI.dismissChallenge(selectedChallenge.id, adminNotes);
          break;
        case 'adjust':
          if (!adjustedFine) {
            alert('Adjusted fine amount is required');
            return;
          }
          await adminAPI.adjustChallengeFine(selectedChallenge.id, parseFloat(adjustedFine), adminNotes);
          break;
        case 'uphold':
          await adminAPI.upholdChallenge(selectedChallenge.id, adminNotes);
          break;
        default:
          return;
      }

      setShowActionModal(false);
      setShowDetailModal(false);
      loadChallenges();
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Action failed');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Pending': 'badge-warning',
      'UnderReview': 'badge-info',
      'Approved': 'badge-success',
      'Rejected': 'badge-danger'
    };
    return badges[status] || 'badge-secondary';
  };

  const getOutcomeBadge = (outcome) => {
    const badges = {
      'Dismissed': 'badge-success',
      'FineAdjusted': 'badge-info',
      'Upheld': 'badge-danger'
    };
    return badges[outcome] || 'badge-secondary';
  };

  const calculateFineBounds = (originalFine) => {
    const fine = parseFloat(originalFine);
    return {
      min: (fine * 0.8).toFixed(2),
      max: (fine * 1.2).toFixed(2)
    };
  };

  if (loading && challenges.length === 0) {
    return (
      <div className="admin-section">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading challenges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="section-header">
        <h1>⚖️ Challenge Review</h1>
      </div>

      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      )}

      {/* Status Tabs */}
      <div className="tabs-container">
        <button
          className={`tab ${filterStatus === 'Pending' ? 'active' : ''}`}
          onClick={() => setFilterStatus('Pending')}
        >
          ⏳ Pending
        </button>
        <button
          className={`tab ${filterStatus === 'UnderReview' ? 'active' : ''}`}
          onClick={() => setFilterStatus('UnderReview')}
        >
          🔍 Under Review
        </button>
        <button
          className={`tab ${filterStatus === 'Approved' ? 'active' : ''}`}
          onClick={() => setFilterStatus('Approved')}
        >
          ✅ Approved
        </button>
        <button
          className={`tab ${filterStatus === 'Rejected' ? 'active' : ''}`}
          onClick={() => setFilterStatus('Rejected')}
        >
          ❌ Rejected
        </button>
        <button
          className={`tab ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          📋 All
        </button>
      </div>

      {/* Challenges Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Offence</th>
              <th>Fine</th>
              <th>Reason</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Outcome</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {challenges.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">
                  No challenges found
                </td>
              </tr>
            ) : (
              challenges.map((challenge) => (
                <tr key={challenge.id}>
                  <td><code>{challenge.ticket?.serial_number || 'N/A'}</code></td>
                  <td>{challenge.ticket?.offence?.name || challenge.ticket?.offense_description || 'N/A'}</td>
                  <td className="text-right">
                    ${parseFloat(challenge.ticket?.fine_amount || 0).toFixed(2)}
                  </td>
                  <td className="reason-cell">
                    {challenge.reason.substring(0, 50)}
                    {challenge.reason.length > 50 && '...'}
                  </td>
                  <td>{new Date(challenge.submitted_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${getStatusBadge(challenge.status)}`}>
                      {challenge.status}
                    </span>
                  </td>
                  <td>
                    {challenge.outcome ? (
                      <span className={`badge ${getOutcomeBadge(challenge.outcome)}`}>
                        {challenge.outcome}
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="actions">
                    <button 
                      onClick={() => handleViewDetails(challenge)}
                      className="btn btn-sm btn-secondary"
                      title="View Details"
                    >
                      👁️ View
                    </button>
                    {challenge.status === 'Pending' && (
                      <button 
                        onClick={() => handleStartReview(challenge)}
                        className="btn btn-sm btn-info"
                        title="Start Review"
                      >
                        🔍 Review
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Challenge Detail Modal */}
      {showDetailModal && selectedChallenge && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>Challenge Details</h2>
            
            <div className="challenge-details">
              {/* Ticket Information */}
              <div className="detail-section">
                <h3>📋 Ticket Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Serial Number:</label>
                    <span><code>{selectedChallenge.ticket?.serial_number}</code></span>
                  </div>
                  <div className="detail-item">
                    <label>Fine Amount:</label>
                    <span><strong>${parseFloat(selectedChallenge.ticket?.fine_amount || 0).toFixed(2)}</strong></span>
                  </div>
                  <div className="detail-item">
                    <label>Offence:</label>
                    <span>{selectedChallenge.ticket?.offence?.name || selectedChallenge.ticket?.offense_description}</span>
                  </div>
                  <div className="detail-item">
                    <label>Points:</label>
                    <span>{selectedChallenge.ticket?.points || 0}</span>
                  </div>
                  {selectedChallenge.ticket?.measured_value && (
                    <div className="detail-item">
                      <label>Measured Value:</label>
                      <span>{selectedChallenge.ticket.measured_value} {selectedChallenge.ticket.offence?.unit}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <label>Driver:</label>
                    <span>{selectedChallenge.ticket?.driver_name || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Vehicle:</label>
                    <span>{selectedChallenge.ticket?.vehicle_plate || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Location:</label>
                    <span>{selectedChallenge.ticket?.location || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Challenge Information */}
              <div className="detail-section">
                <h3>⚖️ Challenge Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Status:</label>
                    <span className={`badge ${getStatusBadge(selectedChallenge.status)}`}>
                      {selectedChallenge.status}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Submitted:</label>
                    <span>{new Date(selectedChallenge.submitted_at).toLocaleString()}</span>
                  </div>
                  {selectedChallenge.reviewed_at && (
                    <>
                      <div className="detail-item">
                        <label>Reviewed:</label>
                        <span>{new Date(selectedChallenge.reviewed_at).toLocaleString()}</span>
                      </div>
                      <div className="detail-item">
                        <label>Reviewed By:</label>
                        <span>{selectedChallenge.reviewed_by?.username || 'N/A'}</span>
                      </div>
                    </>
                  )}
                  {selectedChallenge.outcome && (
                    <div className="detail-item">
                      <label>Outcome:</label>
                      <span className={`badge ${getOutcomeBadge(selectedChallenge.outcome)}`}>
                        {selectedChallenge.outcome}
                      </span>
                    </div>
                  )}
                  {selectedChallenge.adjusted_fine && (
                    <div className="detail-item">
                      <label>Adjusted Fine:</label>
                      <span><strong>${parseFloat(selectedChallenge.adjusted_fine).toFixed(2)}</strong></span>
                    </div>
                  )}
                </div>

                <div className="detail-item full-width">
                  <label>Citizen's Reason:</label>
                  <div className="reason-box">{selectedChallenge.reason}</div>
                </div>

                {selectedChallenge.evidence && (
                  <div className="detail-item full-width">
                    <label>Evidence:</label>
                    <div className="evidence-box">{selectedChallenge.evidence}</div>
                  </div>
                )}

                {selectedChallenge.admin_notes && (
                  <div className="detail-item full-width">
                    <label>Admin Notes:</label>
                    <div className="admin-notes-box">{selectedChallenge.admin_notes}</div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {selectedChallenge.status === 'UnderReview' && (
                <div className="action-buttons">
                  <button 
                    onClick={() => handleAction(selectedChallenge, 'dismiss')}
                    className="btn btn-success"
                  >
                    ✅ Dismiss Ticket
                  </button>
                  <button 
                    onClick={() => handleAction(selectedChallenge, 'adjust')}
                    className="btn btn-info"
                  >
                    💰 Adjust Fine
                  </button>
                  <button 
                    onClick={() => handleAction(selectedChallenge, 'uphold')}
                    className="btn btn-danger"
                  >
                    ❌ Uphold Fine
                  </button>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button 
                onClick={() => setShowDetailModal(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {showActionModal && selectedChallenge && (
        <div className="modal-overlay" onClick={() => setShowActionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>
              {actionType === 'dismiss' && '✅ Dismiss Ticket'}
              {actionType === 'adjust' && '💰 Adjust Fine'}
              {actionType === 'uphold' && '❌ Uphold Fine'}
            </h2>
            
            <div className="action-form">
              {actionType === 'dismiss' && (
                <div className="info-box success">
                  <p>This will dismiss the ticket entirely. The citizen will not need to pay.</p>
                </div>
              )}

              {actionType === 'adjust' && (
                <>
                  <div className="info-box info">
                    <p>You can adjust the fine within ±20% of the original amount.</p>
                  </div>
                  <div className="form-group">
                    <label>Adjusted Fine Amount ($) *</label>
                    <input
                      type="number"
                      value={adjustedFine}
                      onChange={(e) => setAdjustedFine(e.target.value)}
                      step="0.01"
                      min={calculateFineBounds(selectedChallenge.ticket?.calculated_fine || selectedChallenge.ticket?.fine_amount).min}
                      max={calculateFineBounds(selectedChallenge.ticket?.calculated_fine || selectedChallenge.ticket?.fine_amount).max}
                      className="form-input"
                      required
                    />
                    <small>
                      Allowed range: $
                      {calculateFineBounds(selectedChallenge.ticket?.calculated_fine || selectedChallenge.ticket?.fine_amount).min}
                      {' - $'}
                      {calculateFineBounds(selectedChallenge.ticket?.calculated_fine || selectedChallenge.ticket?.fine_amount).max}
                    </small>
                  </div>
                </>
              )}

              {actionType === 'uphold' && (
                <div className="info-box warning">
                  <p>This will reject the challenge and maintain the original fine. The ticket will become payable.</p>
                </div>
              )}

              <div className="form-group">
                <label>Admin Notes *</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Explain your decision..."
                  rows="4"
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div className="modal-actions">
              <button 
                onClick={() => setShowActionModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmitAction}
                className={`btn ${
                  actionType === 'dismiss' ? 'btn-success' :
                  actionType === 'adjust' ? 'btn-info' :
                  'btn-danger'
                }`}
              >
                Confirm {actionType === 'dismiss' ? 'Dismissal' : actionType === 'adjust' ? 'Adjustment' : 'Uphold'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChallengeReview;
