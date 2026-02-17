/**
 * ProtectedRoute - Route Guard Component
 * Protects routes that require authentication and specific roles
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ 
  children, 
  requireAuth = true,
  requireAdmin = false,
  requireOperator = false,
  requiredRole = null,
  redirectTo = '/'
}) => {
  const { isAuthenticated, user, loading, isAdmin, isOperator } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="route-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Check if authentication is required
  if (requireAuth && !isAuthenticated) {
    // Redirect to login, but save the attempted location
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check if admin access is required
  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check if operator access is required
  if (requireOperator && !isOperator()) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check if specific role is required
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  // All checks passed, render the protected content
  return children;
};

export default ProtectedRoute;
