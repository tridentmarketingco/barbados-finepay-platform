/**
 * Early Discount Configuration Component
 * Admin interface for configuring early payment discount tiers
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';

function EarlyDiscountConfig() {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discount_type: 'tiered',
    tiers: [
      { days: 3, discount_percentage: 15, label: 'Super Early Bird', points_bonus: 50 },
      { days: 7, discount_percentage: 10, label: 'Early Bird', points_bonus: 25 },
      { days: 14, discount_percentage: 5, label: 'Prompt Payment', points_bonus: 10 }
    ],
    applies_to_offence_categories: [],
    applies_to_offences: [],
    min_fine_amount: 0,
    max_fine_amount: null,
    effective_from: '',
    effective_to: '',
    is_active: true
  });

  useEffect(() => {
    loadDiscounts();
  }, []);

  const loadDiscounts = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.get('/gamification/early-discounts');
      setDiscounts(response.data.discounts || []);
    } catch (error) {
      console.error('Failed to load discounts:', error);
      alert('Failed to load discount configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        discount_config: JSON.stringify({ tiers: formData.tiers }),
        points_bonus_config: JSON.stringify({
          tiers: formData.tiers.map(t => ({ days: t.days, points: t.points_bonus }))
        })
      };

      if (editingDiscount) {
        await adminAPI.put(`/gamification/early-discounts/${editingDiscount.id}`, payload);
        alert('Discount configuration updated successfully!');
      } else {
        await adminAPI.post('/gamification/early-discounts', payload);
        alert('Discount configuration created successfully!');
      }
      
      setShowForm(false);
      setEditingDiscount(null);
      resetForm();
      loadDiscounts();
    } catch (error) {
      console.error('Failed to save discount:', error);
      alert(error.response?.data?.error || 'Failed to save discount configuration');
    }
  };

  const handleEdit = (discount) => {
    setEditingDiscount(discount);
    
    let tiers = [];
    try {
      const config = JSON.parse(discount.discount_config || '{}');
      tiers = config.tiers || [];
    } catch (e) {
      console.error('Failed to parse discount config:', e);
    }

    setFormData({
      name: discount.name,
      description: discount.description || '',
      discount_type: discount.discount_type,
      tiers: tiers.length > 0 ? tiers : formData.tiers,
      applies_to_offence_categories: discount.applies_to_offence_categories || [],
      applies_to_offences: discount.applies_to_offences || [],
      min_fine_amount: discount.min_fine_amount || 0,
      max_fine_amount: discount.max_fine_amount || null,
      effective_from: discount.effective_from || '',
      effective_to: discount.effective_to || '',
      is_active: discount.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (discountId) => {
    if (!window.confirm('Are you sure you want to delete this discount configuration?')) return;
    
    try {
      await adminAPI.delete(`/gamification/early-discounts/${discountId}`);
      alert('Discount configuration deleted successfully!');
      loadDiscounts();
    } catch (error) {
      console.error('Failed to delete discount:', error);
      alert('Failed to delete discount configuration');
    }
  };

  const addTier = () => {
    setFormData({
      ...formData,
      tiers: [...formData.tiers, { days: 7, discount_percentage: 5, label: '', points_bonus: 10 }]
    });
  };

  const removeTier = (index) => {
    setFormData({
      ...formData,
      tiers: formData.tiers.filter((_, i) => i !== index)
    });
  };

  const updateTier = (index, field, value) => {
    const newTiers = [...formData.tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setFormData({ ...formData, tiers: newTiers });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      discount_type: 'tiered',
      tiers: [
        { days: 3, discount_percentage: 15, label: 'Super Early Bird', points_bonus: 50 },
        { days: 7, discount_percentage: 10, label: 'Early Bird', points_bonus: 25 },
        { days: 14, discount_percentage: 5, label: 'Prompt Payment', points_bonus: 10 }
      ],
      applies_to_offence_categories: [],
      applies_to_offences: [],
      min_fine_amount: 0,
      max_fine_amount: null,
      effective_from: '',
      effective_to: '',
      is_active: true
    });
  };

  if (loading) {
    return <div className="loading">Loading discount configurations...</div>;
  }

  return (
    <div className="early-discount-config">
      <div className="management-header">
        <h2>💰 Early Payment Discount Configuration</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(true);
            setEditingDiscount(null);
            resetForm();
          }}
        >
          + Create New Configuration
        </button>
      </div>

      {/* Discount Form */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>{editingDiscount ? 'Edit Discount Configuration' : 'Create New Discount Configuration'}</h3>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Configuration Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Standard Early Payment Discount"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe this discount configuration..."
                  rows="2"
                />
              </div>

              {/* Discount Tiers */}
              <div className="form-section">
                <div className="section-header">
                  <h4>Discount Tiers</h4>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={addTier}>
                    + Add Tier
                  </button>
                </div>

                {formData.tiers.map((tier, index) => (
                  <div key={index} className="tier-row">
                    <div className="tier-fields">
                      <div className="form-group">
                        <label>Days</label>
                        <input
                          type="number"
                          value={tier.days}
                          onChange={(e) => updateTier(index, 'days', parseInt(e.target.value))}
                          min="1"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Discount %</label>
                        <input
                          type="number"
                          value={tier.discount_percentage}
                          onChange={(e) => updateTier(index, 'discount_percentage', parseFloat(e.target.value))}
                          min="0"
                          max="100"
                          step="0.1"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Label</label>
                        <input
                          type="text"
                          value={tier.label}
                          onChange={(e) => updateTier(index, 'label', e.target.value)}
                          placeholder="e.g., Early Bird"
                        />
                      </div>

                      <div className="form-group">
                        <label>Points Bonus</label>
                        <input
                          type="number"
                          value={tier.points_bonus}
                          onChange={(e) => updateTier(index, 'points_bonus', parseInt(e.target.value))}
                          min="0"
                        />
                      </div>

                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => removeTier(index)}
                        disabled={formData.tiers.length === 1}
                      >
                        ×
                      </button>
                    </div>

                    <div className="tier-preview">
                      Pay within <strong>{tier.days} days</strong> → 
                      Save <strong>{tier.discount_percentage}%</strong> + 
                      Earn <strong>{tier.points_bonus} points</strong>
                      {tier.label && ` (${tier.label})`}
                    </div>
                  </div>
                ))}
              </div>

              {/* Fine Amount Range */}
              <div className="form-section">
                <h4>Fine Amount Range (Optional)</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Minimum Fine Amount</label>
                    <input
                      type="number"
                      value={formData.min_fine_amount}
                      onChange={(e) => setFormData({...formData, min_fine_amount: parseFloat(e.target.value)})}
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="form-group">
                    <label>Maximum Fine Amount (blank = no limit)</label>
                    <input
                      type="number"
                      value={formData.max_fine_amount || ''}
                      onChange={(e) => setFormData({...formData, max_fine_amount: e.target.value ? parseFloat(e.target.value) : null})}
                      min="0"
                      step="0.01"
                      placeholder="No limit"
                    />
                  </div>
                </div>
              </div>

              {/* Effective Dates */}
              <div className="form-section">
                <h4>Effective Period</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Effective From *</label>
                    <input
                      type="date"
                      value={formData.effective_from}
                      onChange={(e) => setFormData({...formData, effective_from: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Effective To (Optional)</label>
                    <input
                      type="date"
                      value={formData.effective_to}
                      onChange={(e) => setFormData({...formData, effective_to: e.target.value})}
                    />
                  </div>
                </div>
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

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingDiscount(null);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingDiscount ? 'Update Configuration' : 'Create Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Discounts List */}
      <div className="discounts-list">
        {discounts.map(discount => {
          let tiers = [];
          try {
            const config = JSON.parse(discount.discount_config || '{}');
            tiers = config.tiers || [];
          } catch (e) {
            console.error('Failed to parse config:', e);
          }

          return (
            <div key={discount.id} className="discount-card">
              <div className="discount-header">
                <h3>{discount.name}</h3>
                <span className={`badge ${discount.is_active ? 'active' : 'inactive'}`}>
                  {discount.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {discount.description && (
                <p className="discount-description">{discount.description}</p>
              )}

              <div className="discount-tiers">
                <h4>Discount Tiers:</h4>
                {tiers.map((tier, index) => (
                  <div key={index} className="tier-display">
                    <span className="tier-days">{tier.days} days</span>
                    <span className="tier-arrow">→</span>
                    <span className="tier-discount">{tier.discount_percentage}% off</span>
                    <span className="tier-points">+ {tier.points_bonus} pts</span>
                    {tier.label && <span className="tier-label">({tier.label})</span>}
                  </div>
                ))}
              </div>

              <div className="discount-details">
                {discount.min_fine_amount > 0 && (
                  <div className="detail-item">
                    <span className="label">Min Fine:</span>
                    <span className="value">${discount.min_fine_amount.toFixed(2)}</span>
                  </div>
                )}
                {discount.max_fine_amount && (
                  <div className="detail-item">
                    <span className="label">Max Fine:</span>
                    <span className="value">${discount.max_fine_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="detail-item">
                  <span className="label">Effective From:</span>
                  <span className="value">{new Date(discount.effective_from).toLocaleDateString()}</span>
                </div>
                {discount.effective_to && (
                  <div className="detail-item">
                    <span className="label">Effective To:</span>
                    <span className="value">{new Date(discount.effective_to).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="discount-actions">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleEdit(discount)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(discount.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {discounts.length === 0 && (
        <div className="empty-state">
          <p>No discount configurations created yet. Create your first configuration to get started!</p>
        </div>
      )}
    </div>
  );
}

export default EarlyDiscountConfig;
