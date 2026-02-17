/**
 * AI Insights Dashboard
 * Comprehensive AI-powered analytics and predictions for government administrators
 */

import React, { useState, useEffect } from 'react';
import aiApi from '../../services/aiApi';
import '../../styles/AIInsights.css';

// Tooltip component for better UX
const Tooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);
  
  return (
    <div 
      className="tooltip-container"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && <div className="tooltip-text">{text}</div>}
    </div>
  );
};

function AIInsights() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [period, setPeriod] = useState(30);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadDashboard();
  }, [period]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await aiApi.getDashboard(period);
      setDashboard(data);
    } catch (err) {
      // Handle specific error cases
      if (err.response?.status === 403) {
        // AI features not enabled
        setError(err.response?.data?.message || 'AI features are not enabled. Please enable them in AI Configuration.');
      } else if (err.response?.status === 400) {
        // Invalid parameters
        setError(err.response?.data?.message || 'Invalid request parameters');
      } else {
        // Generic error
        setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load AI insights. Please try again.');
      }
      console.error('AI Dashboard Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="ai-insights">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>🤖 AI analyzing your data...</p>
          <p className="loading-subtext">This may take a few moments</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-insights">
        <div className="error-message">
          <div className="error-icon">❌</div>
          <h3>Unable to Load AI Insights</h3>
          <p>{error}</p>
          <button onClick={loadDashboard} className="btn btn-primary">
            🔄 Try Again
          </button>
        </div>
      </div>
    );
  }

  const { executive_summary, predictions, hotspots, anomalies, recommendations } = dashboard || {};

  return (
    <div className="ai-insights">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-title">
          <h1>
            🤖 AI Insights Dashboard
            <Tooltip text="AI-powered analytics using statistical analysis and machine learning to predict trends and identify patterns">
              <span className="info-icon">ℹ️</span>
            </Tooltip>
          </h1>
          <p className="ai-subtitle">Predictive analytics to help you stay one step ahead</p>
        </div>
        <div className="ai-controls">
          <Tooltip text="Select the time period for analysis">
            <select 
              value={period} 
              onChange={(e) => setPeriod(Number(e.target.value))}
              className="period-selector"
              aria-label="Select analysis period"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </Tooltip>
          <Tooltip text="Refresh data to get latest insights">
            <button onClick={loadDashboard} className="btn-refresh" aria-label="Refresh dashboard">
              🔄 Refresh
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="ai-tabs">
        <Tooltip text="Executive summary and key metrics">
          <button 
            className={`ai-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            aria-label="Overview tab"
          >
            📊 Overview
          </button>
        </Tooltip>
        <Tooltip text="Forecast ticket volume and revenue">
          <button 
            className={`ai-tab ${activeTab === 'predictions' ? 'active' : ''}`}
            onClick={() => setActiveTab('predictions')}
            aria-label="Predictions tab"
          >
            📈 Predictions
          </button>
        </Tooltip>
        <Tooltip text="High-violation geographic areas">
          <button 
            className={`ai-tab ${activeTab === 'hotspots' ? 'active' : ''}`}
            onClick={() => setActiveTab('hotspots')}
            aria-label="Hotspots tab"
          >
            🗺️ Hotspots
          </button>
        </Tooltip>
        <Tooltip text="Unusual patterns requiring attention">
          <button 
            className={`ai-tab ${activeTab === 'anomalies' ? 'active' : ''}`}
            onClick={() => setActiveTab('anomalies')}
            aria-label="Anomalies tab"
          >
            ⚠️ Anomalies {anomalies?.anomalies?.length > 0 && `(${anomalies.anomalies.length})`}
          </button>
        </Tooltip>
        <Tooltip text="AI-generated actionable recommendations">
          <button 
            className={`ai-tab ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
            aria-label="Recommendations tab"
          >
            💡 Recommendations
          </button>
        </Tooltip>
      </div>

      {/* Tab Content */}
      <div className="ai-content">
        {activeTab === 'overview' && (
          <OverviewTab summary={executive_summary} />
        )}
        {activeTab === 'predictions' && (
          <PredictionsTab predictions={predictions} />
        )}
        {activeTab === 'hotspots' && (
          <HotspotsTab hotspots={hotspots} />
        )}
        {activeTab === 'anomalies' && (
          <AnomaliesTab anomalies={anomalies} />
        )}
        {activeTab === 'recommendations' && (
          <RecommendationsTab recommendations={recommendations} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================

function OverviewTab({ summary }) {
  if (!summary) {
    return (
      <div className="no-data">
        <h3>No Summary Data Available</h3>
        <p>Unable to load executive summary. Please try refreshing the page.</p>
      </div>
    );
  }

  const { 
    ticket_volume = {}, 
    revenue = {}, 
    predictions = {}, 
    top_hotspots = [], 
    critical_anomalies = [], 
    top_recommendations = [], 
    insights = [] 
  } = summary;

  return (
    <div className="overview-tab">
      {/* Executive Summary */}
      <div className="executive-summary">
        <h2>📋 Executive Summary</h2>
        <div className="insights-list">
          {insights && insights.length > 0 ? (
            insights.map((insight, index) => (
              <div key={index} className="insight-item">
                {insight}
              </div>
            ))
          ) : (
            <div className="insight-item">
              No insights available for the selected period.
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">🎫</div>
          <div className="metric-content">
            <h3>Ticket Volume</h3>
            <div className="metric-value">
              {ticket_volume?.current || 0}
              <span className={`metric-change ${ticket_volume?.change_percent >= 0 ? 'positive' : 'negative'}`}>
                {ticket_volume?.change_percent >= 0 ? '↑' : '↓'} {Math.abs(ticket_volume?.change_percent || 0)}%
              </span>
            </div>
            <div className="metric-label">
              Trend: {ticket_volume?.trend || 'STABLE'}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <h3>Revenue</h3>
            <div className="metric-value">
              ${(revenue?.current_period || 0).toFixed(2)}
            </div>
            <div className="metric-label">
              Collection Rate: {revenue?.collection_rate || 0}%
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <h3>Next Month Forecast</h3>
            <div className="metric-value">
              ${(revenue?.forecast_next_month || 0).toFixed(2)}
            </div>
            <div className="metric-label">
              Predicted Revenue
            </div>
          </div>
        </div>
      </div>

      {/* Quick Insights Grid */}
      <div className="quick-insights-grid">
        {/* Top Hotspots */}
        {top_hotspots && top_hotspots.length > 0 && (
          <div className="quick-insight-card">
            <h3>🎯 Top Hotspots</h3>
            <div className="hotspot-list">
              {top_hotspots.map((hotspot, index) => (
                <div key={index} className="hotspot-item">
                  <span className="hotspot-rank">#{index + 1}</span>
                  <span className="hotspot-location">{hotspot.location}</span>
                  <span className="hotspot-count">{hotspot.ticket_count} tickets</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Critical Anomalies */}
        {critical_anomalies && critical_anomalies.length > 0 && (
          <div className="quick-insight-card alert">
            <h3>⚠️ Critical Alerts</h3>
            <div className="anomaly-list">
              {critical_anomalies.map((anomaly, index) => (
                <div key={index} className="anomaly-item">
                  <span className={`severity-badge ${anomaly.severity}`}>
                    {anomaly.severity}
                  </span>
                  <span className="anomaly-description">{anomaly.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Recommendations */}
        {top_recommendations && top_recommendations.length > 0 && (
          <div className="quick-insight-card">
            <h3>💡 Top Recommendations</h3>
            <div className="recommendation-list">
              {top_recommendations.map((rec, index) => (
                <div key={index} className="recommendation-item">
                  <span className={`priority-badge ${rec.priority}`}>
                    {rec.priority}
                  </span>
                  <div className="recommendation-content">
                    <div className="recommendation-title">{rec.title}</div>
                    <div className="recommendation-description">{rec.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PREDICTIONS TAB
// ============================================================================

function PredictionsTab({ predictions }) {
  if (!predictions) return <div>No prediction data available</div>;

  const { tickets, revenue } = predictions;

  return (
    <div className="predictions-tab">
      <h2>📈 Predictive Analytics</h2>

      {/* Ticket Volume Forecast */}
      {tickets && (
        <div className="prediction-section">
          <h3>🎫 Ticket Volume Forecast (Next 7 Days)</h3>
          <div className="forecast-info">
            <span>Trend: <strong>{tickets.trend}</strong></span>
            <span>Confidence: <strong>{tickets.confidence}</strong></span>
            <span>Historical Avg: <strong>{tickets.historical_average}</strong> tickets/day</span>
          </div>
          <div className="forecast-chart">
            {tickets.forecast && tickets.forecast.slice(0, 7).map((day, index) => {
              const maxValue = Math.max(...tickets.forecast.slice(0, 7).map(d => d.upper_bound));
              const height = (day.predicted_tickets / maxValue) * 200;
              
              return (
                <div key={index} className="forecast-bar-container">
                  <div className="forecast-bar-wrapper">
                    <div 
                      className="forecast-bar"
                      style={{ height: `${height}px` }}
                      title={`${day.predicted_tickets} tickets (${day.lower_bound}-${day.upper_bound})`}
                    >
                      <span className="bar-value">{day.predicted_tickets}</span>
                    </div>
                  </div>
                  <div className="forecast-label">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revenue Forecast */}
      {revenue && (
        <div className="prediction-section">
          <h3>💰 Revenue Forecast (Next 7 Days)</h3>
          <div className="forecast-info">
            <span>Total Predicted: <strong>${revenue.total_predicted?.toFixed(2)}</strong></span>
            <span>Avg Daily: <strong>${revenue.avg_daily_revenue?.toFixed(2)}</strong></span>
            <span>Collection Rate: <strong>{revenue.collection_rate}%</strong></span>
          </div>
          <div className="forecast-chart">
            {revenue.forecast && revenue.forecast.slice(0, 7).map((day, index) => {
              const maxValue = Math.max(...revenue.forecast.slice(0, 7).map(d => d.upper_bound));
              const height = (day.predicted_revenue / maxValue) * 200;
              
              return (
                <div key={index} className="forecast-bar-container">
                  <div className="forecast-bar-wrapper">
                    <div 
                      className="forecast-bar revenue"
                      style={{ height: `${height}px` }}
                      title={`$${day.predicted_revenue.toFixed(2)} ($${day.lower_bound.toFixed(2)}-$${day.upper_bound.toFixed(2)})`}
                    >
                      <span className="bar-value">${day.predicted_revenue.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="forecast-label">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HOTSPOTS TAB
// ============================================================================

function HotspotsTab({ hotspots }) {
  if (!hotspots || hotspots.length === 0) {
    return <div className="no-data">No hotspots detected in this period</div>;
  }

  return (
    <div className="hotspots-tab">
      <h2>🗺️ Geographic Hotspots</h2>
      <p className="tab-description">High-violation areas requiring attention</p>

      <div className="hotspots-grid">
        {hotspots.map((hotspot, index) => (
          <div key={index} className={`hotspot-card severity-${hotspot.severity}`}>
            <div className="hotspot-header">
              <span className="hotspot-rank">#{index + 1}</span>
              <h3>{hotspot.location}</h3>
              <span className={`severity-badge ${hotspot.severity}`}>
                {hotspot.severity}
              </span>
            </div>

            <div className="hotspot-stats">
              <div className="stat">
                <span className="stat-label">Violations</span>
                <span className="stat-value">{hotspot.ticket_count}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Avg Fine</span>
                <span className="stat-value">${hotspot.avg_fine.toFixed(2)}</span>
              </div>
            </div>

            {hotspot.peak_hours && hotspot.peak_hours.length > 0 && (
              <div className="hotspot-detail">
                <strong>Peak Hours:</strong> {hotspot.peak_hours.join(', ')}
              </div>
            )}

            {hotspot.top_offences && hotspot.top_offences.length > 0 && (
              <div className="hotspot-detail">
                <strong>Top Offences:</strong>
                <ul>
                  {hotspot.top_offences.map((offence, i) => (
                    <li key={i}>{offence.offence} ({offence.count})</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="hotspot-recommendation">
              <strong>💡 Recommendation:</strong> {hotspot.recommendation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ANOMALIES TAB
// ============================================================================

function AnomaliesTab({ anomalies }) {
  if (!anomalies || !anomalies.anomalies || anomalies.anomalies.length === 0) {
    return (
      <div className="no-data">
        <div className="success-icon">✅</div>
        <h3>No Anomalies Detected</h3>
        <p>All patterns appear normal</p>
      </div>
    );
  }

  const { by_severity } = anomalies;

  return (
    <div className="anomalies-tab">
      <h2>⚠️ Detected Anomalies</h2>
      <p className="tab-description">Unusual patterns requiring investigation</p>

      {/* Critical Anomalies */}
      {by_severity?.critical && by_severity.critical.length > 0 && (
        <div className="anomaly-section">
          <h3 className="severity-critical">🚨 Critical</h3>
          <div className="anomaly-list">
            {by_severity.critical.map((anomaly, index) => (
              <AnomalyCard key={index} anomaly={anomaly} />
            ))}
          </div>
        </div>
      )}

      {/* High Anomalies */}
      {by_severity?.high && by_severity.high.length > 0 && (
        <div className="anomaly-section">
          <h3 className="severity-high">⚠️ High</h3>
          <div className="anomaly-list">
            {by_severity.high.map((anomaly, index) => (
              <AnomalyCard key={index} anomaly={anomaly} />
            ))}
          </div>
        </div>
      )}

      {/* Medium Anomalies */}
      {by_severity?.medium && by_severity.medium.length > 0 && (
        <div className="anomaly-section">
          <h3 className="severity-medium">⚡ Medium</h3>
          <div className="anomaly-list">
            {by_severity.medium.map((anomaly, index) => (
              <AnomalyCard key={index} anomaly={anomaly} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnomalyCard({ anomaly }) {
  return (
    <div className={`anomaly-card severity-${anomaly.severity}`}>
      <div className="anomaly-header">
        <span className={`severity-badge ${anomaly.severity}`}>
          {anomaly.severity}
        </span>
        <span className="anomaly-type">{anomaly.type?.replace('_', ' ')}</span>
      </div>
      <div className="anomaly-description">
        {anomaly.description}
      </div>
      {anomaly.date && (
        <div className="anomaly-meta">
          Date: {anomaly.date}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RECOMMENDATIONS TAB
// ============================================================================

function RecommendationsTab({ recommendations }) {
  if (!recommendations || !recommendations.recommendations || recommendations.recommendations.length === 0) {
    return <div className="no-data">No recommendations at this time</div>;
  }

  const { by_category } = recommendations;

  return (
    <div className="recommendations-tab">
      <h2>💡 Smart Recommendations</h2>
      <p className="tab-description">AI-generated actionable insights</p>

      <div className="recommendations-list">
        {recommendations.recommendations.map((rec, index) => (
          <div key={index} className={`recommendation-card priority-${rec.priority}`}>
            <div className="recommendation-header">
              <span className={`priority-badge ${rec.priority}`}>
                {rec.priority}
              </span>
              <span className="recommendation-category">
                {rec.category?.replace('_', ' ')}
              </span>
            </div>

            <h3 className="recommendation-title">{rec.title}</h3>
            <p className="recommendation-description">{rec.description}</p>

            <div className="recommendation-meta">
              <span className="meta-item">
                <strong>Impact:</strong> {rec.impact}
              </span>
              <span className="meta-item">
                <strong>Effort:</strong> {rec.effort}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Grouped by Category */}
      {by_category && Object.keys(by_category).length > 1 && (
        <div className="recommendations-by-category">
          <h3>By Category</h3>
          {Object.entries(by_category).map(([category, recs]) => (
            <div key={category} className="category-group">
              <h4>{category.replace('_', ' ')}</h4>
              <span className="category-count">{recs.length} recommendations</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AIInsights;
