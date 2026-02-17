import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';
import { Alert } from '../common';

const LateFeeSettings = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({
    enabled: false,
    grace_period_days: 15,
    fee_structure_type: 'flat',
    config: {},
    max_fee_cap_amount: null,
    max_fee_cap_percentage: null,
    apply_to_original_only: true,
    pause_during_dispute: true
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getLateFeeConfig();
      if (data.config) {
        setConfig(data.config);
        const newFormData = {
          enabled: data.config.enabled,
          grace_period_days: data.config.grace_period_days,
          fee_structure_type: data.config.fee_structure_type,
          config: data.config.config || {},
          max_fee_cap_amount: data.config.max_fee_cap_amount,
          max_fee_cap_percentage: data.config.max_fee_cap_percentage,
          apply_to_original_only: data.config.apply_to_original_only,
          pause_during_dispute: data.config.pause_during_dispute
        };
        setFormData(newFormData);
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to load configuration: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefaults = () => {
    const defaultConfig = {
      enabled: false,
      grace_period_days: 15,
      fee_structure_type: 'flat',
      config: { amount: 25, after_days: 15 },
      max_fee_cap_amount: null,
      max_fee_cap_percentage: null,
      apply_to_original_only: true,
      pause_during_dispute: true
    };
    setFormData(defaultConfig);
    setMessage({ type: 'info', text: 'Form reset to default values' });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await adminAPI.updateLateFeeConfig(formData);
      setMessage({ type: 'success', text: 'Configuration saved successfully' });
      loadConfig();
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to save: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  const renderStructureConfig = () => {
    const { fee_structure_type, config: structConfig } = formData;

    switch (fee_structure_type) {
      case 'flat':
        return (
          <div className="structure-config">
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
        );

      case 'tiered':
        const tiers = structConfig.tiers || [{ days: 15, amount: 25 }, { days: 45, amount: 50 }];
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
                <button onClick={() => {
                  const newTiers = tiers.filter((_, i) => i !== idx);
                  setFormData({ ...formData, config: { tiers: newTiers } });
                }}>Remove</button>
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
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={structConfig.compound || false}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...structConfig, compound: e.target.checked }
                  })}
                />
                Compound Interest
              </label>
            </div>
          </div>
        );

      case 'daily':
        return (
          <div className="structure-config">
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
        );

      case 'combination':
        return (
          <div className="structure-config">
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
        );

      default:
        return null;
    }
  };

  if (loading) return <div className="loading">Loading configuration...</div>;

  return (
    <div className="late-fee-settings">
      <div className="settings-header">
        <h2>💰 Late Fee Configuration</h2>
        <p>Configure automatic late fee calculation for overdue tickets</p>
      </div>

      {message && <Alert type={message.type} message={message.text} onClose={() => setMessage(null)} />}

      <div className="settings-form">
        <div className="form-section">
          <h3>General Settings</h3>
          
          <div className="form-group">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
              <span>Enable Late Fees</span>
            </label>
          </div>

          <div className="form-group">
            <label>Grace Period (days after due date)</label>
            <input
              type="number"
              min="0"
              max="90"
              value={formData.grace_period_days}
              onChange={(e) => setFormData({ ...formData, grace_period_days: parseInt(e.target.value) })}
            />
            <small>No late fees will be charged during the grace period</small>
          </div>
        </div>

        <div className="form-section">
          <h3>Fee Structure</h3>
          
          <div className="form-group">
            <label>Structure Type</label>
            <select
              value={formData.fee_structure_type}
              onChange={(e) => setFormData({ ...formData, fee_structure_type: e.target.value, config: {} })}
            >
              <option value="flat">Flat Fee (one-time after X days)</option>
              <option value="tiered">Tiered Fees (different amounts at thresholds)</option>
              <option value="percentage">Percentage (per period)</option>
              <option value="daily">Daily Accruing</option>
              <option value="combination">Combination (flat + daily)</option>
            </select>
          </div>

          {renderStructureConfig()}
        </div>

        <div className="form-section">
          <h3>Caps & Limits</h3>
          
          <div className="form-group">
            <label>Maximum Late Fee Amount ($)</label>
            <input
              type="number"
              step="0.01"
              value={formData.max_fee_cap_amount || ''}
              placeholder="No limit"
              onChange={(e) => setFormData({ ...formData, max_fee_cap_amount: e.target.value ? parseFloat(e.target.value) : null })}
            />
          </div>

          <div className="form-group">
            <label>Maximum Late Fee (% of original fine)</label>
            <input
              type="number"
              step="1"
              value={formData.max_fee_cap_percentage || ''}
              placeholder="No limit"
              onChange={(e) => setFormData({ ...formData, max_fee_cap_percentage: e.target.value ? parseFloat(e.target.value) : null })}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Application Rules</h3>
          
          <div className="form-group">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={formData.apply_to_original_only}
                onChange={(e) => setFormData({ ...formData, apply_to_original_only: e.target.checked })}
              />
              <span>Apply to Original Amount Only</span>
            </label>
            <small>If unchecked, fees apply to growing total (original + late fees)</small>
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
            <small>Stop calculating late fees while ticket is under challenge review</small>
          </div>
        </div>

        <div className="form-actions">
          <button 
            className="btn-primary" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          
          <button 
            className="btn-secondary" 
            onClick={handleResetToDefaults}
            disabled={loading || saving}
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      <style jsx>{`
        .late-fee-settings {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .settings-header {
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: rgba(255, 255, 255, 0.55);
          backdrop-filter: blur(16px) saturate(1.1);
          -webkit-backdrop-filter: blur(16px) saturate(1.1);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 20px;
          box-shadow: 0 4px 20px rgba(0, 63, 135, 0.12);
        }

        .settings-header h2 {
          font-size: 1.8rem;
          margin-bottom: 0.5rem;
          color: #1a1a1a;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .settings-header p {
          color: #666;
          font-size: 0.95rem;
          margin: 0;
        }

        .settings-form {
          background: rgba(255, 255, 255, 0.55);
          backdrop-filter: blur(24px) saturate(1.15);
          -webkit-backdrop-filter: blur(24px) saturate(1.15);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 28px;
          box-shadow: 0 12px 48px rgba(0, 63, 135, 0.18), 0 4px 16px rgba(0, 0, 0, 0.06);
          padding: 2rem;
        }

        .form-section {
          margin-bottom: 2rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid #e0e0e0;
        }

        .form-section:last-of-type {
          border-bottom: none;
        }

        .form-section h3 {
          font-size: 1.3rem;
          margin-bottom: 1rem;
          color: #333;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #333;
        }

        .form-group input[type="number"],
        .form-group input[type="text"],
        .form-group select {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          background: #f8f9fa;
          transition: all 0.3s ease;
        }

        .form-group input[type="number"]:focus,
        .form-group input[type="text"]:focus,
        .form-group select:focus {
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

        .toggle-label {
          display: flex;
          align-items: center;
          cursor: pointer;
          user-select: none;
        }

        .toggle-label input[type="checkbox"] {
          margin-right: 0.75rem;
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .toggle-label span {
          font-weight: 500;
        }

        .structure-config {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 12px;
          margin-top: 1rem;
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
          font-size: 0.9rem;
          transition: all 0.2s ease;
        }

        .tier-row button:hover {
          background: #c82333;
          transform: translateY(-1px);
        }

        .structure-config > button {
          margin-top: 0.5rem;
          padding: 0.5rem 1rem;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s ease;
        }

        .structure-config > button:hover {
          background: #218838;
          transform: translateY(-1px);
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid #e0e0e0;
        }

        .btn-primary,
        .btn-secondary {
          padding: 0.75rem 2rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary {
          background: #102B3F;
          color: white;
          box-shadow: 0 4px 12px rgba(0, 63, 135, 0.3);
        }

        .btn-primary:hover:not(:disabled) {
          background: #0a1929;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 63, 135, 0.4);
        }

        .btn-primary:disabled {
          background: #6c757d;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #545b62;
          transform: translateY(-2px);
        }

        .btn-secondary:disabled {
          background: #6c757d;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .loading {
          text-align: center;
          padding: 3rem;
          color: #666;
        }

        /* Dark Mode Styles */
        html.dark .settings-header {
          background: rgba(30, 41, 59, 0.65);
          backdrop-filter: blur(16px) saturate(1.1);
          -webkit-backdrop-filter: blur(16px) saturate(1.1);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        html.dark .settings-header h2 {
          color: #f8fafc;
        }

        html.dark .settings-header p {
          color: #94a3b8;
        }

        html.dark .settings-form {
          background: rgba(30, 41, 59, 0.65);
          backdrop-filter: blur(24px) saturate(1.15);
          -webkit-backdrop-filter: blur(24px) saturate(1.15);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.2);
        }

        html.dark .form-section h3 {
          color: #f8fafc;
        }

        html.dark .form-section {
          border-bottom-color: rgba(255, 255, 255, 0.1);
        }

        html.dark .form-group label {
          color: #e2e8f0;
        }

        html.dark .form-group input[type="number"],
        html.dark .form-group input[type="text"],
        html.dark .form-group select {
          background: rgba(30, 41, 59, 0.8);
          border-color: rgba(255, 255, 255, 0.1);
          color: #f8fafc;
        }

        html.dark .form-group input[type="number"]:focus,
        html.dark .form-group input[type="text"]:focus,
        html.dark .form-group select:focus {
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

        html.dark .form-actions {
          border-top-color: rgba(255, 255, 255, 0.1);
        }

        html.dark .loading {
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default LateFeeSettings;

