/**
 * Reward Management Component
 * Admin interface for creating, editing, and managing rewards
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';

function RewardManagement() {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    icon_emoji: '🎁',
    reward_type: 'discount',
    reward_value: 0,
    points_cost: 100,
    total_available: null,
    max_per_citizen: 1,
    valid_from: '',
    valid_to: '',
    validity_days: 90,
    terms_and_conditions: '',
    redemption_instructions: '',
    is_active: true,
    is_featured: false
  });

  const rewardTypes = [
    'discount',
    'service_waiver',
    'parking_voucher',
    'priority_service',
    'certificate'
  ];

  useEffect(() => {
    loadRewards();
  }, []);

  const loadRewards = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.get('/gamification/rewards');
      setRewards(response.data.rewards || []);
    } catch (error) {
      console.error('Failed to load rewards:', error);
      alert('Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        total_available: formData.total_available === '' ? null : parseInt(formData.total_available)
      };

      if (editingReward) {
        await adminAPI.put(`/gamification/rewards/${editingReward.id}`, payload);
        alert('Reward updated successfully!');
      } else {
        await adminAPI.post('/gamification/rewards', payload);
        alert('Reward created successfully!');
      }
      
      setShowForm(false);
      setEditingReward(null);
      resetForm();
      loadRewards();
    } catch (error) {
      console.error('Failed to save reward:', error);
      alert(error.response?.data?.error || 'Failed to save reward');
    }
  };

  const handleEdit = (reward) => {
    setEditingReward(reward);
    setFormData({
      code: reward.code,
      name: reward.name,
      description: reward.description || '',
      icon_emoji: reward.icon_emoji || '🎁',
      reward_type: reward.reward_type,
      reward_value: reward.reward_value || 0,
      points_cost: reward.points_cost,
      total_available: reward.total_available || '',
      max_per_citizen: reward.max_per_citizen || 1,
      valid_from: reward.valid_from || '',
      valid_to: reward.valid_to || '',
      validity_days: reward.validity_days || 90,
      terms_and_conditions: reward.terms_and_conditions || '',
      redemption_instructions: reward.redemption_instructions || '',
      is_active: reward.is_active,
      is_featured: reward.is_featured || false
    });
    setShowForm(true);
  };

  const handleDelete = async (rewardId) => {
    if (!window.confirm('Are you sure you want to delete this reward?')) return;
    
    try {
      await adminAPI.delete(`/gamification/rewards/${rewardId}`);
      alert('Reward deleted successfully!');
      loadRewards();
    } catch (error) {
      console.error('Failed to delete reward:', error);
      alert('Failed to delete reward');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      icon_emoji: '🎁',
      reward_type: 'discount',
      reward_value: 0,
      points_cost: 100,
      total_available: null,
      max_per_citizen: 1,
      valid_from: '',
      valid_to: '',
      validity_days: 90,
      terms_and_conditions: '',
      redemption_instructions: '',
      is_active: true,
      is_featured: false
    });
  };

  if (loading) {
    return <div className="loading">Loading rewards...</div>;
  }

  return (
    <div className="reward-management">
      <div className="management-header">
        <h2>🎁 Reward Management</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(true);
            setEditingReward(null);
            resetForm();
          }}
        >
          + Create New Reward
        </button>
      </div>

      {/* Reward Form */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>{editingReward ? 'Edit Reward' : 'Create New Reward'}</h3>
            
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    placeholder="e.g., PARKING_DAY_PASS"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Icon Emoji</label>
                  <input
                    type="text"
                    value={formData.icon_emoji}
                    onChange={(e) => setFormData({...formData, icon_emoji: e.target.value})}
                    placeholder="🎁"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Free Parking Day Pass"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe the reward..."
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Reward Type *</label>
                  <select
                    value={formData.reward_type}
                    onChange={(e) => setFormData({...formData, reward_type: e.target.value})}
                    required
                  >
                    {rewardTypes.map(type => (
                      <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Reward Value ($)</label>
                  <input
                    type="number"
                    value={formData.reward_value}
                    onChange={(e) => setFormData({...formData, reward_value: parseFloat(e.target.value)})}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Points Cost *</label>
                  <input
                    type="number"
                    value={formData.points_cost}
                    onChange={(e) => setFormData({...formData, points_cost: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Total Available (blank = unlimited)</label>
                  <input
                    type="number"
                    value={formData.total_available}
                    onChange={(e) => setFormData({...formData, total_available: e.target.value})}
                    min="1"
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Max Per Citizen</label>
                  <input
                    type="number"
                    value={formData.max_per_citizen}
                    onChange={(e) => setFormData({...formData, max_per_citizen: parseInt(e.target.value)})}
                    min="1"
                  />
                </div>

                <div className="form-group">
                  <label>Validity Days</label>
                  <input
                    type="number"
                    value={formData.validity_days}
                    onChange={(e) => setFormData({...formData, validity_days: parseInt(e.target.value)})}
                    min="1"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Valid From (Optional)</label>
                  <input
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({...formData, valid_from: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Valid To (Optional)</label>
                  <input
                    type="date"
                    value={formData.valid_to}
                    onChange={(e) => setFormData({...formData, valid_to: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Terms & Conditions</label>
                <textarea
                  value={formData.terms_and_conditions}
                  onChange={(e) => setFormData({...formData, terms_and_conditions: e.target.value})}
                  placeholder="Enter terms and conditions..."
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Redemption Instructions</label>
                <textarea
                  value={formData.redemption_instructions}
                  onChange={(e) => setFormData({...formData, redemption_instructions: e.target.value})}
                  placeholder="How to redeem this reward..."
                  rows="3"
                />
              </div>

              <div className="form-row">
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

                <div className="form-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.is_featured}
                      onChange={(e) => setFormData({...formData, is_featured: e.target.checked})}
                    />
                    Featured
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingReward(null);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingReward ? 'Update Reward' : 'Create Reward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rewards List */}
      <div className="rewards-grid">
        {rewards.map(reward => (
          <div key={reward.id} className={`reward-card admin ${reward.is_featured ? 'featured' : ''}`}>
            <div className="reward-header">
              <span className="reward-icon">{reward.icon_emoji}</span>
              {reward.is_featured && <span className="featured-badge">⭐ Featured</span>}
            </div>
            
            <h4>{reward.name}</h4>
            <p className="reward-description">{reward.description}</p>
            
            <div className="reward-details">
              <div className="detail-item">
                <span className="label">Type:</span>
                <span className="value">{reward.reward_type.replace(/_/g, ' ')}</span>
              </div>
              {reward.reward_value > 0 && (
                <div className="detail-item">
                  <span className="label">Value:</span>
                  <span className="value">${reward.reward_value.toFixed(2)}</span>
                </div>
              )}
              <div className="detail-item">
                <span className="label">Cost:</span>
                <span className="value">{reward.points_cost} points</span>
              </div>
              {reward.total_available && (
                <div className="detail-item">
                  <span className="label">Available:</span>
                  <span className="value">{reward.remaining}/{reward.total_available}</span>
                </div>
              )}
              <div className="detail-item">
                <span className="label">Redeemed:</span>
                <span className="value">{reward.total_redeemed || 0}</span>
              </div>
            </div>

            <div className="reward-status">
              <span className={`status-badge ${reward.is_active ? 'active' : 'inactive'}`}>
                {reward.is_active ? 'Active' : 'Inactive'}
              </span>
              {reward.total_available && reward.remaining === 0 && (
                <span className="status-badge sold-out">Sold Out</span>
              )}
            </div>

            <div className="reward-actions">
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => handleEdit(reward)}
              >
                Edit
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleDelete(reward.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {rewards.length === 0 && (
        <div className="empty-state">
          <p>No rewards created yet. Create your first reward to get started!</p>
        </div>
      )}
    </div>
  );
}

export default RewardManagement;
