/**
 * Gamification Analytics Component
 * Dashboard showing gamification metrics and insights
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';

function GamificationAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30'); // days

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.get(`/gamification/analytics/overview?days=${timeRange}`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      alert('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className="error">Failed to load analytics data</div>;
  }

  return (
    <div className="gamification-analytics">
      <div className="analytics-header">
        <h2>📊 Gamification Analytics</h2>
        <div className="time-range-selector">
          <label>Time Range:</label>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="365">Last Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">👥</div>
          <div className="metric-content">
            <div className="metric-value">{analytics.total_citizens?.toLocaleString() || 0}</div>
            <div className="metric-label">Total Citizens</div>
            {analytics.new_citizens > 0 && (
              <div className="metric-change positive">
                +{analytics.new_citizens} new
              </div>
            )}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💎</div>
          <div className="metric-content">
            <div className="metric-value">{analytics.total_points_awarded?.toLocaleString() || 0}</div>
            <div className="metric-label">Points Awarded</div>
            {analytics.points_growth_percentage && (
              <div className={`metric-change ${analytics.points_growth_percentage > 0 ? 'positive' : 'negative'}`}>
                {analytics.points_growth_percentage > 0 ? '+' : ''}{analytics.points_growth_percentage.toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🏆</div>
          <div className="metric-content">
            <div className="metric-value">{analytics.badges_unlocked || 0}</div>
            <div className="metric-label">Badges Unlocked</div>
            <div className="metric-subtext">
              {analytics.unique_badge_earners || 0} citizens
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🎁</div>
          <div className="metric-content">
            <div className="metric-value">{analytics.rewards_redeemed || 0}</div>
            <div className="metric-label">Rewards Redeemed</div>
            <div className="metric-subtext">
              {analytics.points_spent?.toLocaleString() || 0} points spent
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <div className="metric-value">${(analytics.total_discounts_given || 0).toFixed(2)}</div>
            <div className="metric-label">Discounts Given</div>
            <div className="metric-subtext">
              {analytics.early_payments || 0} early payments
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <div className="metric-value">{analytics.avg_driving_score || 750}</div>
            <div className="metric-label">Avg Driving Score</div>
            <div className="metric-subtext">
              Out of 1000
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🔥</div>
          <div className="metric-content">
            <div className="metric-value">{analytics.avg_clean_streak || 0}</div>
            <div className="metric-label">Avg Clean Streak</div>
            <div className="metric-subtext">
              Days without violations
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⚡</div>
          <div className="metric-content">
            <div className="metric-value">{analytics.engagement_rate || 0}%</div>
            <div className="metric-label">Engagement Rate</div>
            <div className="metric-subtext">
              Active participants
            </div>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="analytics-section">
        <h3>🏅 Top Performers</h3>
        <div className="top-performers-grid">
          <div className="performers-card">
            <h4>Top Points Earners</h4>
            {analytics.top_points_earners?.slice(0, 5).map((citizen, index) => (
              <div key={index} className="performer-item">
                <span className="rank">#{index + 1}</span>
                <span className="name">{citizen.name || 'Anonymous'}</span>
                <span className="value">{citizen.points.toLocaleString()} pts</span>
              </div>
            ))}
          </div>

          <div className="performers-card">
            <h4>Highest Driving Scores</h4>
            {analytics.top_driving_scores?.slice(0, 5).map((citizen, index) => (
              <div key={index} className="performer-item">
                <span className="rank">#{index + 1}</span>
                <span className="name">{citizen.name || 'Anonymous'}</span>
                <span className="value">{citizen.score}/1000</span>
              </div>
            ))}
          </div>

          <div className="performers-card">
            <h4>Longest Clean Streaks</h4>
            {analytics.top_clean_streaks?.slice(0, 5).map((citizen, index) => (
              <div key={index} className="performer-item">
                <span className="rank">#{index + 1}</span>
                <span className="name">{citizen.name || 'Anonymous'}</span>
                <span className="value">{citizen.streak} days</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Badge Statistics */}
      <div className="analytics-section">
        <h3>🏆 Badge Statistics</h3>
        <div className="badge-stats-grid">
          {analytics.badge_stats?.map((badge, index) => (
            <div key={index} className="badge-stat-card">
              <div className="badge-stat-header">
                <span className="badge-icon">{badge.icon_emoji}</span>
                <span className="badge-name">{badge.name}</span>
              </div>
              <div className="badge-stat-content">
                <div className="stat-row">
                  <span className="label">Unlocked:</span>
                  <span className="value">{badge.unlock_count} times</span>
                </div>
                <div className="stat-row">
                  <span className="label">By:</span>
                  <span className="value">{badge.unique_earners} citizens</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(badge.unique_earners / analytics.total_citizens * 100).toFixed(1)}%` }}
                  />
                </div>
                <div className="progress-label">
                  {((badge.unique_earners / analytics.total_citizens) * 100).toFixed(1)}% of citizens
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reward Statistics */}
      <div className="analytics-section">
        <h3>🎁 Reward Statistics</h3>
        <div className="reward-stats-grid">
          {analytics.reward_stats?.map((reward, index) => (
            <div key={index} className="reward-stat-card">
              <div className="reward-stat-header">
                <span className="reward-icon">{reward.icon_emoji}</span>
                <span className="reward-name">{reward.name}</span>
              </div>
              <div className="reward-stat-content">
                <div className="stat-row">
                  <span className="label">Redeemed:</span>
                  <span className="value">{reward.redemption_count} times</span>
                </div>
                <div className="stat-row">
                  <span className="label">Points Spent:</span>
                  <span className="value">{reward.total_points_spent.toLocaleString()}</span>
                </div>
                {reward.total_available && (
                  <div className="stat-row">
                    <span className="label">Remaining:</span>
                    <span className="value">{reward.remaining}/{reward.total_available}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Early Payment Impact */}
      <div className="analytics-section">
        <h3>💰 Early Payment Impact</h3>
        <div className="impact-grid">
          <div className="impact-card">
            <div className="impact-value">{analytics.early_payment_rate || 0}%</div>
            <div className="impact-label">Early Payment Rate</div>
            <div className="impact-change">
              {analytics.early_payment_improvement > 0 && (
                <span className="positive">+{analytics.early_payment_improvement}% improvement</span>
              )}
            </div>
          </div>

          <div className="impact-card">
            <div className="impact-value">${(analytics.total_discounts_given || 0).toFixed(2)}</div>
            <div className="impact-label">Total Discounts Given</div>
            <div className="impact-subtext">
              Across {analytics.early_payments || 0} payments
            </div>
          </div>

          <div className="impact-card">
            <div className="impact-value">${(analytics.revenue_increase || 0).toFixed(2)}</div>
            <div className="impact-label">Revenue Increase</div>
            <div className="impact-subtext">
              From improved compliance
            </div>
          </div>

          <div className="impact-card">
            <div className="impact-value">${(analytics.net_revenue_impact || 0).toFixed(2)}</div>
            <div className="impact-label">Net Revenue Impact</div>
            <div className="impact-subtext">
              Revenue increase - discounts
            </div>
          </div>
        </div>
      </div>

      {/* Engagement Trends */}
      <div className="analytics-section">
        <h3>📈 Engagement Trends</h3>
        <div className="trends-grid">
          <div className="trend-card">
            <h4>Active Users</h4>
            <div className="trend-value">{analytics.active_users || 0}</div>
            <div className="trend-percentage">
              {((analytics.active_users / analytics.total_citizens) * 100).toFixed(1)}% of total
            </div>
          </div>

          <div className="trend-card">
            <h4>Leaderboard Participants</h4>
            <div className="trend-value">{analytics.leaderboard_participants || 0}</div>
            <div className="trend-percentage">
              {((analytics.leaderboard_participants / analytics.total_citizens) * 100).toFixed(1)}% opted in
            </div>
          </div>

          <div className="trend-card">
            <h4>Avg Points Per Citizen</h4>
            <div className="trend-value">{analytics.avg_points_per_citizen || 0}</div>
            <div className="trend-subtext">
              Total: {analytics.total_points_in_circulation?.toLocaleString() || 0}
            </div>
          </div>

          <div className="trend-card">
            <h4>Avg Badges Per Citizen</h4>
            <div className="trend-value">{(analytics.avg_badges_per_citizen || 0).toFixed(1)}</div>
            <div className="trend-subtext">
              Total: {analytics.total_badges_unlocked || 0}
            </div>
          </div>
        </div>
      </div>

      {/* ROI Summary */}
      <div className="analytics-section roi-section">
        <h3>💼 ROI Summary</h3>
        <div className="roi-card">
          <div className="roi-metrics">
            <div className="roi-metric">
              <div className="roi-label">Investment (Discounts Given)</div>
              <div className="roi-value negative">${(analytics.total_discounts_given || 0).toFixed(2)}</div>
            </div>
            <div className="roi-operator">+</div>
            <div className="roi-metric">
              <div className="roi-label">Return (Revenue Increase)</div>
              <div className="roi-value positive">${(analytics.revenue_increase || 0).toFixed(2)}</div>
            </div>
            <div className="roi-operator">=</div>
            <div className="roi-metric highlight">
              <div className="roi-label">Net Impact</div>
              <div className="roi-value">${(analytics.net_revenue_impact || 0).toFixed(2)}</div>
            </div>
          </div>
          
          {analytics.roi_percentage && (
            <div className="roi-percentage">
              <strong>ROI: {analytics.roi_percentage.toFixed(1)}%</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GamificationAnalytics;
