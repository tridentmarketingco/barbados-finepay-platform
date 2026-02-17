/**
 * Demerit Status Card Component
 * Shows demerit points, suspension status, and warnings
 */

import React, { useState, useEffect } from 'react';
import { pointsApi } from '../../services/pointsApi';

function DemeritStatusCard({ profile, onRefresh }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (profile) {
      loadStatus();
    }
  }, [profile]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        national_id: profile.national_id,
        driver_license: profile.driver_license,
        profile_id: profile.id
      };
      
      const result = await pointsApi.getSuspensionStatus(params);
      if (result.data) {
        setStatus(result.data);
      }
    } catch (err) {
      setError('Failed to load demerit status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'suspended': return '#f44336';
      case 'revoked': return '#9c27b0';
      case 'warning': return '#ff9800';
      default: return '#4caf50';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'suspended': return '🚫';
      case 'revoked': return '❌';
      case 'warning': return '⚠️';
      default: return '✅';
    }
  };

  const getProgressPercentage = () => {
    if (!status) return 0;
    const { current_demerits } = status;
    const threshold = 14;
    return Math.min((current_demerits / threshold) * 100, 100);
  };

  const getDaysUntilSuspension = () => {
    if (!status || status.status === 'suspended' || status.status === 'revoked') return null;
    const { current_demerits } = status;
    const pointsNeeded = 14 - current_demerits;
    if (pointsNeeded <= 0) return 'Any violation';
    return `${pointsNeeded} point(s)`;
  };

  if (loading) {
    return (
      <div className="demerit-status-card dashboard-card loading">
        <div className="loading-spinner" />
        <p>Loading demerit status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="demerit-status-card dashboard-card error">
        <p>⚠️ {error}</p>
        <button onClick={loadStatus} className="retry-btn">Retry</button>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="demerit-status-card dashboard-card empty">
        <p>No demerit record found</p>
      </div>
    );
  }

  const { current_demerits, active_suspensions, is_suspended, is_revoked, status_info } = status;

  return (
    <div className="demerit-status-card dashboard-card">
      <div className="card-header">
        <h3>🚦 Demerit Status</h3>
        <span 
          className="status-badge"
          style={{ backgroundColor: getStatusColor(status.status) }}
        >
          {getStatusIcon(status.status)} {status.status.toUpperCase()}
        </span>
      </div>

      {/* Points Display */}
      <div className="points-display">
        <div className="points-circle">
          <svg width="140" height="140" viewBox="0 0 140 140">
            {/* Background circle */}
            <circle
              cx="70"
              cy="70"
              r="60"
              fill="none"
              stroke="#e0e0e0"
              strokeWidth="12"
            />
            {/* Progress circle */}
            <circle
              cx="70"
              cy="70"
              r="60"
              fill="none"
              stroke={getStatusColor(status.status)}
              strokeWidth="12"
              strokeDasharray={`${getProgressPercentage() * 3.77} 377`}
              strokeDashoffset="0"
              transform="rotate(-90 70 70)"
              strokeLinecap="round"
            />
            <text x="70" y="75" textAnchor="middle" fontSize="28" fontWeight="bold">
              {current_demerits}
            </text>
            <text x="70" y="95" textAnchor="middle" fontSize="12" fill="#666">
              POINTS
            </text>
          </svg>
        </div>

        {/* Threshold markers */}
        <div className="threshold-info">
          <div className="threshold-item">
            <span className="label">Warning</span>
            <span className="value">10 pts</span>
          </div>
          <div className="threshold-item warning">
            <span className="label">Suspension</span>
            <span className="value">14 pts</span>
          </div>
          <div className="threshold-item revoked">
            <span className="label">Revocation</span>
            <span className="value">20 pts</span>
          </div>
        </div>
      </div>

      {/* Status Message */}
      <div className="status-message">
        {is_suspended && (
          <div className="alert alert-danger">
            <strong>🚫 License Suspended</strong>
            <p>Your license has been suspended due to {current_demerits} demerit points.</p>
            <p>Contact the Licensing Authority to resolve.</p>
          </div>
        )}
        
        {is_revoked && (
          <div className="alert alert-purple">
            <strong>❌ License Revoked</strong>
            <p>Your license has been revoked due to excessive demerit points.</p>
            <p>You will need to reapply for a license.</p>
          </div>
        )}
        
        {!is_suspended && !is_revoked && status.status === 'warning' && (
          <div className="alert alert-warning">
            <strong>⚠️ Warning: Approaching Suspension Threshold</strong>
            <p>You have {current_demerits} demerit points. Any violation may trigger automatic suspension.</p>
          </div>
        )}
        
        {!is_suspended && !is_revoked && status.status === 'clear' && (
          <div className="alert alert-success">
            <strong>✅ Good Standing</strong>
            <p>You have {current_demerits} demerit points. Stay violation-free!</p>
          </div>
        )}
      </div>

      {/* Points Progress */}
      <div className="points-progress">
        <div className="progress-labels">
          <span>0</span>
          <span className="warning-marker">10</span>
          <span className="suspension-marker">14</span>
          <span>20+</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ 
              width: `${getProgressPercentage()}%`,
              backgroundColor: getStatusColor(status.status)
            }}
          />
        </div>
      </div>

      {/* Next Threshold */}
      <div className="next-threshold">
        <span className="label">Points until suspension:</span>
        <span className="value">{getDaysUntilSuspension()}</span>
      </div>

      {/* Active Suspensions */}
      {active_suspensions && active_suspensions.length > 0 && (
        <div className="active-suspensions">
          <h4>Active Suspensions</h4>
          {active_suspensions.map((suspension) => (
            <div key={suspension.id} className="suspension-item">
              <div className="suspension-header">
                <span className="type">{suspension.suspension_type.toUpperCase()}</span>
                <span className="dates">
                  {suspension.effective_date} → {suspension.end_date || 'Indefinite'}
                </span>
              </div>
              <p className="reason">{suspension.reason}</p>
            </div>
          ))}
        </div>
      )}

      {/* Info Note */}
      <div className="info-note">
        <p>📝 <strong>12-Month Rolling Window:</strong> Demerit points automatically expire after 12 months with no new violations.</p>
      </div>
    </div>
  );
}

export default DemeritStatusCard;

