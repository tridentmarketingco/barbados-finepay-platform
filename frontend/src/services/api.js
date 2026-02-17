/**
 * PayFine Platform - API Service
 * Handles all HTTP requests to the backend API
 */

import axios from 'axios';

// API Configuration - Use proxy in development, env var in production
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create public API instance (no auth required)
export const publicAPI = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token } = response.data;
          localStorage.setItem('access_token', access_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/';
      }
    }

    return Promise.reject(error);
  }
);

// API Methods
export const authAPI = {
  login: (credentials) => api.post('/login', credentials).then(res => res.data),
  register: (userData) => api.post('/register', userData).then(res => res.data),
  refresh: (refreshToken) => api.post('/refresh', { refresh_token: refreshToken }).then(res => res.data),
};

export const ticketAPI = {
  lookup: (serialNumber) => api.get(`/lookup/${serialNumber}`).then(res => res.data),
  pay: (serialNumber, paymentData) => api.post(`/pay/${serialNumber}`, paymentData).then(res => res.data),
  /**
   * Initiate 3DS authentication via HPP
   * @param {string} serialNumber - Ticket serial number
   * @param {object} paymentData - Payment data including email and billing address
   * @returns {Promise} - Response with SpiToken and RedirectData
   */
  initiateSPI: (serialNumber, paymentData) => 
    api.post(`/spi/initiate/${serialNumber}`, paymentData).then(res => res.data),
  
  /**
   * Verify Trident ID ownership of a ticket
   * @param {string} serialNumber - Ticket serial number
   * @param {object} verificationData - Verification data (last_four_digits or date_of_birth)
   * @returns {Promise} - Verification result
   */
  verifyTridentId: (serialNumber, verificationData) =>
    api.post('/tickets/verify', { serial_number: serialNumber, ...verificationData }).then(res => res.data),
  
  /**
   * Claim an unlinked ticket using Trident ID
   * @param {string} serialNumber - Ticket serial number
   * @param {object} claimData - Claim data including trident_id and verification info
   * @returns {Promise} - Claim result
   */
  claimTicket: (serialNumber, claimData) =>
    api.post('/tickets/claim', { serial_number: serialNumber, ...claimData }).then(res => res.data),
  
  /**
   * Submit a challenge for a ticket
   * @param {string} serialNumber - Ticket serial number
   * @param {object} challengeData - Challenge data including reason and evidence
   * @returns {Promise} - Challenge submission result
   */
  submitChallenge: (serialNumber, challengeData) =>
    api.post(`/tickets/${serialNumber}/challenge`, challengeData).then(res => res.data),
  
  /**
* Get challenge status for a ticket
   * @param {string} serialNumber - Ticket serial number
   * @returns {Promise} - Challenge status
   */
  getChallengeStatus: (serialNumber) =>
    api.get(`/tickets/${serialNumber}/challenge`).then(res => res.data),

  // ============================================================================
  // OFFENCE SYSTEM - WARDEN ACCESS
  // ============================================================================

  /**
   * Get offence categories (accessible to wardens)
   * @param {Object} params - Query parameters
   * @returns {Promise} - Offence categories
   */
  getOffenceCategories: (params = {}) =>
    api.get('/offence-categories', { params }).then(res => res.data),

  /**
   * Get offences (accessible to wardens)
   * @param {Object} params - Query parameters (active, category_id)
   * @returns {Promise} - Offences
   */
  getOffences: (params = {}) =>
    api.get('/offences', { params }).then(res => res.data),

  /**
   * Calculate fine preview (uses admin endpoint)
   * @param {Object} data - Calculation data (offence_id, measured_value, is_repeat_offence)
   * @returns {Promise} - Calculated fine details
   */
  calculateFinePreview: (data) =>
    api.post('/admin/penalty-rules/calculate-preview', data).then(res => res.data),

  /**
   * Get recent tickets (accessible to wardens and admins)
   * @param {Object} params - Query parameters (per_page, page, status, etc.)
   * @returns {Promise} - Recent tickets
   */
  getRecentTickets: (params = {}) =>
    api.get('/admin/tickets', { params }).then(res => res.data),
};

export const serviceAPI = {
  getAll: () => api.get('/services').then(res => res.data),
  create: (serviceData) => api.post('/services', serviceData).then(res => res.data),
};

// Admin APIs
export const adminAPI = {
  getTickets: (params = {}) => api.get('/admin/tickets', { params }).then(res => res.data),
};

// SPI-3DS-HPP APIs
export const spiAPI = {
  /**
   * Initiate 3DS authentication via HPP
   * @param {string} serialNumber - Ticket serial number
   * @param {object} paymentData - Payment data including email and billing address
   * @returns {Promise} - Response with SpiToken and RedirectData
   */
  initiate: (serialNumber, paymentData) => 
    api.post(`/spi/initiate/${serialNumber}`, paymentData).then(res => res.data),
  
  /**
   * Complete payment after 3DS authentication
   * @param {string} spiToken - SPI Token from initiate response
   * @returns {Promise} - Payment completion response
   */
  completePayment: (spiToken) => 
    api.post('/spi/payment', { SpiToken: spiToken }).then(res => res.data),
  
  /**
   * Check status of SPI transaction/3DS authentication
   * @param {string} spiToken - SPI Token
   * @returns {Promise} - Status response
   */
  getStatus: (spiToken) => 
    api.get(`/spi/status/${spiToken}`).then(res => res.data),
  
  /**
   * HPP callback endpoint (called by backend)
   * @param {object} callbackData - Callback data from PowerTranz
   * @returns {Promise}
   */
  hppCallback: (callbackData) => 
    api.post('/spi/hpp-callback', callbackData).then(res => res.data),
};

// Helper function to handle API errors
export const handleAPIError = (error) => {
  if (error.response) {
    // Server responded with error
    const message = error.response.data?.error || error.response.data?.message || 'An error occurred';
    return {
      type: 'error',
      message: message,
      status: error.response.status,
    };
  } else if (error.request) {
    // Request made but no response
    return {
      type: 'error',
      message: 'Unable to connect to server. Please check your internet connection.',
    };
  } else {
    // Something else went wrong
    return {
      type: 'error',
      message: error.message || 'An unexpected error occurred',
    };
  }
};

export default api;

