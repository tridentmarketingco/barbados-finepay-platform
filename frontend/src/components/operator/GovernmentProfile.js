/**
 * Agency Profile Editor
 * Comprehensive agency profile management for operators
 * Enhanced with better UX, accessibility, and validation
 */

import React, { useState, useEffect } from 'react';
import { getGovernment, updateGovernmentProfile } from '../../services/operatorApi';

function GovernmentProfile({ governmentId, onClose, onUpdate }) {
  const [government, setGovernment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadGovernment();
  }, [governmentId]);

  const loadGovernment = async () => {
    try {
      setLoading(true);
      const response = await getGovernment(governmentId);
      setGovernment(response.government);
      
      // Initialize form data
      setFormData({
        government_name: response.government.government_name || '',
        country_name: response.government.country_name || '',
        country_iso_code: response.government.country_iso_code || '',
        currency_code: response.government.currency_code || '',
        timezone: response.government.timezone || 'UTC',
        legal_framework_version: response.government.legal_framework_version || '',
        payment_gateway_type: response.government.payment_gateway_type || 'powertranz',
        contact_email: response.government.contact_email || '',
        contact_phone: response.government.contact_phone || '',
        support_url: response.government.support_url || '',
        subdomain: response.government.subdomain || '',
        status: response.government.status || 'pilot',
        ai_features_enabled: response.government.ai_features_enabled || false,
        gamification_enabled: response.government.gamification_enabled || false,
      });
    } catch (error) {
      console.error('Failed to load agency:', error);
      alert('Failed to load agency profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
    // Clear success message when user makes changes
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Clear any error messages when switching tabs
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.government_name?.trim()) {
      newErrors.government_name = 'Agency name is required';
    }

    if (!formData.country_name?.trim()) {
      newErrors.country_name = 'Country name is required';
    }

    if (!formData.country_iso_code || formData.country_iso_code.length !== 2) {
      newErrors.country_iso_code = 'Country ISO code must be 2 characters';
    }

    if (!formData.currency_code || formData.currency_code.length !== 3) {
      newErrors.currency_code = 'Currency code must be 3 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      // Scroll to first error
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const element = document.querySelector(`[name="${firstErrorField}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
        }
      }
      return;
    }

    try {
      setSaving(true);
      const response = await updateGovernmentProfile(governmentId, formData);
      setSuccessMessage('Agency profile updated successfully!');
      setHasUnsavedChanges(false);
      
      if (onUpdate) {
        onUpdate(response.government);
      }
      
      // Auto-close after 2 seconds or let user close manually
      setTimeout(() => {
        if (onClose) {
          onClose();
        }
      }, 2000);
    } catch (error) {
      console.error('Failed to update agency profile:', error);
      setErrors({ submit: error.message || 'Failed to update agency profile' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content large">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading agency profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal-content large">
        <div className="modal-header">
          <h2>
            Edit Agency Profile
            {hasUnsavedChanges && <span className="unsaved-indicator"> (Unsaved Changes)</span>}
          </h2>
          <button 
            className="close-btn" 
            onClick={handleClose}
            aria-label="Close modal"
            title="Close"
          >
            ×
          </button>
        </div>

        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'basic'}
            aria-controls="basic-tab"
            className={activeTab === 'basic' ? 'tab active' : 'tab'}
            onClick={() => handleTabChange('basic')}
          >
            📋 Basic Information
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'financial'}
            aria-controls="financial-tab"
            className={activeTab === 'financial' ? 'tab active' : 'tab'}
            onClick={() => handleTabChange('financial')}
          >
            💰 Financial
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'contact'}
            aria-controls="contact-tab"
            className={activeTab === 'contact' ? 'tab active' : 'tab'}
            onClick={() => handleTabChange('contact')}
          >
            📞 Contact
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'features'}
            aria-controls="features-tab"
            className={activeTab === 'features' ? 'tab active' : 'tab'}
            onClick={() => handleTabChange('features')}
          >
            ⚡ Features
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'advanced'}
            aria-controls="advanced-tab"
            className={activeTab === 'advanced' ? 'tab active' : 'tab'}
            onClick={() => handleTabChange('advanced')}
          >
            ⚙️ Advanced
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {successMessage && (
              <div className="success-message" role="alert">
                ✓ {successMessage}
              </div>
            )}
            
            {errors.submit && (
              <div className="error-message" role="alert">
                ✗ {errors.submit}
              </div>
            )}

            {activeTab === 'basic' && (
              <div className="form-section" id="basic-tab" role="tabpanel">
                <h3>Basic Information</h3>
                <p className="section-description">Core details about the agency</p>
                
                <div className="form-group">
                  <label htmlFor="government_name">
                    Agency Name <span className="required">*</span>
                  </label>
                  <input
                    id="government_name"
                    name="government_name"
                    type="text"
                    value={formData.government_name}
                    onChange={(e) => handleChange('government_name', e.target.value)}
                    placeholder="e.g., Barbados Traffic Authority"
                    required
                    aria-required="true"
                    aria-invalid={!!errors.government_name}
                  />
                  {errors.government_name && (
                    <span className="error" role="alert">{errors.government_name}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="country_name">
                    Country Name <span className="required">*</span>
                  </label>
                  <input
                    id="country_name"
                    name="country_name"
                    type="text"
                    value={formData.country_name}
                    onChange={(e) => handleChange('country_name', e.target.value)}
                    placeholder="e.g., Barbados"
                    required
                    aria-required="true"
                    aria-invalid={!!errors.country_name}
                  />
                  {errors.country_name && (
                    <span className="error" role="alert">{errors.country_name}</span>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="country_iso_code">
                      Country ISO Code <span className="required">*</span>
                    </label>
                    <input
                      id="country_iso_code"
                      name="country_iso_code"
                      type="text"
                      maxLength="2"
                      value={formData.country_iso_code}
                      onChange={(e) => handleChange('country_iso_code', e.target.value.toUpperCase())}
                      placeholder="BB"
                      required
                      aria-required="true"
                      aria-invalid={!!errors.country_iso_code}
                    />
                    <span className="help-text">2-character ISO code</span>
                    {errors.country_iso_code && (
                      <span className="error" role="alert">{errors.country_iso_code}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="status">Status</label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status}
                      onChange={(e) => handleChange('status', e.target.value)}
                    >
                      <option value="pilot">🟡 Pilot</option>
                      <option value="active">🟢 Active</option>
                      <option value="suspended">🔴 Suspended</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'financial' && (
              <div className="form-section" id="financial-tab" role="tabpanel">
                <h3>Financial Configuration</h3>
                <p className="section-description">Currency, timezone, and payment settings</p>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="currency_code">
                      Currency Code <span className="required">*</span>
                    </label>
                    <input
                      id="currency_code"
                      name="currency_code"
                      type="text"
                      maxLength="3"
                      value={formData.currency_code}
                      onChange={(e) => handleChange('currency_code', e.target.value.toUpperCase())}
                      placeholder="BBD"
                      required
                      aria-required="true"
                      aria-invalid={!!errors.currency_code}
                    />
                    <span className="help-text">3-character ISO currency code</span>
                    {errors.currency_code && (
                      <span className="error" role="alert">{errors.currency_code}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="timezone">Timezone</label>
                    <input
                      id="timezone"
                      name="timezone"
                      type="text"
                      value={formData.timezone}
                      onChange={(e) => handleChange('timezone', e.target.value)}
                      placeholder="America/Barbados"
                    />
                    <span className="help-text">IANA timezone identifier</span>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="legal_framework_version">Legal Framework Version</label>
                  <input
                    id="legal_framework_version"
                    name="legal_framework_version"
                    type="text"
                    value={formData.legal_framework_version}
                    onChange={(e) => handleChange('legal_framework_version', e.target.value)}
                    placeholder="e.g., Traffic Act 2024"
                  />
                  <span className="help-text">Version of applicable legal framework</span>
                </div>

                <div className="form-group">
                  <label htmlFor="payment_gateway_type">Payment Gateway Type</label>
                  <select
                    id="payment_gateway_type"
                    name="payment_gateway_type"
                    value={formData.payment_gateway_type}
                    onChange={(e) => handleChange('payment_gateway_type', e.target.value)}
                  >
                    <option value="powertranz">💳 PowerTranz</option>
                    <option value="stripe">💳 Stripe</option>
                    <option value="paypal">💳 PayPal</option>
                    <option value="square">💳 Square</option>
                  </select>
                  <span className="help-text">Payment processor for transactions</span>
                </div>
              </div>
            )}

            {activeTab === 'contact' && (
              <div className="form-section" id="contact-tab" role="tabpanel">
                <h3>Contact Information</h3>
                <p className="section-description">Public contact details for citizens</p>
                
                <div className="form-group">
                  <label htmlFor="contact_email">Contact Email</label>
                  <input
                    id="contact_email"
                    name="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => handleChange('contact_email', e.target.value)}
                    placeholder="info@gov.bb"
                  />
                  <span className="help-text">Primary email for citizen inquiries</span>
                </div>

                <div className="form-group">
                  <label htmlFor="contact_phone">Contact Phone</label>
                  <input
                    id="contact_phone"
                    name="contact_phone"
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => handleChange('contact_phone', e.target.value)}
                    placeholder="+1-246-123-4567"
                  />
                  <span className="help-text">Primary phone number with country code</span>
                </div>

                <div className="form-group">
                  <label htmlFor="support_url">Support URL</label>
                  <input
                    id="support_url"
                    name="support_url"
                    type="url"
                    value={formData.support_url}
                    onChange={(e) => handleChange('support_url', e.target.value)}
                    placeholder="https://support.gov.bb"
                  />
                  <span className="help-text">Link to support or help center</span>
                </div>
              </div>
            )}

            {activeTab === 'features' && (
              <div className="form-section" id="features-tab" role="tabpanel">
                <h3>Feature Configuration</h3>
                <p className="section-description">Enable or disable platform features</p>
                
                <div className="features-list">
                  <div className="feature-toggle-item">
                    <div className="feature-toggle-header">
                      <div className="feature-info">
                        <h4>🤖 AI Features</h4>
                        <p>Enable AI-powered analytics, insights, and predictive capabilities</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={formData.ai_features_enabled}
                          onChange={(e) => handleChange('ai_features_enabled', e.target.checked)}
                          aria-label="Toggle AI Features"
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="feature-toggle-item">
                    <div className="feature-toggle-header">
                      <div className="feature-info">
                        <h4>🎮 Gamification</h4>
                        <p>Enable badges, rewards, leaderboards, and driving score for citizens</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={formData.gamification_enabled}
                          onChange={(e) => handleChange('gamification_enabled', e.target.checked)}
                          aria-label="Toggle Gamification"
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="form-section" id="advanced-tab" role="tabpanel">
                <h3>Advanced Settings</h3>
                <p className="section-description">Technical configuration and metadata</p>
                
                <div className="form-group">
                  <label htmlFor="subdomain">Subdomain</label>
                  <input
                    id="subdomain"
                    name="subdomain"
                    type="text"
                    value={formData.subdomain}
                    onChange={(e) => handleChange('subdomain', e.target.value.toLowerCase())}
                    placeholder="barbados"
                    pattern="[a-z0-9-]+"
                  />
                  <span className="help-text">
                    Used for multi-tenant routing (e.g., barbados.payfine.com)
                  </span>
                </div>

                <div className="info-boxes-grid">
                  <div className="info-box">
                    <h4>🆔 Agency ID</h4>
                    <p><code>{government?.id}</code></p>
                  </div>

                  <div className="info-box">
                    <h4>📅 Created</h4>
                    <p>{government?.created_at ? new Date(government.created_at).toLocaleString() : 'N/A'}</p>
                  </div>

                  <div className="info-box">
                    <h4>🔄 Last Updated</h4>
                    <p>{government?.updated_at ? new Date(government.updated_at).toLocaleString() : 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner-small"></span>
                  Saving...
                </>
              ) : (
                <>
                  💾 Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GovernmentProfile;
