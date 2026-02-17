/**
 * Citizen Profiles View Component
 * Admin interface for viewing and managing citizen gamification profiles
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';

function CitizenProfilesView() {
  const [citizens, setCitizens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCitizen, setSelectedCitizen] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({
    points_amount: 0,
    reason: ''
  });
  const [filters, setFilters] = useState({
    search: '',
    min_points: '',
    max_points: '',
    min_driving_score: '',
    sort_by: 'total_points',
    sort_order: 'desc'
  });

  useEffect(() => {
    loadCitizens();
  }, [filters]);

  const loadCitizens = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.min_points) params.append('min_points', filters.min_points);
      if (filters.max_points) params.append('max_points', filters.max_points);
      if (filters.min_driving_score) params.append('min_driving_score', filters.min_driving_score);
      params.append('sort_by', filters.sort_by);
      params.append('sort_order', filters.sort_order);

      const response = await adminAPI.get(`/gamification/citizens?${params.toString()}`);
      setCitizens(response.data.citizens || []);
    } catch (error) {
      console.error('Failed to load citizens:', error);
      alert('Failed to load citizen profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (citizen) => {
    try {
      const response = await adminAPI.get(`/gamification/citizens/${citizen.id}`);
      setSelectedCitizen(response.data.citizen);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Failed to load citizen details:', error);
      alert('Failed to load citizen details');
    }
  };

  const handleAdjustPoints = (citizen) => {
    setSelectedCitizen(citizen);
    setAdjustmentData({ points_amount: 0, reason: '' });
    setShowAdjustModal(true);
  };

  const submitPointsAdjustment = async (e) => {
    e.preventDefault();
    
    try {
      await adminAPI.post(`/gamification/citizens/${selectedCitizen.id}/adjust-points`, adjustmentData);
      alert('Points adjusted successfully!');
      setShowAdjustModal(false);
      setSelectedCitizen(null);
      loadCitizens();
    } catch (error) {
      console.error('Failed to adjust points:', error);
      alert(error.response?.data?.error || 'Failed to adjust points');
    }
  };

  const getDrivingScoreColor = (score) => {
    if (score >= 900) return '#4caf50';
    if (score >= 800) return '#8bc34a';
    if (score >= 700) return '#ffc107';
    if (score >= 600) return '#ff9800';
    return '#f44336';
  };

  if (loading) {
    return <div className="loading">Loading citizen profiles...</div>;
  }

  return (
    <div className="citizen-profiles-view">
      <div className="management-header">
        <h2>👥 Citizen Profiles</h2>
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-value">{citizens.length}</span>
            <span className="stat-label">Total Citizens</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-panel">
        <div className="filter-row">
          <div className="filter-group">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
            />
          </div>

          <div className="filter-group">
            <input
              type="number"
              placeholder="Min Points"
              value={filters.min_points}
              onChange={(e) => setFilters({...filters, min_points: e.target.value})}
            />
          </div>

          <div className="filter-group">
            <input
              type="number"
              placeholder="Max Points"
              value={filters.max_points}
              onChange={(e) => setFilters({...filters, max_points: e.target.value})}
            />
          </div>

          <div className="filter-group">
            <input
              type="number"
              placeholder="Min Driving Score"
              value={filters.min_driving_score}
              onChange={(e) => setFilters({...filters, min_driving_score: e.target.value})}
            />
          </div>

          <div className="filter-group">
            <select
              value={filters.sort_by}
              onChange={(e) => setFilters({...filters, sort_by: e.target.value})}
            >
              <option value="total_points">Points</option>
              <option value="driving_score">Driving Score</option>
              <option value="clean_driving_streak_days">Clean Streak</option>
              <option value="created_at">Join Date</option>
            </select>
          </div>

          <div className="filter-group">
            <select
              value={filters.sort_order}
              onChange={(e) => setFilters({...filters, sort_order: e.target.value})}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Citizens Table */}
      <div className="citizens-table">
        <table>
          <thead>
            <tr>
              <th>Citizen</th>
              <th>Points</th>
              <th>Level</th>
              <th>Driving Score</th>
              <th>Clean Streak</th>
              <th>Tickets</th>
              <th>Discounts Earned</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {citizens.map(citizen => (
              <tr key={citizen.id}>
                <td>
                  <div className="citizen-info">
                    <div className="citizen-name">{citizen.full_name || 'Anonymous'}</div>
                    <div className="citizen-email">{citizen.email || 'N/A'}</div>
                  </div>
                </td>
                <td>
                  <strong>{citizen.total_points.toLocaleString()}</strong>
                </td>
                <td>
                  <span className="level-badge">Level {citizen.current_level}</span>
                </td>
                <td>
                  <div className="driving-score">
                    <span style={{ color: getDrivingScoreColor(citizen.driving_score) }}>
                      {citizen.driving_score}/1000
                    </span>
                  </div>
                </td>
                <td>
                  <span className="streak-badge">
                    🔥 {citizen.clean_driving_streak_days} days
                  </span>
                </td>
                <td>
                  {citizen.total_tickets_paid}/{citizen.total_tickets_received}
                </td>
                <td>
                  ${(citizen.total_discounts_earned || 0).toFixed(2)}
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleViewDetails(citizen)}
                    >
                      View
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleAdjustPoints(citizen)}
                    >
                      Adjust Points
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {citizens.length === 0 && (
        <div className="empty-state">
          <p>No citizen profiles found.</p>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedCitizen && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>Citizen Profile Details</h3>
            
            <div className="citizen-details">
              <div className="detail-section">
                <h4>Basic Information</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">Name:</span>
                    <span className="value">{selectedCitizen.full_name || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Email:</span>
                    <span className="value">{selectedCitizen.email || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Phone:</span>
                    <span className="value">{selectedCitizen.phone || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Member Since:</span>
                    <span className="value">
                      {new Date(selectedCitizen.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Gamification Stats</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">Total Points:</span>
                    <span className="value">{selectedCitizen.total_points.toLocaleString()}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Current Level:</span>
                    <span className="value">Level {selectedCitizen.current_level}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Driving Score:</span>
                    <span className="value" style={{ color: getDrivingScoreColor(selectedCitizen.driving_score) }}>
                      {selectedCitizen.driving_score}/1000
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Clean Streak:</span>
                    <span className="value">{selectedCitizen.clean_driving_streak_days} days</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Payment Streak:</span>
                    <span className="value">{selectedCitizen.on_time_payment_streak}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Ticket History</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">Total Tickets:</span>
                    <span className="value">{selectedCitizen.total_tickets_received}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Tickets Paid:</span>
                    <span className="value">{selectedCitizen.total_tickets_paid}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Total Amount Paid:</span>
                    <span className="value">${selectedCitizen.total_amount_paid.toFixed(2)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Discounts Earned:</span>
                    <span className="value">${selectedCitizen.total_discounts_earned.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Preferences</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">Gamification Opt-in:</span>
                    <span className="value">{selectedCitizen.opted_in_gamification ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Leaderboard Opt-in:</span>
                    <span className="value">{selectedCitizen.opted_in_leaderboard ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Status:</span>
                    <span className="value">{selectedCitizen.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Points Modal */}
      {showAdjustModal && selectedCitizen && (
        <div className="modal-overlay" onClick={() => setShowAdjustModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Adjust Points</h3>
            
            <div className="citizen-summary">
              <p><strong>{selectedCitizen.full_name || 'Anonymous'}</strong></p>
              <p>Current Points: <strong>{selectedCitizen.total_points}</strong></p>
            </div>

            <form onSubmit={submitPointsAdjustment}>
              <div className="form-group">
                <label>Points Adjustment *</label>
                <input
                  type="number"
                  value={adjustmentData.points_amount}
                  onChange={(e) => setAdjustmentData({...adjustmentData, points_amount: parseInt(e.target.value)})}
                  placeholder="Enter positive or negative number"
                  required
                />
                <small>Use positive numbers to add points, negative to subtract</small>
              </div>

              <div className="form-group">
                <label>Reason *</label>
                <textarea
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData({...adjustmentData, reason: e.target.value})}
                  placeholder="Explain why you're adjusting points..."
                  rows="3"
                  required
                />
              </div>

              <div className="adjustment-preview">
                <p>New Balance: <strong>{selectedCitizen.total_points + adjustmentData.points_amount}</strong></p>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAdjustModal(false);
                    setSelectedCitizen(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Adjust Points
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CitizenProfilesView;
