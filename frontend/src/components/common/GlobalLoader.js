/**
 * Global Loader Component
 * Shows a full-screen loading overlay during global operations like login
 */

import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/Admin.css'; // Using Admin.css for consistent styling

function GlobalLoader() {
  const { globalLoading } = useAuth();

  if (!globalLoading) {
    return null;
  }

  return (
    <div className="global-loader-overlay">
      <div className="global-loader-content">
        <div className="loading-spinner"></div>
        <p>Signing you in...</p>
      </div>
    </div>
  );
}

export default GlobalLoader;
