/**
 * Reports Component
 * Payment reports and analytics
 */

import React, { useState } from 'react';
import adminAPI from '../../services/adminApi';

function Reports() {
  const [reportType, setReportType] = useState('payments');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [filters, setFilters] = useState({
    date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    status: 'paid'
  });

  const generateReport = async () => {
    setLoading(true);
    try {
      if (reportType === 'payments') {
        const data = await adminAPI.getPaymentReport(filters);
        setReportData(data);
      } else if (reportType === 'revenue') {
        const data = await adminAPI.getRevenueReport('daily', 30);
        setReportData(data);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = async () => {
    try {
      await adminAPI.downloadPaymentReportCSV(filters);
    } catch (err) {
      alert('Failed to download CSV');
    }
  };

  return (
    <div className="reports">
      <div className="page-header">
        <h1>📊 Reports</h1>
      </div>

      <div className="report-controls">
        <div className="form-group">
          <label>Report Type:</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="payments">Payment Report</option>
            <option value="revenue">Revenue Report</option>
          </select>
        </div>

        {reportType === 'payments' && (
          <>
            <div className="form-group">
              <label>From:</label>
              <input type="date" value={filters.date_from} onChange={(e) => setFilters({...filters, date_from: e.target.value})} />
            </div>
            <div className="form-group">
              <label>To:</label>
              <input type="date" value={filters.date_to} onChange={(e) => setFilters({...filters, date_to: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Status:</label>
              <select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
                <option value="paid">Paid</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </>
        )}

        <div className="form-group">
          <button onClick={generateReport} className="btn btn-primary" disabled={loading}>
            {loading ? 'Generating...' : '📊 Generate Report'}
          </button>
        </div>

        {reportData && reportType === 'payments' && (
          <div className="form-group">
            <button onClick={downloadCSV} className="btn btn-secondary">
              📥 Download CSV
            </button>
          </div>
        )}
      </div>

      {reportData && (
        <div className="report-results">
          {reportType === 'payments' && (
            <>
              <div className="report-summary">
                <h3>Summary</h3>
                <p>Total Payments: {reportData.summary.total_count}</p>
                <p>Total Amount: ${reportData.summary.total_amount.toFixed(2)}</p>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Serial</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.tickets.map(ticket => (
                      <tr key={ticket.id}>
                        <td>{ticket.serial_number}</td>
                        <td>${(ticket.payment_amount || ticket.fine_amount).toFixed(2)}</td>
                        <td>{new Date(ticket.paid_date).toLocaleDateString()}</td>
                        <td>{ticket.payment_method || 'Online'}</td>
                        <td className="reference">{ticket.payment_reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {reportType === 'revenue' && (
            <div className="revenue-chart">
              <h3>Daily Revenue</h3>
              <div className="simple-bar-chart">
                {reportData.data.map((day, index) => (
                  <div key={index} className="bar-item">
                    <div className="bar" style={{ height: `${(day.revenue / Math.max(...reportData.data.map(d => d.revenue))) * 200}px` }}>
                      <span className="bar-value">${day.revenue.toFixed(0)}</span>
                    </div>
                    <div className="bar-label">{day.period}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Reports;
