/**
 * Admin Dashboard Component
 * Displays statistics, charts, and recent activity
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';
import '../../styles/Admin.css';

function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    loadDashboard();
  }, [period]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await adminAPI.getDashboard(period);
      setDashboard(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get payment method icon
  const getPaymentMethodIcon = (method) => {
    const icons = {
      'online': '💳',
      'card': '💳',
      'cash': '💵',
      'bank transfer': '🏦',
      'mobile payment': '📱',
      'pos': '🖥️'
    };
    return icons[method?.toLowerCase()] || '💳';
  };

  // Helper function to get payment method CSS class
  const getPaymentMethodClass = (method) => {
    const classes = {
      'online': 'method-online',
      'card': 'method-card',
      'cash': 'method-cash',
      'bank transfer': 'method-bank',
      'mobile payment': 'method-mobile',
      'pos': 'method-pos'
    };
    return classes[method?.toLowerCase()] || 'method-default';
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Helper function to format time
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="error-message">
          <p>❌ {error}</p>
          <button onClick={loadDashboard} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { summary, payment_methods, daily_revenue, recent_payments } = dashboard;

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>📊 Admin Dashboard</h1>
        <div className="period-selector">
          <label>Period:</label>
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🎫</div>
          <div className="stat-content">
            <h3>Total Tickets</h3>
            <p className="stat-value">{summary.total_tickets}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Paid Tickets</h3>
            <p className="stat-value">{summary.paid_tickets}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏰</div>
          <div className="stat-content">
            <h3>Unpaid Tickets</h3>
            <p className="stat-value">{summary.unpaid_tickets}</p>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <h3>Overdue Tickets</h3>
            <p className="stat-value">{summary.overdue_tickets}</p>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Total Revenue</h3>
            <p className="stat-value">${summary.total_revenue.toFixed(2)}</p>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>Revenue (Period)</h3>
            <p className="stat-value">${summary.revenue_this_period.toFixed(2)}</p>
          </div>
        </div>

        <div className="stat-card danger">
          <div className="stat-icon">💸</div>
          <div className="stat-content">
            <h3>Outstanding</h3>
            <p className="stat-value">${summary.outstanding_amount.toFixed(2)}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🆕</div>
          <div className="stat-content">
            <h3>New Tickets</h3>
            <p className="stat-value">{summary.new_tickets_this_period}</p>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="dashboard-section">
        <h2>💳 Payment Methods</h2>
        <div className="payment-methods-grid">
          {payment_methods.map((pm, index) => (
            <div key={index} className="payment-method-card">
              <h4>{pm.method || 'Online'}</h4>
              <p className="pm-count">{pm.count} payments</p>
              <p className="pm-total">${pm.total.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="dashboard-section">
        <h2>📈 Daily Revenue</h2>
        <div className="revenue-chart">
          {daily_revenue.length > 0 ? (
            <div className="simple-bar-chart">
              {daily_revenue.map((day, index) => (
                <div key={index} className="bar-item">
                  <div 
                    className="bar" 
                    style={{ 
                      height: `${(day.revenue / Math.max(...daily_revenue.map(d => d.revenue))) * 200}px` 
                    }}
                    title={`$${day.revenue.toFixed(2)}`}
                  >
                    <span className="bar-value">${day.revenue.toFixed(0)}</span>
                  </div>
                  <div className="bar-label">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No revenue data for this period</p>
          )}
        </div>
      </div>

      {/* Recent Payments - Enhanced */}
      <div className="dashboard-section">
        <h2>🕒 Recent Payments</h2>
        <div className="recent-payments-table">
          {recent_payments.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th className="th-serial">🎫 Serial</th>
                  <th className="th-amount">💰 Amount</th>
                  <th className="th-method">💳 Method</th>
                  <th className="th-date">📅 Date</th>
                  <th className="th-reference">🔗 Reference</th>
                </tr>
              </thead>
              <tbody>
                {recent_payments.map((payment, index) => (
                  <tr key={payment.id} className={`payment-row ${index % 2 === 0 ? 'even' : 'odd'}`}>
                    <td className="td-serial">
                      <span className="serial-badge">{payment.serial_number}</span>
                    </td>
                    <td className="td-amount">
                      <span className="amount-value">${payment.payment_amount?.toFixed(2) || payment.fine_amount.toFixed(2)}</span>
                    </td>
                    <td className="td-method">
                      <span className={`payment-badge ${getPaymentMethodClass(payment.payment_method)}`}>
                        <span className="payment-icon">{getPaymentMethodIcon(payment.payment_method)}</span>
                        {payment.payment_method || 'Online'}
                      </span>
                    </td>
                    <td className="td-date">
                      <span className="date-display">
                        <span className="date-main">{formatDate(payment.paid_date)}</span>
                        <span className="date-time">{formatTime(payment.paid_date)}</span>
                      </span>
                    </td>
                    <td className="td-reference">
                      <span className="reference-container">
                        <span className="reference-value">{payment.payment_reference}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="no-data">No recent payments</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
