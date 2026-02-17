/**
 * User Panel Manager Component
 * Allows admins to customize which panels a user can access
 */

import React, { useState, useEffect } from 'react';
import { getUserPanels, updateUserPanels, resetUserPanels } from '../../services/adminApi';
import '../../styles/Admin.css';
import '../../styles/PanelManager.css';

function UserPanelManager({ user, onClose, onUpdate }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [panelConfig, setPanelConfig] = useState(null);
  const [selectedPanels, setSelectedPanels] = useState([]);
  const [useCustom, setUseCustom] = useState(false);

  useEffect(() => {
    fetchPanelConfig();
  }, [user.id]);

  const fetchPanelConfig = async () => {
    try {
      setLoading(true);
      setError('');
      const config = await getUserPanels(user.id);
      setPanelConfig(config);
      
      // Set initial state
      if (config.using_custom && config.custom_panels) {
        setSelectedPanels(config.custom_panels);
        setUseCustom(true);
      } else {
        setSelectedPanels(config.role_panels || []);
        setUseCustom(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load panel configuration');
    } finally {
      setLoading(false);
    }
  };

  const handlePanelToggle = (panelId) => {
    setSelectedPanels(prev => {
      if (prev.includes(panelId)) {
        return prev.filter(p => p !== panelId);
      } else {
        return [...prev, panelId];
      }
    });
  };

  const handleSelectAll = () => {
    if (panelConfig) {
      setSelectedPanels(panelConfig.all_available_panels.map(p => p.id));
    }
  };

  const handleDeselectAll = () => {
    setSelectedPanels([]);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      // If using custom, save the selected panels; otherwise save null to use role defaults
      const panelsToSave = useCustom ? selectedPanels : null;
      
      await updateUserPanels(user.id, panelsToSave);
      setSuccess('Panel access updated successfully!');
      
      // Refresh config
      await fetchPanelConfig();
      
      // Notify parent
      if (onUpdate) {
        onUpdate();
      }
      
      // Close after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update panel access');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset to role defaults? This will remove all custom panel settings for this user.')) {
      return;
    }
    
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      await resetUserPanels(user.id);
      setSuccess('Panel access reset to role defaults!');
      
      // Refresh config
      await fetchPanelConfig();
      
      // Notify parent
      if (onUpdate) {
        onUpdate();
      }
      
      // Close after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset panel access');
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = (custom) => {
    setUseCustom(custom);
    if (!custom && panelConfig) {
      // Switch to role defaults
      setSelectedPanels(panelConfig.role_panels || []);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Manage Panel Access</h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Loading panel configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content panel-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Panel Access - {user.username}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
              {success}
            </div>
          )}

          {panelConfig && (
            <>
              {/* User Info */}
              <div className="panel-manager-info">
                <p><strong>User:</strong> {panelConfig.username}</p>
                <p><strong>Role:</strong> {panelConfig.role}</p>
                <p><strong>Current Mode:</strong> {panelConfig.using_custom ? 'Custom Panels' : 'Role Defaults'}</p>
              </div>

              {/* Mode Selection */}
              <div className="panel-mode-selector">
                <label className="mode-option">
                  <input
                    type="radio"
                    checked={!useCustom}
                    onChange={() => handleModeChange(false)}
                    disabled={saving}
                  />
                  <span>Use Role Defaults</span>
                  <small>User gets panels based on their role ({panelConfig.role})</small>
                </label>

                <label className="mode-option">
                  <input
                    type="radio"
                    checked={useCustom}
                    onChange={() => handleModeChange(true)}
                    disabled={saving}
                  />
                  <span>Custom Panel Access</span>
                  <small>Manually select which panels this user can access</small>
                </label>
              </div>

              {/* Panel Selection (only show if custom mode) */}
              {useCustom && (
                <>
                  <div className="panel-selection-actions">
                    <button
                      onClick={handleSelectAll}
                      disabled={saving}
                      className="btn-secondary btn-sm"
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      disabled={saving}
                      className="btn-secondary btn-sm"
                    >
                      Deselect All
                    </button>
                  </div>

                  <div className="panel-list">
                    {panelConfig.all_available_panels.map(panel => (
                      <label key={panel.id} className="panel-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedPanels.includes(panel.id)}
                          onChange={() => handlePanelToggle(panel.id)}
                          disabled={saving}
                        />
                        <span className="panel-icon">{panel.icon}</span>
                        <span className="panel-name">{panel.name}</span>
                        {panelConfig.role_panels.includes(panel.id) && (
                          <span className="panel-badge">From Role</span>
                        )}
                      </label>
                    ))}
                  </div>
                </>
              )}

              {/* Role Panels Preview (only show if using role defaults) */}
              {!useCustom && (
                <div className="role-panels-preview">
                  <h4>Panels from Role ({panelConfig.role}):</h4>
                  <div className="panel-list-preview">
                    {panelConfig.role_panels.map(panelId => {
                      const panel = panelConfig.all_available_panels.find(p => p.id === panelId);
                      return panel ? (
                        <div key={panel.id} className="panel-preview-item">
                          <span className="panel-icon">{panel.icon}</span>
                          <span className="panel-name">{panel.name}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button
            onClick={handleReset}
            disabled={saving || !panelConfig?.using_custom}
            className="btn-secondary"
          >
            Reset to Defaults
          </button>
          <div style={{ flex: 1 }}></div>
          <button onClick={onClose} disabled={saving} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserPanelManager;
