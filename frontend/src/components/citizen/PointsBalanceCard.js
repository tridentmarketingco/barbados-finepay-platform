/**
 * Points Balance Card Component
 * Shows citizen's points balance and recent transactions
 */

import React, { useState, useEffect } from 'react';
import { gamificationAPI } from '../../services/gamificationApi';

function PointsBalanceCard({ profile, onRefresh }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      loadTransactions();
    }
  }, [profile]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const data = await gamificationAPI.getPointsHistory({
        national_id: profile.national_id,
        driver_license: profile.driver_license,
        limit: 5
      });
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const pointsToNextLevel = ((profile?.current_level || 1) * 1000) - (profile?.total_points || 0);

  return (
    <div className="points-balance-card dashboard-card">
      <div className="card-header">
        <h3>💰 Points Balance</h3>
        <div className="level-badge">
          Level {profile?.current_level || 1}
        </div>
      </div>

      <div className="points-display">
        <div className="points-amount">
          {(profile?.total_points || 0).toLocaleString()}
        </div>
        <div className="points-label">Total Points</div>
      </div>

      <div className="level-info">
        <div>
          <strong>Next Level:</strong> Level {(profile?.current_level || 1) + 1}
        </div>
        <div className="next-level">
          {pointsToNextLevel} points to go
        </div>
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${((profile?.total_points || 0) % 1000) / 10}%`,
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
          }}
        />
      </div>

      {/* Recent Transactions */}
      <div className="recent-transactions">
        <h4>Recent Activity</h4>
        {loading ? (
          <div className="loading-spinner" />
        ) : transactions.length > 0 ? (
          <div className="transactions-list">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="transaction-item">
                <div className="transaction-info">
                  <span className="transaction-source">
                    {transaction.source_type === 'ticket_payment' && '💳 Ticket Payment'}
                    {transaction.source_type === 'badge_earned' && '🏆 Badge Earned'}
                    {transaction.source_type === 'reward_redeemed' && '🎁 Reward Redeemed'}
                    {transaction.source_type === 'early_payment' && '⚡ Early Payment Bonus'}
                    {!['ticket_payment', 'badge_earned', 'reward_redeemed', 'early_payment'].includes(transaction.source_type) && 
                      `📊 ${transaction.source_type}`}
                  </span>
                  <span className="transaction-date">
                    {new Date(transaction.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className={`transaction-points ${transaction.points_amount > 0 ? 'positive' : 'negative'}`}>
                  {transaction.points_amount > 0 ? '+' : ''}{transaction.points_amount}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-transactions">No recent activity</p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-item">
          <span className="stat-icon">🎯</span>
          <div>
            <div className="stat-value">{profile?.total_tickets_paid || 0}</div>
            <div className="stat-label">Tickets Paid</div>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">💵</span>
          <div>
            <div className="stat-value">
              ${(profile?.total_discounts_earned || 0).toFixed(2)}
            </div>
            <div className="stat-label">Discounts Earned</div>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">🔥</span>
          <div>
            <div className="stat-value">{profile?.on_time_payment_streak || 0}</div>
            <div className="stat-label">Payment Streak</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PointsBalanceCard;
