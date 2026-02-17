/**
 * Driving Score Card Component
 * Shows citizen's driving score with visual progress
 */

import React from 'react';

function DrivingScoreCard({ score }) {
  const getScoreColor = (score) => {
    if (score >= 900) return '#4caf50'; // Green - Excellent
    if (score >= 800) return '#8bc34a'; // Light Green - Good
    if (score >= 700) return '#ff9800'; // Orange - Fair
    if (score >= 600) return '#ff5722'; // Red - Poor
    return '#f44336'; // Dark Red - Very Poor
  };

  const getScoreLabel = (score) => {
    if (score >= 900) return 'Excellent';
    if (score >= 800) return 'Good';
    if (score >= 700) return 'Fair';
    if (score >= 600) return 'Poor';
    return 'Needs Improvement';
  };

  const getScoreIcon = (score) => {
    if (score >= 900) return '🌟';
    if (score >= 800) return '👍';
    if (score >= 700) return '⚖️';
    if (score >= 600) return '⚠️';
    return '🚨';
  };

  const progressPercentage = Math.min((score / 1000) * 100, 100);

  return (
    <div className="driving-score-card dashboard-card">
      <div className="card-header">
        <h3>🚗 Driving Score</h3>
        <span className="score-badge" style={{ backgroundColor: getScoreColor(score) }}>
          {getScoreIcon(score)} {score}/1000
        </span>
      </div>

      <div className="score-display">
        <div className="score-circle">
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
              stroke={getScoreColor(score)}
              strokeWidth="8"
              strokeDasharray={`${progressPercentage * 3.14} 314`}
              strokeDashoffset="0"
              transform="rotate(-90 60 60)"
              strokeLinecap="round"
            />
            <text x="60" y="65" textAnchor="middle" fontSize="20" fontWeight="bold">
              {score}
            </text>
          </svg>
        </div>

        <div className="score-info">
          <h4>{getScoreLabel(score)}</h4>
          <p>Your driving behavior score</p>
          <div className="score-breakdown">
            <div className="breakdown-item">
              <span>Payment History</span>
              <span>+{Math.min(score * 0.3, 300)} pts</span>
            </div>
            <div className="breakdown-item">
              <span>Clean Driving</span>
              <span>+{Math.min(score * 0.4, 400)} pts</span>
            </div>
            <div className="breakdown-item">
              <span>Compliance</span>
              <span>+{Math.min(score * 0.3, 300)} pts</span>
            </div>
          </div>
        </div>
      </div>

      <div className="score-tips">
        <h5>💡 Improvement Tips</h5>
        <ul>
          {score < 700 && <li>Pay tickets early for bonus points</li>}
          {score < 800 && <li>Maintain clean driving record</li>}
          {score < 900 && <li>Complete challenges for extra points</li>}
          {score >= 900 && <li>Keep up the excellent driving!</li>}
        </ul>
      </div>
    </div>
  );
}

export default DrivingScoreCard;
