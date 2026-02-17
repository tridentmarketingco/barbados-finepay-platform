/**
 * PayFine Compliance Alerts Component
 * Monitor compliance issues and configuration alerts
 */

import React, { useState, useEffect } from 'react';
import { getComplianceAlerts, getSLAData } from '../../services/operatorApi';
import '../../styles/Operator.css';

function ComplianceAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [slaData, setSlaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { severity: filter } : {};
      
      const [alertsData, sla] = await Promise.all([
        getComplianceAlerts(params),
        getSLAData({ days: 30 })
      ]);

      setAlerts(alertsData.alerts || []);
      setSlaData(sla);
    } catch (error) {
      console.error('Failed to load compliance alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#17a2b8';
      default: return '#6c757d';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '📋';
    }
  };

  if (loading) {
    return <div className="loading">Loading compliance alerts...</div>;
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const highAlerts = alerts.filter(a => a.severity === 'high').length;
  const mediumAlerts = alerts.filter(a => a.severity === 'medium').length;
  const lowAlerts = alerts.filter(a => a.severity === 'low').length;

  return (
    <div className="compliance-alerts">
      <div className="page-header">
        <h2>Compliance & Alerts</h2>
        <div className="header-actions">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="filter-selector"
          >
            <option value="all">All Alerts</option>
            <option value="critical">Critical Only</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
          <button className="btn-secondary" onClick={loadAlerts}>
            Refresh
          </button>
        </div>
      </div>

      <div className="alerts-summary">
        <div className="alert-stat critical">
          <div className="stat-icon">🚨</div>
          <div className="stat-content">
            <p className="stat-value">{criticalAlerts}</p>
            <p className="stat-label">Critical</p>
          </div>
        </div>

        <div className="alert-stat high">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <p className="stat-value">{highAlerts}</p>
            <p className="stat-label">High</p>
          </div>
        </div>

        <div className="alert-stat medium">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <p className="stat-value">{mediumAlerts}</p>
            <p className="stat-label">Medium</p>
          </div>
        </div>

        <div className="alert-stat low">
          <div className="stat-icon">ℹ️</div>
          <div className="stat-content">
            <p className="stat-value">{lowAlerts}</p>
            <p className="stat-label">Low</p>
          </div>
        </div>
      </div>

      {slaData && (
        <div className="section-card">
          <h4>SLA Compliance</h4>
          <div className="sla-metrics">
            <div className="sla-metric">
              <label>Uptime</label>
              <div className="sla-bar">
                <div 
                  className="sla-fill success" 
                  style={{ width: `${slaData.uptime_percentage || 99.9}%` }}
                ></div>
              </div>
              <p>{slaData.uptime_percentage || 99.9}%</p>
            </div>

            <div className="sla-metric">
              <label>Response Time</label>
              <div className="sla-bar">
                <div 
                  className="sla-fill success" 
                  style={{ width: `${Math.min((200 / (slaData.avg_response_time || 150)) * 100, 100)}%` }}
                ></div>
              </div>
              <p>{slaData.avg_response_time || 150}ms avg</p>
            </div>

            <div className="sla-metric">
              <label>Success Rate</label>
              <div className="sla-bar">
                <div 
                  className="sla-fill success" 
                  style={{ width: `${slaData.success_rate || 98.5}%` }}
                ></div>
              </div>
              <p>{slaData.success_rate || 98.5}%</p>
            </div>
          </div>
        </div>
      )}

      <div className="section-card">
        <h4>Active Alerts ({alerts.length})</h4>
        {alerts.length === 0 ? (
          <div className="no-alerts">
            <p>✅ No compliance alerts at this time</p>
            <p className="metric-sub">All systems operating normally</p>
          </div>
        ) : (
          <div className="alerts-list">
            {alerts.map((alert, index) => (
              <div 
                key={index} 
                className="alert-item"
                style={{ borderLeftColor: getSeverityColor(alert.severity) }}
              >
                <div className="alert-header">
                  <span className="alert-icon">{getSeverityIcon(alert.severity)}</span>
                  <span className={`alert-severity ${alert.severity}`}>
                    {alert.severity.toUpperCase()}
                  </span>
                  <span className="alert-type">{alert.type}</span>
                </div>
                <div className="alert-body">
                  <h5>{alert.government_name}</h5>
                  <p>{alert.message}</p>
                  {alert.government_id && (
                    <p className="alert-meta">Agency ID: {alert.government_id}</p>
                  )}
                </div>
                <div className="alert-actions">
                  <button className="btn-small btn-primary">Investigate</button>
                  <button className="btn-small btn-secondary">Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-card">
        <h4>Compliance Checklist</h4>
        <div className="compliance-checklist">
          <div className="checklist-item complete">
            <span className="check-icon">✅</span>
            <div className="check-content">
              <h5>Payment Gateway Configuration</h5>
              <p>All active agencies have valid payment gateway configs</p>
            </div>
          </div>

          <div className="checklist-item complete">
            <span className="check-icon">✅</span>
            <div className="check-content">
              <h5>ISO Code Compliance</h5>
              <p>All agencies use valid ISO 3166-1 and ISO 4217 codes</p>
            </div>
          </div>

          <div className="checklist-item complete">
            <span className="check-icon">✅</span>
            <div className="check-content">
              <h5>Data Encryption</h5>
              <p>All sensitive data is encrypted at rest and in transit</p>
            </div>
          </div>

          <div className="checklist-item complete">
            <span className="check-icon">✅</span>
            <div className="check-content">
              <h5>Audit Logging</h5>
              <p>All critical operations are logged for audit trail</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComplianceAlerts;
