/**
 * Badges Showcase Component
 * Displays earned and available badges
 */

import React, { useState } from 'react';

function BadgesShowcase({ badges = [], allBadges = [] }) {
  const [showAll, setShowAll] = useState(false);

  const earnedBadges = badges.filter(badge => badge.earned);
  const lockedBadges = allBadges.filter(badge =>
    !earnedBadges.some(earned => earned.badge.code === badge.code)
  );

  const getTierColor = (tier) => {
    switch (tier) {
      case 'bronze': return '#cd7f32';
      case 'silver': return '#c0c0c0';
      case 'gold': return '#ffd700';
      case 'platinum': return '#e5e4e2';
      case 'diamond': return '#b9f2ff';
      default: return '#666';
    }
  };

  const getTierIcon = (tier) => {
    switch (tier) {
      case 'bronze': return '🥉';
      case 'silver': return '🥈';
      case 'gold': return '🥇';
      case 'platinum': return '💎';
      case 'diamond': return '💠';
      default: return '🏆';
    }
  };

  return (
    <div className="badges-showcase dashboard-card">
      <div className="card-header">
        <h3>🏆 Your Achievements</h3>
        <div className="badges-stats">
          <span className="earned-count">{earnedBadges.length}</span>
          <span className="total-count">/{allBadges.length}</span>
          <span className="completion-rate">
            ({Math.round((earnedBadges.length / allBadges.length) * 100)}%)
          </span>
        </div>
      </div>

      {/* Earned Badges */}
      <div className="earned-badges-section">
        <h4>✨ Earned Badges</h4>
        {earnedBadges.length > 0 ? (
          <div className="badges-grid">
            {earnedBadges.map((earnedBadge) => {
              const badge = earnedBadge.badge;
              return (
                <div key={badge.code} className="badge-card earned">
                  <div className="badge-icon">
                    <span className="tier-icon">{getTierIcon(badge.tier)}</span>
                    <span className="emoji-icon">{badge.icon_emoji}</span>
                  </div>
                  <div className="badge-info">
                    <h5 className="badge-name">{badge.name}</h5>
                    <p className="badge-description">{badge.description}</p>
                    <div className="badge-meta">
                      <span
                        className="badge-tier"
                        style={{ color: getTierColor(badge.tier) }}
                      >
                        {badge.tier.toUpperCase()}
                      </span>
                      <span className="badge-points">
                        +{badge.points_reward} pts
                      </span>
                    </div>
                  </div>
                  <div className="earned-date">
                    Earned {new Date(earnedBadge.earned_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-badges">
            <p>No badges earned yet. Start by paying your first ticket!</p>
          </div>
        )}
      </div>

      {/* Locked Badges */}
      {lockedBadges.length > 0 && (
        <div className="locked-badges-section">
          <div className="section-header">
            <h4>🔒 Locked Badges</h4>
            <button
              className="toggle-btn"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Hide' : 'Show'} All
            </button>
          </div>

          {showAll && (
            <div className="badges-grid locked">
              {lockedBadges.map((badge) => (
                <div key={badge.code} className="badge-card locked">
                  <div className="badge-icon locked">
                    <span className="tier-icon">{getTierIcon(badge.tier)}</span>
                    <span className="emoji-icon locked">{badge.icon_emoji}</span>
                  </div>
                  <div className="badge-info">
                    <h5 className="badge-name">{badge.name}</h5>
                    <p className="badge-description">{badge.description}</p>
                    <div className="badge-meta">
                      <span
                        className="badge-tier"
                        style={{ color: getTierColor(badge.tier) }}
                      >
                        {badge.tier.toUpperCase()}
                      </span>
                      <span className="badge-points">
                        +{badge.points_reward} pts
                      </span>
                    </div>
                  </div>
                  <div className="locked-overlay">
                    <span className="lock-icon">🔒</span>
                    <span className="requirement">
                      {badge.requirement_type === 'tickets_paid' && `Pay ${badge.requirement_value} tickets`}
                      {badge.requirement_type === 'clean_days' && `${badge.requirement_value} days clean driving`}
                      {badge.requirement_type === 'points_earned' && `Earn ${badge.requirement_value} points`}
                      {badge.requirement_type === 'driving_score' && `Reach ${badge.requirement_value} driving score`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Progress Summary */}
      <div className="progress-summary">
        <h4>📊 Your Progress</h4>
        <div className="progress-stats">
          <div className="stat-item">
            <span className="stat-label">Badges Earned</span>
            <span className="stat-value">{earnedBadges.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Available</span>
            <span className="stat-value">{allBadges.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Completion Rate</span>
            <span className="stat-value">
              {allBadges.length > 0 ? Math.round((earnedBadges.length / allBadges.length) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BadgesShowcase;
