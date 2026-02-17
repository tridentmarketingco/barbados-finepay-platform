/**
 * AI Analytics API Service
 * Handles all AI-powered insights and predictions
 */

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Create axios instance with auth token
const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const aiApi = {
  /**
   * Get comprehensive AI dashboard
   * @param {number} days - Analysis period in days
   * @returns {Promise} Dashboard data with all AI insights
   */
  getDashboard: async (days = 30) => {
    const response = await axios.get(`${API_URL}/api/ai/insights/dashboard`, {
      params: { days },
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Get ticket volume forecast
   * @param {number} daysAhead - Days to forecast
   * @param {number} lookbackDays - Historical days to analyze
   * @returns {Promise} Ticket volume predictions
   */
  forecastTickets: async (daysAhead = 30, lookbackDays = 90) => {
    const response = await axios.get(`${API_URL}/api/ai/predictions/tickets`, {
      params: { days_ahead: daysAhead, lookback_days: lookbackDays },
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Get revenue forecast
   * @param {number} daysAhead - Days to forecast
   * @param {number} lookbackDays - Historical days to analyze
   * @returns {Promise} Revenue predictions
   */
  forecastRevenue: async (daysAhead = 30, lookbackDays = 90) => {
    const response = await axios.get(`${API_URL}/api/ai/predictions/revenue`, {
      params: { days_ahead: daysAhead, lookback_days: lookbackDays },
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Get geographic hotspots
   * @param {number} days - Analysis period
   * @param {number} minTickets - Minimum tickets to qualify
   * @returns {Promise} Hotspot locations with patterns
   */
  getHotspots: async (days = 30, minTickets = 5) => {
    const response = await axios.get(`${API_URL}/api/ai/hotspots`, {
      params: { days, min_tickets: minTickets },
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Get detected anomalies
   * @param {number} days - Analysis period
   * @returns {Promise} List of anomalies with severity
   */
  getAnomalies: async (days = 30) => {
    const response = await axios.get(`${API_URL}/api/ai/anomalies`, {
      params: { days },
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Get smart recommendations
   * @returns {Promise} AI-generated recommendations
   */
  getRecommendations: async () => {
    const response = await axios.get(`${API_URL}/api/ai/recommendations`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Get payment risk assessment for a ticket
   * @param {number} ticketId - Ticket ID
   * @returns {Promise} Risk score and factors
   */
  assessPaymentRisk: async (ticketId) => {
    const response = await axios.get(`${API_URL}/api/ai/risk-assessment/${ticketId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Get executive summary
   * @param {number} days - Analysis period
   * @returns {Promise} Natural language summary
   */
  getExecutiveSummary: async (days = 30) => {
    const response = await axios.get(`${API_URL}/api/ai/executive-summary`, {
      params: { days },
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Get time-based patterns
   * @param {number} days - Analysis period
   * @returns {Promise} Peak hours and day-of-week patterns
   */
  getTimePatterns: async (days = 30) => {
    const response = await axios.get(`${API_URL}/api/ai/patterns/time`, {
      params: { days },
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Get officer performance insights
   * @param {number} days - Analysis period
   * @returns {Promise} Officer statistics and performance
   */
  getOfficerInsights: async (days = 30) => {
    const response = await axios.get(`${API_URL}/api/ai/officer-insights`, {
      params: { days },
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Health check for AI service
   * @returns {Promise} Service health status
   */
  healthCheck: async () => {
    const response = await axios.get(`${API_URL}/api/ai/health`);
    return response.data;
  }
};

export default aiApi;
