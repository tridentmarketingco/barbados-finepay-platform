/**
 * Points History Card Component
 * Shows transaction history for merit and demerit points
 */

import React, { useState, useEffect } from 'react';
import { pointsApi } from '../../services/pointsApi';

function PointsHistoryCard({ profile, pointType = null, showAll = true }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState(pointType || 'all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  useEffect(() => {
    if (profile) {
      loadHistory();
    }
  }, [profile, filter]);

  const loadHistory = async (reset = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        national_id: profile.national_id,
        driver_license: profile.driver_license,
        profile_id: profile.id,
        limit: limit,
        offset: reset ? 0 : (page - 1) * limit
      };
      
      if (filter !== 'all') {
        params.point_type = filter;
      }
      
      const result = await pointsApi.getHistory(params);
      
      if (result.data) {
        const newHistory = reset ? result.data.history : [...history, ...result.data.history];
        setHistory(newHistory);
        setHasMore(result.data.history.length >= limit);
        if (reset) setPage(1);
      }
    } catch (err) {
      setError('Failed to load points history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
    loadHistory();
  };

  const getTransactionIcon = (transaction) => {
    if (transaction.point_type === 'demerit') {
      if (transaction.transaction_type === 'demerit_expired') {
        return '⏰';
      }
      return '⚠️';
    }
    
    if (transaction.point_type === 'merit') {
      if (transaction.transaction_type === 'merit_expired') {
        return '⏰';
      }
      if (transaction.transaction_type === 'offset') {
        return '🔄';
      }
      return '⭐';
    }
    
    return '📊';
  };

  const getTransactionClass = (transaction) => {
    if (transaction.point_type === 'demerit') {
      if (transaction.transaction_type === 'demerit_expired') {
        return 'expired';
      }
      return 'demerit';
    }
    
    if (transaction.point_type === 'merit') {
      if (transaction.transaction_type === 'offset') {
        return 'offset';
      }
      return 'merit';
    }
    
    return '';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-BB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const getDescription = (transaction) => {
    if (transaction.display_description) {
      return transaction.display_description;
    }
    
    const descriptions = {
      'demerit_added': `Demerit points for ${transaction.offence_code || 'violation'}`,
      'demerit_expired': 'Demerit points expired',
      'merit_earned': 'Merit points earned',
      'merit_added': 'Merit points awarded',
      'merit_expired': 'Merit points expired',
      'adjusted': 'Manual adjustment',
      'offset': `Offset ${Math.abs(transaction.points_delta)} demerit point(s)`
    };
    
    return descriptions[transaction.transaction_type] || transaction.transaction_type;
  };

  const filterOptions = [
    { value: 'all', label: 'All Points' },
    { value: 'demerit', label: 'Demerits Only' },
    { value: 'merit', label: 'Merits Only' }
  ];

  if (loading && history.length === 0) {
    return (
      <div className="points-history-card dashboard-card loading">
        <div className="loading-spinner" />
        <p>Loading points history...</p>
      </div>
    );
  }

  if (error && history.length === 0) {
    return (
      <div className="points-history-card dashboard-card error">
        <p>⚠️ {error}</p>
        <button onClick={() => loadHistory(true)} className="retry-btn">Retry</button>
      </div>
    );
  }

  return (
    <div className="points-history-card dashboard-card">
      <div className="card-header">
        <h3>📜 Points History</h3>
        <div className="filter-tabs">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              className={`filter-tab ${filter === option.value ? 'active' : ''}`}
              onClick={() => {
                setFilter(option.value);
                setHistory([]);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="history-summary">
        <div className="summary-item demerit">
          <span className="count">
            {history.filter(t => t.point_type === 'demerit' && t.transaction_type !== 'demerit_expired').length}
          </span>
          <span className="label">Active Demerits</span>
        </div>
        <div className="summary-item merit">
          <span className="count">
            {history.filter(t => t.point_type === 'merit' && t.transaction_type !== 'merit_expired').length}
          </span>
          <span className="label">Merit Awards</span>
        </div>
        <div className="summary-item expired">
          <span className="count">
            {history.filter(t => t.transaction_type.includes('expired')).length}
          </span>
          <span className="label">Expired</span>
        </div>
      </div>

      {/* History List */}
      <div className="history-list">
        {history.length > 0 ? (
          history.map((transaction) => (
            <div 
              key={transaction.id} 
              className={`history-item ${getTransactionClass(transaction)}`}
            >
              <div className="item-icon">
                {getTransactionIcon(transaction)}
              </div>
              
              <div className="item-content">
                <div className="item-header">
                  <span className="description">
                    {getDescription(transaction)}
                  </span>
                  <span className={`points ${transaction.points_delta > 0 ? 'positive' : 'negative'}`}>
                    {transaction.points_delta > 0 ? '+' : ''}{transaction.points_delta}
                  </span>
                </div>
                
                <div className="item-meta">
                  <span className="date">
                    {formatDate(transaction.created_at)}
                  </span>
                  <span className="days-ago">
                    {getDaysAgo(transaction.created_at)}
                  </span>
                  {transaction.source_type && (
                    <span className="source">
                      via {transaction.source_type.replace('_', ' ')}
                    </span>
                  )}
                </div>
                
                {transaction.offence_description && (
                  <div className="offence-details">
                    {transaction.offence_description}
                  </div>
                )}
                
                {transaction.is_expired && (
                  <div className="expired-badge">
                    ⏰ Expired
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <span className="icon">📋</span>
            <p>No points history found</p>
            <span className="hint">Your points transactions will appear here</span>
          </div>
        )}
      </div>

      {/* Load More */}
      {hasMore && history.length > 0 && (
        <div className="load-more">
          <button 
            className="load-more-btn" 
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {/* Info */}
      <div className="history-info">
        <p>
          📝 Points remain active for 12 months from the date of violation.
          After 12 months with no new violations, demerit points automatically expire.
        </p>
      </div>
    </div>
  );
}

export default PointsHistoryCard;

