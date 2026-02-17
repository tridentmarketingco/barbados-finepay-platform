/**
 * Points API Service
 * API client for merit/demerit point system
 */

import api from './api';

const BASE_URL = '/api/points';

export const pointsApi = {
  /**
   * Get complete points status for a citizen
   * @param {Object} params - Identification parameters
   * @param {string} params.national_id - National ID
   * @param {string} params.driver_license - Driver license number
   * @param {number} params.profile_id - Profile ID
   */
  getStatus: async (params) => {
    const query = new URLSearchParams();
    if (params.national_id) query.append('national_id', params.national_id);
    if (params.driver_license) query.append('driver_license', params.driver_license);
    if (params.profile_id) query.append('profile_id', params.profile_id);
    
    const response = await api.get(`${BASE_URL}/status?${query.toString()}`);
    return response.data;
  },

  /**
   * Get points balance (merit and demerit)
   */
  getBalance: async (params) => {
    const query = new URLSearchParams();
    if (params.national_id) query.append('national_id', params.national_id);
    if (params.driver_license) query.append('driver_license', params.driver_license);
    if (params.profile_id) query.append('profile_id', params.profile_id);
    
    const response = await api.get(`${BASE_URL}/balance?${query.toString()}`);
    return response.data;
  },

  /**
   * Get suspension status
   */
  getSuspensionStatus: async (params) => {
    const query = new URLSearchParams();
    if (params.national_id) query.append('national_id', params.national_id);
    if (params.driver_license) query.append('driver_license', params.driver_license);
    if (params.profile_id) query.append('profile_id', params.profile_id);
    
    const response = await api.get(`${BASE_URL}/suspension-status?${query.toString()}`);
    return response.data;
  },

  /**
   * Get points transaction history
   */
  getHistory: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.national_id) query.append('national_id', params.national_id);
    if (params.driver_license) query.append('driver_license', params.driver_license);
    if (params.profile_id) query.append('profile_id', params.profile_id);
    if (params.point_type) query.append('point_type', params.point_type);
    if (params.status) query.append('status', params.status);
    if (params.limit) query.append('limit', params.limit);
    if (params.offset) query.append('offset', params.offset);
    
    const response = await api.get(`${BASE_URL}/history?${query.toString()}`);
    return response.data;
  },

  /**
   * Get active demerit entries
   */
  getActiveDemerits: async (params) => {
    const query = new URLSearchParams();
    if (params.national_id) query.append('national_id', params.national_id);
    if (params.driver_license) query.append('driver_license', params.driver_license);
    if (params.profile_id) query.append('profile_id', params.profile_id);
    
    const response = await api.get(`${BASE_URL}/active-demerits?${query.toString()}`);
    return response.data;
  },

  /**
   * Add demerit points for a violation
   */
  addDemerit: async (data) => {
    const response = await api.post(`${BASE_URL}/demerit/add`, data);
    return response.data;
  },

  /**
   * Calculate current demerits (12-month rolling window)
   */
  calculateDemerits: async (params) => {
    const query = new URLSearchParams();
    if (params.national_id) query.append('national_id', params.national_id);
    if (params.driver_license) query.append('driver_license', params.driver_license);
    if (params.profile_id) query.append('profile_id', params.profile_id);
    
    const response = await api.get(`${BASE_URL}/demerit/calculate?${query.toString()}`);
    return response.data;
  },

  /**
   * Award merit points
   */
  awardMerit: async (data) => {
    const response = await api.post(`${BASE_URL}/merit/award`, data);
    return response.data;
  },

  /**
   * Get merit status
   */
  getMeritStatus: async (params) => {
    const query = new URLSearchParams();
    if (params.national_id) query.append('national_id', params.national_id);
    if (params.driver_license) query.append('driver_license', params.driver_license);
    if (params.profile_id) query.append('profile_id', params.profile_id);
    
    const response = await api.get(`${BASE_URL}/merit/status?${query.toString()}`);
    return response.data;
  },

  /**
   * Offset demerits with merits
   */
  offsetDemerits: async (params) => {
    const response = await api.post(`${BASE_URL}/merit/offset`, params);
    return response.data;
  },

  /**
   * Get offence points information
   */
  getOffencePoints: async (offenceCode, queryParams = {}) => {
    const query = new URLSearchParams(queryParams);
    const response = await api.get(`${BASE_URL}/offence/${offenceCode}/points?${query.toString()}`);
    return response.data;
  },

  /**
   * Sync with Licensing Authority (BLA)
   */
  syncBLA: async (params) => {
    const response = await api.post(`${BASE_URL}/bla/sync`, params);
    return response.data;
  },

  /**
   * Get threshold configuration
   */
  getThresholds: async () => {
    const response = await api.get(`${BASE_URL}/thresholds`);
    return response.data;
  },

  /**
   * Get offence points reference table
   */
  getOffencePointsTable: async () => {
    const response = await api.get(`${BASE_URL}/offence-points-table`);
    return response.data;
  }
};

export default pointsApi;

