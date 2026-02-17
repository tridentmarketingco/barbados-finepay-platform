/**
 * PayFine Platform - Login Component
 * Handles user authentication with username/password
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { handleAPIError } from '../services/api';

function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);

    try {
      const result = await login(formData);

      if (result.success) {
        // Call parent callback if provided
        if (onLoginSuccess) {
          onLoginSuccess(result.user);
        }

        setAlert({
          type: 'success',
          message: `Welcome back, ${result.user.username}!`
        });

        // Redirect based on role
        setTimeout(() => {
          // Wardens go to dedicated Warden Portal (not admin panel)
          if (result.user.role === 'warden' || result.user.role === 'staff') {
            navigate('/warden');
          }
          // All other roles go to admin panel with role-based tab visibility
          else {
            navigate('/admin');
          }
        }, 1000);
      } else {
        setAlert({
          type: 'error',
          message: result.error
        });
      }
    } catch (error) {
      const errorInfo = handleAPIError(error);
      setAlert(errorInfo);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>🔐 Secure Login</h2>
        <p>Please enter your credentials to access the PayFine Platform</p>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          <span className="alert-icon">
            {alert.type === 'success' ? '✅' : '❌'}
          </span>
          <div className="alert-content">
            <p>{alert.message}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">Username or Email</label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            placeholder="Enter your username or email"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Enter your password"
            required
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="loading"></span>
              Signing In...
            </>
          ) : (
            <>
              🔐 Sign In
            </>
          )}
        </button>
      </form>

      <div className="card" style={{ marginTop: '2rem', background: 'var(--bg-secondary)' }}>
        <div className="card-header">
          <h3 style={{ color: 'white' }}>🧪 Demo Credentials</h3>
          <p style={{ color: 'white' }}>For demonstration purposes only:</p>
        </div>
        <div style={{ padding: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <strong>Government Admin:</strong> govadmin / admin123
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <strong>Warden:</strong> warden1 / warden123
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ⚠️ Remember to change default passwords in production!
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', textAlign: 'center', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px' }}>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--primary-blue)' }}>
          <strong>🔧 Platform Operator?</strong>
        </p>
        <p style={{ margin: '0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Platform administrators should use the{' '}
          <a href="/operator/login" style={{ color: 'var(--primary-blue)', textDecoration: 'underline' }}>
            Operator Login Page
          </a>
        </p>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          🔒 Your login credentials are encrypted and secure.
          <br />
          This platform uses JWT authentication for maximum security.
        </p>
      </div>
    </div>
  );
}

export default Login;
