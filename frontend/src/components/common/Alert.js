/**
 * Alert - Reusable Alert/Notification Component
 * Provides consistent alert messaging across the app
 */

import React from 'react';
import './Alert.css';

const Alert = ({
  type = 'info',
  title,
  message,
  children,
  icon,
  onClose,
  className = '',
  ...props
}) => {
  const getDefaultIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const alertClasses = [
    'alert',
    `alert-${type}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={alertClasses} role="alert" {...props}>
      <span className="alert-icon">{icon || getDefaultIcon()}</span>
      
      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        {message && <div className="alert-message">{message}</div>}
        {children && <div className="alert-body">{children}</div>}
      </div>

      {onClose && (
        <button
          className="alert-close"
          onClick={onClose}
          aria-label="Close alert"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default Alert;
