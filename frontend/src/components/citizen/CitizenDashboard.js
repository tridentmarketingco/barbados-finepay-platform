/**
 * Citizen Gamification Dashboard
 * Main dashboard showing points, badges, driving score, and rewards
 */

import React, { useState, useEffect } from 'react';
import { gamificationAPI } from '../../services/gamificationApi';
import DrivingScoreCard from './DrivingScoreCard';
import PointsBalanceCard from './PointsBalanceCard';
import BadgesShowcase from './BadgesShowcase';
import RewardsGallery from './RewardsGallery';
import '../../styles/Gamification.css';

function CitizenDashboard() {
  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [identifiers, setIdentifiers] = useState({
    national_id: '',
    driver_license: '',
    ticket_serial: ''
  });
  const [showIdentifierForm, setShowIdentifierForm] = useState(true);

  useEffect(() => {
    // Check if identifiers are in localStorage
    const savedNationalId = localStorage.getItem('citizen_national_id');
    const savedDriverLicense = localStorage.getItem('citizen_driver_license');
    
    if (savedNationalId || savedDriverLicense) {
      setIdentifiers({
        national_id: savedNationalId || '',
        driver_license: savedDriverLicense || '',
        ticket_serial: ''
      });
      setShowIdentifierForm(false);
      loadDashboardData(savedNationalId, savedDriverLicense);
    }
  }, []);

  const loadDashboardData = async (nationalId, driverLicense) => {
    try {
      setLoading(true);
      setError(null);

      // Load profile
      const profileData = await gamificationAPI.getProfile({
        national_id: nationalId,
        driver_license: driverLicense
      });
      setProfile(profileData.profile);

      // Load badges
      const badgesData = await gamificationAPI.getCitizenBadges({
        national_id: nationalId,
        driver_license: driverLicense
      });
      setBadges(badgesData.badges || []);

      // Load all available badges
      const allBadgesData = await gamificationAPI.getAllBadges();
      setAllBadges(allBadgesData.badges || []);

      // Load rewards
      const rewardsData = await gamificationAPI.getRewards();
      setRewards(rewardsData.rewards || []);

    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleIdentifierSubmit = (e) => {
    e.preventDefault();
    
    if (!identifiers.national_id && !identifiers.driver_license && !identifiers.ticket_serial) {
      setError('Please provide at least one identifier');
      return;
    }

    // Save to localStorage
    if (identifiers.national_id) {
      localStorage.setItem('citizen_national_id', identifiers.national_id);
    }
    if (identifiers.driver_license) {
      localStorage.setItem('citizen_driver_license', identifiers.driver_license);
    }

    setShowIdentifierForm(false);
    loadDashboardData(identifiers.national_id, identifiers.driver_license);
  };

  const handleRedeemReward = async (rewardId) => {
    try {
      const result = await gamificationAPI.redeemReward(rewardId, {
        national_id: identifiers.national_id,
        driver_license: identifiers.driver_license
      });

      // Refresh profile to show updated points
      await loadDashboardData(identifiers.national_id, identifiers.driver_license);

      alert(`Reward redeemed successfully! Code: ${result.reward.redemption_code}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to redeem reward');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('citizen_national_id');
    localStorage.removeItem('citizen_driver_license');
    setShowIdentifierForm(true);
    setProfile(null);
    setBadges([]);
    setRewards([]);
  };

  // Show identifier form if needed
  if (showIdentifierForm) {
    return (
      <div className="citizen-dashboard">
        <div className="dashboard-card">
          <div className="card-header">
            <h2>🎮 Welcome to Your Gamification Dashboard</h2>
          </div>

          <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
            Enter your information to view your points, badges, and rewards.
          </p>

          <form onSubmit={handleIdentifierSubmit}>
            <div className="form-group">
              <label htmlFor="national_id">National ID (Optional)</label>
              <input
                type="text"
                id="national_id"
                value={identifiers.national_id}
                onChange={(e) => setIdentifiers({...identifiers, national_id: e.target.value})}
                placeholder="Enter your National ID"
              />
            </div>

            <div className="form-group">
              <label htmlFor="driver_license">Driver License (Optional)</label>
              <input
                type="text"
                id="driver_license"
                value={identifiers.driver_license}
                onChange={(e) => setIdentifiers({...identifiers, driver_license: e.target.value})}
                placeholder="Enter your Driver License"
              />
            </div>

            <div className="form-group">
              <label htmlFor="ticket_serial">Or Ticket Serial Number</label>
              <input
                type="text"
                id="ticket_serial"
                value={identifiers.ticket_serial}
                onChange={(e) => setIdentifiers({...identifiers, ticket_serial: e.target.value})}
                placeholder="e.g., A459778"
              />
            </div>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              View My Dashboard
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>🔒 Privacy Notice</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Your information is hashed and stored securely. We never store your actual National ID or Driver License number.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="citizen-dashboard">
        <div className="dashboard-card text-center">
          <div className="loading-spinner" style={{ margin: '2rem auto' }} />
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !profile) {
    return (
      <div className="citizen-dashboard">
        <div className="dashboard-card">
          <div className="alert alert-error">
            {error}
          </div>
          <button onClick={handleLogout} className="btn btn-secondary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="citizen-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>🎮 Your Gamification Dashboard</h1>
        <button onClick={handleLogout} className="btn btn-secondary">
          Logout
        </button>
      </div>

      {/* Welcome Message */}
      <div className="welcome-message">
        <h2>Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}!</h2>
        <p>Track your progress, earn rewards, and compete with other safe drivers.</p>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Row 1: Driving Score and Points */}
        <div className="dashboard-row">
          <DrivingScoreCard score={profile?.driving_score || 750} />
          <PointsBalanceCard 
            profile={profile} 
            onRefresh={() => loadDashboardData(identifiers.national_id, identifiers.driver_license)}
          />
        </div>

        {/* Row 2: Badges */}
        <BadgesShowcase badges={badges} allBadges={allBadges} />

        {/* Row 3: Rewards */}
        <RewardsGallery
          rewards={rewards}
          citizenPoints={profile?.total_points || 0}
          onRedeem={handleRedeemReward}
        />
      </div>

      {/* Quick Stats Footer */}
      <div className="dashboard-footer">
        <div className="footer-stats">
          <div className="footer-stat">
            <span className="stat-icon">🎯</span>
            <div>
              <div className="stat-value">{profile?.total_tickets_paid || 0}</div>
              <div className="stat-label">Tickets Paid</div>
            </div>
          </div>
          <div className="footer-stat">
            <span className="stat-icon">🔥</span>
            <div>
              <div className="stat-value">{profile?.clean_driving_streak_days || 0}</div>
              <div className="stat-label">Clean Days</div>
            </div>
          </div>
          <div className="footer-stat">
            <span className="stat-icon">💵</span>
            <div>
              <div className="stat-value">${(profile?.total_discounts_earned || 0).toFixed(2)}</div>
              <div className="stat-label">Discounts Earned</div>
            </div>
          </div>
          <div className="footer-stat">
            <span className="stat-icon">🏆</span>
            <div>
              <div className="stat-value">{badges.length}</div>
              <div className="stat-label">Badges Earned</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CitizenDashboard;
