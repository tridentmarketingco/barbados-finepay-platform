/**
 * PayFine Audit Logs Component
 * View and search audit logs for all operator actions
 */

import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../../services/operatorApi';
import '../../styles/Operator.css';

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action_type: '',
    government_id: '',
    days: '7'
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadLogs();
  }, [filters, page]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        page,
        per_page: 50
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });

      const data = await getAuditLogs(params);
      setLogs(data.logs || []);
      setTotalPages(data.total_pages || 1);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPage(1); // Reset to first page when filters change
  };

  const getActionIcon = (actionType) => {
    const icons = {
      'create': '➕',
      'update': '✏️',
      'delete': '🗑️',
      'activate': '✅',
      'suspend': '⏸️',
      'login': '🔐',
      'logout': '🚪',
      'view': '👁️',
      'export': '📥',
      'import': '📤'
    };
    return icons[actionType] || '📋';
  };

  const getActionColor = (actionType) => {
    const colors = {
      'create': '#28a745',
      'update': '#17a2b8',
      'delete': '#dc3545',
      'activate': '#28a745',
      'suspend': '#ffc107',
      'login': '#007bff',
      'logout': '#6c757d'
    };
    return colors[actionType] || '#6c757d';
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading && logs.length === 0) {
    return <div className="loading">Loading audit logs...</div>;
  }

  return (
    <div className="audit-logs">
      <div className="page-header">
        <h2>Audit Logs</h2>
        <div className="header-actions">
          <button className="btn-secondary" onClick={loadLogs}>
            Refresh
          </button>
          <button className="btn-primary">
            Export Logs
          </button>
        </div>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <label>Action Type</label>
          <select
            value={filters.action_type}
            onChange={e => handleFilterChange('action_type', e.target.value)}
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="activate">Activate</option>
            <option value="suspend">Suspend</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Time Period</label>
          <select
            value={filters.days}
            onChange={e => handleFilterChange('days', e.target.value)}
          >
            <option value="1">Last 24 Hours</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="365">Last Year</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Agency ID</label>
          <input
            type="text"
            placeholder="Filter by agency ID"
            value={filters.government_id}
            onChange={e => handleFilterChange('government_id', e.target.value)}
          />
        </div>
      </div>

      <div className="section-card">
        <h4>Audit Trail ({logs.length} entries)</h4>
        {logs.length === 0 ? (
          <div className="no-logs">
            <p>📋 No audit logs found for the selected filters</p>
          </div>
        ) : (
          <>
            <div className="logs-table">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Operator</th>
                    <th>Resource</th>
                    <th>Details</th>
                    <th>IP Address</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => (
                    <tr key={index}>
                      <td className="timestamp">{formatTimestamp(log.timestamp || new Date())}</td>
                      <td>
                        <span 
                          className="action-badge"
                          style={{ backgroundColor: getActionColor(log.action_type) }}
                        >
                          {getActionIcon(log.action_type)} {log.action_type}
                        </span>
                      </td>
                      <td>
                        <div className="operator-info">
                          <strong>{log.operator_name || 'System'}</strong>
                          <span className="operator-role">{log.operator_role || 'N/A'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="resource-info">
                          <strong>{log.resource_type || 'N/A'}</strong>
                          {log.resource_id && (
                            <span className="resource-id">{log.resource_id}</span>
                          )}
                        </div>
                      </td>
                      <td className="details">{log.details || log.description || 'No details'}</td>
                      <td>{log.ip_address || 'N/A'}</td>
                      <td>
                        <span className={`status-badge ${log.status || 'success'}`}>
                          {log.status || 'success'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                className="btn-secondary"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span className="page-info">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn-secondary"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      <div className="section-card">
        <h4>Audit Statistics</h4>
        <div className="audit-stats">
          <div className="stat-item">
            <label>Total Actions (Last 7 Days)</label>
            <p className="value">{logs.length}</p>
          </div>
          <div className="stat-item">
            <label>Unique Operators</label>
            <p className="value">{new Set(logs.map(l => l.operator_name)).size}</p>
          </div>
          <div className="stat-item">
            <label>Failed Actions</label>
            <p className="value error">{logs.filter(l => l.status === 'failed').length}</p>
          </div>
          <div className="stat-item">
            <label>Most Common Action</label>
            <p className="value">
              {logs.length > 0 
                ? logs.reduce((acc, log) => {
                    acc[log.action_type] = (acc[log.action_type] || 0) + 1;
                    return acc;
                  }, {})
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuditLogs;
