/**
 * Gamification Settings - Admin Panel
 * Main settings panel for configuring gamification features
 */

import React, { useState, useEffect } from 'react';
import BadgeManagement from './BadgeManagement';
import RewardManagement from './RewardManagement';
import LeaderboardManagement from './LeaderboardManagement';
import EarlyDiscountConfig from './EarlyDiscountConfig';
import CitizenProfilesView from './CitizenProfilesView';
import GamificationAnalytics from './GamificationAnalytics';
import adminAPI from '../../services/adminApi';

function GamificationSettings() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [gamificationEnabled, setGamificationEnabled] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingToggle, setPendingToggle] = useState(null);

  const tabs = [
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
    { id: 'badges', label: 'Badges', icon: '🏆' },
    { id: 'rewards', label: 'Rewards', icon: '🎁' },
    { id: 'discounts', label: 'Early Discounts', icon: '💰' },
    { id: 'leaderboards', label: 'Leaderboards', icon: '🏅' },
    { id: 'citizens', label: 'Citizens', icon: '👥' }
  ];

  useEffect(() => {
    fetchGamificationConfig();
  }, []);

  const fetchGamificationConfig = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getGamificationConfig();
      setGamificationEnabled(response.gamification_enabled);
    } catch (error) {
      console.error('Failed to fetch gamification config:', error);
      // Default to enabled if API fails
      setGamificationEnabled(true);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGamification = () => {
    setShowConfirmDialog(true);
    setPendingToggle(!gamificationEnabled);
  };

  const confirmToggleGamification = async () => {
    try {
      setSaving(true);
      setShowConfirmDialog(false);
      setAlert(null);

      const response = await adminAPI.updateGamificationConfig({
        gamification_enabled: pendingToggle
      });

      setGamificationEnabled(pendingToggle);
      const status = pendingToggle ? 'enabled' : 'disabled';
      
      setAlert({
        type: 'success',
        message: `Gamification ${status} successfully!`
      });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to update gamification settings'
      });
    } finally {
      setSaving(false);
      setPendingToggle(null);
    }
  };

  const cancelToggleGamification = () => {
    setShowConfirmDialog(false);
    setPendingToggle(null);
  };

  return (
    <div className="gamification-settings">
      <div className="settings-header">
        <h1>🎮 Gamification Settings</h1>
        <p>Configure badges, rewards, discounts, and leaderboards</p>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.message}
          <button onClick={() => setAlert(null)} className="alert-close">×</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tabs-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="tab-pane active">
            <div className="settings-section">
              <h3>⚙️ General Settings</h3>
              <p className="section-description">
                Control gamification features for citizens on the platform
              </p>

              <div className="toggle-card">
                <div className="toggle-info">
                  <div className="toggle-header">
                    <h4>🎮 Gamification Features</h4>
                    <span className={`status-badge ${gamificationEnabled ? 'status-active' : 'status-inactive'}`}>
                      {gamificationEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p>
                    When enabled, citizens can earn points, badges, and rewards for early ticket payments 
                    and good driving behavior. Gamification encourages timely payments and road safety.
                  </p>
                </div>
                
                <div className="toggle-actions">
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={gamificationEnabled}
                      onChange={handleToggleGamification}
                      disabled={saving}
                    />
                    <span className="slider round"></span>
                  </label>
                  <span className="toggle-label">
                    {gamificationEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>

              {gamificationEnabled && (
                <div className="feature-preview">
                  <h4>Active Features:</h4>
                  <ul>
                    <li>🏆 <strong>Badges:</strong> Citizens earn badges for achievements</li>
                    <li>🎁 <strong>Rewards:</strong> Redeemable rewards for points</li>
                    <li>💰 <strong>Early Payment Discounts:</strong> Discounts for early payments</li>
                    <li>🏅 <strong>Leaderboards:</strong> Rankings for top performers</li>
                    <li>📊 <strong>Analytics:</strong> Track engagement and performance</li>
                  </ul>
                </div>
              )}

              {!gamificationEnabled && (
                <div className="disabled-notice">
                  <h4>⚠️ What happens when disabled:</h4>
                  <ul>
                    <li>Citizens will not see gamification features on their dashboard</li>
                    <li>Points will no longer be awarded for payments</li>
                    <li>Badges will not be displayed</li>
                    <li>Rewards and discounts will be hidden</li>
                    <li>Leaderboards will be hidden from public view</li>
                    <li>Existing citizen points and badges will be preserved</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && <GamificationAnalytics />}
        {activeTab === 'badges' && <BadgeManagement />}
        {activeTab === 'rewards' && <RewardManagement />}
        {activeTab === 'discounts' && <EarlyDiscountConfig />}
        {activeTab === 'leaderboards' && <LeaderboardManagement />}
        {activeTab === 'citizens' && <CitizenProfilesView />}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h3>⚠️ Confirm Change</h3>
                <button onClick={cancelToggleGamification} className="modal-close">×</button>
              </div>
              <div className="modal-body">
                <p>
                  {pendingToggle ? (
                    <>
                      Are you sure you want to <strong>enable</strong> gamification features? 
                      Citizens will be able to earn points, badges, and rewards.
                    </>
                  ) : (
                    <>
                      Are you sure you want to <strong>disable</strong> gamification features? 
                      <br /><br />
                      <strong>Note:</strong> This will hide all gamification features from citizens, 
                      but existing data (points, badges, rewards) will be preserved.
                    </>
                  )}
                </p>
              </div>
              <div className="modal-actions">
                <button onClick={cancelToggleGamification} className="btn-secondary">
                  Cancel
                </button>
                <button 
                  onClick={confirmToggleGamification} 
                  className={pendingToggle ? 'btn-success' : 'btn-danger'}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : (pendingToggle ? 'Enable' : 'Disable')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .gamification-settings {
          padding: 1.5rem;
        }

        .settings-header {
          margin-bottom: 1.5rem;
        }

        .settings-header h1 {
          color: #003f87;
          margin-bottom: 0.5rem;
        }

        .settings-header p {
          color: #6c757d;
          margin: 0;
        }

        .alert {
          padding: 1rem 1.5rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .alert-success {
          background-color: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .alert-error {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .alert-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          opacity: 0.7;
        }

        .tabs-navigation {
          display: flex;
          gap: 0.5rem;
          padding: 1rem 1.5rem 0;
          border-bottom: 2px solid #e9ecef;
          overflow-x: auto;
        }

        .tab-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          color: #6c757d;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .tab-button:hover {
          color: #003f87;
          background: #f8f9fa;
        }

        .tab-button.active {
          color: #003f87;
          border-bottom-color: #003f87;
        }

        .tab-icon {
          font-size: 1.2rem;
        }

        .tab-content {
          padding: 2rem 1.5rem;
        }

        .tab-pane {
          display: none;
        }

        .tab-pane.active {
          display: block;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .settings-section {
          max-width: 800px;
        }

        .settings-section h3 {
          color: #003f87;
          margin-bottom: 0.5rem;
        }

        .section-description {
          color: #6c757d;
          margin-bottom: 2rem;
        }

        .toggle-card {
          background: #f8f9fa;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .toggle-info {
          flex: 1;
        }

        .toggle-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .toggle-header h4 {
          margin: 0;
          color: #212529;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .status-active {
          background-color: #d4edda;
          color: #155724;
        }

        .status-inactive {
          background-color: #f8d7da;
          color: #721c24;
        }

        .toggle-info p {
          color: #6c757d;
          margin: 0;
          font-size: 0.95rem;
        }

        .toggle-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-left: 2rem;
        }

        .switch {
          position: relative;
          display: inline-block;
          width: 60px;
          height: 34px;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.4s;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 26px;
          width: 26px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: 0.4s;
        }

        input:checked + .slider {
          background-color: #28a745;
        }

        input:focus + .slider {
          box-shadow: 0 0 1px #28a745;
        }

        input:checked + .slider:before {
          transform: translateX(26px);
        }

        .slider.round {
          border-radius: 34px;
        }

        .slider.round:before {
          border-radius: 50%;
        }

        .toggle-label {
          font-weight: 600;
          color: #495057;
          min-width: 40px;
        }

        .feature-preview {
          background: #e7f3ff;
          border-left: 4px solid #007bff;
          padding: 1.5rem;
          border-radius: 0 8px 8px 0;
        }

        .feature-preview h4 {
          color: #004085;
          margin-bottom: 1rem;
        }

        .feature-preview ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .feature-preview li {
          padding: 0.5rem 0;
          color: #495057;
        }

        .disabled-notice {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 1.5rem;
          border-radius: 0 8px 8px 0;
        }

        .disabled-notice h4 {
          color: #856404;
          margin-bottom: 1rem;
        }

        .disabled-notice ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .disabled-notice li {
          padding: 0.5rem 0;
          color: #495057;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-dialog {
          background: white;
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }

        .modal-content {
          padding: 0;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #e9ecef;
        }

        .modal-header h3 {
          margin: 0;
          color: #212529;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #6c757d;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .modal-body p {
          margin: 0;
          color: #495057;
          line-height: 1.6;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding: 1.5rem;
          border-top: 1px solid #e9ecef;
        }

        .btn-secondary {
          padding: 0.75rem 1.5rem;
          border: 1px solid #6c757d;
          background: white;
          color: #6c757d;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-secondary:hover {
          background: #f8f9fa;
        }

        .btn-success {
          padding: 0.75rem 1.5rem;
          border: none;
          background: #28a745;
          color: white;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-success:hover {
          background: #218838;
        }

        .btn-danger {
          padding: 0.75rem 1.5rem;
          border: none;
          background: #dc3545;
          color: white;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-danger:hover {
          background: #c82333;
        }

        .btn-success:disabled,
        .btn-danger:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .tabs-navigation {
            padding: 1rem 1rem 0;
          }

          .tab-button {
            padding: 0.5rem 1rem;
            font-size: 0.9rem;
          }

          .tab-label {
            display: none;
          }

          .tab-icon {
            font-size: 1.5rem;
          }

          .tab-content {
            padding: 1.5rem 1rem;
          }

          .toggle-card {
            flex-direction: column;
            gap: 1.5rem;
          }

          .toggle-actions {
            margin-left: 0;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}

export default GamificationSettings;
