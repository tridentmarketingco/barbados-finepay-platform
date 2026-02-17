/**
 * Offence Categories Management Component
 * Allows admins to manage traffic offence categories
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';
import '../../styles/Admin.css';

function OffenceCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    active: true
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {};
      if (filterActive !== 'all') {
        params.active = filterActive === 'true';
      }
      if (searchTerm) {
        params.search = searchTerm;
      }

      const data = await adminAPI.getOffenceCategories(params);
      setCategories(data.categories || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load offence categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadCategories();
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      active: true
    });
    setShowModal(true);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      code: category.code,
      name: category.name,
      description: category.description || '',
      active: category.active
    });
    setShowModal(true);
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`Are you sure you want to deactivate the category "${category.name}"?`)) {
      return;
    }

    try {
      await adminAPI.deleteOffenceCategory(category.id);
      loadCategories();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete category');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      if (editingCategory) {
        await adminAPI.updateOffenceCategory(editingCategory.id, formData);
      } else {
        await adminAPI.createOffenceCategory(formData);
      }
      
      setShowModal(false);
      loadCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save category');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (loading && categories.length === 0) {
    return (
      <div className="admin-section">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading offence categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="section-header">
        <h1>📋 Offence Categories</h1>
        <button onClick={handleCreate} className="btn btn-primary">
          ➕ Create Category
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
          <label>Status:</label>
          <select 
            value={filterActive} 
            onChange={(e) => {
              setFilterActive(e.target.value);
              setTimeout(loadCategories, 100);
            }}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Categories Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Description</th>
              <th>Offences</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data">
                  No offence categories found
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category.id}>
                  <td><code>{category.code}</code></td>
                  <td><strong>{category.name}</strong></td>
                  <td>{category.description}</td>
                  <td className="text-center">{category.offence_count || 0}</td>
                  <td>
                    <span className={`status-badge ${category.active ? 'active' : 'inactive'}`}>
                      {category.active ? '✓ Active' : '✗ Inactive'}
                    </span>
                  </td>
                  <td className="actions">
                    <button 
                      onClick={() => handleEdit(category)}
                      className="btn btn-sm btn-secondary"
                      title="Edit"
                    >
                      ✏️ Edit
                    </button>
                    {category.active && (
                      <button 
                        onClick={() => handleDelete(category)}
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
              <h2>{editingCategory ? 'Edit Category' : 'Create Category'}</h2>
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
                  placeholder="e.g., SPEED"
                  required
                  disabled={editingCategory !== null}
                  className="form-input"
                />
                <small>Unique identifier (uppercase, no spaces)</small>
              </div>

              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Speeding Offences"
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Brief description of this category..."
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
                  {editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OffenceCategories;
