/**
 * Badge Management Component
 * Admin interface for creating, editing, and managing badges
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';

function BadgeManagement() {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBadge, setEditingBadge] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    icon_emoji: '🏆',
    category: 'payment',
    tier: 'bronze',
    requirement_type: 'tickets_paid',
    requirement_value: 1,
    points_reward: 10,
    discount_percentage: 0,
    is_active: true,
    is_hidden: false
  });

  const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const categories = ['payment', 'driving', 'streak', 'milestone', 'special'];
  const requirementTypes = [
    'tickets_paid',
    'early_payments',
    'clean_days',
    'on_time_payments',
    'points_earned',
    'driving_score'
  ];

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.get('/gamification/badges');
      setBadges(response.data.badges || []);
    } catch (error) {
      console.error('Failed to load badges:', error);
      alert('Failed to load badges');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingBadge) {
        await adminAPI.put(`/gamification/badges/${editingBadge.id}`, formData);
        alert('Badge updated successfully!');
      } else {
        await adminAPI.post('/gamification/badges', formData);
        alert('Badge created successfully!');
      }
      
      setShowForm(false);
      setEditingBadge(null);
      resetForm();
      loadBadges();
    } catch (error) {
      console.error('Failed to save badge:', error);
      alert(error.response?.data?.error || 'Failed to save badge');
    }
  };

  const handleEdit = (badge) => {
    setEditingBadge(badge);
    setFormData({
      code: badge.code,
      name: badge.name,
      description: badge.description || '',
      icon_emoji: badge.icon_emoji || '🏆',
      category: badge.category,
      tier: badge.tier,
      requirement_type: badge.requirement_type,
      requirement_value: badge.requirement_value,
      points_reward: badge.points_reward || 0,
      discount_percentage: badge.discount_percentage || 0,
      is_active: badge.is_active,
      is_hidden: badge.is_hidden || false
    });
    setShowForm(true);
  };

  const handleDelete = async (badgeId) => {
    if (!window.confirm('Are you sure you want to delete this badge?')) return;
    
    try {
      await adminAPI.delete(`/gamification/badges/${badgeId}`);
      alert('Badge deleted successfully!');
      loadBadges();
    } catch (error) {
      console.error('Failed to delete badge:', error);
      alert('Failed to delete badge');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      icon_emoji: '🏆',
      category: 'payment',
      tier: 'bronze',
      requirement_type: 'tickets_paid',
      requirement_value: 1,
      points_reward: 10,
      discount_percentage: 0,
      is_active: true,
      is_hidden: false
    });
  };

  const getTierColor = (tier) => {
    const colors = {
      bronze: '#CD7F32',
      silver: '#C0C0C0',
      gold: '#FFD700',
      platinum: '#E5E4E2',
      diamond: '#B9F2FF'
    };
    return colors[tier] || '#666';
  };

  if (loading) {
    return <div className="loading">Loading badges...</div>;
  }

  return (
    <div className="badge-management">
      <div className="management-header">
        <h2>🏆 Badge Management</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(true);
            setEditingBadge(null);
            resetForm();
          }}
        >
          + Create New Badge
        </button>
      </div>

      {/* Badge Form */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>{editingBadge ? 'Edit Badge' : 'Create New Badge'}</h3>
            
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    placeholder="e.g., FIRST_TIMER"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Icon Emoji</label>
                  <input
                    type="text"
                    value={formData.icon_emoji}
                    onChange={(e) => setFormData({...formData, icon_emoji: e.target.value})}
                    placeholder="🏆"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., First Timer"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe how to earn this badge..."
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    required
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Tier *</label>
                  <select
                    value={formData.tier}
                    onChange={(e) => setFormData({...formData, tier: e.target.value})}
                    required
                  >
                    {tiers.map(tier => (
                      <option key={tier} value={tier}>{tier}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Requirement Type *</label>
                  <select
                    value={formData.requirement_type}
                    onChange={(e) => setFormData({...formData, requirement_type: e.target.value})}
                    required
                  >
                    {requirementTypes.map(type => (
                      <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Requirement Value *</label>
                  <input
                    type="number"
                    value={formData.requirement_value}
                    onChange={(e) => setFormData({...formData, requirement_value: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Points Reward</label>
                  <input
                    type="number"
                    value={formData.points_reward}
                    onChange={(e) => setFormData({...formData, points_reward: parseInt(e.target.value)})}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Discount % (Optional)</label>
                  <input
                    type="number"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({...formData, discount_percentage: parseFloat(e.target.value)})}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
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
                      checked={formData.is_hidden}
                      onChange={(e) => setFormData({...formData, is_hidden: e.target.checked})}
                    />
                    Hidden (until unlocked)
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingBadge(null);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingBadge ? 'Update Badge' : 'Create Badge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Badges List */}
      <div className="badges-grid">
        {badges.map(badge => (
          <div key={badge.id} className="badge-card admin">
            <div className="badge-header" style={{ borderColor: getTierColor(badge.tier) }}>
              <span className="badge-icon">{badge.icon_emoji}</span>
              <span className={`badge-tier ${badge.tier}`}>{badge.tier}</span>
            </div>
            
            <h4>{badge.name}</h4>
            <p className="badge-description">{badge.description}</p>
            
            <div className="badge-details">
              <div className="detail-item">
                <span className="label">Category:</span>
                <span className="value">{badge.category}</span>
              </div>
              <div className="detail-item">
                <span className="label">Requirement:</span>
                <span className="value">
                  {badge.requirement_value} {badge.requirement_type.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Points:</span>
                <span className="value">{badge.points_reward}</span>
              </div>
              {badge.discount_percentage > 0 && (
                <div className="detail-item">
                  <span className="label">Discount:</span>
                  <span className="value">{badge.discount_percentage}%</span>
                </div>
              )}
            </div>

            <div className="badge-status">
              <span className={`status-badge ${badge.is_active ? 'active' : 'inactive'}`}>
                {badge.is_active ? 'Active' : 'Inactive'}
              </span>
              {badge.is_hidden && (
                <span className="status-badge hidden">Hidden</span>
              )}
            </div>

            <div className="badge-actions">
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => handleEdit(badge)}
              >
                Edit
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleDelete(badge.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {badges.length === 0 && (
        <div className="empty-state">
          <p>No badges created yet. Create your first badge to get started!</p>
        </div>
      )}
    </div>
  );
}

export default BadgeManagement;
