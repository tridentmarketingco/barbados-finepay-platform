/**
 * Admin Layout Component
 * Main layout for admin panel with navigation
 * Now with role-based access control
 */

import React, { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { Sun, Moon, Settings, LogOut } from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import TicketManagement from './TicketManagement';
import TicketMap from './TicketMap';
import UserManagement from './UserManagement';
import ServiceManagement from './ServiceManagement';
import Reports from './Reports';
import OffenceCategories from './OffenceCategories';
import OffenceManagement from './OffenceManagement';
import PenaltyRules from './PenaltyRules';
import ChallengeReview from './ChallengeReview';
import CompanySettings from './CompanySettings';
import AIInsights from './AIInsights';
import LateFeeSettings from './LateFeeSettings';
import LateFeeRules from './LateFeeRules';
import { getMyPermissions } from '../../services/adminApi';
import { useBranding } from '../../contexts/BrandingContext';
import '../../styles/Admin.css';
import '../../styles/HamburgerMenuFix.css';

function AdminLayout({ onLogout, user }) {
  const { branding } = useBranding();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accessiblePanels, setAccessiblePanels] = useState([]);
const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage first, then system preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const profileDropdownRef = useRef(null);

  // Check if user has any admin panel access (not just full admin)
  const hasAdminAccess = user?.is_admin === true || 
                         user?.role === 'admin' || 
                         user?.role === 'super_admin' ||
                         user?.role === 'ticket_manager' ||
                         user?.role === 'challenge_reviewer' ||
                         user?.role === 'finance_manager' ||
                         user?.role === 'offence_manager' ||
                         user?.role === 'user_manager' ||
                         user?.role === 'viewer';
  
  // Check if user is full admin (for fallback permissions)
  const isAdmin = user?.is_admin === true || user?.role === 'admin' || user?.role === 'super_admin';

  // Fetch user permissions on mount
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const response = await getMyPermissions();
        setAccessiblePanels(response.accessible_panels || []);
        setPermissions(response.permissions || []);
        
        // Set initial active tab to first accessible panel
        if (response.accessible_panels && response.accessible_panels.length > 0) {
          setActiveTab(response.accessible_panels[0]);
        }
      } catch (error) {
        console.error('Failed to fetch permissions:', error);
        // Fallback for admins
        if (isAdmin) {
          setAccessiblePanels([
            'dashboard', 'ai-insights', 'tickets', 'offence-categories',
            'offences', 'penalty-rules', 'challenges', 'late-fees', 
            'late-fee-rules', 'users', 'services', 'reports', 'settings'
          ]);
        }
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchPermissions();
    }
  }, [user, isAdmin]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle theme changes
  useEffect(() => {
    const html = document.documentElement;
    if (isDarkMode) {
      html.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode]);

// Handle theme toggle
  const toggleTheme = (dark) => {
    setIsDarkMode(dark);
    setShowProfileDropdown(false);
  };

  // Initialize theme on mount
  useEffect(() => {
    const html = document.documentElement;
    if (isDarkMode) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, []);

  // Check if user can access a specific panel
  const canAccessPanel = (panel) => {
    if (isAdmin) return true; // Full admins can access everything
    return accessiblePanels.includes(panel);
  };

  // Handle profile dropdown toggle
  const toggleProfileDropdown = (e) => {
    e.stopPropagation();
    setShowProfileDropdown(!showProfileDropdown);
  };

  // Handle settings navigation
  const handleSettingsClick = () => {
    setShowProfileDropdown(false);
    setSidebarOpen(false);
    if (canAccessPanel('settings')) {
      setActiveTab('settings');
    } else {
      alert('You do not have permission to access Settings');
    }
  };

  // Handle logout
  const handleLogoutClick = () => {
    setShowProfileDropdown(false);
    onLogout();
  };

  const handleNavClick = (tab) => {
    // Check if user can access this panel
    if (!canAccessPanel(tab)) {
      alert('You do not have permission to access this panel');
      return;
    }
    setActiveTab(tab);
    setSidebarOpen(false); // Close sidebar on mobile after selection
  };

  // Authentication checks (after all hooks are defined)
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Show loading state while fetching permissions
  if (loading) {
    return (
      <div className="admin-layout">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Checking your permissions...</p>
        </div>
      </div>
    );
  }

  // Check if user has access to admin panel at all
  if (!hasAdminAccess) {
    return (
      <div className="admin-layout">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>⛔ Access Denied</h2>
          <p>You do not have permission to access the Admin Panel.</p>
          <p>Please contact your administrator for access.</p>
          <button onClick={onLogout} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // Check if user has access to any panels (after permissions are loaded)
  if (!loading && accessiblePanels.length === 0 && !isAdmin) {
    return (
      <div className="admin-layout">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>⛔ No Panels Available</h2>
          <p>Your role does not have access to any admin panels.</p>
          <p>Please contact your administrator if you believe this is an error.</p>
          <button onClick={onLogout} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'ai-insights':
        return <AIInsights />;
      case 'tickets':
        return <TicketManagement />;
      case 'ticket-map':
        return <TicketMap />;
      case 'users':
        return <UserManagement />;
      case 'services':
        return <ServiceManagement />;
      case 'reports':
        return <Reports />;
      case 'offence-categories':
        return <OffenceCategories />;
      case 'offences':
        return <OffenceManagement />;
      case 'penalty-rules':
        return <PenaltyRules />;
      case 'challenges':
        return <ChallengeReview />;
      case 'settings':
        return <CompanySettings />;
      case 'late-fees':
        return <LateFeeSettings />;
      case 'late-fee-rules':
        return <LateFeeRules />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="admin-layout">
      {/* Mobile Header - Sticky */}
      <header className="admin-mobile-header">
        <div className="mobile-header-content">
          <div className="mobile-logo">
            <span className="logo-icon">🔐</span>
            <span className="logo-text">Admin Panel</span>
          </div>
          <button 
            className="mobile-menu-toggle" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* Sidebar Overlay for Mobile */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Sidebar Navigation */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <img src={branding.logo_url} alt={`${branding.platform_name} Logo`} className="header-logo" />
            <div className="header-text">
              <h1>{branding.platform_name}</h1>
            </div>
          </div>
        </div>

        <nav className="admin-nav">
          {canAccessPanel('dashboard') && (
            <button
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleNavClick('dashboard')}
            >
              <span className="nav-icon">📊</span>
              <span className="nav-label">Dashboard</span>
            </button>
          )}

          {canAccessPanel('tickets') && (
            <button
              className={`nav-item ${activeTab === 'tickets' ? 'active' : ''}`}
              onClick={() => handleNavClick('tickets')}
            >
              <span className="nav-icon">🎫</span>
              <span className="nav-label">Tickets</span>
            </button>
          )}

          {canAccessPanel('tickets') && (
            <button
              className={`nav-item ${activeTab === 'ticket-map' ? 'active' : ''}`}
              onClick={() => handleNavClick('ticket-map')}
            >
              <span className="nav-icon">🗺️</span>
              <span className="nav-label">Ticket Map</span>
            </button>
          )}

          {(canAccessPanel('offence-categories') || canAccessPanel('offences') || canAccessPanel('penalty-rules') || canAccessPanel('challenges')) && (
            <div className="nav-divider"></div>
          )}

          {canAccessPanel('offence-categories') && (
            <button
              className={`nav-item ${activeTab === 'offence-categories' ? 'active' : ''}`}
              onClick={() => handleNavClick('offence-categories')}
            >
              <span className="nav-icon">📋</span>
              <span className="nav-label">Categories</span>
            </button>
          )}

          {canAccessPanel('offences') && (
            <button
              className={`nav-item ${activeTab === 'offences' ? 'active' : ''}`}
              onClick={() => handleNavClick('offences')}
            >
              <span className="nav-icon">⚖️</span>
              <span className="nav-label">Offences</span>
            </button>
          )}

          {canAccessPanel('penalty-rules') && (
            <button
              className={`nav-item ${activeTab === 'penalty-rules' ? 'active' : ''}`}
              onClick={() => handleNavClick('penalty-rules')}
            >
              <span className="nav-icon">💰</span>
              <span className="nav-label">Penalty Rules</span>
            </button>
          )}

          {canAccessPanel('challenges') && (
            <button
              className={`nav-item ${activeTab === 'challenges' ? 'active' : ''}`}
              onClick={() => handleNavClick('challenges')}
            >
              <span className="nav-icon">⚖️</span>
              <span className="nav-label">Challenges</span>
            </button>
          )}

          {(canAccessPanel('late-fees') || canAccessPanel('late-fee-rules')) && (
            <div className="nav-divider"></div>
          )}

          {canAccessPanel('late-fees') && (
            <button
              className={`nav-item ${activeTab === 'late-fees' ? 'active' : ''}`}
              onClick={() => handleNavClick('late-fees')}
            >
              <span className="nav-icon">💰</span>
              <span className="nav-label">Late Fee Config</span>
            </button>
          )}

          {canAccessPanel('late-fee-rules') && (
            <button
              className={`nav-item ${activeTab === 'late-fee-rules' ? 'active' : ''}`}
              onClick={() => handleNavClick('late-fee-rules')}
            >
              <span className="nav-icon">📋</span>
              <span className="nav-label">Late Fee Rules</span>
            </button>
          )}

          {(canAccessPanel('users') || canAccessPanel('services') || canAccessPanel('reports') || canAccessPanel('settings')) && (
            <div className="nav-divider"></div>
          )}

          {canAccessPanel('users') && (
            <button
              className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => handleNavClick('users')}
            >
              <span className="nav-icon">👥</span>
              <span className="nav-label">Users</span>
            </button>
          )}

          {canAccessPanel('services') && (
            <button
              className={`nav-item ${activeTab === 'services' ? 'active' : ''}`}
              onClick={() => handleNavClick('services')}
            >
              <span className="nav-icon">🗂️</span>
              <span className="nav-label">Services</span>
            </button>
          )}

          {canAccessPanel('reports') && (
            <button
              className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => handleNavClick('reports')}
            >
              <span className="nav-icon">📈</span>
              <span className="nav-label">Reports</span>
            </button>
          )}

          <div className="nav-divider"></div>

          {canAccessPanel('ai-insights') && (
            <button
              className={`nav-item ${activeTab === 'ai-insights' ? 'active' : ''}`}
              onClick={() => handleNavClick('ai-insights')}
            >
              <span className="nav-icon">🤖</span>
              <span className="nav-label">AI Insights</span>
            </button>
          )}

        </nav>

        {/* Profile Widget */}
        <div className="profile-widget" ref={profileDropdownRef}>
          <div className="profile-container" onClick={toggleProfileDropdown}>
            <div className="profile-avatar">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="profile-info">
              <p className="profile-greeting">Welcome back</p>
              <p className="profile-name">{user?.username || 'User'}</p>
            </div>
            <div className={`profile-dropdown-icon ${showProfileDropdown ? 'open' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          
{/* Profile Dropdown Menu */}
          {showProfileDropdown && (
            <div className="profile-dropdown-menu">
              {/* Theme Toggle Section */}
              <div className="profile-dropdown-theme-section">
                <span className="profile-dropdown-theme-label">Theme</span>
                <div className="profile-dropdown-theme-buttons">
                  <button 
                    className={`profile-dropdown-theme-btn ${!isDarkMode ? 'active' : ''}`}
                    onClick={() => toggleTheme(false)}
                    title="Light Mode"
                  >
                    <Sun size={16} />
                    <span>Light</span>
                  </button>
                  <button 
                    className={`profile-dropdown-theme-btn ${isDarkMode ? 'active' : ''}`}
                    onClick={() => toggleTheme(true)}
                    title="Dark Mode"
                  >
                    <Moon size={16} />
                    <span>Dark</span>
                  </button>
                </div>
              </div>
              <div className="profile-dropdown-divider"></div>
              <button className="profile-dropdown-item" onClick={handleSettingsClick}>
                <Settings size={18} />
                <span>Settings</span>
              </button>
              <div className="profile-dropdown-divider"></div>
              <button className="profile-dropdown-item logout" onClick={handleLogoutClick}>
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        {renderContent()}
      </main>
    </div>
  );
}

export default AdminLayout;
