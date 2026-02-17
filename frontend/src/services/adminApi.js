/**
 * PayFine Platform - Admin API Service
 * Handles all admin-related API calls
 */

import axios from 'axios';

// API Configuration - Use proxy in development, env var in production
const API_URL = process.env.REACT_APP_API_URL || '/api';

// Create axios instance with auth header
const getAuthHeader = () => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const adminAPI = {
  // ============================================================================
  // DASHBOARD
  // ============================================================================
  
  getDashboard: async (days = 30) => {
    const response = await axios.get(`${API_URL}/admin/dashboard`, {
      params: { days },
      headers: getAuthHeader()
    });
    return response.data;
  },

  // ============================================================================
  // TICKET MANAGEMENT
  // ============================================================================
  
  getTickets: async (params = {}) => {
    const response = await axios.get(`${API_URL}/admin/tickets`, {
      params,
      headers: getAuthHeader()
    });
    return response.data;
  },

  createTicket: async (ticketData) => {
    const response = await axios.post(`${API_URL}/admin/tickets`, ticketData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  updateTicket: async (ticketId, ticketData) => {
    const response = await axios.put(`${API_URL}/admin/tickets/${ticketId}`, ticketData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  deleteTicket: async (ticketId) => {
    const response = await axios.delete(`${API_URL}/admin/tickets/${ticketId}`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  voidTicket: async (ticketId, reason) => {
    const response = await axios.post(`${API_URL}/admin/tickets/${ticketId}/void`,
      { reason },
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  unvoidTicket: async (ticketId) => {
    const response = await axios.post(`${API_URL}/admin/tickets/${ticketId}/unvoid`, {}, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  refundTicket: async (ticketId, refundData) => {
    const response = await axios.post(`${API_URL}/admin/tickets/${ticketId}/refund`, 
      refundData,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  markTicketPaid: async (ticketId, paymentData) => {
    const response = await axios.post(`${API_URL}/admin/tickets/${ticketId}/mark-paid`, 
      paymentData,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================
  
  getUsers: async (params = {}) => {
    const response = await axios.get(`${API_URL}/admin/users`, {
      params,
      headers: getAuthHeader()
    });
    return response.data;
  },

  createUser: async (userData) => {
    const response = await axios.post(`${API_URL}/admin/users`, userData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  updateUser: async (userId, userData) => {
    const response = await axios.put(`${API_URL}/admin/users/${userId}`, userData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  deleteUser: async (userId) => {
    const response = await axios.delete(`${API_URL}/admin/users/${userId}`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  resetUserPassword: async (userId, newPassword) => {
    const response = await axios.post(`${API_URL}/admin/users/${userId}/reset-password`, 
      { new_password: newPassword },
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // ============================================================================
  // SERVICE MANAGEMENT
  // ============================================================================
  
  getServices: async (queryString = '') => {
    const response = await axios.get(`${API_URL}/admin/services${queryString}`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  createService: async (serviceData) => {
    const response = await axios.post(`${API_URL}/admin/services`, serviceData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  updateService: async (serviceId, serviceData) => {
    const response = await axios.put(`${API_URL}/admin/services/${serviceId}`, serviceData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  deleteService: async (serviceId) => {
    const response = await axios.delete(`${API_URL}/admin/services/${serviceId}`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  // ============================================================================
  // REPORTS
  // ============================================================================
  
  getPaymentReport: async (params = {}) => {
    const response = await axios.get(`${API_URL}/admin/reports/payments`, {
      params,
      headers: getAuthHeader()
    });
    return response.data;
  },

  downloadPaymentReportCSV: async (params = {}) => {
    const response = await axios.get(`${API_URL}/admin/reports/payments`, {
      params: { ...params, format: 'csv' },
      headers: getAuthHeader(),
      responseType: 'blob'
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payment_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  getRevenueReport: async (period = 'daily', days = 30) => {
    const response = await axios.get(`${API_URL}/admin/reports/revenue`, {
      params: { period, days },
      headers: getAuthHeader()
    });
    return response.data;
  },

  // ============================================================================
  // OFFENCE CATEGORY MANAGEMENT
  // ============================================================================
  
  getOffenceCategories: async (params = {}) => {
    const response = await axios.get(`${API_URL}/admin/offence-categories`, {
      params,
      headers: getAuthHeader()
    });
    return response.data;
  },

  createOffenceCategory: async (categoryData) => {
    const response = await axios.post(`${API_URL}/admin/offence-categories`, categoryData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  updateOffenceCategory: async (categoryId, categoryData) => {
    const response = await axios.put(`${API_URL}/admin/offence-categories/${categoryId}`, categoryData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  deleteOffenceCategory: async (categoryId) => {
    const response = await axios.delete(`${API_URL}/admin/offence-categories/${categoryId}`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  // ============================================================================
  // OFFENCE MANAGEMENT
  // ============================================================================
  
  getOffences: async (params = {}) => {
    const response = await axios.get(`${API_URL}/admin/offences`, {
      params,
      headers: getAuthHeader()
    });
    return response.data;
  },

  createOffence: async (offenceData) => {
    const response = await axios.post(`${API_URL}/admin/offences`, offenceData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  updateOffence: async (offenceId, offenceData) => {
    const response = await axios.put(`${API_URL}/admin/offences/${offenceId}`, offenceData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  deleteOffence: async (offenceId) => {
    const response = await axios.delete(`${API_URL}/admin/offences/${offenceId}`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  // ============================================================================
  // PENALTY RULE MANAGEMENT
  // ============================================================================
  
  getPenaltyRules: async (params = {}) => {
    const response = await axios.get(`${API_URL}/admin/penalty-rules`, {
      params,
      headers: getAuthHeader()
    });
    return response.data;
  },

  createPenaltyRule: async (ruleData) => {
    const response = await axios.post(`${API_URL}/admin/penalty-rules`, ruleData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  updatePenaltyRule: async (ruleId, ruleData) => {
    const response = await axios.put(`${API_URL}/admin/penalty-rules/${ruleId}`, ruleData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  deletePenaltyRule: async (ruleId) => {
    const response = await axios.delete(`${API_URL}/admin/penalty-rules/${ruleId}`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  calculateFinePreview: async (previewData) => {
    const response = await axios.post(`${API_URL}/admin/penalty-rules/calculate-preview`, previewData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  // ============================================================================
  // CHALLENGE MANAGEMENT
  // ============================================================================
  
  getChallenges: async (params = {}) => {
    const response = await axios.get(`${API_URL}/admin/challenges`, {
      params,
      headers: getAuthHeader()
    });
    return response.data;
  },

  getChallenge: async (challengeId) => {
    const response = await axios.get(`${API_URL}/admin/challenges/${challengeId}`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  startChallengeReview: async (challengeId) => {
    const response = await axios.post(`${API_URL}/admin/challenges/${challengeId}/review`, {}, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  dismissChallenge: async (challengeId, adminNotes) => {
    const response = await axios.post(`${API_URL}/admin/challenges/${challengeId}/dismiss`, 
      { admin_notes: adminNotes },
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  adjustChallengeFine: async (challengeId, adjustedFine, adminNotes) => {
    const response = await axios.post(`${API_URL}/admin/challenges/${challengeId}/adjust`, 
      { adjusted_fine: adjustedFine, admin_notes: adminNotes },
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  upholdChallenge: async (challengeId, adminNotes) => {
    const response = await axios.post(`${API_URL}/admin/challenges/${challengeId}/uphold`, 
      { admin_notes: adminNotes },
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // ============================================================================
  // USER PROFILE MANAGEMENT
  // ============================================================================
  
  getProfile: async () => {
    const response = await axios.get(`${API_URL}/admin/profile`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await axios.put(`${API_URL}/admin/profile`, profileData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  changePassword: async (passwordData) => {
    const response = await axios.put(`${API_URL}/admin/profile/password`, passwordData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  // ============================================================================
  // BRANDING MANAGEMENT
  // ============================================================================
  
  getBranding: async () => {
    const response = await axios.get(`${API_URL}/admin/branding`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  updateBranding: async (brandingData) => {
    const response = await axios.put(`${API_URL}/admin/branding`, brandingData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  uploadLogo: async (logoData) => {
    const response = await axios.post(`${API_URL}/admin/branding/upload-logo`,
      { logo_data: logoData },
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  uploadProfileImage: async (imageData) => {
    const response = await axios.post(`${API_URL}/admin/profile/upload-image`,
      { image_data: imageData },
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // ============================================================================
  // AI CONFIGURATION
  // ============================================================================
  
  getAIConfig: async () => {
    const response = await axios.get(`${API_URL}/admin/ai-config`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  updateAIConfig: async (config) => {
    const response = await axios.put(`${API_URL}/admin/ai-config`, config, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  testOpenAIConnection: async () => {
    const response = await axios.post(`${API_URL}/admin/ai-config/test`, {}, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  // ============================================================================
  // GAMIFICATION CONFIGURATION
  // ============================================================================

  getGamificationConfig: async () => {
    const response = await axios.get(`${API_URL}/admin/gamification/config`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  updateGamificationConfig: async (config) => {
    const response = await axios.put(`${API_URL}/admin/gamification/config`, config, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  // ============================================================================
  // PERMISSIONS & ROLES
  // ============================================================================
  
  getMyPermissions: async () => {
    const response = await axios.get(`${API_URL}/admin/permissions/me`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  getAvailableRoles: async () => {
    const response = await axios.get(`${API_URL}/admin/permissions/roles`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  getRolePermissions: async () => {
    const response = await axios.get(`${API_URL}/admin/permissions/role-permissions`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  checkPermission: async (permission) => {
    const response = await axios.post(`${API_URL}/admin/permissions/check`,
      { permission },
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // ============================================================================
  // USER PANEL ACCESS MANAGEMENT
  // ============================================================================

  getUserPanels: async (userId) => {
    const response = await axios.get(`${API_URL}/admin/users/${userId}/panels`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  updateUserPanels: async (userId, panels) => {
    const response = await axios.put(`${API_URL}/admin/users/${userId}/panels`,
      { panels },
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  resetUserPanels: async (userId) => {
    const response = await axios.post(`${API_URL}/admin/users/${userId}/panels/reset`,
      {},
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // ============================================================================
  // LATE FEE MANAGEMENT
  // ============================================================================

  getLateFeeConfig: async () => {
    const response = await axios.get(`${API_URL}/admin/late-fee-config`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  updateLateFeeConfig: async (config) => {
    const response = await axios.put(`${API_URL}/admin/late-fee-config`, config, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  getLateFeeRules: async (params = {}) => {
    const response = await axios.get(`${API_URL}/admin/late-fee-rules`, {
      params,
      headers: getAuthHeader()
    });
    return response.data;
  },

  createLateFeeRule: async (rule) => {
    const response = await axios.post(`${API_URL}/admin/late-fee-rules`, rule, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  updateLateFeeRule: async (ruleId, rule) => {
    const response = await axios.put(`${API_URL}/admin/late-fee-rules/${ruleId}`, rule, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  deleteLateFeeRule: async (ruleId) => {
    const response = await axios.delete(`${API_URL}/admin/late-fee-rules/${ruleId}`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  calculateTicketLateFee: async (ticketId) => {
    const response = await axios.post(`${API_URL}/admin/tickets/${ticketId}/calculate-late-fee`, {}, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  waiveTicketLateFee: async (ticketId, reason) => {
    const response = await axios.post(`${API_URL}/admin/tickets/${ticketId}/waive-late-fee`,
      { reason },
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  adjustTicketLateFee: async (ticketId, newAmount, reason) => {
    const response = await axios.post(`${API_URL}/admin/tickets/${ticketId}/adjust-late-fee`,
      { new_amount: newAmount, reason },
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  getTicketLateFeeHistory: async (ticketId) => {
    const response = await axios.get(`${API_URL}/admin/tickets/${ticketId}/late-fee-history`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  triggerLateFeeProcessing: async () => {
    const response = await axios.post(`${API_URL}/admin/late-fees/trigger`, {}, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  previewLateFees: async () => {
    const response = await axios.get(`${API_URL}/admin/late-fees/preview`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  // ============================================================================
  // GAMIFICATION MANAGEMENT
  // ============================================================================

  // Generic GET request for gamification endpoints
  get: async (endpoint) => {
    const response = await axios.get(`${API_URL}/admin${endpoint}`, {
      headers: getAuthHeader()
    });
    return response;
  },

  // Generic POST request for gamification endpoints
  post: async (endpoint, data = {}) => {
    const response = await axios.post(`${API_URL}/admin${endpoint}`, data, {
      headers: getAuthHeader()
    });
    return response;
  },

  // Generic PUT request for gamification endpoints
  put: async (endpoint, data = {}) => {
    const response = await axios.put(`${API_URL}/admin${endpoint}`, data, {
      headers: getAuthHeader()
    });
    return response;
  },

  // Generic DELETE request for gamification endpoints
  delete: async (endpoint) => {
    const response = await axios.delete(`${API_URL}/admin${endpoint}`, {
      headers: getAuthHeader()
    });
    return response;
  },

  // ============================================================================
  // TICKET MAP DATA
  // ============================================================================

  getTicketsMapData: async (params = {}) => {
    const response = await axios.get(`${API_URL}/admin/tickets/map-data`, {
      params,
      headers: getAuthHeader()
    });
    return response.data;
  }
};

export default adminAPI;

// Export individual functions for easier imports
export const {
  getDashboard,
  getTickets,
  createTicket,
  updateTicket,
  deleteTicket,
  voidTicket,
  unvoidTicket,
  refundTicket,
  markTicketPaid,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  getServices,
  createService,
  updateService,
  deleteService,
  getPaymentReport,
  downloadPaymentReportCSV,
  getRevenueReport,
  getOffenceCategories,
  createOffenceCategory,
  updateOffenceCategory,
  deleteOffenceCategory,
  getOffences,
  createOffence,
  updateOffence,
  deleteOffence,
  getPenaltyRules,
  createPenaltyRule,
  updatePenaltyRule,
  deletePenaltyRule,
  calculateFinePreview,
  getChallenges,
  getChallenge,
  startChallengeReview,
  dismissChallenge,
  adjustChallengeFine,
  upholdChallenge,
  getProfile,
  updateProfile,
  changePassword,
  uploadProfileImage,
  getBranding,
  updateBranding,
  uploadLogo,
  getAIConfig,
  updateAIConfig,
  testOpenAIConnection,
  getGamificationConfig,
  updateGamificationConfig,
  getMyPermissions,
  getAvailableRoles,
  getRolePermissions,
  checkPermission,
  getUserPanels,
  updateUserPanels,
  resetUserPanels,
  getLateFeeConfig,
  updateLateFeeConfig,
  getLateFeeRules,
  createLateFeeRule,
  updateLateFeeRule,
  deleteLateFeeRule,
  calculateTicketLateFee,
  waiveTicketLateFee,
  adjustTicketLateFee,
  getTicketLateFeeHistory,
  triggerLateFeeProcessing,
  previewLateFees,
  getTicketsMapData
} = adminAPI;
