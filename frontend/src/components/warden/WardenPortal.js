/**
 * Warden Portal - Simplified Interface for Traffic Wardens
 * Mobile-first design for quick ticket entry in the field
 * 
 * NATIONAL TRAFFIC OFFENCE SYSTEM INTEGRATION:
 * - Wardens select offence from dropdown (not manual fine entry)
 * - Enter measured values (speed, BAC, etc.) for measurable offences
 * - System auto-calculates fine, points, and court requirement
 * - Detects repeat offences automatically
 * - Clear indication of court-required offences
 */

import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { ticketAPI } from '../../services/api';
import adminAPI from '../../services/adminApi';
import { useBranding } from '../../contexts/BrandingContext';
import '../../styles/Warden.css';

function WardenPortal({ user, onLogout }) {
  const { branding } = useBranding();
  const [services, setServices] = useState([]);
  const [offenceCategories, setOffenceCategories] = useState([]);
  const [offences, setOffences] = useState([]);
  const [filteredOffences, setFilteredOffences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketsError, setTicketsError] = useState(null);
  const [calculatedFine, setCalculatedFine] = useState(null);
  const [calculating, setCalculating] = useState(false);
  
  // Form state - NEW OFFENCE SYSTEM
  const [formData, setFormData] = useState({
    serial_number: '',
    service_id: '',
    offence_id: '', // NEW - replaces manual fine entry
    measured_value: '', // NEW - for measurable offences
    offense_description: '', // Optional override
    location: '',
    vehicle_plate: '',
    officer_badge: user?.username || '',
    driver_name: '',
    driver_license: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    // Trident ID Integration
    trident_id: '',
    citizen_email: '',
    citizen_phone: '',
    send_notification: true,
    // Photo evidence
    photo_data: '',
    photo_filename: ''
  });

  // Photo preview
  const [photoPreview, setPhotoPreview] = useState(null);

  // Selected offence details
  const [selectedOffence, setSelectedOffence] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');

  // Check if user is logged in and has appropriate role (after all hooks)
  // Wardens can have role='staff' or role='warden' or user_type='warden'
  const isWarden = user?.role === 'warden' || user?.role === 'staff' || user?.user_type === 'warden';
  const isAdmin = user?.is_admin === true || user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    loadServices();
    loadOffenceCategories();
    loadOffences();
    loadRecentTickets();
  }, []);

  // Filter offences when category changes
  useEffect(() => {
    if (selectedCategory) {
      const filtered = offences.filter(o => o.category_id === parseInt(selectedCategory));
      setFilteredOffences(filtered);
    } else {
      setFilteredOffences(offences);
    }
  }, [selectedCategory, offences]);

  // Auto-calculate fine when offence or measured value changes
  useEffect(() => {
    if (formData.offence_id) {
      calculateFinePreview();
    } else {
      setCalculatedFine(null);
    }
  }, [formData.offence_id, formData.measured_value]);

  const loadServices = async () => {
    try {
      const data = await adminAPI.getServices();
      setServices(data.services.filter(s => s.is_active));
      if (data.services.length > 0) {
        setFormData(prev => ({ ...prev, service_id: data.services[0].id }));
      }
    } catch (err) {
      console.error('Failed to load services:', err);
    }
  };

  const loadOffenceCategories = async () => {
    try {
      const data = await ticketAPI.getOffenceCategories({ active: true });
      setOffenceCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to load offence categories:', err);
    }
  };

  const loadOffences = async () => {
    try {
      const data = await ticketAPI.getOffences({ active: true });
      setOffences(data.offences || []);
      setFilteredOffences(data.offences || []);
    } catch (err) {
      console.error('Failed to load offences:', err);
    }
  };

  const loadRecentTickets = async () => {
    setLoadingTickets(true);
    setTicketsError(null);
    try {
      console.log('Loading recent tickets...');
      const data = await ticketAPI.getRecentTickets({ per_page: 5, page: 1 });
      console.log('Recent tickets response:', data);
      console.log('Tickets array:', data.tickets);
      setRecentTickets(data.tickets || []);
      setLoadingTickets(false);
    } catch (err) {
      console.error('Failed to load recent tickets:', err);
      console.error('Error response:', err.response);
      console.error('Error data:', err.response?.data);
      console.error('Error status:', err.response?.status);
      setTicketsError(err.response?.data?.error || err.message || 'Failed to load tickets');
      setRecentTickets([]);
      setLoadingTickets(false);
    }
  };

  const calculateFinePreview = async () => {
    if (!formData.offence_id) {
      setCalculatedFine(null);
      return;
    }

    setCalculating(true);
    try {
      const data = await ticketAPI.calculateFinePreview({
        offence_id: parseInt(formData.offence_id),
        measured_value: formData.measured_value ? parseFloat(formData.measured_value) : null,
        is_repeat_offence: false // Will be auto-detected by backend based on driver_license
      });
      
      setCalculatedFine(data);
    } catch (err) {
      console.error('Failed to calculate fine:', err);
      setCalculatedFine(null);
    } finally {
      setCalculating(false);
    }
  };

  const handleOffenceChange = (offenceId) => {
    const offence = offences.find(o => o.id === parseInt(offenceId));
    setSelectedOffence(offence);
    setFormData(prev => ({
      ...prev,
      offence_id: offenceId,
      measured_value: '', // Reset measured value
      offense_description: offence ? offence.name : ''
    }));
  };

  const generateSerialNumber = () => {
    // Generate serial number: Letter + 6 digits (e.g., A459778)
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
    const numbers = Math.floor(100000 + Math.random() * 900000); // 100000-999999
    return `${letter}${numbers}`;
  };

  const handleAutoFill = () => {
    setFormData(prev => ({
      ...prev,
      serial_number: generateSerialNumber()
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate offence selection
      if (!formData.offence_id) {
        setError('Please select an offence');
        setLoading(false);
        return;
      }

      // Validate measured value for measurable offences
      if (selectedOffence && selectedOffence.measurable_type !== 'none' && !formData.measured_value) {
        setError(`Please enter ${selectedOffence.unit} for this offence`);
        setLoading(false);
        return;
      }

      const ticketData = {
        serial_number: formData.serial_number,
        service_id: parseInt(formData.service_id),
        offence_id: parseInt(formData.offence_id),
        measured_value: formData.measured_value ? parseFloat(formData.measured_value) : null,
        offense_description: formData.offense_description,
        location: formData.location,
        vehicle_plate: formData.vehicle_plate,
        officer_badge: formData.officer_badge,
        driver_name: formData.driver_name,
        driver_license: formData.driver_license,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        notes: formData.notes,
        trident_id: formData.trident_id,
        citizen_email: formData.citizen_email,
        citizen_phone: formData.citizen_phone,
        send_notification: formData.send_notification,
        // Photo evidence
        photo_data: formData.photo_data || null,
        photo_filename: formData.photo_filename || null
      };

      const response = await adminAPI.createTicket(ticketData);
      
      // Show success with calculation details
      let successMsg = `Ticket ${formData.serial_number} created successfully!\n`;
      if (response.calculation_details) {
        successMsg += `\n💰 Fine: $${response.calculation_details.calculated_fine.toFixed(2)}`;
        successMsg += `\n⚠️ Points: ${response.calculation_details.points}`;
        if (response.calculation_details.court_required) {
          successMsg += `\n⚖️ COURT REQUIRED - Payment blocked`;
        }
        if (response.calculation_details.is_repeat_offence) {
          successMsg += `\n🔁 Repeat offence detected (${response.calculation_details.repeat_count} previous)`;
        }
      }
      
      setSuccess(successMsg);
      
      // Reset form
      setFormData({
        serial_number: '',
        service_id: formData.service_id,
        offence_id: '',
        measured_value: '',
        offense_description: '',
        location: '',
        vehicle_plate: '',
        officer_badge: user?.username || '',
        driver_name: '',
        driver_license: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: '',
        trident_id: '',
        citizen_email: '',
        citizen_phone: '',
        send_notification: true,
        photo_data: '',
        photo_filename: ''
      });
      
      setSelectedOffence(null);
      setCalculatedFine(null);
      setPhotoPreview(null);

      // Reload recent tickets
      loadRecentTickets();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle photo upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Photo size must be less than 5MB');
        return;
      }

      // Read file as base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          photo_data: reader.result,
          photo_filename: file.name
        }));
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove photo
  const handleRemovePhoto = () => {
    setFormData(prev => ({
      ...prev,
      photo_data: '',
      photo_filename: ''
    }));
    setPhotoPreview(null);
  };

  // Authentication checks (after all hooks are defined)
  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!isWarden && !isAdmin) {
    return (
      <div className="warden-portal">
        <div className="warden-container" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>⛔ Access Denied</h2>
          <p>You do not have permission to access the Warden Portal.</p>
          <p>Only wardens and administrators can access this area.</p>
          <button onClick={onLogout} className="btn-warden-logout" style={{ marginTop: '1rem' }}>
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="warden-portal">
      {/* Header */}
      <header className="warden-header">
        <div className="warden-header-content">
          <div className="warden-logo">
            {branding?.logo_url ? (
              <div className="warden-logo-with-name">
                <img 
                  src={branding.logo_url} 
                  alt={`${branding.platform_name} Logo`}
                  className="warden-logo-image"
                />
                <div className="warden-logo-text">
                  <h1 className="warden-platform-name">{branding.platform_name || 'Warden Portal'}</h1>
                  <p className="warden-subtitle">Traffic Ticket Entry</p>
                </div>
              </div>
            ) : (
              <>
                <h1>🚔 Warden Portal</h1>
                <p className="warden-subtitle">Traffic Ticket Entry</p>
              </>
            )}
          </div>
          <div className="warden-user">
            <span className="warden-badge">👮 {user?.username}</span>
            <button onClick={onLogout} className="btn-warden-logout">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="warden-container">
        {/* Success/Error Messages */}
        {success && (
          <div className="warden-alert warden-alert-success">
            ✅ {success}
          </div>
        )}

        {error && (
          <div className="warden-alert warden-alert-error">
            ❌ {error}
          </div>
        )}

        {/* Offence Selection */}
        <div className="offence-selection">
          <h3>⚖️ Select Traffic Offence</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>Category (Optional Filter)</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="form-select"
              >
                <option value="">All Categories</option>
                {offenceCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.offence_count} offences)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Offence *</label>
              <select
                value={formData.offence_id}
                onChange={(e) => handleOffenceChange(e.target.value)}
                className="form-select"
                required
              >
                <option value="">Select an offence...</option>
                {filteredOffences.map((offence) => (
                  <option key={offence.id} value={offence.id}>
                    {offence.name}
                    {offence.is_measurable && ` (${offence.unit})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Measured Value Input (for measurable offences) */}
          {selectedOffence && selectedOffence.measurable_type !== 'none' && (
            <div className="form-group">
              <label>
                {selectedOffence.measurable_type === 'speed' && 'Speed Over Limit'}
                {selectedOffence.measurable_type === 'alcohol' && 'Blood Alcohol Content'}
                {selectedOffence.measurable_type === 'distance' && 'Distance'}
                {' '}({selectedOffence.unit}) *
              </label>
              <input
                type="number"
                step={selectedOffence.measurable_type === 'alcohol' ? '0.01' : '1'}
                value={formData.measured_value}
                onChange={(e) => handleInputChange('measured_value', e.target.value)}
                placeholder={
                  selectedOffence.measurable_type === 'speed' ? 'e.g., 15 (km/h over limit)' :
                  selectedOffence.measurable_type === 'alcohol' ? 'e.g., 0.08 (%BAC)' :
                  'Enter measured value'
                }
                required
                className="form-input"
              />
              <small style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {selectedOffence.description}
              </small>
            </div>
          )}

          {/* Fine Calculation Preview */}
          {calculating && (
            <div className="calculation-preview calculating">
              <p>⏳ Calculating fine...</p>
            </div>
          )}

          {calculatedFine && !calculating && (
            <div className={`calculation-preview ${calculatedFine.court_required ? 'court-required' : ''}`}>
              <h4>💰 Calculated Fine</h4>
              <div className="calc-details">
                <div className="calc-row">
                  <span>Base Fine:</span>
                  <strong>${calculatedFine.base_fine.toFixed(2)}</strong>
                </div>
                <div className="calc-row">
                  <span>Calculated Fine:</span>
                  <strong className="calc-amount">${calculatedFine.calculated_fine.toFixed(2)}</strong>
                </div>
                <div className="calc-row">
                  <span>Demerit Points:</span>
                  <strong>{calculatedFine.points} points</strong>
                </div>
                {calculatedFine.is_repeat_offence && (
                  <div className="calc-row repeat-warning">
                    <span>🔁 Repeat Offence:</span>
                    <strong>{calculatedFine.repeat_multiplier}x multiplier applied</strong>
                  </div>
                )}
                {calculatedFine.court_required && (
                  <div className="court-warning">
                    ⚖️ <strong>COURT REQUIRED</strong> - Online payment will be blocked
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Ticket Entry Form */}
        <form onSubmit={handleSubmit} className="warden-form">
          <div className="form-section">
            <h3>📋 Ticket Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Serial Number *</label>
                <div className="input-with-button">
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) => handleInputChange('serial_number', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))}
                    placeholder="A459778"
                    required
                    pattern="[A-Z][0-9]{6}"
                    title="Format: Letter followed by 6 digits (e.g., A459778)"
                    maxLength="7"
                  />
                  <button type="button" onClick={handleAutoFill} className="btn-auto">
                    Auto
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Offense Description (Optional Override)</label>
                <input
                  type="text"
                  value={formData.offense_description}
                  onChange={(e) => handleInputChange('offense_description', e.target.value)}
                  placeholder="Auto-filled from selected offence"
                  className="form-input"
                />
                <small style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Leave blank to use offence name
                </small>
              </div>
            </div>

            <div className="form-group">
              <label>Location *</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="Highway 1, near Holetown"
                required
                className="form-input"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>🚗 Vehicle & Driver Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Vehicle Plate *</label>
                <input
                  type="text"
                  value={formData.vehicle_plate}
                  onChange={(e) => handleInputChange('vehicle_plate', e.target.value.toUpperCase())}
                  placeholder="BDS-1234"
                  required
                />
              </div>

              <div className="form-group">
                <label>Officer Badge</label>
                <input
                  type="text"
                  value={formData.officer_badge}
                  onChange={(e) => handleInputChange('officer_badge', e.target.value)}
                  placeholder="OFF-789"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Driver Name</label>
                <input
                  type="text"
                  value={formData.driver_name}
                  onChange={(e) => handleInputChange('driver_name', e.target.value)}
                  placeholder="John Doe"
                />
              </div>

              <div className="form-group">
                <label>Driver License</label>
                <input
                  type="text"
                  value={formData.driver_license}
                  onChange={(e) => handleInputChange('driver_license', e.target.value.toUpperCase())}
                  placeholder="DL123456"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>📅 Dates</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Issue Date *</label>
                <input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => handleInputChange('issue_date', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Due Date (21 days) *</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleInputChange('due_date', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>🆔 Trident ID & Notifications</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Link this ticket to the citizen's Barbados National ID (Trident ID) for automatic notifications.
            </p>
            
            <div className="form-group">
              <label>Trident ID (National ID)</label>
              <input
                type="text"
                value={formData.trident_id}
                onChange={(e) => handleInputChange('trident_id', e.target.value.replace(/\D/g, ''))}
                placeholder="9504270019"
                maxLength="10"
                pattern="\d{10}"
                title="10-digit National ID number"
              />
              <small style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Optional: Enter citizen's 10-digit Trident ID to enable notifications
              </small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Citizen Email</label>
                <input
                  type="email"
                  value={formData.citizen_email}
                  onChange={(e) => handleInputChange('citizen_email', e.target.value)}
                  placeholder="citizen@example.com"
                />
              </div>

              <div className="form-group">
                <label>Citizen Phone</label>
                <input
                  type="tel"
                  value={formData.citizen_phone}
                  onChange={(e) => handleInputChange('citizen_phone', e.target.value)}
                  placeholder="+1-246-123-4567"
                />
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={formData.send_notification}
                  onChange={(e) => handleInputChange('send_notification', e.target.checked)}
                  style={{ width: 'auto' }}
                />
                <span>Send notification to citizen (SMS/Email)</span>
              </label>
              <small style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '1.5rem' }}>
                Citizen will receive ticket details and payment link
              </small>
            </div>
          </div>

          <div className="form-section">
            <h3>📷 Photo Evidence (Optional)</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Upload a photo of the traffic violation or vehicle as evidence.
            </p>
            
            <div className="photo-upload-container">
              {!photoPreview ? (
                <div className="photo-upload-area">
                  <input
                    type="file"
                    id="photo-upload"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="photo-upload" className="photo-upload-label">
                    <span className="photo-icon">📷</span>
                    <span>Tap to take photo or select image</span>
                    <span className="photo-hint">Max 5MB, JPG or PNG</span>
                  </label>
                </div>
              ) : (
                <div className="photo-preview-container">
                  <img src={photoPreview} alt="Evidence preview" className="photo-preview" />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="btn-remove-photo"
                  >
                    🗑️ Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <h3>📝 Additional Notes</h3>
            <div className="form-group">
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Any additional information..."
                rows="3"
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              disabled={loading || !formData.offence_id || calculating}
              className="btn-warden-submit"
            >
              {loading ? '⏳ Creating Ticket...' : 
               calculating ? '⏳ Calculating...' :
               calculatedFine ? `✅ Create Ticket - $${calculatedFine.calculated_fine.toFixed(2)}` :
               '✅ Create Ticket'}
            </button>
            
            {calculatedFine && calculatedFine.court_required && (
              <p className="court-notice">
                ⚖️ This offence requires court appearance - online payment will be blocked
              </p>
            )}
          </div>
        </form>

        {/* Recent Tickets - Compact Table Layout */}
        <div className="recent-tickets">
          <h3>Recent Tickets</h3>
          
          {loadingTickets ? (
            <p className="no-tickets">⏳ Loading recent tickets...</p>
          ) : ticketsError ? (
            <div className="warden-alert warden-alert-error" style={{ marginTop: '1rem' }}>
              ❌ {ticketsError}
              <br />
              <small>Check browser console for details</small>
            </div>
          ) : recentTickets.length > 0 ? (
            <div className="tickets-list">
              {recentTickets.map((ticket) => (
                <div key={ticket.id} className="ticket-card">
                  <span className="ticket-serial">{ticket.serial_number}</span>
                  
                  <div className="ticket-info">
                    <div className="ticket-primary">
                      <span className="ticket-vehicle">🚗 {ticket.vehicle_plate}</span>
                      <span className="ticket-amount">${ticket.fine_amount.toFixed(2)}</span>
                    </div>
                    <div className="ticket-secondary">
                      <span className="ticket-offense">{ticket.offense_description}</span>
                      <span className="ticket-date">
                        {new Date(ticket.created_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  
                  <span className={`ticket-status status-${ticket.status}`}>
                    {ticket.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-tickets">No recent tickets found</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default WardenPortal;
