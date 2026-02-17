/**
 * Penalty Rules Management Component
 * Allows admins to manage penalty rules for offences
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';
import '../../styles/Admin.css';

function PenaltyRules() {
  const [rules, setRules] = useState([]);
  const [offences, setOffences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [filterOffence, setFilterOffence] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  // Form state
  const [formData, setFormData] = useState({
    offence_id: '',
    min_value: '',
    max_value: '',
    base_fine: '',
    points: 0,
    court_required: false,
    repeat_multiplier: 1.5,
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    active: true
  });

  // Calculator state
  const [calculatorData, setCalculatorData] = useState({
    offence_id: '',
    measured_value: '',
    is_repeat_offence: false
  });
  const [calculatorResult, setCalculatorResult] = useState(null);

  useEffect(() => {
    loadOffences();
    loadRules();
  }, []);

  const loadOffences = async () => {
    try {
      const data = await adminAPI.getOffences({ active: true });
      setOffences(data.offences || []);
    } catch (err) {
      console.error('Failed to load offences:', err);
    }
  };

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {};
      if (filterOffence) {
        params.offence_id = filterOffence;
      }
      if (filterActive !== 'all') {
        params.active = filterActive === 'true';
      }

      const data = await adminAPI.getPenaltyRules(params);
      setRules(data.rules || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load penalty rules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRule(null);
    setFormData({
      offence_id: '',
      min_value: '',
      max_value: '',
      base_fine: '',
      points: 0,
      court_required: false,
      repeat_multiplier: 1.5,
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: '',
      active: true
    });
    setShowModal(true);
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      offence_id: rule.offence_id,
      min_value: rule.min_value || '',
      max_value: rule.max_value || '',
      base_fine: rule.base_fine,
      points: rule.points,
      court_required: rule.court_required,
      repeat_multiplier: rule.repeat_multiplier,
      effective_from: rule.effective_from,
      effective_to: rule.effective_to || '',
      active: rule.active
    });
    setShowModal(true);
  };

  const handleDelete = async (rule) => {
    if (!window.confirm('Are you sure you want to deactivate this penalty rule?')) {
      return;
    }

    try {
      await adminAPI.deletePenaltyRule(rule.id);
      loadRules();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete rule');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const submitData = {
        ...formData,
        min_value: formData.min_value ? parseFloat(formData.min_value) : null,
        max_value: formData.max_value ? parseFloat(formData.max_value) : null,
        base_fine: parseFloat(formData.base_fine),
        points: parseInt(formData.points),
        repeat_multiplier: parseFloat(formData.repeat_multiplier)
      };

      if (editingRule) {
        await adminAPI.updatePenaltyRule(editingRule.id, submitData);
      } else {
        await adminAPI.createPenaltyRule(submitData);
      }
      
      setShowModal(false);
      loadRules();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save penalty rule');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleCalculate = async () => {
    setError(null);
    setCalculatorResult(null);

    try {
      const result = await adminAPI.calculateFinePreview({
        offence_id: parseInt(calculatorData.offence_id),
        measured_value: calculatorData.measured_value ? parseFloat(calculatorData.measured_value) : null,
        is_repeat_offence: calculatorData.is_repeat_offence
      });
      setCalculatorResult(result);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to calculate fine');
    }
  };

  const getSelectedOffence = () => {
    return offences.find(o => o.id === parseInt(formData.offence_id));
  };

  const isMeasurableOffence = () => {
    const offence = getSelectedOffence();
    return offence && offence.measurable_type !== 'none';
  };

  if (loading && rules.length === 0) {
    return (
      <div className="admin-section">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading penalty rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="section-header">
        <h1>💰 Penalty Rules</h1>
        <div>
          <button onClick={() => setShowCalculator(true)} className="btn btn-secondary" style={{marginRight: '10px'}}>
            🧮 Fine Calculator
          </button>
          <button onClick={handleCreate} className="btn btn-primary">
            ➕ Create Rule
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Offence:</label>
          <select 
            value={filterOffence} 
            onChange={(e) => {
              setFilterOffence(e.target.value);
              setTimeout(loadRules, 100);
            }}
            className="filter-select"
          >
            <option value="">All Offences</option>
            {offences.map(off => (
              <option key={off.id} value={off.id}>{off.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select 
            value={filterActive} 
            onChange={(e) => {
              setFilterActive(e.target.value);
              setTimeout(loadRules, 100);
            }}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Rules Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Offence</th>
              <th>Range</th>
              <th>Base Fine</th>
              <th>Points</th>
              <th>Court</th>
              <th>Repeat Mult.</th>
              <th>Effective</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan="9" className="no-data">
                  No penalty rules found
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id}>
                  <td><strong>{rule.offence?.name || 'N/A'}</strong></td>
                  <td>
                    {rule.min_value || rule.max_value ? (
                      <code>
                        {rule.min_value || '0'} - {rule.max_value || '∞'} {rule.offence?.unit || ''}
                      </code>
                    ) : (
                      <span className="text-muted">Fixed</span>
                    )}
                  </td>
                  <td className="text-right"><strong>${parseFloat(rule.base_fine).toFixed(2)}</strong></td>
                  <td className="text-center">{rule.points}</td>
                  <td className="text-center">
                    {rule.court_required ? (
                      <span className="badge badge-warning">⚖️ Yes</span>
                    ) : (
                      <span className="badge badge-success">✓ No</span>
                    )}
                  </td>
                  <td className="text-center">{parseFloat(rule.repeat_multiplier).toFixed(1)}x</td>
                  <td>
                    <small>
                      {rule.effective_from}
                      {rule.effective_to && ` to ${rule.effective_to}`}
                    </small>
                  </td>
                  <td>
                    <span className={`status-badge ${rule.active ? 'active' : 'inactive'}`}>
                      {rule.active ? '✓ Active' : '✗ Inactive'}
                    </span>
                  </td>
                  <td className="actions">
                    <button 
                      onClick={() => handleEdit(rule)}
                      className="btn btn-sm btn-secondary"
                      title="Edit"
                    >
                      ✏️ Edit
                    </button>
                    {rule.active && (
                      <button 
                        onClick={() => handleDelete(rule)}
                        className="btn btn-sm btn-danger"
                        title="Deactivate"
                      >
                        🗑️ Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingRule ? 'Edit Penalty Rule' : 'Create Penalty Rule'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="close-btn">×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Offence *</label>
                  <select
                    name="offence_id"
                    value={formData.offence_id}
                    onChange={handleInputChange}
                    required
                    disabled={editingRule !== null}
                    className="form-input"
                  >
                    <option value="">Select an offence...</option>
                    {offences.map(off => (
                      <option key={off.id} value={off.id}>
                        {off.name} ({off.category?.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isMeasurableOffence() && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Min Value</label>
                    <input
                      type="number"
                      name="min_value"
                      value={formData.min_value}
                      onChange={handleInputChange}
                      step="0.01"
                      placeholder="e.g., 11"
                      className="form-input"
                    />
                    <small>Minimum {getSelectedOffence()?.unit || 'value'}</small>
                  </div>

                  <div className="form-group">
                    <label>Max Value</label>
                    <input
                      type="number"
                      name="max_value"
                      value={formData.max_value}
                      onChange={handleInputChange}
                      step="0.01"
                      placeholder="e.g., 20"
                      className="form-input"
                    />
                    <small>Maximum {getSelectedOffence()?.unit || 'value'}</small>
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Base Fine ($) *</label>
                  <input
                    type="number"
                    name="base_fine"
                    value={formData.base_fine}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g., 100.00"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Demerit Points *</label>
                  <input
                    type="number"
                    name="points"
                    value={formData.points}
                    onChange={handleInputChange}
                    min="0"
                    max="12"
                    required
                    className="form-input"
                  />
                  <small>0-12 points</small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Repeat Multiplier *</label>
                  <input
                    type="number"
                    name="repeat_multiplier"
                    value={formData.repeat_multiplier}
                    onChange={handleInputChange}
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    required
                    className="form-input"
                  />
                  <small>Applied to repeat offenders (e.g., 1.5 = 50% increase)</small>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="court_required"
                      checked={formData.court_required}
                      onChange={handleInputChange}
                    />
                    <span>Court Appearance Required</span>
                  </label>
                  <small>Blocks online payment</small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Effective From *</label>
                  <input
                    type="date"
                    name="effective_from"
                    value={formData.effective_from}
                    onChange={handleInputChange}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Effective To</label>
                  <input
                    type="date"
                    name="effective_to"
                    value={formData.effective_to}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                  <small>Leave blank for no expiry</small>
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="active"
                    checked={formData.active}
                    onChange={handleInputChange}
                  />
                  <span>Active</span>
                </label>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRule ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fine Calculator Modal */}
      {showCalculator && (
        <div className="modal-overlay fine-calculator-modal" onClick={() => setShowCalculator(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="calculator-header">
              <div className="calculator-header-icon">🧮</div>
              <h2>Fine Calculator</h2>
              <button type="button" onClick={() => setShowCalculator(false)} className="close-btn">×</button>
            </div>
            
            <div className="modal-body">
              <div className="calculator-form">
                <div className="form-group">
                  <label>Offence *</label>
                  <select
                    value={calculatorData.offence_id}
                    onChange={(e) => setCalculatorData(prev => ({
                      ...prev,
                      offence_id: e.target.value,
                      measured_value: ''
                    }))}
                    className="form-input"
                  >
                    <option value="">Select an offence...</option>
                    {offences.map(off => (
                      <option key={off.id} value={off.id}>{off.name}</option>
                    ))}
                  </select>
                </div>

                {calculatorData.offence_id && offences.find(o => o.id === parseInt(calculatorData.offence_id))?.measurable_type !== 'none' && (
                  <div className="form-group">
                    <label>Measured Value</label>
                    <div className="input-with-unit">
                      <input
                        type="number"
                        value={calculatorData.measured_value}
                        onChange={(e) => setCalculatorData(prev => ({
                          ...prev,
                          measured_value: e.target.value
                        }))}
                        step="0.01"
                        placeholder={`Enter ${offences.find(o => o.id === parseInt(calculatorData.offence_id))?.unit || 'value'}`}
                        className="form-input"
                      />
                      <span className="input-unit">{offences.find(o => o.id === parseInt(calculatorData.offence_id))?.unit || 'km/h'}</span>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={calculatorData.is_repeat_offence}
                      onChange={(e) => setCalculatorData(prev => ({
                        ...prev,
                        is_repeat_offence: e.target.checked
                      }))}
                    />
                    <span>🔄 Repeat Offence</span>
                  </label>
                </div>

                <button 
                  onClick={handleCalculate}
                  disabled={!calculatorData.offence_id}
                  className="btn btn-primary"
                >
                  Calculate Fine
                </button>
              </div>

              {calculatorResult && (
                <div className="calculator-result">
                  <div className="calculator-result-header">
                    <h3>💰 Calculated Fine</h3>
                  </div>
                  <div className="calculator-result-body">
                    <p className="fine-amount">${parseFloat(calculatorResult.calculated_fine).toFixed(2)}</p>
                    <div className="fine-details">
                      <div className="detail-item">
                        <span className="detail-label">Base Fine</span>
                        <span className="detail-value">${parseFloat(calculatorResult.base_fine).toFixed(2)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Points</span>
                        <span className="detail-value">{calculatorResult.points}</span>
                      </div>
                      {calculatorResult.is_repeat_offence && (
                        <div className="detail-item">
                          <span className="detail-label">Multiplier</span>
                          <span className="detail-value">{parseFloat(calculatorResult.repeat_multiplier).toFixed(1)}x</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {calculatorResult.court_required && (
                    <div className="calculator-warning">
                      ⚖️ COURT APPEARANCE REQUIRED - Payment Blocked
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="calculator-modal-actions">
              <button 
                onClick={() => {
                  setShowCalculator(false);
                  setCalculatorResult(null);
                  setCalculatorData({ offence_id: '', measured_value: '', is_repeat_offence: false });
                }}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PenaltyRules;
