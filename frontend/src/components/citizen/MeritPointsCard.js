/**
 * Merit Points Card Component
 * Shows merit point balance, awards, and benefits
 */

import React, { useState, useEffect } from 'react';
import { pointsApi } from '../../services/pointsApi';

function MeritPointsCard({ profile, onRefresh }) {
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
      
      const result = await pointsApi.getMeritStatus(params);
      if (result.data) {
        setStatus(result.data);
      }
    } catch (err) {
      setError('Failed to load merit status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getMeritColor = (points) => {
    if (points >= 8) return '#4caf50'; // Green - Excellent
    if (points >= 5) return '#8bc34a'; // Light Green - Good
    if (points >= 3) return '#ff9800'; // Orange - Fair
    return '#2196f3'; // Blue - Building
  };

  const getMeritIcon = (points) => {
    if (points >= 8) return '🏆';
    if (points >= 5) return '⭐';
    if (points >= 3) return '🌟';
    return '✨';
  };

  const getMeritLabel = (points) => {
    if (points >= 8) return 'Exemplary';
    if (points >= 5) return 'Excellent';
    if (points >= 3) return 'Good';
    return 'Building';
  };

  const getProgressPercentage = () => {
    if (!status) return 0;
    return (status.current_merit_points / status.max_points) * 100;
  };

  const getNextAwardInfo = () => {
    if (!status) return null;
    
    // Simplified - in production would check actual dates
    return {
      days: 180,
      description: 'Clean driving for 6 months',
      points: 1
    };
  };

  if (loading) {
    return (
      <div className="merit-points-card dashboard-card loading">
        <div className="loading-spinner" />
        <p>Loading merit status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="merit-points-card dashboard-card error">
        <p>⚠️ {error}</p>
        <button onClick={loadStatus} className="retry-btn">Retry</button>
      </div>
    );
  }

  const defaultStatus = {
    current_merit_points: 0,
    total_earned: 0,
    total_used: 0,
    is_exemplary: false,
    max_points: 10,
    can_offset_demerits: false,
    offset_cap: 3,
    last_award_date: null
  };

  const s = status || defaultStatus;

  return (
    <div className="merit-points-card dashboard-card">
      <div className="card-header">
        <h3>✨ Merit Points</h3>
        <span className="merit-badge" style={{ backgroundColor: getMeritColor(s.current_merit_points) }}>
          {getMeritIcon(s.current_merit_points)} {getMeritLabel(s.current_merit_points)}
        </span>
      </div>

      {/* Points Display */}
      <div className="points-display">
        <div className="points-circle merit">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#e0e0e0"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={getMeritColor(s.current_merit_points)}
              strokeWidth="8"
              strokeDasharray={`${getProgressPercentage() * 3.14} 314`}
              strokeDashoffset="0"
              transform="rotate(-90 60 60)"
              strokeLinecap="round"
            />
            <text x="60" y="65" textAnchor="middle" fontSize="24" fontWeight="bold">
              {s.current_merit_points}
            </text>
            <text x="60" y="85" textAnchor="middle" fontSize="10" fill="#666">
              / {s.max_points} pts
            </text>
          </svg>
        </div>

        {/* Stats */}
        <div className="merit-stats">
          <div className="stat-item">
            <span className="value">{s.total_earned}</span>
            <span className="label">Total Earned</span>
          </div>
          <div className="stat-item">
            <span className="value">{s.total_used}</span>
            <span className="label">Total Used</span>
          </div>
        </div>
      </div>

      {/* Exemplary Badge */}
      {s.is_exemplary && (
        <div className="exemplary-badge">
          <span className="icon">🎖️</span>
          <span className="text">Exemplary Driver</span>
          <p>5+ merit points with no violations - You're a model citizen!</p>
        </div>
      )}

      {/* Benefits */}
      <div className="benefits-section">
        <h4>💎 Merit Benefits</h4>
        
        <div className="benefit-grid">
          <div className="benefit-item">
            <span className="icon">🛡️</span>
            <div className="content">
              <strong>Offset Demerits</strong>
              <p>Use up to {s.offset_cap} points to reduce demerits</p>
              {s.can_offset_demerits && (
                <span className="available">✓ Available</span>
              )}
            </div>
          </div>
          
          <div className="benefit-item">
            <span className="icon">🏷️</span>
            <div className="content">
              <strong>Safe Driver Badge</strong>
              <p>Display your status to others</p>
            </div>
          </div>
          
          <div className="benefit-item">
            <span className="icon">💰</span>
            <div className="content">
              <strong>Insurance Discounts</strong>
              <p>Partner insurers offer rates for safe drivers</p>
            </div>
          </div>
          
          <div className="benefit-item">
            <span className="icon">⏱️</span>
            <div className="content">
              <strong>Priority Service</strong>
              <p>Faster processing at Licensing Authority</p>
            </div>
          </div>
        </div>
      </div>

      {/* How to Earn */}
      <div className="earn-section">
        <h4>📈 How to Earn More Points</h4>
        
        <div className="earn-list">
          <div className="earn-item">
            <span className="icon">📅</span>
            <div className="content">
              <strong>6 Months Clean</strong>
              <p>+1 point every 6 months violation-free</p>
            </div>
            <span className="reward">+1</span>
          </div>
          
          <div className="earn-item">
            <span className="icon">📆</span>
            <div className="content">
              <strong>12 Months Clean</strong>
              <p>+2 points at license renewal (clean year)</p>
            </div>
            <span className="reward">+2</span>
          </div>
          
          <div className="earn-item">
            <span className="icon">🎂</span>
            <div className="content">
              <strong>2+ Years Clean</strong>
              <p>+3-5 point bonus for long-term safe driving</p>
            </div>
            <span className="reward">+3-5</span>
          </div>
        </div>
      </div>

      {/* Progress to Next */}
      {s.current_merit_points < s.max_points && (
        <div className="next-award">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: `${getProgressPercentage()}%`,
                background: 'linear-gradient(90deg, #4caf50 0%, #8bc34a 100%)'
              }}
            />
          </div>
          <p>
            {s.max_points - s.current_merit_points} points until max ({s.max_points})
          </p>
        </div>
      )}

      {/* Reset Warning */}
      {s.current_merit_points > 0 && (
        <div className="reset-warning">
          <p>⚠️ <strong>Note:</strong> Any violation will reduce your merit points (halved).</p>
        </div>
      )}

      {/* Maxed Out */}
      {s.current_merit_points >= s.max_points && (
        <div className="maxed-out">
          <span className="icon">🎉</span>
          <p>Maximum merit points reached! Keep up the excellent driving!</p>
        </div>
      )}
    </div>
  );
}

export default MeritPointsCard;

