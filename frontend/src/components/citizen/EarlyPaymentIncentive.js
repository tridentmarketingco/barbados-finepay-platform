/**
 * Early Payment Incentive Component
 * Shows discount preview and countdown timer for early payment
 */

import React, { useState, useEffect } from 'react';

function EarlyPaymentIncentive({ discountPreview }) {
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    if (discountPreview && discountPreview.has_discount) {
      calculateTimeRemaining();
      const interval = setInterval(calculateTimeRemaining, 1000);
      return () => clearInterval(interval);
    }
  }, [discountPreview]);

  const calculateTimeRemaining = () => {
    if (!discountPreview || !discountPreview.due_date) return;

    const now = new Date();
    const dueDate = new Date(discountPreview.due_date);
    const diff = dueDate - now;

    if (diff <= 0) {
      setTimeRemaining(null);
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setTimeRemaining({ days, hours, minutes, seconds });
  };

  if (!discountPreview || !discountPreview.has_discount) {
    return null;
  }

  return (
    <div className="early-payment-incentive">
      <h3>🎉 Early Payment Bonus!</h3>
      <p>Pay now and save:</p>

      <div className="discount-amount">
        ${discountPreview.discount_amount.toFixed(2)}
        <span style={{ fontSize: '1.2rem', marginLeft: '0.5rem' }}>
          ({discountPreview.discount_percentage}% off)
        </span>
      </div>

      {discountPreview.points_bonus > 0 && (
        <div className="points-bonus">
          + {discountPreview.points_bonus} bonus points
        </div>
      )}

      {discountPreview.tier_name && (
        <div style={{ marginTop: '1rem', fontSize: '1.1rem', opacity: 0.9 }}>
          ⭐ {discountPreview.tier_name}
        </div>
      )}

      {timeRemaining && (
        <div className="countdown-timer">
          <div className="timer-label">Time Remaining:</div>
          <div className="timer-display">
            {timeRemaining.days > 0 && (
              <span className="time-unit">
                <span className="time-value">{timeRemaining.days}</span>
                <span className="time-label">d</span>
              </span>
            )}
            <span className="time-unit">
              <span className="time-value">{String(timeRemaining.hours).padStart(2, '0')}</span>
              <span className="time-label">h</span>
            </span>
            <span className="time-separator">:</span>
            <span className="time-unit">
              <span className="time-value">{String(timeRemaining.minutes).padStart(2, '0')}</span>
              <span className="time-label">m</span>
            </span>
            <span className="time-separator">:</span>
            <span className="time-unit">
              <span className="time-value">{String(timeRemaining.seconds).padStart(2, '0')}</span>
              <span className="time-label">s</span>
            </span>
          </div>
        </div>
      )}

      <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', opacity: 0.9 }}>
        💡 Pay within {discountPreview.days_early} days to get this discount!
      </div>
    </div>
  );
}

export default EarlyPaymentIncentive;
