/**
 * Branding Context - Manages platform branding globally
 * Fetches branding from backend and provides to all components
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import { publicAPI } from '../services/api';

const BrandingContext = createContext();

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState({
    logo_url: '/logo.svg',
    primary_color: '#003f87',
    secondary_color: '#ffc72c',
    platform_name: 'PayFine',
    font_family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch branding from backend
  const fetchBranding = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch branding from public endpoint
      const response = await publicAPI.get('/branding');
      
      if (response.data && response.data.branding) {
        setBranding({
          logo_url: response.data.branding.logo_url || '/logo.svg',
          primary_color: response.data.branding.primary_color || '#003f87',
          secondary_color: response.data.branding.secondary_color || '#ffc72c',
          platform_name: response.data.branding.platform_name || 'PayFine',
          font_family: response.data.branding.font_family || 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        });
      }
    } catch (err) {
      console.warn('Failed to fetch branding, using defaults:', err.message);
      // Keep default branding on error
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Refresh branding (called after admin updates)
  const refreshBranding = () => {
    fetchBranding();
  };

  // Update branding locally (optimistic update)
  const updateBranding = (newBranding) => {
    setBranding(prev => ({
      ...prev,
      ...newBranding
    }));
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  // Apply CSS custom properties for dynamic theming
  useEffect(() => {
    if (branding.primary_color) {
      document.documentElement.style.setProperty('--primary-blue', branding.primary_color);
    }
    if (branding.secondary_color) {
      document.documentElement.style.setProperty('--primary-gold', branding.secondary_color);
    }
    if (branding.font_family) {
      document.documentElement.style.setProperty('--font-family', branding.font_family);
    }
  }, [branding.primary_color, branding.secondary_color, branding.font_family]);

  const value = {
    branding,
    loading,
    error,
    refreshBranding,
    updateBranding
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
};

export default BrandingContext;
