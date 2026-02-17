/**
 * PayFine Transaction Analytics Component
 * Detailed transaction analytics and success rate monitoring
 */

import React, { useState, useEffect } from 'react';
import { getTransactionAnalytics, getSuccessRates } from '../../services/operatorApi';
import '../../styles/Operator.css';

function TransactionAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [successRates, setSuccessRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [selectedGovernment, setSelectedGovernment] = useState('');

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod, selectedGovernment]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const params = { days: selectedPeriod };
      if (selectedGovernment) {
        params.government_id = selectedGovernment;
      }

      const [analyticsData, ratesData] = await Promise.all([
        getTransactionAnalytics(params),
        getSuccessRates(params)
      ]);

      setAnalytics(analyticsData);
      setSuccessRates(ratesData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading transaction analytics...</div>;
  }

  return (
    <div className="transaction-analytics">
      <div className="page-header">
        <h2>Transaction Analytics</h2>
        <div className="header-actions">
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            className="period-selector"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="180">Last 6 Months</option>
            <option value="365">Last Year</option>
          </select>
          <button className="btn-secondary" onClick={loadAnalytics}>
            Refresh
          </button>
        </div>
      </div>

      {analytics && (
        <>
          <div className="analytics-summary">
            <div className="summary-card">
              <div className="summary-icon">📊</div>
              <div className="summary-content">
                <h3>Total Transactions</h3>
                <p className="metric">{analytics.total_transactions?.toLocaleString() || 0}</p>
                <p className="metric-sub">Last {selectedPeriod} days</p>
              </div>
            </div>

            <div className="summary-card success">
              <div className="summary-icon">✅</div>
              <div className="summary-content">
                <h3>Successful</h3>
                <p className="metric">{analytics.successful_transactions?.toLocaleString() || 0}</p>
                <p className="metric-sub">{analytics.success_rate?.toFixed(2) || 0}% success rate</p>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-icon">💰</div>
              <div className="summary-content">
                <h3>Average Value</h3>
                <p className="metric">${analytics.average_transaction_value?.toFixed(2) || 0}</p>
                <p className="metric-sub">Per transaction</p>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-icon">📈</div>
              <div className="summary-content">
                <h3>Total Volume</h3>
                <p className="metric">${(analytics.total_transactions * analytics.average_transaction_value)?.toLocaleString() || 0}</p>
                <p className="metric-sub">Transaction volume</p>
              </div>
            </div>
          </div>

          {successRates && (
            <div className="section-card">
              <h4>Success Rate Breakdown</h4>
              <div className="success-rates-grid">
                <div className="rate-card">
                  <h5>Payment Gateway</h5>
                  <div className="rate-bar">
                    <div 
                      className="rate-fill success" 
                      style={{ width: `${successRates.gateway_success_rate || 0}%` }}
                    ></div>
                  </div>
                  <p>{successRates.gateway_success_rate?.toFixed(2) || 0}%</p>
                </div>

                <div className="rate-card">
                  <h5>Overall System</h5>
                  <div className="rate-bar">
                    <div 
                      className="rate-fill success" 
                      style={{ width: `${successRates.overall_success_rate || 0}%` }}
                    ></div>
                  </div>
                  <p>{successRates.overall_success_rate?.toFixed(2) || 0}%</p>
                </div>

                <div className="rate-card">
                  <h5>First Attempt</h5>
                  <div className="rate-bar">
                    <div 
                      className="rate-fill warning" 
                      style={{ width: `${successRates.first_attempt_rate || 0}%` }}
                    ></div>
                  </div>
                  <p>{successRates.first_attempt_rate?.toFixed(2) || 0}%</p>
                </div>
              </div>
            </div>
          )}

          <div className="section-card">
            <h4>Transaction Trends</h4>
            <div className="trends-placeholder">
              <p>📊 Transaction trend charts will be displayed here</p>
              <p className="metric-sub">Daily/Weekly/Monthly transaction volumes and success rates</p>
            </div>
          </div>

          <div className="section-card">
            <h4>Performance Metrics</h4>
            <div className="metrics-grid">
              <div className="metric-item">
                <label>Average Processing Time</label>
                <p className="value">{analytics.avg_processing_time || 'N/A'}</p>
              </div>
              <div className="metric-item">
                <label>Peak Transaction Hour</label>
                <p className="value">{analytics.peak_hour || 'N/A'}</p>
              </div>
              <div className="metric-item">
                <label>Failed Transactions</label>
                <p className="value error">{analytics.failed_transactions || 0}</p>
              </div>
              <div className="metric-item">
                <label>Pending Transactions</label>
                <p className="value warning">{analytics.pending_transactions || 0}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TransactionAnalytics;
