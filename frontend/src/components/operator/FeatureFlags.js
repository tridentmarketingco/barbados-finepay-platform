// @ts-nocheck
/**
 * PayFine Feature Flags Component
 * Manage feature flags for agencies
 */

import React, { useState, useEffect } from 'react';
import { getGovernments, getFeatureFlags, updateFeatureFlags } from '../../services/operatorApi';
import '../../styles/Operator.css';

function FeatureFlags() {
  const [governments, setGovernments] = useState([]);
  const [selectedGov, setSelectedGov] = useState(null);
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGovernments();
  }, []);

  useEffect(() => {
    if (selectedGov) {
      loadFeatures(selectedGov);
    }
  }, [selectedGov]);

  const loadGovernments = async () => {
    try {
      const data = await getGovernments();
      setGovernments(data.governments || []);
      if (data.governments && data.governments.length > 0) {
        setSelectedGov(data.governments[0].id);
      }
    } catch (error) {
      console.error('Failed to load agencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFeatures = async (governmentId) => {
    try {
      setLoading(true);
      const data = await getFeatureFlags(governmentId);
      setFeatures(data.features || getDefaultFeatures());
    } catch (error) {
      console.error('Failed to load feature flags:', error);
      setFeatures(getDefaultFeatures());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultFeatures = () => ({
    payment_processing: true,
    ticket_challenges: true,
    gamification_enabled: true,
    mobile_app: false,
    sms_notifications: true,
    email_notifications: true,
    payment_plans: false,
    bulk_operations: false,
    advanced_reporting: true,
    api_access: false,
    webhook_notifications: false,
    multi_currency: false,
    offline_payments: false,
    qr_code_payments: true,
    biometric_auth: false,
    two_factor_auth: true,
    audit_logging: true,
    data_export: true,
    custom_branding: true,
    white_label: false,
    developer_mode: false
  });

  const handleToggle = (featureKey) => {
    setFeatures({
      ...features,
      [featureKey]: !features[featureKey]
    });
  };

  const handleSave = async () => {
    if (!selectedGov) return;

    try {
      setSaving(true);
      await updateFeatureFlags(selectedGov, features);
      alert('Feature flags updated successfully');
    } catch (error) {
      console.error('Failed to update feature flags:', error);
      alert('Error updating feature flags: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getFeatureCategory = (key) => {
    const categories = {
      payment_processing: 'Core',
      ticket_challenges: 'Core',
      gamification_enabled: 'Core',
      mobile_app: 'Platform',
      sms_notifications: 'Notifications',
      email_notifications: 'Notifications',
      payment_plans: 'Payments',
      bulk_operations: 'Operations',
      advanced_reporting: 'Analytics',
      api_access: 'Integration',
      webhook_notifications: 'Integration',
      multi_currency: 'Payments',
      offline_payments: 'Payments',
      qr_code_payments: 'Payments',
      biometric_auth: 'Security',
      two_factor_auth: 'Security',
      audit_logging: 'Security',
      data_export: 'Data',
      custom_branding: 'Customization',
      white_label: 'Customization',
      developer_mode: 'Development'
    };
    return categories[key] || 'Other';
  };

  const getFeatureDescription = (key) => {
    const descriptions = {
      payment_processing: 'Enable online payment processing',
      ticket_challenges: 'Allow citizens to challenge tickets',
      gamification_enabled: 'Enable gamification features (points, badges, leaderboards, rewards)',
      mobile_app: 'Enable mobile app access',
      sms_notifications: 'Send SMS notifications to citizens',
      email_notifications: 'Send email notifications',
      payment_plans: 'Allow installment payment plans',
      bulk_operations: 'Enable bulk ticket operations',
      advanced_reporting: 'Access to advanced analytics',
      api_access: 'Enable REST API access',
      webhook_notifications: 'Send webhook notifications',
      multi_currency: 'Support multiple currencies',
      offline_payments: 'Accept offline payment methods',
      qr_code_payments: 'Enable QR code payments',
      biometric_auth: 'Biometric authentication',
      two_factor_auth: 'Two-factor authentication',
      audit_logging: 'Comprehensive audit logging',
      data_export: 'Export data to CSV/Excel',
      custom_branding: 'Custom colors and logos',
      white_label: 'Complete white-label solution',
      developer_mode: 'Enable developer tools and debugging'
    };
    return descriptions[key] || 'Feature description';
  };

  if (loading && !features) {
    return <div className="loading">Loading feature flags...</div>;
  }

  const selectedGovData = governments.find(g => g.id === selectedGov);
  const featuresByCategory = features ? Object.keys(features).reduce((acc, key) => {
    const category = getFeatureCategory(key);
    if (!acc[category]) acc[category] = [];
    acc[category].push(key);
    return acc;
  }, {}) : {};

  return (
    <div className="feature-flags">
      <div className="page-header">
        <h2>Feature Flags Management</h2>
        <div className="header-actions">
          <select
            value={selectedGov || ''}
            onChange={e => setSelectedGov(e.target.value)}
            className="government-selector"
          >
            {governments.map(gov => (
              <option key={gov.id} value={gov.id}>
                {gov.government_name} ({gov.country_iso_code})
              </option>
            ))}
          </select>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || !selectedGov}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {selectedGovData && (
        <div className="government-info-card">
          <h3>{selectedGovData.government_name}</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Country</label>
              <p>{selectedGovData.country_name}</p>
            </div>
            <div className="info-item">
              <label>Status</label>
              <p>
                <span className={`status-badge ${selectedGovData.status}`}>
                  {selectedGovData.status}
                </span>
              </p>
            </div>
            <div className="info-item">
              <label>Currency</label>
              <p>{selectedGovData.currency_code}</p>
            </div>
            <div className="info-item">
              <label>Timezone</label>
              <p>{selectedGovData.timezone}</p>
            </div>
          </div>
        </div>
      )}

      {features && Object.keys(featuresByCategory).map(category => (
        <div key={category} className="section-card">
          <h4>{category} Features</h4>
          <div className="features-grid">
            {featuresByCategory[category].map(featureKey => (
              <div key={featureKey} className="feature-item">
                <div className="feature-header">
                  <div className="feature-info">
                    <h5>{featureKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h5>
                    <p>{getFeatureDescription(featureKey)}</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={features[featureKey]}
                      onChange={() => handleToggle(featureKey)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="section-card">
        <h4>Feature Flag Summary</h4>
        <div className="summary-stats">
          <div className="summary-item">
            <label>Total Features</label>
            <p className="value">{features ? Object.keys(features).length : 0}</p>
          </div>
          <div className="summary-item">
            <label>Enabled</label>
            <p className="value success">
              {features ? Object.values(features).filter(v => v).length : 0}
            </p>
          </div>
          <div className="summary-item">
            <label>Disabled</label>
            <p className="value error">
              {features ? Object.values(features).filter(v => !v).length : 0}
            </p>
          </div>
          <div className="summary-item">
            <label>Activation Rate</label>
            <p className="value">
              {features 
                ? `${((Object.values(features).filter(v => v).length / Object.keys(features).length) * 100).toFixed(0)}%`
                : '0%'}
            </p>
          </div>
        </div>
      </div>

      <div className="section-card warning-card">
        <h4>⚠️ Important Notes</h4>
        <ul className="warning-list">
          <li>Disabling core features may impact agency operations</li>
          <li>Changes take effect immediately after saving</li>
          <li>Some features may require additional configuration</li>
          <li>Contact support before enabling white-label or developer mode</li>
          <li>All changes are logged in the audit trail</li>
        </ul>
      </div>
    </div>
  );
}

export default FeatureFlags;

