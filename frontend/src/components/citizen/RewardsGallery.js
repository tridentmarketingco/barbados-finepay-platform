/**
 * Rewards Gallery Component
 * Displays available rewards that can be redeemed with points
 */

import React, { useState } from 'react';

function RewardsGallery({ rewards = [], citizenPoints = 0, onRedeem }) {
  const [selectedReward, setSelectedReward] = useState(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  const canAfford = (reward) => {
    return citizenPoints >= reward.points_cost;
  };

  const isAvailable = (reward) => {
    if (reward.total_available === null) return true;
    return reward.remaining > 0;
  };

  const handleRedeemClick = (reward) => {
    setSelectedReward(reward);
    setShowRedeemModal(true);
  };

  const handleConfirmRedeem = async () => {
    if (selectedReward && onRedeem) {
      await onRedeem(selectedReward.id);
      setShowRedeemModal(false);
      setSelectedReward(null);
    }
  };

  const featuredRewards = rewards.filter(r => r.is_featured);
  const regularRewards = rewards.filter(r => !r.is_featured);

  return (
    <div className="rewards-gallery dashboard-card">
      <div className="card-header">
        <h3>🎁 Available Rewards</h3>
        <div className="points-available">
          You have: <strong>{citizenPoints.toLocaleString()}</strong> points
        </div>
      </div>

      {/* Featured Rewards */}
      {featuredRewards.length > 0 && (
        <div className="featured-section">
          <h4>⭐ Featured Rewards</h4>
          <div className="rewards-grid">
            {featuredRewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                canAfford={canAfford(reward)}
                isAvailable={isAvailable(reward)}
                onRedeem={() => handleRedeemClick(reward)}
                citizenPoints={citizenPoints}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Rewards */}
      <div className="all-rewards-section">
        <h4>All Rewards</h4>
        <div className="rewards-grid">
          {regularRewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              canAfford={canAfford(reward)}
              isAvailable={isAvailable(reward)}
              onRedeem={() => handleRedeemClick(reward)}
              citizenPoints={citizenPoints}
            />
          ))}
        </div>
      </div>

      {/* Redeem Confirmation Modal */}
      {showRedeemModal && selectedReward && (
        <div className="modal-overlay" onClick={() => setShowRedeemModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Redemption</h3>
            <div className="reward-preview">
              <div className="reward-icon-large">{selectedReward.icon_emoji}</div>
              <h4>{selectedReward.name}</h4>
              <p>{selectedReward.description}</p>
            </div>

            <div className="redemption-details">
              <div className="detail-row">
                <span>Cost:</span>
                <strong>{selectedReward.points_cost} points</strong>
              </div>
              <div className="detail-row">
                <span>Your Balance:</span>
                <strong>{citizenPoints} points</strong>
              </div>
              <div className="detail-row">
                <span>After Redemption:</span>
                <strong>{citizenPoints - selectedReward.points_cost} points</strong>
              </div>
              {selectedReward.validity_days && (
                <div className="detail-row">
                  <span>Valid For:</span>
                  <strong>{selectedReward.validity_days} days</strong>
                </div>
              )}
            </div>

            {selectedReward.terms_and_conditions && (
              <div className="terms">
                <h5>Terms & Conditions</h5>
                <p>{selectedReward.terms_and_conditions}</p>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowRedeemModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmRedeem}
              >
                Confirm Redemption
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RewardCard({ reward, canAfford, isAvailable, onRedeem, citizenPoints }) {
  const getRewardTypeIcon = (type) => {
    switch (type) {
      case 'discount': return '💵';
      case 'parking_voucher': return '🅿️';
      case 'priority_service': return '⚡';
      case 'service_waiver': return '🎓';
      case 'certificate': return '📜';
      default: return '🎁';
    }
  };

  return (
    <div className={`reward-card ${reward.is_featured ? 'featured' : ''}`}>
      <div className="reward-icon">
        {reward.icon_emoji || getRewardTypeIcon(reward.reward_type)}
      </div>

      <h5 className="reward-name">{reward.name}</h5>
      <p className="reward-description">{reward.description}</p>

      {reward.reward_value && (
        <div className="reward-value">
          Value: ${reward.reward_value.toFixed(2)}
        </div>
      )}

      <div className="reward-cost">
        <span className="cost-icon">💎</span>
        {reward.points_cost.toLocaleString()} points
      </div>

      {reward.total_available !== null && (
        <div className={`reward-availability ${reward.remaining < 10 ? 'low-stock' : ''}`}>
          {reward.remaining > 0 ? (
            <>Only {reward.remaining} left!</>
          ) : (
            <>Sold Out</>
          )}
        </div>
      )}

      <button
        className="redeem-btn"
        onClick={onRedeem}
        disabled={!canAfford || !isAvailable}
      >
        {!isAvailable ? 'Unavailable' :
         !canAfford ? 'Not Enough Points' :
         'Redeem Now'}
      </button>

      {!canAfford && isAvailable && (
        <div className="points-needed">
          Need {(reward.points_cost - citizenPoints).toLocaleString()} more points
        </div>
      )}
    </div>
  );
}

export default RewardsGallery;
