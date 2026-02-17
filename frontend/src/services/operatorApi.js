/**
 * PayFine Operator API Service
 * Handles all communication with the PayFine Operator Control Panel backend
 */

const OPERATOR_API_BASE = process.env.REACT_APP_OPERATOR_API_URL || '/api/operator';

// Helper to get operator token
const getOperatorToken = () => localStorage.getItem('operator_access_token');

const getAuthHeaders = () => {
  const token = getOperatorToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * Operator Authentication
 */

// Login for PayFine HQ operators
export const operatorLogin = async (username, password) => {
  try {
    const response = await fetch(`${OPERATOR_API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Store operator token
    localStorage.setItem('operator_access_token', data.access_token);
    localStorage.setItem('operator_user', JSON.stringify(data.operator));

    return data;
  } catch (error) {
    console.error('Operator login error:', error);
    throw error;
  }
};

// Logout operator
export const operatorLogout = () => {
  localStorage.removeItem('operator_access_token');
  localStorage.removeItem('operator_user');
};

/**
 * Government Management
 */

// Get all governments
export const getGovernments = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${OPERATOR_API_BASE}/governments?${queryString}`, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch governments');
    }

    return data;
  } catch (error) {
    console.error('Get governments error:', error);
    throw error;
  }
};

// Get single government
export const getGovernment = async (governmentId) => {
  try {
    const response = await fetch(`${OPERATOR_API_BASE}/governments/${governmentId}`, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch government');
    }

    return data;
  } catch (error) {
    console.error('Get government error:', error);
    throw error;
  }
};

// Create new government
export const createGovernment = async (governmentData) => {
  try {
    const response = await fetch(`${OPERATOR_API_BASE}/governments`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(governmentData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create government');
    }

    return data;
  } catch (error) {
    console.error('Create government error:', error);
    throw error;
  }
};

// Update government
export const updateGovernment = async (governmentId, updates) => {
  try {
    const response = await fetch(`${OPERATOR_API_BASE}/governments/${governmentId}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update government');
    }

    return data;
  } catch (error) {
    console.error('Update government error:', error);
    throw error;
  }
};

// Activate government
export const activateGovernment = async (governmentId) => {
  try {
    const response = await fetch(`${OPERATOR_API_BASE}/governments/${governmentId}/activate`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to activate government');
    }

    return data;
  } catch (error) {
    console.error('Activate government error:', error);
    throw error;
  }
};

// Suspend government
export const suspendGovernment = async (governmentId, reason) => {
  try {
    const response = await fetch(`${OPERATOR_API_BASE}/governments/${governmentId}/suspend`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to suspend government');
    }

    return data;
  } catch (error) {
    console.error('Suspend government error:', error);
    throw error;
  }
};

// Reactivate government
export const reactivateGovernment = async (governmentId, reason) => {
  try {
    const response = await fetch(`${OPERATOR_API_BASE}/governments/${governmentId}/reactivate`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to reactivate government');
    }

    return data;
  } catch (error) {
    console.error('Reactivate government error:', error);
    throw error;
  }
};

/**
 * Revenue & Billing
 */

// Get revenue dashboard
export const getRevenueDashboard = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${OPERATOR_API_BASE}/revenue/dashboard?${queryString}`, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch revenue dashboard');
    }

    return data;
  } catch (error) {
    console.error('Get revenue dashboard error:', error);
    throw error;
  }
};

// Get revenue by government
export const getRevenueByGovernment = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${OPERATOR_API_BASE}/revenue/by-government?${queryString}`, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch revenue by government');
    }

    return data;
  } catch (error) {
    console.error('Get revenue by government error:', error);
    throw error;
  }
};

// Generate billing invoice
export const generateBillingInvoice = async (governmentId, billingMonth) => {
  try {
    const response = await fetch(`${OPERATOR_API_BASE}/billing/generate`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ government_id: governmentId, billing_month: billingMonth }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate billing invoice');
    }

    return data;
  } catch (error) {
    console.error('Generate billing invoice error:', error);
    throw error;
  }
};

// Export billing data
export const exportBillingData = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${OPERATOR_API_BASE}/billing/export?${queryString}`, {
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to export billing data');
    }

    // Return as blob for file download
    return await response.blob();
  } catch (error) {
    console.error('Export billing data error:', error);
    throw error;
  }
};

/**
 * Transaction Analytics
 */

// Get transaction analytics
export const getTransactionAnalytics = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${OPERATOR_API_BASE}/analytics/transactions?${queryString}`, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch transaction analytics');
    }

    return data;
  } catch (error) {
    console.error('Get transaction analytics error:', error);
    throw error;
  }
};

// Get success/failure rates
export const getSuccessRates = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${OPERATOR_API_BASE}/analytics/success-rates?${queryString}`, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch success rates');
    }

    return data;
  } catch (error) {
    console.error('Get success rates error:', error);
    throw error;
  }
};

/**
 * Compliance & Monitoring
 */

// Get SLA data
export const getSLAData = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${OPERATOR_API_BASE}/compliance/sla?${queryString}`, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch SLA data');
    }

    return data;
  } catch (error) {
    console.error('Get SLA data error:', error);
    throw error;
  }
};

// Get compliance alerts
export const getComplianceAlerts = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${OPERATOR_API_BASE}/compliance/alerts?${queryString}`, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch compliance alerts');
    }

    return data;
  } catch (error) {
    console.error('Get compliance alerts error:', error);
    throw error;
  }
};

// Get audit logs
export const getAuditLogs = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${OPERATOR_API_BASE}/audit-logs?${queryString}`, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch audit logs');
    }

    return data;
  } catch (error) {
    console.error('Get audit logs error:', error);
    throw error;
  }
};

/**
 * Feature Flags
 */

// Get feature flags for a government
export const getFeatureFlags = async (governmentId) => {
  try {
    const response = await fetch(`${OPERATOR_API_BASE}/governments/${governmentId}/features`, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch feature flags');
    }

    return data;
  } catch (error) {
    console.error('Get feature flags error:', error);
    throw error;
  }
};

// Update feature flags for a government
export const updateFeatureFlags = async (governmentId, features) => {
  try {
    const response = await fetch(`${OPERATOR_API_BASE}/governments/${governmentId}/features`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(features),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update feature flags');
    }

    return data;
  } catch (error) {
    console.error('Update feature flags error:', error);
    throw error;
  }
};

/**
 * Gamification Configuration
 */

// Get gamification configuration for a government
export const getGamificationConfig = async (governmentId) => {
  try {
    const response = await fetch(`${OPERATOR_API_BASE}/governments/${governmentId}/gamification`, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch gamification config');
    }

    return data;
  } catch (error) {
    console.error('Get gamification config error:', error);
    throw error;
  }
};

// Update gamification configuration for a government
export const updateGamificationConfig = async (governmentId, config) => {
  try {
    const response = await fetch(`${OPERATOR_API_BASE}/governments/${governmentId}/gamification`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update gamification config');
    }

    return data;
  } catch (error) {
    console.error('Update gamification config error:', error);
    throw error;
  }
};

/**
 * Government Profile Management
 */

// Update comprehensive government profile
export const updateGovernmentProfile = async (governmentId, profileData) => {
  try {
    const response = await fetch(`${OPERATOR_API_BASE}/governments/${governmentId}/profile`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update government profile');
    }

    return data;
  } catch (error) {
    console.error('Update government profile error:', error);
    throw error;
  }
};

export default {
  operatorLogin,
  operatorLogout,
  getGovernments,
  getGovernment,
  createGovernment,
  updateGovernment,
  updateGovernmentProfile,
  activateGovernment,
  suspendGovernment,
  reactivateGovernment,
  getRevenueDashboard,
  getRevenueByGovernment,
  generateBillingInvoice,
  exportBillingData,
  getTransactionAnalytics,
  getSuccessRates,
  getSLAData,
  getComplianceAlerts,
  getAuditLogs,
  getFeatureFlags,
  updateFeatureFlags,
  getGamificationConfig,
  updateGamificationConfig,
};
