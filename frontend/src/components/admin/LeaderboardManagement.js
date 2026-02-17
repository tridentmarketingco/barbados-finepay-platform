/**
 * Leaderboard Management Component
 * Admin interface for creating and managing leaderboards
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';

function LeaderboardManagement() {
  const [leaderboards, setLeaderboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLeaderboard, setEditingLeaderboard] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leaderboard_type: 'points',
    period_type: 'monthly',
    period_start: '',
    period_end: '',
    max_display_rank: 100,
    is_public: true,
    has_prizes: false,
    prize_config: '',
    is_active: true
  });

  const leaderboardTypes = ['points', 'driving_score', 'clean_streak', 'early_payments'];
  const periodTypes = ['all_time', 'yearly', 'monthly', 'weekly'];

  useEffect(() => {
    loadLeaderboards();
  }, []);

  const loadLeaderboards = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.get('/gamification/leaderboards');
      setLeaderboards(response.data.leaderboards || []);
    } catch (error) {
      console.error('Failed to load leaderboards:', error);
      alert('Failed to load leaderboards');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingLeaderboard) {
        await adminAPI.put(`/gamification/leaderboards/${editingLeaderboard.id}`, formData);
        alert('Leaderboard updated successfully!');
      } else {
        await adminAPI.post('/gamification/leaderboards', formData);
        alert('Leaderboard created successfully!');
      }
      
      setShowForm(false);
      setEditingLeaderboard(null);
      resetForm();
      loadLeaderboards();
    } catch (error) {
      console.error('Failed to save leaderboard:', error);
      alert(error.response?.data?.error || 'Failed to save leaderboard');
    }
  };

  const handleRecalculate = async (leaderboardId) => {
    if (!window.confirm('Recalculate this leaderboard? This may take a moment.')) return;
    
    try {
      await adminAPI.post(`/gamification/leaderboards/${leaderboardId}/calculate`);
      alert('Leaderboard recalculated successfully!');
      loadLeaderboards();
    } catch (error) {
      console.error('Failed to recalculate:', error);
      alert('Failed to recalculate leaderboard');
    }
  };

  const handleEdit = (leaderboard) => {
    setEditingLeaderboard(leaderboard);
    setFormData({
      name: leaderboard.name,
      description: leaderboard.description || '',
      leaderboard_type: leaderboard.leaderboard_type,
      period_type: leaderboard.period_type,
      period_start: leaderboard.period_start || '',
      period_end: leaderboard.period_end || '',
      max_display_rank: leaderboard.max_display_rank || 100,
      is_public: leaderboard.is_public,
      has_prizes: leaderboard.has_prizes || false,
      prize_config: leaderboard.prize_config || '',
      is_active: leaderboard.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (leaderboardId) => {
    if (!window.confirm('Are you sure you want to delete this leaderboard?')) return;
    
    try {
      await adminAPI.delete(`/gamification/leaderboards/${leaderboardId}`);
      alert('Leaderboard deleted successfully!');
      loadLeaderboards();
    } catch (error) {
      console.error('Failed to delete leaderboard:', error);
      alert('Failed to delete leaderboard');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      leaderboard_type: 'points',
      period_type: 'monthly',
      period_start: '',
      period_end: '',
      max_display_rank: 100,
      is_public: true,
      has_prizes: false,
      prize_config: '',
      is_active: true
    });
  };

  if (loading) {
    return <div className="loading">Loading leaderboards...</div>;
  }

  return (
    <div className="leaderboard-management">
      <div className="management-header">
        <h2>🏅 Leaderboard Management</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(true);
            setEditingLeaderboard(null);
            resetForm();
          }}
        >
          + Create New Leaderboard
        </button>
      </div>

      {/* Leaderboard Form */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>{editingLeaderboard ? 'Edit Leaderboard' : 'Create New Leaderboard'}</h3>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Top Safe Drivers"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe this leaderboard..."
                  rows="2"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Leaderboard Type *</label>
                  <select
                    value={formData.leaderboard_type}
                    onChange={(e) => setFormData({...formData, leaderboard_type: e.target.value})}
                    required
                  >
                    {leaderboardTypes.map(type => (
                      <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Period Type *</label>
                  <select
                    value={formData.period_type}
                    onChange={(e) => setFormData({...formData, period_type: e.target.value})}
                    required
                  >
                    {periodTypes.map(type => (
                      <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.period_type !== 'all_time' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Period Start</label>
                    <input
                      type="date"
                      value={formData.period_start}
                      onChange={(e) => setFormData({...formData, period_start: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>Period End</label>
                    <input
                      type="date"
                      value={formData.period_end}
                      onChange={(e) => setFormData({...formData, period_end: e.target.value})}
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Max Display Rank</label>
                <input
                  type="number"
                  value={formData.max_display_rank}
                  onChange={(e) => setFormData({...formData, max_display_rank: parseInt(e.target.value)})}
                  min="10"
                  max="1000"
                />
                <small>Maximum number of ranks to display (e.g., Top 100)</small>
              </div>

              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.has_prizes}
                    onChange={(e) => setFormData({...formData, has_prizes: e.target.checked})}
                  />
                  Has Prizes
                </label>
              </div>

              {formData.has_prizes && (
                <div className="form-group">
                  <label>Prize Configuration (JSON)</label>
                  <textarea
                    value={formData.prize_config}
                    onChange={(e) => setFormData({...formData, prize_config: e.target.value})}
                    placeholder='{"1st": "100 bonus points", "2nd": "50 bonus points", "3rd": "25 bonus points"}'
                    rows="3"
                  />
                  <small>Enter prize details in JSON format</small>
                </div>
              )}

              <div className="form-row">
                <div className="form-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.is_public}
                      onChange={(e) => setFormData({...formData, is_public: e.target.checked})}
                    />
                    Public (visible to all citizens)
                  </label>
                </div>

                <div className="form-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingLeaderboard(null);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingLeaderboard ? 'Update Leaderboard' : 'Create Leaderboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leaderboards List */}
      <div className="leaderboards-list">
        {leaderboards.map(leaderboard => (
          <div key={leaderboard.id} className="leaderboard-card">
            <div className="leaderboard-header">
              <h3>{leaderboard.name}</h3>
              <div className="leaderboard-badges">
                <span className={`badge ${leaderboard.is_active ? 'active' : 'inactive'}`}>
                  {leaderboard.is_active ? 'Active' : 'Inactive'}
                </span>
                {leaderboard.is_public && <span className="badge public">Public</span>}
                {leaderboard.has_prizes && <span className="badge prizes">🏆 Prizes</span>}
              </div>
            </div>

            {leaderboard.description && (
              <p className="leaderboard-description">{leaderboard.description}</p>
            )}

            <div className="leaderboard-details">
              <div className="detail-row">
                <span className="label">Type:</span>
                <span className="value">{leaderboard.leaderboard_type.replace(/_/g, ' ')}</span>
              </div>
              <div className="detail-row">
                <span className="label">Period:</span>
                <span className="value">{leaderboard.period_type.replace(/_/g, ' ')}</span>
              </div>
              <div className="detail-row">
                <span className="label">Max Rank:</span>
                <span className="value">Top {leaderboard.max_display_rank}</span>
              </div>
              {leaderboard.last_calculated_at && (
                <div className="detail-row">
                  <span className="label">Last Updated:</span>
                  <span className="value">
                    {new Date(leaderboard.last_calculated_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="leaderboard-actions">
              <button
                className="btn btn-sm btn-primary"
                onClick={() => handleRecalculate(leaderboard.id)}
              >
                🔄 Recalculate
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => handleEdit(leaderboard)}
              >
                Edit
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleDelete(leaderboard.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {leaderboards.length === 0 && (
        <div className="empty-state">
          <p>No leaderboards created yet. Create your first leaderboard to get started!</p>
        </div>
      )}
    </div>
  );
}

export default LeaderboardManagement;
