/**
 * Offence Management Component
 * Allows admins to manage specific traffic offences
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';
import '../../styles/Admin.css';

function OffenceManagement() {
  const [offences, setOffences] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingOffence, setEditingOffence] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category_id: '',
    description: '',
    measurable_type: 'none',
    unit: '',
    active: true
  });

  useEffect(() => {
    loadCategories();
    loadOffences();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await adminAPI.getOffenceCategories({ active: true });
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadOffences = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {};
      if (filterCategory) {
        params.category_id = filterCategory;
      }
      if (filterActive !== 'all') {
        params.active = filterActive === 'true';
      }
      if (searchTerm) {
        params.search = searchTerm;
      }

      const data = await adminAPI.getOffences(params);
      setOffences(data.offences || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load offences');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadOffences();
  };

  const handleCreate = () => {
    setEditingOffence(null);
    setFormData({
      code: '',
      name: '',
      category_id: '',
      description: '',
      measurable_type: 'none',
      unit: '',
      active: true
    });
    setShowModal(true);
  };

  const handleEdit = (offence) => {
    setEditingOffence(offence);
    setFormData({
      code: offence.code,
      name: offence.name,
      category_id: offence.category_id,
      description: offence.description || '',
      measurable_type: offence.measurable_type || 'none',
      unit: offence.unit || '',
      active: offence.active
    });
    setShowModal(true);
  };

  const handleDelete = async (offence) => {
    if (!window.confirm(`Are you sure you want to deactivate the offence "${offence.name}"?`)) {
      return;
    }

    try {
      await adminAPI.deleteOffence(offence.id);
      loadOffences();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete offence');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      if (editingOffence) {
        await adminAPI.updateOffence(editingOffence.id, formData);
      } else {
        await adminAPI.createOffence(formData);
      }
      
      setShowModal(false);
      loadOffences();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save offence');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const getMeasurableTypeLabel = (type) => {
    const labels = {
      'none': 'Fixed',
      'speed': 'Speed',
      'alcohol': 'Alcohol (%BAC)',
      'distance': 'Distance (m)'
    };
    return labels[type] || type;
  };

  if (loading && offences.length === 0) {
    return (
      <div className="admin-section">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading offences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="section-header">
        <h1>⚖️ Offence Management</h1>
        <button onClick={handleCreate} className="btn btn-primary">
          ➕ Create Offence
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="search-input"
          />
          <button onClick={handleSearch} className="btn btn-secondary">
            🔍 Search
          </button>
        </div>

        <div className="filter-group">
          <label>Category:</label>
          <select 
            value={filterCategory} 
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setTimeout(loadOffences, 100);
            }}
            className="filter-select"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select 
            value={filterActive} 
            onChange={(e) => {
              setFilterActive(e.target.value);
              setTimeout(loadOffences, 100);
            }}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Offences Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Type</th>
              <th>Unit</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {offences.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">
                  No offences found
                </td>
              </tr>
            ) : (
              offences.map((offence) => (
                <tr key={offence.id}>
                  <td><code>{offence.code}</code></td>
                  <td><strong>{offence.name}</strong></td>
                  <td>{offence.category?.name || 'N/A'}</td>
                  <td>
                    <span className={`type-badge ${offence.measurable_type}`}>
                      {getMeasurableTypeLabel(offence.measurable_type)}
                    </span>
                  </td>
                  <td>{offence.unit || '-'}</td>
                  <td>
                    <span className={`status-badge ${offence.active ? 'active' : 'inactive'}`}>
                      {offence.active ? '✓ Active' : '✗ Inactive'}
                    </span>
                  </td>
                  <td className="actions">
                    <button 
                      onClick={() => handleEdit(offence)}
                      className="btn btn-sm btn-secondary"
                      title="Edit"
                    >
                      ✏️ Edit
                    </button>
                    {offence.active && (
                      <button 
                        onClick={() => handleDelete(offence)}
                        className="btn btn-sm btn-danger"
                        title="Deactivate"
                      >
                        🗑️ Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingOffence ? 'Edit Offence' : 'Create Offence'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="close-btn">×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Code *</label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  placeholder="e.g., SPEED_11_20"
                  required
                  disabled={editingOffence !== null}
                  className="form-input"
                />
                <small>Unique identifier (uppercase, underscores allowed)</small>
              </div>

              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Speeding 11-20 km/h over limit"
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Category *</label>
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleInputChange}
                  required
                  className="form-input"
                >
                  <option value="">Select a category...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Measurable Type *</label>
                <select
                  name="measurable_type"
                  value={formData.measurable_type}
                  onChange={handleInputChange}
                  className="form-input"
                >
                  <option value="none">Fixed (no measurement)</option>
                  <option value="speed">Speed</option>
                  <option value="alcohol">Alcohol (BAC)</option>
                  <option value="distance">Distance</option>
                </select>
                <small>
                  {formData.measurable_type === 'none' 
                    ? 'Fixed offence with no variable measurement'
                    : 'Offence with measurable criteria (e.g., speed over limit)'}
                </small>
              </div>

              {formData.measurable_type !== 'none' && (
                <div className="form-group">
                  <label>Unit *</label>
                  <input
                    type="text"
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    placeholder="e.g., km/h, %BAC, meters"
                    required={formData.measurable_type !== 'none'}
                    className="form-input"
                  />
                  <small>Unit of measurement (e.g., km/h for speed)</small>
                </div>
              )}

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Detailed description of this offence..."
                  rows="3"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="active"
                    checked={formData.active}
                    onChange={handleInputChange}
                  />
                  <span>Active</span>
                </label>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingOffence ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OffenceManagement;
