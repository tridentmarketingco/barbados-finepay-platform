/**
 * Header Component - Dynamic branding header
 * Fetches branding from backend and displays logo, platform name, and tagline
 * Fully responsive design with theme toggle support
 */

import React from 'react';
import { useBranding } from '../../contexts/BrandingContext';
import ThemeToggle from './ThemeToggle';
import './Header.css';

function Header() {
  const { branding, loading } = useBranding();

  if (loading) {
    return (
      <header className="app-header">
        <div className="container">
          <div className="header-content">
            <div className="logo-section">
              <div className="loading-placeholder"></div>
            </div>
            <div className="header-actions">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="app-header">
      <div className="container">
        <div className="header-content">
          <div className="logo-section">
            <img 
              src={branding.logo_url || '/logo.svg'} 
              alt={`${branding.platform_name} Logo`}
              className="header-logo"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/logo.svg';
              }}
            />
            <div className="header-text">
              <h1>{branding.platform_name || 'PayFine'}</h1>
              {branding.tagline && (
                <p className="tagline">{branding.tagline}</p>
              )}
            </div>
          </div>
          <div className="header-actions">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
