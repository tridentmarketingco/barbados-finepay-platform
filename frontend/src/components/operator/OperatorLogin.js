/**
 * PayFine Operator Login Component
 * Authentication for PayFine HQ operators
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { operatorLogin } from '../../services/operatorApi';
import '../../styles/Operator.css';

function OperatorLogin() {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await operatorLogin(credentials.username, credentials.password);
      navigate('/operator/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="operator-login">
      <div className="login-container">
        <div className="login-header">
          <h1>PayFine</h1>
          <h2>Operator Control Panel</h2>
          <p>Access the global government management system</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              placeholder="Enter your username"
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
              value={credentials.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn-primary login-btn"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <p>Demo Credentials:</p>
          <div className="demo-credentials">
            <div className="credential-item">
              <strong>Super Admin:</strong> superadmin@payfine.com / admin123
            </div>
            <div className="credential-item">
              <strong>Finance:</strong> finance@payfine.com / finance123
            </div>
            <div className="credential-item">
              <strong>Support:</strong> support@payfine.com / support123
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OperatorLogin;
