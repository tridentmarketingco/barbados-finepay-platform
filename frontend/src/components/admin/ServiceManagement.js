/**
 * Service Management Component
 * Enhanced to support multiple government services
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';

// Service type options
const SERVICE_TYPES = [
  { value: 'traffic_fines', label: '🚗 Traffic Fines', description: 'Traffic violation tickets' },
  { value: 'parking', label: '🅿️ Parking', description: 'Parking permits and fines' },
  { value: 'vehicle_licensing', label: '🚙 Vehicle Licensing', description: 'Vehicle registration and renewals' },
  { value: 'business_licenses', label: '🏢 Business Licenses', description: 'Business permit applications' },
  { value: 'property_tax', label: '🏠 Property Tax', description: 'Property tax payments' },
  { value: 'permits', label: '📋 Permits', description: 'General permit applications' },
  { value: 'other', label: '📄 Other', description: 'Other government services' }
];

// Icon options for services
const ICON_OPTIONS = [
  '🚗', '🚙', '🅿️', '🏢', '🏠', '📋', '📄', '💰', '⚖️', '🛣️', 
  '🌳', '🏖️', '🐕', '📱', '💼', '🏥', '🎓', '🚌', '🚲', '⚓'
];

function ServiceManagement() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedService, setSelectedService] = useState(null);
  const [formData, setFormData] = useState({});
  const [filterType, setFilterType] = useState('all');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    loadServices();
  }, [filterType, showInactive]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType !== 'all') {
        params.append('service_type', filterType);
      }
      if (showInactive) {
        params.append('include_inactive', 'true');
      }
      
      const queryString = params.toString();
      const data = await adminAPI.getServices(queryString ? `?${queryString}` : '');
      setServices(data.services);
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({ 
      name: '', 
      description: '', 
      is_active: true,
      service_type: 'other',
      icon: '📋',
      display_order: 0
    });
    setShowModal(true);
  };

  const openEditModal = (service) => {
    setModalMode('edit');
    setSelectedService(service);
    setFormData({
      name: service.name,
      description: service.description,
      is_active: service.is_active,
      service_type: service.service_type || 'other',
      icon: service.icon || '📋',
      display_order: service.display_order || 0
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === 'create') {
        await adminAPI.createService(formData);
      } else {
        await adminAPI.updateService(selectedService.id, formData);
      }
      setShowModal(false);
      loadServices();
    } catch (err) {
      alert(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (serviceId) => {
    if (!window.confirm('Deactivate this service? This will hide it from the active list.')) return;
    try {
      await adminAPI.deleteService(serviceId);
      loadServices();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete service');
    }
  };

  const getServiceTypeLabel = (type) => {
    const found = SERVICE_TYPES.find(t => t.value === type);
    return found ? found.label : '📄 Other';
  };

  if (loading) return <div className="loading-container"><div className="loading-spinner"></div></div>;

  return (
    <div className="service-management">
      <div className="page-header">
        <div className="header-left">
          <h1>🗂️ Service Management</h1>
          <p className="header-subtitle">Manage government services and payment types</p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">➕ Add Service</button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Filter by Type:</label>
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Services</option>
            {SERVICE_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show Inactive Services
          </label>
        </div>
      </div>

      {/* Services Grid */}
      <div className="services-grid">
        {services.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <h3>No services found</h3>
            <p>Click "Add Service" to create your first government service.</p>
          </div>
        ) : (
          services.map(service => (
            <div key={service.id} className={`service-card ${!service.is_active ? 'inactive' : ''}`}>
              <div className="service-header">
                <div className="service-icon">{service.icon || '📋'}</div>
                <div className="service-title">
                  <h3>{service.name}</h3>
                  <span className="service-type-badge">{getServiceTypeLabel(service.service_type)}</span>
                </div>
                <span className={`badge ${service.is_active ? 'badge-success' : 'badge-danger'}`}>
                  {service.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="service-description">{service.description}</p>
              <div className="service-meta">
                <span className="meta-item">Order: {service.display_order || 0}</span>
              </div>
              <div className="service-actions">
                <button onClick={() => openEditModal(service)} className="btn btn-secondary">✏️ Edit</button>
                <button onClick={() => handleDelete(service.id)} className="btn btn-danger">🗑️ Deactivate</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? '➕ Create Service' : '✏️ Edit Service'}</h2>
              <button onClick={() => setShowModal(false)} className="close-btn">×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Service Name *</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    required 
                    placeholder="e.g., Traffic Fines"
                  />
                </div>
                <div className="form-group">
                  <label>Service Type *</label>
                  <select 
                    value={formData.service_type}
                    onChange={(e) => setFormData({...formData, service_type: e.target.value})}
                    required
                  >
                    {SERVICE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label} - {type.description}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>Description *</label>
                <textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})} 
                  required 
                  placeholder="Describe this government service..."
                  rows={3}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Icon</label>
                  <div className="icon-selector">
                    {ICON_OPTIONS.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        className={`icon-btn ${formData.icon === icon ? 'selected' : ''}`}
                        onClick={() => setFormData({...formData, icon})}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Display Order</label>
                  <input 
                    type="number" 
                    value={formData.display_order} 
                    onChange={(e) => setFormData({...formData, display_order: parseInt(e.target.value) || 0})}
                    min="0"
                    placeholder="0"
                  />
                  <small>Lower numbers appear first</small>
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={formData.is_active} 
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    />
                    Active
                  </label>
                </div>
              </div>
              
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{modalMode === 'create' ? 'Create Service' : 'Update Service'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ServiceManagement;

