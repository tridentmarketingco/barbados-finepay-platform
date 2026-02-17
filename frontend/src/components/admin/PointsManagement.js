/**
 * Admin Points Management Component
 * Admin interface for managing merit/demerit points system
 */

import React, { useState, useEffect } from 'react';
import { adminGamificationAPI } from '../../services/adminApi';

function PointsManagement() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Overview state
  const [stats, setStats] = useState(null);
  
  // Add demerit state
  const [addDemeritForm, setAddDemeritForm] = useState({
    national_id: '',
    driver_license: '',
    offence_code: '',
    points: 3,
    description: '',
    source_type: 'manual'
  });
  
  // Award merit state
  const [awardMeritForm, setAwardMeritForm] = useState({
    national_id: '',
    driver_license: '',
    points: 1,
    reason: '',
    source_type: 'manual'
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const result = await adminGamificationAPI.getAnalyticsOverview();
      if (result.data) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDemerit = async (e) => {
    e.preventDefault();
    try {
      // This would call the API to add demerit
      console.log('Adding demerit:', addDemeritForm);
      alert('Demerit added successfully');
      setAddDemeritForm({
        national_id: '',
        driver_license: '',
        offence_code: '',
        points: 3,
        description: '',
        source_type: 'manual'
      });
    } catch (err) {
      setError('Failed to add demerit');
    }
  };

  const handleAwardMerit = async (e) => {
    e.preventDefault();
    try {
      // This would call the API to award merit
      console.log('Awarding merit:', awardMeritForm);
      alert('Merit awarded successfully');
      setAwardMeritForm({
        national_id: '',
        driver_license: '',
        points: 1,
        reason: '',
        source_type: 'manual'
      });
    } catch (err) {
      setError('Failed to award merit');
    }
  };

  const renderOverviewTab = () => (
    <div className="overview-tab">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🚗</div>
          <div className="stat-content">
            <div className="stat-value">{stats?.total_citizens || 0}</div>
            <div className="stat-label">Total Citizens</div>
          </div>
        </div>
        
        <div className="stat-card warning">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <div className="stat-value">
              {stats?.total_points_awarded || 0}
            </div>
            <div className="stat-label">Total Points Awarded</div>
          </div>
        </div>
        
        <div className="stat-card success">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <div className="stat-value">
              {stats?.badges_unlocked || 0}
            </div>
            <div className="stat-label">Badges Unlocked</div>
          </div>
        </div>
        
        <div className="stat-card info">
          <div className="stat-icon">🏆</div>
          <div className="stat-content">
            <div className="stat-value">
              {stats?.rewards_redeemed || 0}
            </div>
            <div className="stat-label">Rewards Redeemed</div>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="section">
        <h3>🏆 Top Points Earners</h3>
        <div className="top-performers">
          {stats?.top_points_earners?.map((earner, index) => (
            <div key={index} className="performer-item">
              <span className="rank">#{index + 1}</span>
              <span className="name">{earner.name}</span>
              <span className="points">{earner.points} pts</span>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement */}
      <div className="section">
        <h3>📊 Engagement Metrics</h3>
        <div className="metrics-grid">
          <div className="metric-item">
            <span className="metric-label">Active Users</span>
            <span className="metric-value">{stats?.active_users || 0}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Engagement Rate</span>
            <span className="metric-value">{stats?.engagement_rate || 0}%</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Leaderboard Participants</span>
            <span className="metric-value">{stats?.leaderboard_participants || 0}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Avg Driving Score</span>
            <span className="metric-value">{stats?.avg_driving_score || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAddDemeritTab = () => (
    <div className="add-demerit-tab">
      <h3>⚠️ Add Demerit Points</h3>
      <p className="form-description">
        Manually add demerit points to a citizen's record. This is typically used 
        for court-ordered points or corrections.
      </p>
      
      <form onSubmit={handleAddDemerit} className="admin-form">
        <div className="form-row">
          <div className="form-group">
            <label>National ID</label>
            <input
              type="text"
              value={addDemeritForm.national_id}
              onChange={(e) => setAddDemeritForm({...addDemeritForm, national_id: e.target.value})}
              placeholder="Enter National ID"
            />
          </div>
          
          <div className="form-group">
            <label>Driver License</label>
            <input
              type="text"
              value={addDemeritForm.driver_license}
              onChange={(e) => setAddDemeritForm({...addDemeritForm, driver_license: e.target.value})}
              placeholder="Enter Driver License"
            />
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label>Offence Code</label>
            <select
              value={addDemeritForm.offence_code}
              onChange={(e) => setAddDemeritForm({...addDemeritForm, offence_code: e.target.value})}
            >
              <option value="">Select Offence</option>
              <option value="SPEEDING_MINOR">Speeding Minor (3 pts)</option>
              <option value="SPEEDING_SERIOUS">Speeding Serious (6 pts)</option>
              <option value="CARELESS_DANGEROUS">Careless/Dangerous (7 pts)</option>
              <option value="DRINK_DRIVING">Drink Driving (11 pts)</option>
              <option value="RED_LIGHT">Red Light (4 pts)</option>
              <option value="NO_SEATBELT">No Seatbelt (2 pts)</option>
              <option value="MOBILE_PHONE">Mobile Phone (4 pts)</option>
              <option value="UNLICENSED">Unlicensed (9 pts)</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Points</label>
            <input
              type="number"
              value={addDemeritForm.points}
              onChange={(e) => setAddDemeritForm({...addDemeritForm, points: parseInt(e.target.value)})}
              min="1"
              max="20"
            />
          </div>
        </div>
        
        <div className="form-group">
          <label>Description</label>
          <textarea
            value={addDemeritForm.description}
            onChange={(e) => setAddDemeritForm({...addDemeritForm, description: e.target.value})}
            placeholder="Describe the violation..."
            rows="3"
          />
        </div>
        
        <div className="form-group">
          <label>Source Type</label>
          <select
            value={addDemeritForm.source_type}
            onChange={(e) => setAddDemeritForm({...addDemeritForm, source_type: e.target.value})}
          >
            <option value="manual">Manual Entry</option>
            <option value="court_order">Court Order</option>
            <option value="bla_sync">BLA Sync</option>
          </select>
        </div>
        
        <button type="submit" className="submit-btn danger">
          Add Demerit Points
        </button>
      </form>
    </div>
  );

  const renderAwardMeritTab = () => (
    <div className="award-merit-tab">
      <h3>⭐ Award Merit Points</h3>
      <p className="form-description">
        Award merit points to citizens for clean driving or special achievements.
      </p>
      
      <form onSubmit={handleAwardMerit} className="admin-form">
        <div className="form-row">
          <div className="form-group">
            <label>National ID</label>
            <input
              type="text"
              value={awardMeritForm.national_id}
              onChange={(e) => setAwardMeritForm({...awardMeritForm, national_id: e.target.value})}
              placeholder="Enter National ID"
            />
          </div>
          
          <div className="form-group">
            <label>Driver License</label>
            <input
              type="text"
              value={awardMeritForm.driver_license}
              onChange={(e) => setAwardMeritForm({...awardMeritForm, driver_license: e.target.value})}
              placeholder="Enter Driver License"
            />
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label>Points to Award</label>
            <input
              type="number"
              value={awardMeritForm.points}
              onChange={(e) => setAwardMeritForm({...awardMeritForm, points: parseInt(e.target.value)})}
              min="1"
              max="10"
            />
          </div>
          
          <div className="form-group">
            <label>Reason</label>
            <select
              value={awardMeritForm.reason}
              onChange={(e) => setAwardMeritForm({...awardMeritForm, reason: e.target.value})}
            >
              <option value="">Select Reason</option>
              <option value="6_months_clean">6 Months Clean Driving</option>
              <option value="12_months_clean">12 Months Clean Driving</option>
              <option value="2_years_clean">2+ Years Clean Driving Bonus</option>
              <option value="exemplary">Exemplary Driving</option>
              <option value="special">Special Achievement</option>
            </select>
          </div>
        </div>
        
        <div className="form-group">
          <label>Source Type</label>
          <select
            value={awardMeritForm.source_type}
            onChange={(e) => setAwardMeritForm({...awardMeritForm, source_type: e.target.value})}
          >
            <option value="manual">Manual Entry</option>
            <option value="auto_award">Auto Award</option>
            <option value="bonus">Bonus</option>
          </select>
        </div>
        
        <button type="submit" className="submit-btn success">
          Award Merit Points
        </button>
      </form>
    </div>
  );

  const renderThresholdsTab = () => (
    <div className="thresholds-tab">
      <h3>⚙️ Threshold Configuration</h3>
      
      <div className="threshold-config">
        <div className="config-section">
          <h4>Suspension Thresholds</h4>
          <div className="form-row">
            <div className="form-group">
              <label>Warning Threshold</label>
              <input type="number" defaultValue={10} min="5" max="13" />
              <span className="hint">Points at which to issue warning</span>
            </div>
            
            <div className="form-group">
              <label>Suspension Threshold</label>
              <input type="number" defaultValue={14} min="10" max="18" />
              <span className="hint">Points triggering automatic suspension</span>
            </div>
            
            <div className="form-group">
              <label>Revocation Threshold</label>
              <input type="number" defaultValue={20} min="15" max="25" />
              <span className="hint">Points for potential revocation</span>
            </div>
          </div>
        </div>
        
        <div className="config-section">
          <h4>Suspension Duration</h4>
          <div className="form-row">
            <div className="form-group">
              <label>Suspension Duration (months)</label>
              <input type="number" defaultValue={12} min="6" max="24" />
            </div>
            
            <div className="form-group">
              <label>Revocation Duration (months)</label>
              <input type="number" defaultValue={24} min="12" max="48" />
            </div>
          </div>
        </div>
        
        <div className="config-section">
          <h4>Rolling Window</h4>
          <div className="form-group">
            <label>Point Expiry Period (days)</label>
            <input type="number" defaultValue={365} min="180" max="730" />
            <span className="hint">Points automatically expire after this period</span>
          </div>
        </div>
        
        <div className="config-section">
          <h4>Merit System</h4>
          <div className="form-row">
            <div className="form-group">
              <label>Max Merit Points</label>
              <input type="number" defaultValue={10} min="5" max="20" />
            </div>
            
            <div className="form-group">
              <label>Merit Offset Cap</label>
              <input type="number" defaultValue={3} min="1" max="5" />
              <span className="hint">Max demerits that can be offset</span>
            </div>
          </div>
        </div>
        
        <button className="submit-btn">
          Save Configuration
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="admin-page loading">
        <div className="loading-spinner" />
        <p>Loading points management...</p>
      </div>
    );
  }

  return (
    <div className="admin-page points-management">
      <div className="page-header">
        <h1>🎯 Points Management</h1>
        <p>Manage merit and demerit points for the traffic enforcement system</p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`tab ${activeTab === 'add-demerit' ? 'active' : ''}`}
          onClick={() => setActiveTab('add-demerit')}
        >
          ⚠️ Add Demerit
        </button>
        <button
          className={`tab ${activeTab === 'award-merit' ? 'active' : ''}`}
          onClick={() => setActiveTab('award-merit')}
        >
          ⭐ Award Merit
        </button>
        <button
          className={`tab ${activeTab === 'thresholds' ? 'active' : ''}`}
          onClick={() => setActiveTab('thresholds')}
        >
          ⚙️ Thresholds
        </button>
        <button
          className={`tab ${activeTab === 'expiry' ? 'active' : ''}`}
          onClick={() => setActiveTab('expiry')}
        >
          ⏰ Expiry
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'add-demerit' && renderAddDemeritTab()}
        {activeTab === 'award-merit' && renderAwardMeritTab()}
        {activeTab === 'thresholds' && renderThresholdsTab()}
        {activeTab === 'expiry' && (
          <div className="expiry-tab">
            <h3>⏰ Point Expiry Management</h3>
            <p>Monitor and manage point expiry process</p>
            
            <div className="expiry-actions">
              <button className="action-btn" onClick={() => alert('Running expiry check...')}>
                Run Expiry Check Now
              </button>
              <button className="action-btn" onClick={() => alert('Running merit award check...')}>
                Run Merit Award Check
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PointsManagement;

