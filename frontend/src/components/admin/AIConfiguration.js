/**
 * AI Configuration Component
 * Allows governments to configure AI features and OpenAI API key
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';
import { Button, Input, Alert } from '../common';

function AIConfiguration() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [alert, setAlert] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const [config, setConfig] = useState({
    ai_features_enabled: true,
    openai_api_key: '',
    has_openai_key: false,
    openai_enhanced: false
  });

  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getAIConfig();
      setConfig({
        ai_features_enabled: data.ai_features_enabled,
        openai_api_key: data.openai_api_key || '',
        has_openai_key: data.has_openai_key,
        openai_enhanced: data.openai_enhanced
      });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to load AI configuration'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setTestResult(null); // Clear test result when config changes
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setAlert(null);
      setTestResult(null);

      const response = await adminAPI.updateAIConfig({
        ai_features_enabled: config.ai_features_enabled,
        openai_api_key: config.openai_api_key || null
      });

      setConfig(prev => ({
        ...prev,
        has_openai_key: response.has_openai_key,
        openai_enhanced: response.openai_enhanced
      }));

      setAlert({
        type: 'success',
        message: 'AI configuration updated successfully!'
      });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to update AI configuration'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.openai_api_key) {
      setAlert({
        type: 'error',
        message: 'Please enter an OpenAI API key first'
      });
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);
      setAlert(null);

      const response = await adminAPI.testOpenAIConnection();
      
      setTestResult({
        success: response.success,
        message: response.message
      });

      if (response.success) {
        setAlert({
          type: 'success',
          message: 'Connection successful! Enhanced AI features are ready.'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error.response?.data?.message || 'Connection test failed'
      });
      setAlert({
        type: 'error',
        message: error.response?.data?.message || 'Failed to test connection'
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="ai-config-loading">
        <div className="loading-spinner"></div>
        <p>Loading AI configuration...</p>
      </div>
    );
  }

  return (
    <div className="ai-configuration">
      {alert && (
        <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
      )}

      <form onSubmit={handleSubmit}>
        {/* AI Features Toggle */}
        <div className="form-section">
          <h3>🤖 AI Features</h3>
          <p className="form-section-description">
            Enable or disable AI-powered analytics and insights
          </p>

          <div className="toggle-group">
            <label className="toggle-label">
              <input
                type="checkbox"
                name="ai_features_enabled"
                checked={config.ai_features_enabled}
                onChange={handleChange}
                disabled={saving}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">
                {config.ai_features_enabled ? 'AI Features Enabled' : 'AI Features Disabled'}
              </span>
            </label>
          </div>

          {config.ai_features_enabled && (
            <div className="ai-status-cards">
              <div className="status-card basic-ai">
                <div className="status-icon">📊</div>
                <div className="status-content">
                  <h4>Basic AI Analytics</h4>
                  <p>Statistical forecasting, trend analysis, anomaly detection</p>
                  <span className="status-badge active">✅ Active (Free)</span>
                </div>
              </div>

              <div className={`status-card enhanced-ai ${config.openai_enhanced ? 'active' : ''}`}>
                <div className="status-icon">🧠</div>
                <div className="status-content">
                  <h4>Enhanced AI (OpenAI GPT-4)</h4>
                  <p>Natural language insights, smarter recommendations, advanced analysis</p>
                  <span className={`status-badge ${config.openai_enhanced ? 'active' : 'inactive'}`}>
                    {config.openai_enhanced ? '✅ Active (Paid)' : '⚠️ Not Configured'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* OpenAI API Key Configuration */}
        {config.ai_features_enabled && (
          <div className="form-section">
            <h3>🔑 OpenAI API Key</h3>
            <p className="form-section-description">
              Enter your OpenAI API key to unlock enhanced AI features powered by GPT-4.
              Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Platform</a>.
            </p>

            <div className="form-group">
              <label htmlFor="openai_api_key">
                OpenAI API Key
                {config.has_openai_key && (
                  <span className="key-status"> (Configured ✓)</span>
                )}
              </label>
              <div className="api-key-input-group">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  id="openai_api_key"
                  name="openai_api_key"
                  value={config.openai_api_key}
                  onChange={handleChange}
                  placeholder="sk-..."
                  disabled={saving || testing}
                  className="api-key-input"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="btn-toggle-visibility"
                  disabled={saving || testing}
                >
                  {showApiKey ? '🙈' : '👁️'}
                </button>
              </div>
              <small className="form-help">
                Your API key is encrypted and stored securely. It will never be shared or exposed.
              </small>
            </div>

            {/* Test Connection Button */}
            <div className="test-connection-section">
              <Button
                type="button"
                onClick={handleTestConnection}
                disabled={!config.openai_api_key || testing || saving}
                className="btn-secondary"
              >
                {testing ? '🔄 Testing...' : '🧪 Test Connection'}
              </Button>

              {testResult && (
                <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                  <span className="test-icon">
                    {testResult.success ? '✅' : '❌'}
                  </span>
                  <span className="test-message">{testResult.message}</span>
                </div>
              )}
            </div>

            {/* What You Get Section */}
            <div className="features-comparison">
              <h4>What Enhanced AI Provides:</h4>
              <ul className="features-list">
                <li>✨ Natural language executive summaries</li>
                <li>🎯 Context-aware smart recommendations</li>
                <li>💬 Conversational insights and explanations</li>
                <li>🔍 Advanced pattern recognition</li>
                <li>📝 Automated report generation</li>
                <li>🤝 Intelligent decision support</li>
              </ul>
            </div>

            {/* Pricing Info */}
            <div className="pricing-info">
              <p>
                <strong>💰 Cost:</strong> OpenAI charges based on API usage. 
                Typical government usage: $20-50/month for comprehensive analytics.
              </p>
              <p>
                <strong>🔒 Security:</strong> Your API key is encrypted and only used for your government's data.
                No data is shared with third parties.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="form-actions">
          <Button
            type="submit"
            disabled={saving || testing}
            className="btn-primary"
          >
            {saving ? '💾 Saving...' : '💾 Save AI Configuration'}
          </Button>
        </div>
      </form>

      <style jsx>{`
        .ai-configuration {
          max-width: 900px;
        }

        .ai-config-loading {
          text-align: center;
          padding: 3rem;
        }

        .loading-spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007bff;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .form-section {
          margin-bottom: 2.5rem;
          padding-bottom: 2.5rem;
          border-bottom: 1px solid #e9ecef;
        }

        .form-section:last-of-type {
          border-bottom: none;
        }

        .form-section h3 {
          color: #003f87;
          font-size: 1.3rem;
          margin-bottom: 0.5rem;
        }

        .form-section-description {
          color: #6c757d;
          font-size: 0.95rem;
          margin-bottom: 1.5rem;
          line-height: 1.6;
        }

        .form-section-description a {
          color: #007bff;
          text-decoration: none;
        }

        .form-section-description a:hover {
          text-decoration: underline;
        }

        .toggle-group {
          margin: 1.5rem 0;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 1rem;
          cursor: pointer;
          user-select: none;
        }

        .toggle-label input[type="checkbox"] {
          display: none;
        }

        .toggle-slider {
          position: relative;
          width: 60px;
          height: 30px;
          background: #ccc;
          border-radius: 30px;
          transition: background 0.3s;
        }

        .toggle-slider::before {
          content: '';
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          top: 3px;
          left: 3px;
          transition: transform 0.3s;
        }

        .toggle-label input[type="checkbox"]:checked + .toggle-slider {
          background: #28a745;
        }

        .toggle-label input[type="checkbox"]:checked + .toggle-slider::before {
          transform: translateX(30px);
        }

        .toggle-text {
          font-size: 1rem;
          font-weight: 500;
          color: #212529;
        }

        .ai-status-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-top: 1.5rem;
        }

        .status-card {
          display: flex;
          gap: 1rem;
          padding: 1.5rem;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          background: #f8f9fa;
          transition: all 0.3s;
        }

        .status-card.enhanced-ai.active {
          border-color: #28a745;
          background: #f0fff4;
        }

        .status-icon {
          font-size: 2.5rem;
          line-height: 1;
        }

        .status-content {
          flex: 1;
        }

        .status-content h4 {
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
          color: #212529;
        }

        .status-content p {
          margin: 0 0 0.75rem 0;
          font-size: 0.9rem;
          color: #6c757d;
          line-height: 1.5;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .status-badge.active {
          background: #28a745;
          color: white;
        }

        .status-badge.inactive {
          background: #ffc107;
          color: #212529;
        }

        .api-key-input-group {
          display: flex;
          gap: 0.5rem;
        }

        .api-key-input {
          flex: 1;
          font-family: 'Courier New', monospace;
        }

        .btn-toggle-visibility {
          padding: 0.5rem 1rem;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1.2rem;
          transition: background 0.2s;
        }

        .btn-toggle-visibility:hover:not(:disabled) {
          background: #5a6268;
        }

        .btn-toggle-visibility:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .key-status {
          color: #28a745;
          font-size: 0.9rem;
          font-weight: normal;
        }

        .test-connection-section {
          margin-top: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .test-result {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.95rem;
        }

        .test-result.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .test-result.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .test-icon {
          font-size: 1.2rem;
        }

        .features-comparison {
          margin-top: 2rem;
          padding: 1.5rem;
          background: #e7f3ff;
          border-left: 4px solid #007bff;
          border-radius: 8px;
        }

        .features-comparison h4 {
          margin: 0 0 1rem 0;
          color: #003f87;
          font-size: 1.1rem;
        }

        .features-list {
          margin: 0;
          padding-left: 1.5rem;
          list-style: none;
        }

        .features-list li {
          margin: 0.5rem 0;
          color: #212529;
          line-height: 1.6;
        }

        .features-list li::before {
          content: '';
          margin-right: 0.5rem;
        }

        .pricing-info {
          margin-top: 1.5rem;
          padding: 1.5rem;
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          border-radius: 8px;
        }

        .pricing-info p {
          margin: 0.5rem 0;
          color: #856404;
          font-size: 0.95rem;
          line-height: 1.6;
        }

        .pricing-info strong {
          color: #533f03;
        }

        .form-help {
          display: block;
          margin-top: 0.5rem;
          color: #6c757d;
          font-size: 0.85rem;
          line-height: 1.5;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 2px solid #e9ecef;
        }

        @media (max-width: 768px) {
          .ai-status-cards {
            grid-template-columns: 1fr;
          }

          .test-connection-section {
            flex-direction: column;
            align-items: stretch;
          }

          .form-actions {
            flex-direction: column;
          }

          .form-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default AIConfiguration;
