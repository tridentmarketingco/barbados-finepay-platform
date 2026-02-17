/**
 * PayFine Operator Dashboard
 * Main operator control panel for PayFine HQ
 * Fully responsive with hamburger menu on mobile
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { operatorLogout, getGovernments, getRevenueDashboard, getComplianceAlerts } from '../../services/operatorApi';
import GovernmentManagement from './GovernmentManagement';
import RevenueDashboard from './RevenueDashboard';
import TransactionAnalytics from './TransactionAnalytics';
import ComplianceAlerts from './ComplianceAlerts';
import AuditLogs from './AuditLogs';
import FeatureFlags from './FeatureFlags';
import '../../styles/Operator.css';
import '../../styles/HamburgerMenuFix.css';

function OperatorDashboard() {
  const [user, setUser] = useState(null);
  const [governments, setGovernments] = useState([]);
  const [revenueSummary, setRevenueSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadOperatorData();
  }, []);

  const loadOperatorData = async () => {
    try {
      const userData = localStorage.getItem('operator_user');
      if (userData) {
        setUser(JSON.parse(userData));
      }

      // Load data with individual error handling
      const [govs, revenue, alertsData] = await Promise.allSettled([
        getGovernments(),
        getRevenueDashboard({ months: 12 }),
        getComplianceAlerts({ severity: 'high,medium' })
      ]);

      // Handle governments
      if (govs.status === 'fulfilled') {
        setGovernments(govs.value.governments || []);
      } else {
        console.error('Failed to load governments:', govs.reason);
        setGovernments([]);
      }

      // Handle revenue
      if (revenue.status === 'fulfilled') {
        setRevenueSummary(revenue.value);
      } else {
        console.error('Failed to load revenue:', revenue.reason);
        setRevenueSummary({ summary: { total_revenue: 0, total_transactions: 0, avg_success_rate: 0 } });
      }

      // Handle alerts
      if (alertsData.status === 'fulfilled') {
        setAlerts(alertsData.value.alerts || []);
      } else {
        console.error('Failed to load alerts:', alertsData.reason);
        setAlerts([]);
      }
    } catch (error) {
      console.error('Failed to load operator data:', error);
      // Set default empty values
      setGovernments([]);
      setRevenueSummary({ summary: { total_revenue: 0, total_transactions: 0, avg_success_rate: 0 } });
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    operatorLogout();
    window.location.href = '/operator/login';
  };

  if (!loading && !user) {
    return <Navigate to="/operator/login" replace />;
  }

  if (loading) {
    return (
      <div className="operator-loading">
        <div className="loading-spinner"></div>
        <p>Loading PayFine Operator Dashboard...</p>
      </div>
    );
  }

  const activeGovernments = governments.filter(g => g.status === 'active').length;
  const pilotGovernments = governments.filter(g => g.status === 'pilot').length;
  const suspendedGovernments = governments.filter(g => g.status === 'suspended').length;
  const totalRevenue = revenueSummary?.summary?.total_revenue || 0;
  const totalTransactions = revenueSummary?.summary?.total_transactions || 0;
  const avgSuccessRate = revenueSummary?.summary?.avg_success_rate || 0;

  return (
    <div className="operator-dashboard">
      {/* Mobile Header - Dark Blue with Hamburger on Right */}
      <header className="operator-mobile-header">
        <div className="mobile-header-content">
          <div className="mobile-logo">
            <span className="logo-icon">⚙️</span>
            <span className="logo-text">PayFine</span>
          </div>
          <button 
            className="mobile-menu-toggle" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* Sidebar Overlay for Mobile */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      <aside className={`operator-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <h1>PayFine</h1>
          </div>
        </div>

        <div className="operator-info">
          <div className="operator-avatar">
            {user?.full_name?.[0] || user?.username?.[0] || 'O'}
          </div>
          <div className="operator-details">
            <p className="operator-name">{user?.full_name || user?.username}</p>
            <p className="operator-role">{user?.role?.replace('_', ' ').toUpperCase()}</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink 
            to="/operator/dashboard" 
            className={({ isActive }) => isActive ? 'active' : ''}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="nav-icon">📊</span>
            Dashboard
          </NavLink>
          <NavLink 
            to="/operator/agencies" 
            className={({ isActive }) => isActive ? 'active' : ''}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="nav-icon">🏛️</span>
            Agencies
          </NavLink>
          <NavLink 
            to="/operator/revenue" 
            className={({ isActive }) => isActive ? 'active' : ''}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="nav-icon">💰</span>
            Revenue
          </NavLink>
          <NavLink 
            to="/operator/analytics" 
            className={({ isActive }) => isActive ? 'active' : ''}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="nav-icon">📈</span>
            Analytics
          </NavLink>
          <NavLink 
            to="/operator/compliance" 
            className={({ isActive }) => isActive ? 'active' : ''}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="nav-icon">✅</span>
            Compliance
          </NavLink>
          <NavLink 
            to="/operator/audit-logs" 
            className={({ isActive }) => isActive ? 'active' : ''}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="nav-icon">📋</span>
            Audit Logs
          </NavLink>
          <NavLink 
            to="/operator/features" 
            className={({ isActive }) => isActive ? 'active' : ''}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="nav-icon">🎛️</span>
            Features
          </NavLink>
          <button className="logout-btn" onClick={() => { setSidebarOpen(false); handleLogout(); }}>
            <span className="nav-icon">🚪</span>
            Logout
          </button>
        </nav>
      </aside>

      <main className="operator-main">
        <Routes>
          <Route path="/" element={<Navigate to="/operator/dashboard" replace />} />
          <Route path="/dashboard" element={
            <>
              <div className="dashboard-header">
                <h2>Dashboard Overview</h2>
                <div className="dashboard-stats">
                  <div className="stat-card">
                    <div className="stat-icon">🏛️</div>
                    <div className="stat-content">
                      <p className="stat-value">{governments.length}</p>
                      <p className="stat-label">Total Agencies</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content">
                      <p className="stat-value">{activeGovernments}</p>
                      <p className="stat-label">Active</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🧪</div>
                    <div className="stat-content">
                      <p className="stat-value">{pilotGovernments}</p>
                      <p className="stat-label">Pilot</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">⏸️</div>
                    <div className="stat-content">
                      <p className="stat-value">{suspendedGovernments}</p>
                      <p className="stat-label">Suspended</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="dashboard-content">
                <div className="metric-card">
                  <div className="metric-icon">💰</div>
                  <div className="metric-content">
                    <p className="metric-value">${totalRevenue.toLocaleString()}</p>
                    <p className="metric-label">Total Revenue (12mo)</p>
                    <p className="metric-sub">{totalTransactions.toLocaleString()} transactions</p>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon">📈</div>
                  <div className="metric-content">
                    <p className="metric-value">{avgSuccessRate}%</p>
                    <p className="metric-label">Avg Success Rate</p>
                    <p className="metric-sub">Payment success rate</p>
                  </div>
                </div>

                <div className="metric-card alert-card">
                  <div className="metric-icon">⚠️</div>
                  <div className="metric-content">
                    <p className="metric-value">{alerts.length}</p>
                    <p className="metric-label">Active Alerts</p>
                    <p className="metric-sub">Requires attention</p>
                  </div>
                </div>
              </div>

              <div className="section-card">
                <h4>Recent Agencies</h4>
                <div className="governments-table">
                  {governments.length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Agency</th>
                          <th>Country</th>
                          <th>Currency</th>
                          <th>Status</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {governments.slice(0, 5).map(gov => (
                          <tr key={gov.id}>
                            <td>{gov.government_name}</td>
                            <td>{gov.country_name} ({gov.country_iso_code})</td>
                            <td>{gov.currency_code}</td>
                            <td>
                              <span className={`status-badge ${gov.status}`}>
                                {gov.status}
                              </span>
                            </td>
                            <td>{new Date(gov.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-state">
                      <p>No agencies found</p>
                      <p className="empty-state-hint">
                        Run the seeding script to create sample agencies:<br/>
                        <code>python backend/seed_agencies_for_operator.py</code>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          } />
          <Route path="/agencies" element={<GovernmentManagement />} />
          <Route path="/revenue" element={<RevenueDashboard />} />
          <Route path="/analytics" element={<TransactionAnalytics />} />
          <Route path="/compliance" element={<ComplianceAlerts />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/features" element={<FeatureFlags />} />
        </Routes>
      </main>
    </div>
  );
}

export default OperatorDashboard;
