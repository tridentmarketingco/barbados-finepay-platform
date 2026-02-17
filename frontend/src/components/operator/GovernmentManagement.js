/**
 * PayFine Agency Management Component
 * Create, view, and manage agency tenants
 */

import React, { useState, useEffect } from 'react';
import { getGovernments, createGovernment, updateGovernment, activateGovernment, suspendGovernment, reactivateGovernment, getGovernment } from '../../services/operatorApi';
import GovernmentProfile from './GovernmentProfile';
import '../../styles/Operator.css';

function GovernmentManagement() {
  const [governments, setGovernments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGov, setSelectedGov] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editingGovId, setEditingGovId] = useState(null);
  const [formData, setFormData] = useState(initialFormData());

  useEffect(() => {
    loadGovernments();
  }, []);

  const loadGovernments = async () => {
    try {
      const data = await getGovernments();
      setGovernments(data.governments || []);
    } catch (error) {
      console.error('Failed to load agencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createGovernment(formData);
      setShowForm(false);
      setFormData(initialFormData());
      loadGovernments();
    } catch (error) {
      console.error('Failed to create agency:', error);
      alert('Error: ' + (error.message || 'Failed to create agency'));
    }
  };

  const handleActivate = async (id) => {
    try {
      await activateGovernment(id);
      loadGovernments();
    } catch (error) {
      console.error('Failed to activate agency:', error);
    }
  };

  const handleSuspend = async (id) => {
    try {
      await suspendGovernment(id, 'Suspended by operator');
      loadGovernments();
    } catch (error) {
      console.error('Failed to suspend agency:', error);
    }
  };

  const handleReactivate = async (id) => {
    try {
      await reactivateGovernment(id, 'Reactivated by operator');
      loadGovernments();
    } catch (error) {
      console.error('Failed to reactivate agency:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading agencies...</div>;
  }

  return (
    <div className="government-management">
      <div className="page-header">
        <h2>Agency Management</h2>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Add Agency
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create New Agency</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Agency Name</label>
                <input
                  type="text"
                  value={formData.government_name}
                  onChange={e => setFormData({...formData, government_name: e.target.value})}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Country Name</label>
                  <input
                    type="text"
                    value={formData.country_name}
                    onChange={e => setFormData({...formData, country_name: e.target.value})}
                    required
                  />
                </div>
              <div className="form-group">
                  <label>ISO Code (2 chars)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={formData.country_iso_code}
                    onChange={e => setFormData({...formData, country_iso_code: e.target.value.toUpperCase()})}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Currency Code (3 chars)</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={formData.currency_code}
                    onChange={e => setFormData({...formData, currency_code: e.target.value.toUpperCase()})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Timezone</label>
                  <select
                    value={formData.timezone}
                    onChange={e => setFormData({...formData, timezone: e.target.value})}
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/Port_of_Spain">America/Port_of_Spain</option>
                    <option value="America/Jamaica">America/Jamaica</option>
                    <option value="America/Barbados">America/Barbados</option>
                    <option value="Europe/London">Europe/London</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Subdomain</label>
                <input
                  type="text"
                  value={formData.subdomain}
                  onChange={e => setFormData({...formData, subdomain: e.target.value.toLowerCase()})}
                  placeholder="e.g., barbados, trinidad"
                />
              </div>
              <div className="form-group">
                <label>Contact Email</label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={e => setFormData({...formData, contact_email: e.target.value})}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Agency
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="governments-grid">
        {governments.map(gov => (
          <div key={gov.id} className={`government-card ${gov.status}`}>
            <div className="card-header">
              <h4>{gov.government_name}</h4>
              <span className={`status-badge ${gov.status}`}>{gov.status}</span>
            </div>
            <div className="card-body">
              <p><strong>Country:</strong> {gov.country_name} ({gov.country_iso_code})</p>
              <p><strong>Currency:</strong> {gov.currency_code}</p>
              <p><strong>Timezone:</strong> {gov.timezone}</p>
              <p><strong>Created:</strong> {new Date(gov.created_at).toLocaleDateString()}</p>
              <p><strong>Subdomain:</strong> {gov.subdomain || 'Not set'}</p>
            </div>
            <div className="card-actions">
              <button 
                className="btn-primary" 
                onClick={() => {
                  setEditingGovId(gov.id);
                  setShowProfile(true);
                }}
              >
                Edit Profile
              </button>
              {gov.status === 'pilot' && (
                <button className="btn-success" onClick={() => handleActivate(gov.id)}>
                  Activate
                </button>
              )}
              {gov.status === 'active' && (
                <button className="btn-warning" onClick={() => handleSuspend(gov.id)}>
                  Suspend
                </button>
              )}
              {gov.status === 'suspended' && (
                <button className="btn-success" onClick={() => handleReactivate(gov.id)}>
                  Reactivate
                </button>
              )}
              <button className="btn-secondary" onClick={() => setSelectedGov(gov)}>
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {showProfile && editingGovId && (
        <GovernmentProfile
          governmentId={editingGovId}
          onClose={() => {
            setShowProfile(false);
            setEditingGovId(null);
          }}
          onUpdate={(updatedGov) => {
            loadGovernments();
            setShowProfile(false);
            setEditingGovId(null);
          }}
        />
      )}

      {selectedGov && (
        <div className="modal-overlay" onClick={() => setSelectedGov(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Agency Details</h3>
            <div className="details-grid">
              <div className="detail-item">
                <label>ID</label>
                <p>{selectedGov.id}</p>
              </div>
              <div className="detail-item">
                <label>Name</label>
                <p>{selectedGov.government_name}</p>
              </div>
              <div className="detail-item">
                <label>Country</label>
                <p>{selectedGov.country_name}</p>
              </div>
              <div className="detail-item">
                <label>ISO Code</label>
                <p>{selectedGov.country_iso_code}</p>
              </div>
              <div className="detail-item">
                <label>Currency</label>
                <p>{selectedGov.currency_code}</p>
              </div>
              <div className="detail-item">
                <label>Timezone</label>
                <p>{selectedGov.timezone}</p>
              </div>
              <div className="detail-item">
                <label>Status</label>
                <p>{selectedGov.status}</p>
              </div>
              <div className="detail-item">
                <label>Created</label>
                <p>{new Date(selectedGov.created_at).toLocaleString()}</p>
              </div>
            </div>
            <button className="btn-secondary" onClick={() => setSelectedGov(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function initialFormData() {
  return {
    government_name: '',
    country_name: '',
    country_iso_code: '',
    currency_code: '',
    timezone: 'UTC',
    subdomain: '',
    contact_email: '',
    payment_gateway_type: 'powertranz'
  };
}

export default GovernmentManagement;
