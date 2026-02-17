/**
 * Gamification API Service
 * Handles all gamification-related API calls
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add government ID header to all requests
apiClient.interceptors.request.use((config) => {
  const governmentId = localStorage.getItem('government_id') || 'barbados';
  config.headers['X-Government-ID'] = governmentId;
  
  // Add auth token if available
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  
  return config;
});

export const gamificationAPI = {
  // ============================================================================
  // CITIZEN PROFILE
  // ============================================================================
  
  /**
   * Get citizen profile
   * @param {Object} params - { national_id, driver_license, or ticket_serial }
   * @returns {Promise} Profile data
   */
  getProfile: async (params) => {
    const response = await apiClient.get('/api/gamification/profile', { params });
    return response.data;
  },
  
  /**
   * Get detailed citizen statistics
   * @param {Object} params - { national_id, driver_license }
   * @returns {Promise} Detailed stats
   */
  getStats: async (params) => {
    const response = await apiClient.get('/api/gamification/profile/stats', { params });
    return response.data;
  },
  
  // ============================================================================
  // BADGES
  // ============================================================================
  
  /**
   * Get all available badges
   * @returns {Promise} List of badges
   */
  getAllBadges: async () => {
    const response = await apiClient.get('/api/gamification/badges');
    return response.data;
  },
  
  /**
   * Get citizen's earned badges
   * @param {Object} params - { national_id, driver_license }
   * @returns {Promise} Earned badges
   */
  getCitizenBadges: async (params) => {
    const response = await apiClient.get('/api/gamification/profile/badges', { params });
    return response.data;
  },
  
  // ============================================================================
  // REWARDS
  // ============================================================================
  
  /**
   * Get available rewards
   * @param {Object} params - { featured, type }
   * @returns {Promise} List of rewards
   */
  getRewards: async (params = {}) => {
    const response = await apiClient.get('/api/gamification/rewards', { params });
    return response.data;
  },
  
  /**
   * Redeem a reward
   * @param {number} rewardId - Reward ID
   * @param {Object} data - { national_id, driver_license }
   * @returns {Promise} Redemption result
   */
  redeemReward: async (rewardId, data) => {
    const response = await apiClient.post(`/api/gamification/rewards/${rewardId}/redeem`, data);
    return response.data;
  },
  
  /**
   * Get citizen's redeemed rewards
   * @param {Object} params - { national_id, driver_license }
   * @returns {Promise} Redeemed rewards
   */
  getCitizenRewards: async (params) => {
    const response = await apiClient.get('/api/gamification/profile/rewards', { params });
    return response.data;
  },
  
  /**
   * Verify a reward redemption code
   * @param {string} code - Redemption code
   * @returns {Promise} Verification result
   */
  verifyRewardCode: async (code) => {
    const response = await apiClient.get(`/api/gamification/rewards/${code}/verify`);
    return response.data;
  },
  
  // ============================================================================
  // LEADERBOARDS
  // ============================================================================
  
  /**
   * Get all leaderboards
   * @returns {Promise} List of leaderboards
   */
  getLeaderboards: async () => {
    const response = await apiClient.get('/api/gamification/leaderboards');
    return response.data;
  },
  
  /**
   * Get leaderboard rankings
   * @param {number} leaderboardId - Leaderboard ID
   * @returns {Promise} Rankings
   */
  getLeaderboardRankings: async (leaderboardId) => {
    const response = await apiClient.get(`/api/gamification/leaderboards/${leaderboardId}`);
    return response.data;
  },
  
  /**
   * Get citizen's rank on a leaderboard
   * @param {number} leaderboardId - Leaderboard ID
   * @param {Object} params - { national_id, driver_license }
   * @returns {Promise} Rank information
   */
  getMyRank: async (leaderboardId, params) => {
    const response = await apiClient.get(`/api/gamification/leaderboards/${leaderboardId}/my-rank`, { params });
    return response.data;
  },
  
  /**
   * Opt in/out of leaderboards
   * @param {Object} data - { national_id, driver_license, opt_in }
   * @returns {Promise} Result
   */
  updateLeaderboardOptIn: async (data) => {
    const response = await apiClient.post('/api/gamification/leaderboards/opt-in', data);
    return response.data;
  },
  
  // ============================================================================
  // POINTS
  // ============================================================================
  
  /**
   * Get points transaction history
   * @param {Object} params - { national_id, driver_license, limit }
   * @returns {Promise} Transaction history
   */
  getPointsHistory: async (params) => {
    const response = await apiClient.get('/api/gamification/profile/points/history', { params });
    return response.data;
  },
  
  // ============================================================================
  // EARLY PAYMENT DISCOUNTS
  // ============================================================================
  
  /**
   * Preview early payment discount for a ticket
   * @param {string} serialNumber - Ticket serial number
   * @returns {Promise} Discount preview
   */
  getDiscountPreview: async (serialNumber) => {
    const response = await apiClient.get(`/api/gamification/tickets/${serialNumber}/discount-preview`);
    return response.data;
  },

  // ============================================================================
  // GAMIFICATION CONFIG (ADMIN)
  // ============================================================================

  /**
   * Get gamification configuration for the current government
   * @returns {Promise} Gamification config with enabled status
   */
  getGamificationConfig: async () => {
    const response = await apiClient.get('/api/admin/gamification/config');
    return response.data;
  },

  /**
   * Update gamification configuration
   * @param {Object} config - Configuration object
   * @returns {Promise} Updated config
   */
  updateGamificationConfig: async (config) => {
    const response = await apiClient.put('/api/admin/gamification/config', config);
    return response.data;
  }
};

export default gamificationAPI;
