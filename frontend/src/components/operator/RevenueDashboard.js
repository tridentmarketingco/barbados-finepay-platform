import React, { useState, useEffect, useCallback } from 'react';
import { getRevenueDashboard, getRevenueByGovernment, generateBillingInvoice, exportBillingData } from '../../services/operatorApi';
import '../../styles/Operator.css';

function RevenueDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('current_month');

  useEffect(() => {
    loadDashboard();
  }, [selectedPeriod]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await getRevenueDashboard({ period: selectedPeriod });
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load revenue dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoice = async (governmentId) => {
    try {
      await generateBillingInvoice(governmentId, selectedPeriod);
      alert('Invoice generated successfully');
      loadDashboard();
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      alert('Error generating invoice');
    }
  };

  const handleExportData = async () => {
    try {
      const data = await exportBillingData(selectedPeriod);
      // Create and download CSV
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billing-data-${selectedPeriod}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Error exporting data');
    }
  };

  if (loading) {
    return <div className="loading">Loading revenue dashboard...</div>;
  }

  return (
    <div className="revenue-dashboard">
      <div className="page-header">
        <h2>Revenue Dashboard</h2>
        <div className="header-actions">
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            className="period-selector"
          >
            <option value="current_month">Current Month</option>
            <option value="last_month">Last Month</option>
            <option value="last_3_months">Last 3 Months</option>
            <option value="last_6_months">Last 6 Months</option>
            <option value="current_year">Current Year</option>
          </select>
          <button className="btn-secondary" onClick={handleExportData}>
            Export Data
          </button>
        </div>
      </div>

      {dashboardData && (
        <>
          <div className="summary-cards">
            <div className="summary-card">
              <h3>Total Revenue</h3>
              <p className="metric">${dashboardData.total_revenue?.toLocaleString() || 0}</p>
            </div>
            <div className="summary-card">
              <h3>Successful Transactions</h3>
              <p className="metric">{dashboardData.successful_transactions || 0}</p>
            </div>
            <div className="summary-card">
              <h3>Platform Fees</h3>
              <p className="metric">${dashboardData.total_fees?.toLocaleString() || 0}</p>
            </div>
            <div className="summary-card">
              <h3>Active Agencies</h3>
              <p className="metric">{dashboardData.active_governments || 0}</p>
            </div>
          </div>

          <div className="revenue-table">
            <h3>Agency Revenue Breakdown</h3>
            <table>
              <thead>
                <tr>
                  <th>Agency</th>
                  <th>Country</th>
                  <th>Revenue</th>
                  <th>Transactions</th>
                  <th>Fees</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.governments?.map(gov => (
                  <tr key={gov.id}>
                    <td>{gov.government_name}</td>
                    <td>{gov.country_name}</td>
                    <td>${gov.revenue?.toLocaleString() || 0}</td>
                    <td>{gov.transactions || 0}</td>
                    <td>${gov.fees?.toLocaleString() || 0}</td>
                    <td>
                      <span className={`status-badge ${gov.status}`}>
                        {gov.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-small"
                        onClick={() => handleGenerateInvoice(gov.id)}
                        disabled={gov.status !== 'active'}
                      >
                        Generate Invoice
                      </button>
                    </td>
                  </tr>
                )) || []}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default RevenueDashboard;
