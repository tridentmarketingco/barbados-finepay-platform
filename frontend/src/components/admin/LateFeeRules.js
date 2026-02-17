import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';
import { Alert } from '../common';

const LateFeeRules = () => {
  const [rules, setRules] = useState([]);
  const [offences, setOffences] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    offence_category_id: null,
    offence_id: null,
    priority: 0,
    enabled: true,
    grace_period_days: 0,
    fee_structure_type: 'flat',
    config: {},
    max_fee_cap_amount: null,
    max_fee_cap_percentage: null,
    apply_to_original_only: true,
    pause_during_dispute: true,
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: null,
    active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rulesData, offencesData, categoriesData] = await Promise.all([
        adminAPI.getLateFeeRules(),
        adminAPI.getOffences(),
        adminAPI.getOffenceCategories()
      ]);
      
      setRules(rulesData.rules || []);
      setOffences(offencesData.offences || []);
      setCategories(categoriesData.categories || []);
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to load data: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      description: '',
      offence_category_id: null,
      offence_id: null,
      priority: 0,
      enabled: true,
      grace_period_days: 0,
      fee_structure_type: 'flat',
      config: {},
      max_fee_cap_amount: null,
      max_fee_cap_percentage: null,
      apply_to_original_only: true,
      pause_during_dispute: true,
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: null,
      active: true
    });
    setShowModal(true);
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      offence_category_id: rule.offence_category_id,
      offence_id: rule.offence_id,
      priority: rule.priority,
      enabled: rule.enabled,
      grace_period_days: rule.grace_period_days,
      fee_structure_type: rule.fee_structure_type,
      config: rule.config || {},
      max_fee_cap_amount: rule.max_fee_cap_amount,
      max_fee_cap_percentage: rule.max_fee_cap_percentage,
      apply_to_original_only: rule.apply_to_original_only,
      pause_during_dispute: rule.pause_during_dispute,
      effective_from: rule.effective_from,
      effective_to: rule.effective_to,
      active: rule.active
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      setMessage(null);
      
      if (!formData.name) {
        setMessage({ type: 'error', text: 'Rule name is required' });
        return;
      }

      if (editingRule) {
        await adminAPI.updateLateFeeRule(editingRule.id, formData);
        setMessage({ type: 'success', text: 'Rule updated successfully' });
      } else {
        await adminAPI.createLateFeeRule(formData);
        setMessage({ type: 'success', text: 'Rule created successfully' });
      }
      
      setShowModal(false);
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to save rule: ${error.message}` });
    }
  };

  const handleDelete = async (ruleId) => {
    if (!window.confirm('Are you sure you want to deactivate this rule?')) {
      return;
    }

    try {
      await adminAPI.deleteLateFeeRule(ruleId);
      setMessage({ type: 'success', text: 'Rule deactivated successfully' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to delete rule: ${error.message}` });
    }
  };

  const renderStructureConfig = () => {
    const { fee_structure_type, config: structConfig } = formData;

    switch (fee_structure_type) {
      case 'flat':
        return (
          <div className="structure-config">
            <div className="form-row">
              <div className="form-group">
                <label>Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={structConfig.amount || 25}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...structConfig, amount: parseFloat(e.target.value) }
                  })}
                />
              </div>
              <div className="form-group">
                <label>After Days</label>
                <input
                  type="number"
                  value={structConfig.after_days || 15}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...structConfig, after_days: parseInt(e.target.value) }
                  })}
                />
              </div>
            </div>
          </div>
        );

      case 'tiered':
        const tiers = structConfig.tiers || [{ days: 15, amount: 25 }];
        return (
          <div className="structure-config">
            <label>Tiers</label>
            {tiers.map((tier, idx) => (
              <div key={idx} className="tier-row">
                <input
                  type="number"
                  placeholder="Days"
                  value={tier.days}
                  onChange={(e) => {
                    const newTiers = [...tiers];
                    newTiers[idx].days = parseInt(e.target.value);
                    setFormData({ ...formData, config: { tiers: newTiers } });
                  }}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={tier.amount}
                  onChange={(e) => {
                    const newTiers = [...tiers];
                    newTiers[idx].amount = parseFloat(e.target.value);
                    setFormData({ ...formData, config: { tiers: newTiers } });
                  }}
                />
                {tiers.length > 1 && (
                  <button onClick={() => {
                    const newTiers = tiers.filter((_, i) => i !== idx);
                    setFormData({ ...formData, config: { tiers: newTiers } });
                  }}>Remove</button>
                )}
              </div>
            ))}
            <button onClick={() => {
              const newTiers = [...tiers, { days: 0, amount: 0 }];
              setFormData({ ...formData, config: { tiers: newTiers } });
            }}>Add Tier</button>
          </div>
        );

      case 'percentage':
        return (
          <div className="structure-config">
            <div className="form-row">
              <div className="form-group">
                <label>Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={structConfig.rate || 1.5}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...structConfig, rate: parseFloat(e.target.value) }
                  })}
                />
              </div>
              <div className="form-group">
                <label>Period</label>
                <select
                  value={structConfig.period || 'monthly'}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...structConfig, period: e.target.value }
                  })}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={structConfig.compound || false}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...structConfig, compound: e.target.checked }
                  })}
                />
                <span>Compound Interest</span>
              </label>
            </div>
          </div>
        );

      case 'daily':
        return (
          <div className="structure-config">
            <div className="form-row">
              <div className="form-group">
                <label>Daily Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={structConfig.amount || 1}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...structConfig, amount: parseFloat(e.target.value) }
                  })}
                />
              </div>
              <div className="form-group">
                <label>Max Days (optional)</label>
                <input
                  type="number"
                  value={structConfig.max_days || ''}
                  placeholder="No limit"
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...structConfig, max_days: e.target.value ? parseInt(e.target.value) : null }
                  })}
                />
              </div>
            </div>
          </div>
        );

      case 'combination':
        return (
          <div className="structure-config">
            <div className="form-row">
              <div className="form-group">
                <label>Initial Flat Fee ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={structConfig.initial_flat || 25}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...structConfig, initial_flat: parseFloat(e.target.value) }
                  })}
                />
              </div>
              <div className="form-group">
                <label>After Days</label>
                <input
                  type="number"
                  value={structConfig.after_days || 15}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...structConfig, after_days: parseInt(e.target.value) }
                  })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Then Daily ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={structConfig.then_daily || 1}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...structConfig, then_daily: parseFloat(e.target.value) }
                  })}
                />
              </div>
              <div className="form-group">
                <label>Max Days (optional)</label>
                <input
                  type="number"
                  value={structConfig.max_days || ''}
                  placeholder="No limit"
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...structConfig, max_days: e.target.value ? parseInt(e.target.value) : null }
                  })}
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) return <div className="loading">Loading rules...</div>;

  return (
    <div className="late-fee-rules">
      <div className="rules-header">
        <div>
          <h2>💰 Late Fee Rules</h2>
          <p>Configure custom late fee rules for specific offences or categories</p>
        </div>
        <button className="btn-primary" onClick={handleCreate}>
          + Create Rule
        </button>
      </div>

      {message && <Alert type={message.type} message={message.text} onClose={() => setMessage(null)} />}

      <div className="rules-list">
        {rules.length === 0 ? (
          <div className="empty-state">
            <p>No late fee rules configured</p>
            <p className="hint">Create rules to override global late fee settings for specific offences</p>
          </div>
        ) : (
          <table className="rules-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Name</th>
                <th>Applies To</th>
                <th>Structure</th>
                <th>Grace Period</th>
                <th>Effective Dates</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id} className={!rule.active ? 'inactive' : ''}>
                  <td className="priority">{rule.priority}</td>
                  <td>
                    <strong>{rule.name}</strong>
                    {rule.description && <div className="description">{rule.description}</div>}
                  </td>
                  <td>
                    {rule.offence_id ? (
                      <span className="badge badge-offence">
                        Offence: {offences.find(o => o.id === rule.offence_id)?.name || rule.offence_id}
                      </span>
                    ) : rule.offence_category_id ? (
                      <span className="badge badge-category">
                        Category: {categories.find(c => c.id === rule.offence_category_id)?.name || rule.offence_category_id}
                      </span>
                    ) : (
                      <span className="badge badge-global">Global</span>
                    )}
                  </td>
                  <td>
                    <span className="structure-type">{rule.fee_structure_type}</span>
                  </td>
                  <td>{rule.grace_period_days} days</td>
                  <td>
                    <div className="dates">
                      <div>From: {rule.effective_from}</div>
                      {rule.effective_to && <div>To: {rule.effective_to}</div>}
                    </div>
                  </td>
                  <td>
                    <span className={`status ${rule.enabled && rule.active ? 'active' : 'inactive'}`}>
                      {rule.enabled && rule.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn-edit" onClick={() => handleEdit(rule)}>Edit</button>
                      <button className="btn-delete" onClick={() => handleDelete(rule.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingRule ? 'Edit Late Fee Rule' : 'Create Late Fee Rule'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Rule Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Speeding Late Fee Override"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows="2"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Applies To</label>
                  <select
                    value={formData.offence_id || formData.offence_category_id || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.startsWith('offence-')) {
                        setFormData({ 
                          ...formData, 
                          offence_id: parseInt(value.replace('offence-', '')),
                          offence_category_id: null
                        });
                      } else if (value.startsWith('category-')) {
                        setFormData({ 
                          ...formData, 
                          offence_id: null,
                          offence_category_id: parseInt(value.replace('category-', ''))
                        });
                      } else {
                        setFormData({ ...formData, offence_id: null, offence_category_id: null });
                      }
                    }}
                  >
                    <option value="">Global (All Offences)</option>
                    <optgroup label="Categories">
                      {categories.map(cat => (
                        <option key={`cat-${cat.id}`} value={`category-${cat.id}`}>
                          {cat.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Specific Offences">
                      {offences.map(off => (
                        <option key={`off-${off.id}`} value={`offence-${off.id}`}>
                          {off.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  />
                  <small>Higher priority rules are applied first</small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Grace Period (days)</label>
                  <input
                    type="number"
                    value={formData.grace_period_days}
                    onChange={(e) => setFormData({ ...formData, grace_period_days: parseInt(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label>Fee Structure Type</label>
                  <select
                    value={formData.fee_structure_type}
                    onChange={(e) => setFormData({ ...formData, fee_structure_type: e.target.value, config: {} })}
                  >
                    <option value="flat">Flat Fee</option>
                    <option value="tiered">Tiered Fees</option>
                    <option value="percentage">Percentage</option>
                    <option value="daily">Daily Accruing</option>
                    <option value="combination">Combination</option>
                  </select>
                </div>
              </div>

              {renderStructureConfig()}

              <div className="form-row">
                <div className="form-group">
                  <label>Max Fee Cap ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.max_fee_cap_amount || ''}
                    placeholder="No limit"
                    onChange={(e) => setFormData({ ...formData, max_fee_cap_amount: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>

                <div className="form-group">
                  <label>Max Fee Cap (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={formData.max_fee_cap_percentage || ''}
                    placeholder="No limit"
                    onChange={(e) => setFormData({ ...formData, max_fee_cap_percentage: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Effective From *</label>
                  <input
                    type="date"
                    value={formData.effective_from}
                    onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Effective To</label>
                  <input
                    type="date"
                    value={formData.effective_to || ''}
                    onChange={(e) => setFormData({ ...formData, effective_to: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.apply_to_original_only}
                    onChange={(e) => setFormData({ ...formData, apply_to_original_only: e.target.checked })}
                  />
                  <span>Apply to Original Amount Only</span>
                </label>
              </div>

              <div className="form-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.pause_during_dispute}
                    onChange={(e) => setFormData({ ...formData, pause_during_dispute: e.target.checked })}
                  />
                  <span>Pause During Dispute</span>
                </label>
              </div>

              <div className="form-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  />
                  <span>Enabled</span>
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSave}>
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .late-fee-rules {
          padding: 2rem;
        }

        .rules-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
          padding: 1.5rem;
          background: rgba(255, 255, 255, 0.55);
          backdrop-filter: blur(16px) saturate(1.1);
          -webkit-backdrop-filter: blur(16px) saturate(1.1);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 20px;
          box-shadow: 0 4px 20px rgba(0, 63, 135, 0.12);
        }

        .rules-header > div {
          flex: 1;
        }

        .rules-header h2 {
          font-size: 1.8rem;
          margin-bottom: 0.5rem;
          color: #1a1a1a;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .rules-header p {
          color: #666;
          font-size: 0.95rem;
          margin: 0;
        }

        .rules-list {
          background: rgba(255, 255, 255, 0.55);
          backdrop-filter: blur(24px) saturate(1.15);
          -webkit-backdrop-filter: blur(24px) saturate(1.15);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 28px;
          box-shadow: 0 12px 48px rgba(0, 63, 135, 0.18), 0 4px 16px rgba(0, 0, 0, 0.06);
          overflow: hidden;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #666;
        }

        .empty-state .hint {
          font-size: 0.9rem;
          margin-top: 0.5rem;
        }

        .rules-table {
          width: 100%;
          border-collapse: collapse;
        }

        .rules-table th {
          background: #f8f9fa;
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid #dee2e6;
          color: #2c3e50;
        }

        .rules-table td {
          padding: 1rem;
          border-bottom: 1px solid #dee2e6;
          color: #495057;
        }

        .rules-table tr.inactive {
          opacity: 0.6;
        }

        .priority {
          font-weight: bold;
          color: #102B3F;
        }

        .description {
          font-size: 0.85rem;
          color: #666;
          margin-top: 0.25rem;
        }

        .badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .badge-offence {
          background: #e3f2fd;
          color: #1976d2;
        }

        .badge-category {
          background: #f3e5f5;
          color: #7b1fa2;
        }

        .badge-global {
          background: #e8f5e9;
          color: #388e3c;
        }

        .structure-type {
          text-transform: capitalize;
          font-weight: 500;
        }

        .dates {
          font-size: 0.9rem;
        }

        .status {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .status.active {
          background: #d4edda;
          color: #155724;
        }

        .status.inactive {
          background: #f8d7da;
          color: #721c24;
        }

        .actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn-edit, .btn-delete {
          padding: 0.4rem 0.8rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .btn-edit {
          background: #102B3F;
          color: white;
        }

        .btn-edit:hover {
          background: #0a1929;
          transform: translateY(-1px);
        }

        .btn-delete {
          background: #dc3545;
          color: white;
        }

        .btn-delete:hover {
          background: #c82333;
          transform: translateY(-1px);
        }

        .btn-primary {
          padding: 0.75rem 1.5rem;
          background: #102B3F;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0, 63, 135, 0.3);
          transition: all 0.3s ease;
        }

        .btn-primary:hover {
          background: #0a1929;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 63, 135, 0.4);
        }

        .btn-secondary {
          padding: 0.75rem 1.5rem;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .btn-secondary:hover {
          background: #545b62;
          transform: translateY(-2px);
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .modal {
          background: white;
          border-radius: 28px;
          max-width: 800px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 24px 72px rgba(0, 63, 135, 0.28), 0 8px 24px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #dee2e6;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 1.5rem;
          color: #102B3F;
        }

        .close-btn {
          background: #f8f9fa;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #6c757d;
          line-height: 1;
          padding: 0;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          background: #dc3545;
          color: white;
          transform: scale(1.1);
        }

        .modal-body {
          padding: 1.5rem;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding: 1.5rem;
          border-top: 1px solid #dee2e6;
          background: #f8f9fa;
          border-radius: 0 0 28px 28px;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #2c3e50;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          background: #f8f9fa;
          transition: all 0.3s ease;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #102B3F;
          background: white;
          box-shadow: 0 0 0 4px rgba(0, 63, 135, 0.1);
        }

        .form-group small {
          display: block;
          margin-top: 0.25rem;
          color: #666;
          font-size: 0.85rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          cursor: pointer;
        }

        .toggle-label input[type="checkbox"] {
          margin-right: 0.75rem;
          width: 18px;
          height: 18px;
        }

        .structure-config {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 12px;
          margin-bottom: 1.5rem;
          border: 1px solid #e9ecef;
        }

        .tier-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          align-items: center;
        }

        .tier-row input {
          flex: 1;
          padding: 0.75rem;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          background: white;
        }

        .tier-row input:focus {
          outline: none;
          border-color: #102B3F;
        }

        .tier-row button {
          padding: 0.5rem 1rem;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tier-row button:hover {
          background: #c82333;
          transform: translateY(-1px);
        }

        .structure-config > button {
          padding: 0.5rem 1rem;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .structure-config > button:hover {
          background: #218838;
          transform: translateY(-1px);
        }

        .loading {
          text-align: center;
          padding: 3rem;
          color: #666;
        }

        /* Dark Mode Styles */
        html.dark .rules-header {
          background: rgba(30, 41, 59, 0.65);
          backdrop-filter: blur(16px) saturate(1.1);
          -webkit-backdrop-filter: blur(16px) saturate(1.1);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        html.dark .rules-header h2 {
          color: #f8fafc;
        }

        html.dark .rules-header p {
          color: #94a3b8;
        }

        html.dark .rules-list {
          background: rgba(30, 41, 59, 0.65);
          backdrop-filter: blur(24px) saturate(1.15);
          -webkit-backdrop-filter: blur(24px) saturate(1.15);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.2);
        }

        html.dark .empty-state {
          color: #94a3b8;
        }

        html.dark .rules-table th {
          background: rgba(15, 23, 42, 0.8);
          color: #f8fafc;
          border-bottom-color: rgba(255, 255, 255, 0.1);
        }

        html.dark .rules-table td {
          color: #e2e8f0;
          border-bottom-color: rgba(255, 255, 255, 0.1);
        }

        html.dark .rules-table tbody tr:hover {
          background: rgba(30, 41, 59, 0.8);
        }

        html.dark .priority {
          color: #60a5fa;
        }

        html.dark .description {
          color: #94a3b8;
        }

        html.dark .badge-offence {
          background: rgba(25, 118, 210, 0.2);
          color: #60a5fa;
        }

        html.dark .badge-category {
          background: rgba(123, 31, 162, 0.2);
          color: #c084fc;
        }

        html.dark .badge-global {
          background: rgba(56, 142, 60, 0.2);
          color: #86efac;
        }

        html.dark .structure-type {
          color: #e2e8f0;
        }

        html.dark .dates {
          color: #94a3b8;
        }

        html.dark .status.active {
          background: rgba(40, 167, 69, 0.2);
          color: #86efac;
        }

        html.dark .status.inactive {
          background: rgba(220, 53, 69, 0.2);
          color: #fca5a5;
        }

        html.dark .modal {
          background: white;
        }

        html.dark .modal-header {
          border-bottom-color: rgba(255, 255, 255, 0.1);
        }

        html.dark .modal-header h3 {
          color: #f8fafc;
        }

        html.dark .modal-body {
          background: rgba(30, 41, 59, 0.65);
        }

        html.dark .modal-footer {
          border-top-color: rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.8);
        }

        html.dark .form-group label {
          color: #e2e8f0;
        }

        html.dark .form-group input,
        html.dark .form-group select,
        html.dark .form-group textarea {
          background: rgba(30, 41, 59, 0.8);
          border-color: rgba(255, 255, 255, 0.1);
          color: #f8fafc;
        }

        html.dark .form-group input:focus,
        html.dark .form-group select:focus,
        html.dark .form-group textarea:focus {
          border-color: #3b82f6;
          background: rgba(30, 41, 59, 1);
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
        }

        html.dark .form-group small {
          color: #94a3b8;
        }

        html.dark .toggle-label span {
          color: #e2e8f0;
        }

        html.dark .structure-config {
          background: rgba(30, 41, 59, 0.8);
          border-color: rgba(255, 255, 255, 0.1);
        }

        html.dark .tier-row input {
          background: rgba(30, 41, 59, 0.8);
          border-color: rgba(255, 255, 255, 0.1);
          color: #f8fafc;
        }

        html.dark .tier-row input:focus {
          border-color: #3b82f6;
        }

        html.dark .loading {
          color: #94a3b8;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
          }
          
          .rules-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .rules-table {
            display: block;
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default LateFeeRules;
