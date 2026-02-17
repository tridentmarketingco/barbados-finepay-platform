 /**
 * Company Settings Component
 * Comprehensive settings panel with user profile, company branding, and company info
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';
import { useBranding } from '../../contexts/BrandingContext';
import { Card, Button, Input, Alert } from '../common';
import AIConfiguration from './AIConfiguration';

function CompanySettings() {
  const { branding: currentBranding, refreshBranding } = useBranding();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  // Profile state
  const [profileData, setProfileData] = useState({
    username: '',
    email: '',
    full_name: '',
    phone: '',
    role: '',
    profile_image: ''
  });

  // Password state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Branding state
  const [brandingData, setBrandingData] = useState({
    logo_url: '',
    primary_color: '#003f87',
    secondary_color: '#ffc72c',
    platform_name: 'PayFine',
    tagline: 'Secure Government Payment Platform',
    font_family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  // Profile image state
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);

  // Government info state
  const [governmentInfo, setGovernmentInfo] = useState(null);

  // AI Configuration state
  const [aiConfig, setAiConfig] = useState({
    ai_features_enabled: true,
    has_openai_key: false,
    openai_enhanced: false,
    openai_api_key: ''
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch profile and government info
      const profileResponse = await adminAPI.getProfile();
      setProfileData({
        username: profileResponse.profile.username || '',
        email: profileResponse.profile.email || '',
        full_name: profileResponse.profile.full_name || '',
        phone: profileResponse.profile.phone || '',
        role: profileResponse.profile.role || '',
        profile_image: profileResponse.profile.profile_image || ''
      });
      setProfileImagePreview(profileResponse.profile.profile_image);
      setGovernmentInfo(profileResponse.government);

      // Fetch branding
      const brandingResponse = await adminAPI.getBranding();
      if (brandingResponse.branding) {
        setBrandingData({
          logo_url: brandingResponse.branding.logo_url || '',
          primary_color: brandingResponse.branding.primary_color || '#003f87',
          secondary_color: brandingResponse.branding.secondary_color || '#ffc72c',
          platform_name: brandingResponse.branding.platform_name || 'PayFine',
          tagline: brandingResponse.branding.tagline || 'Secure Government Payment Platform',
          font_family: brandingResponse.branding.font_family || 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        });
        setLogoPreview(brandingResponse.branding.logo_url);
      }
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to load settings'
      });
    } finally {
      setLoading(false);
    }
  };

  // Profile handlers
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setAlert(null);

      const response = await adminAPI.updateProfile({
        full_name: profileData.full_name,
        email: profileData.email,
        phone: profileData.phone,
        profile_image: profileData.profile_image
      });

      setAlert({
        type: 'success',
        message: 'Profile updated successfully!'
      });

      // Update profile data with response
      setProfileData(prev => ({
        ...prev,
        ...response.profile
      }));
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to update profile'
      });
    } finally {
      setSaving(false);
    }
  };

  // Password handlers
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setAlert(null);

      await adminAPI.changePassword(passwordData);

      setAlert({
        type: 'success',
        message: 'Password changed successfully!'
      });

      // Reset password form
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      setShowPasswordForm(false);
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to change password'
      });
    } finally {
      setSaving(false);
    }
  };

  // Branding handlers (from original BrandingSettings)
  const handleBrandingChange = (e) => {
    const { name, value } = e.target;
    setBrandingData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogoFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setAlert({
          type: 'error',
          message: 'Please select an image file'
        });
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        setAlert({
          type: 'error',
          message: 'Image file size must be less than 2MB'
        });
        return;
      }

      setLogoFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setAlert({
          type: 'error',
          message: 'Please select an image file'
        });
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        setAlert({
          type: 'error',
          message: 'Image file size must be less than 2MB'
        });
        return;
      }

      setProfileImageFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadLogo = async () => {
    if (!logoFile) {
      setAlert({
        type: 'error',
        message: 'Please select a logo file first'
      });
      return;
    }

    try {
      setSaving(true);
      setAlert(null);

      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const response = await adminAPI.uploadLogo(reader.result);

          setAlert({
            type: 'success',
            message: 'Logo uploaded successfully!'
          });

          setBrandingData(prev => ({
            ...prev,
            logo_url: response.logo_url
          }));

          setLogoFile(null);

          setTimeout(() => {
            refreshBranding();
          }, 500);
        } catch (error) {
          setAlert({
            type: 'error',
            message: error.response?.data?.error || 'Failed to upload logo'
          });
        } finally {
          setSaving(false);
        }
      };
      reader.readAsDataURL(logoFile);
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to process logo file'
      });
      setSaving(false);
    }
  };

  const handleUploadProfileImage = async () => {
    if (!profileImageFile) {
      setAlert({
        type: 'error',
        message: 'Please select a profile image file first'
      });
      return;
    }

    try {
      setSaving(true);
      setAlert(null);

      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const response = await adminAPI.uploadProfileImage(reader.result);

          setAlert({
            type: 'success',
            message: 'Profile image uploaded successfully!'
          });

          setProfileData(prev => ({
            ...prev,
            profile_image: response.profile_image
          }));

          setProfileImageFile(null);
        } catch (error) {
          setAlert({
            type: 'error',
            message: error.response?.data?.error || 'Failed to upload profile image'
          });
        } finally {
          setSaving(false);
        }
      };
      reader.readAsDataURL(profileImageFile);
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to process profile image file'
      });
      setSaving(false);
    }
  };

  const handleBrandingSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setAlert(null);

      await adminAPI.updateBranding(brandingData);

      setAlert({
        type: 'success',
        message: 'Branding settings updated successfully!'
      });

      setTimeout(() => {
        refreshBranding();
      }, 500);
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to update branding settings'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBrandingReset = () => {
    setBrandingData({
    });
    setLogoPreview(currentBranding.logo_url);
    setAlert(null);
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
      case 'super_admin':
        return '#dc3545';
      case 'staff':
      case 'warden':
        return '#007bff';
      default:
        return '#6c757d';
    }
  };

  if (loading) {
    return (
      <div className="admin-content">
        <div className="card">
          <div className="card-header">
            <h2>⚙️ Company Settings</h2>
            <p>Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-content">
      <div className="card">
        <div className="card-header">
          <h2>⚙️ Company Settings</h2>
          <p>Manage your profile, company branding, and settings</p>
        </div>

        {alert && (
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        )}

        {/* Tab Navigation */}
        <div className="settings-tabs">
          <button
            className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <span className="tab-icon">👤</span>
            <span className="tab-label">My Profile</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'branding' ? 'active' : ''}`}
            onClick={() => setActiveTab('branding')}
          >
            <span className="tab-icon">🎨</span>
            <span className="tab-label">Company Branding</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'company' ? 'active' : ''}`}
            onClick={() => setActiveTab('company')}
          >
            <span className="tab-icon">🏢</span>
            <span className="tab-label">Company Info</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <span className="tab-icon">🤖</span>
            <span className="tab-label">AI Configuration</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {/* MY PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="tab-pane active">
              <form onSubmit={handleProfileSubmit}>
                <div className="form-section">
                  <h3>Personal Information</h3>
                  <p className="form-section-description">
                    Update your personal details and contact information
                  </p>

                  <div className="profile-header">
                    <div className="profile-avatar">
                      <div className="avatar-circle">
                        {(profileImagePreview || profileData.profile_image) ? (
                          <img
                            src={profileImagePreview || profileData.profile_image}
                            alt="Profile Image"
                            className="avatar-logo"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : (brandingData.logo_url || currentBranding?.logo_url) ? (
                          <img
                            src={brandingData.logo_url || currentBranding.logo_url}
                            alt="Company Logo"
                            className="avatar-logo"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <span
                          className="avatar-initial"
                          style={{ display: (profileImagePreview || profileData.profile_image || brandingData.logo_url || currentBranding?.logo_url) ? 'none' : 'flex' }}
                        >
                          {profileData.full_name ? profileData.full_name.charAt(0).toUpperCase() : profileData.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="profile-info">
                      <h4>{profileData.full_name || profileData.username}</h4>
                      <span 
                        className="role-badge" 
                        style={{ backgroundColor: getRoleBadgeColor(profileData.role) }}
                      >
                        {profileData.role === 'super_admin' ? 'Super Admin' : 
                         profileData.role === 'admin' ? 'Admin' :
                         profileData.role === 'staff' ? 'Staff' :
                         profileData.role === 'warden' ? 'Warden' : 'User'}
                      </span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <Input
                      type="text"
                      id="username"
                      name="username"
                      value={profileData.username}
                      disabled
                      className="input-disabled"
                    />
                    <small className="form-help">Username cannot be changed</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="full_name">Full Name</label>
                    <Input
                      type="text"
                      id="full_name"
                      name="full_name"
                      value={profileData.full_name}
                      onChange={handleProfileChange}
                      placeholder="Enter your full name"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="email">Email Address</label>
                    <Input
                      type="email"
                      id="email"
                      name="email"
                      value={profileData.email}
                      onChange={handleProfileChange}
                      placeholder="your.email@example.com"
                      required
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="phone">Phone Number</label>
                    <Input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={profileData.phone}
                      onChange={handleProfileChange}
                      placeholder="+1 (246) 123-4567"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label>Profile Image</label>
                    <p className="form-section-description">
                      Upload your personal profile image. Recommended size: 200x200px. Max file size: 2MB.
                    </p>

                    <div className="logo-upload-container">
                      <div className="logo-preview">
                        {profileImagePreview ? (
                          <img src={profileImagePreview} alt="Profile Image Preview" className="logo-preview-image" />
                        ) : (
                          <div className="logo-preview-placeholder">No profile image uploaded</div>
                        )}
                      </div>

                      <div className="logo-upload-controls">
                        <input
                          type="file"
                          id="profile-image-file"
                          accept="image/*"
                          onChange={handleProfileImageFileChange}
                          style={{ display: 'none' }}
                        />
                        <label htmlFor="profile-image-file" className="btn btn-secondary">
                          📁 Choose Profile Image File
                        </label>

                        {profileImageFile && (
                          <Button
                            type="button"
                            onClick={handleUploadProfileImage}
                            disabled={saving}
                            className="btn-primary"
                          >
                            {saving ? 'Uploading...' : '⬆️ Upload Profile Image'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="btn-primary"
                  >
                    {saving ? '💾 Saving...' : '💾 Save Profile'}
                  </Button>
                </div>
              </form>

              {/* Password Change Section */}
              <div className="form-section" style={{ marginTop: '2rem' }}>
                <h3>Security</h3>
                <p className="form-section-description">
                  Change your password to keep your account secure
                </p>

                {!showPasswordForm ? (
                  <Button
                    type="button"
                    onClick={() => setShowPasswordForm(true)}
                    className="btn-secondary"
                  >
                    🔒 Change Password
                  </Button>
                ) : (
                  <form onSubmit={handlePasswordSubmit}>
                    <div className="form-group">
                      <label htmlFor="current_password">Current Password</label>
                      <Input
                        type="password"
                        id="current_password"
                        name="current_password"
                        value={passwordData.current_password}
                        onChange={handlePasswordChange}
                        placeholder="Enter current password"
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="new_password">New Password</label>
                      <Input
                        type="password"
                        id="new_password"
                        name="new_password"
                        value={passwordData.new_password}
                        onChange={handlePasswordChange}
                        placeholder="Enter new password (min 6 characters)"
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="confirm_password">Confirm New Password</label>
                      <Input
                        type="password"
                        id="confirm_password"
                        name="confirm_password"
                        value={passwordData.confirm_password}
                        onChange={handlePasswordChange}
                        placeholder="Confirm new password"
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="form-actions">
                      <Button
                        type="button"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setPasswordData({
                            current_password: '',
                            new_password: '',
                            confirm_password: ''
                          });
                        }}
                        disabled={saving}
                        className="btn-secondary"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={saving}
                        className="btn-primary"
                      >
                        {saving ? '🔒 Changing...' : '🔒 Change Password'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* COMPANY BRANDING TAB */}
          {activeTab === 'branding' && (
            <div className="tab-pane active">
              <form onSubmit={handleBrandingSubmit}>
                {/* Logo Upload Section */}
                <div className="form-section">
                  <h3>Platform Logo</h3>
                  <p className="form-section-description">
                    Upload your organization's logo. Recommended size: 200x60px. Max file size: 2MB.
                  </p>

                  <div className="logo-upload-container">
                    <div className="logo-preview">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo Preview" className="logo-preview-image" />
                      ) : (
                        <div className="logo-preview-placeholder">No logo uploaded</div>
                      )}
                    </div>

                    <div className="logo-upload-controls">
                      <input
                        type="file"
                        id="logo-file"
                        accept="image/*"
                        onChange={handleLogoFileChange}
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="logo-file" className="btn btn-secondary">
                        📁 Choose Logo File
                      </label>
                      
                      {logoFile && (
                        <Button
                          type="button"
                          onClick={handleUploadLogo}
                          disabled={saving}
                          className="btn-primary"
                        >
                          {saving ? 'Uploading...' : '⬆️ Upload Logo'}
                        </Button>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="logo_url">Logo URL (Alternative)</label>
                      <Input
                        type="url"
                        id="logo_url"
                        name="logo_url"
                        value={brandingData.logo_url}
                        onChange={handleBrandingChange}
                        placeholder="https://example.com/logo.svg"
                        disabled={saving}
                      />
                      <small className="form-help">
                        You can also provide a direct URL to your logo instead of uploading
                      </small>
                    </div>
                  </div>
                </div>

                {/* Platform Name Section */}
                <div className="form-section">
                  <h3>Platform Identity</h3>
                  
                  <div className="form-group">
                    <label htmlFor="platform_name">Platform Name *</label>
                    <Input
                      type="text"
                      id="platform_name"
                      name="platform_name"
                      value={brandingData.platform_name}
                      onChange={handleBrandingChange}
                      placeholder="PayFine"
                      required
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="tagline">Tagline</label>
                    <Input
                      type="text"
                      id="tagline"
                      name="tagline"
                      value={brandingData.tagline}
                      onChange={handleBrandingChange}
                      placeholder="Secure Government Payment Platform"
                      disabled={saving}
                    />
                  </div>
                </div>

                {/* Color Scheme Section */}
                <div className="form-section">
                  <h3>Color Scheme</h3>
                  <p className="form-section-description">
                    Choose colors that match your organization's brand identity
                  </p>

                  <div className="color-picker-grid">
                    <div className="form-group">
                      <label htmlFor="primary_color">Primary Color</label>
                      <div className="color-input-group">
                        <input
                          type="color"
                          id="primary_color"
                          name="primary_color"
                          value={brandingData.primary_color}
                          onChange={handleBrandingChange}
                          disabled={saving}
                          className="color-picker"
                        />
                        <Input
                          type="text"
                          value={brandingData.primary_color}
                          onChange={handleBrandingChange}
                          name="primary_color"
                          placeholder="#003f87"
                          disabled={saving}
                          className="color-text-input"
                        />
                      </div>
                      <small className="form-help">Used for headers and primary buttons</small>
                    </div>

                    <div className="form-group">
                      <label htmlFor="secondary_color">Secondary Color</label>
                      <div className="color-input-group">
                        <input
                          type="color"
                          id="secondary_color"
                          name="secondary_color"
                          value={brandingData.secondary_color}
                          onChange={handleBrandingChange}
                          disabled={saving}
                          className="color-picker"
                        />
                        <Input
                          type="text"
                          value={brandingData.secondary_color}
                          onChange={handleBrandingChange}
                          name="secondary_color"
                          placeholder="#ffc72c"
                          disabled={saving}
                          className="color-text-input"
                        />
                      </div>
                      <small className="form-help">Used for accents and highlights</small>
                    </div>
                  </div>
                </div>
                {/* Font Family Section */}
                <div className="form-section">
                  <h3>Font Family</h3>
                  <p className="form-section-description">
                    Choose the font family for your platform. This will apply globally across the entire application.
                  </p>
                  <div className="form-group">
                    <label htmlFor="font_family">Font Family</label>
                    <select
                      id="font_family"
                      name="font_family"
                      value={brandingData.font_family}
                      onChange={handleBrandingChange}
                      disabled={saving}
                      className="form-select"
                    >
                      <option value={'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}>System UI (Recommended)</option>
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="Helvetica, sans-serif">Helvetica</option>
                      <option value={'"Times New Roman", serif'}>Times New Roman</option>
                      <option value="Georgia, serif">Georgia</option>
                      <option value="Verdana, sans-serif">Verdana</option>
                      <option value={'"Courier New", monospace'}>Courier New</option>
                    </select>
                    <small className="form-help">
                      System UI provides the best user experience by using the device's native fonts
                    </small>
                  </div>
                </div>

                {/* Preview Section */}
                <div className="form-section">
                  <h3>Preview</h3>
                  <div className="branding-preview" style={{
                    background: `linear-gradient(135deg, ${brandingData.primary_color} 0%, ${brandingData.primary_color}dd 100%)`,
                    padding: '2rem',
                    borderRadius: '8px',
                    color: 'white'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {logoPreview && (
                        <img
                          src={logoPreview}
                          alt="Logo"
                          style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '50%' }}
                        />
                      )}
                      <div>
                        <h2 style={{ margin: 0, fontSize: '1.75rem', color: 'white' }}>
                          {brandingData.platform_name || 'Platform Name'}
                        </h2>
                        {brandingData.tagline && (
                          <p style={{ margin: '0.25rem 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
                            {brandingData.tagline}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="form-actions">
                  <Button
                    type="button"
                    onClick={handleBrandingReset}
                    disabled={saving}
                    className="btn-secondary"
                  >
                    🔄 Reset
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="btn-primary"
                  >
                    {saving ? '💾 Saving...' : '💾 Save Branding Settings'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* AI CONFIGURATION TAB */}
          {activeTab === 'ai' && (
            <div className="tab-pane active">
              <AIConfiguration />
            </div>
          )}

          {/* COMPANY INFO TAB */}
          {activeTab === 'company' && (
            <div className="tab-pane active">
              <div className="form-section">
                <h3>Government Information</h3>
                <p className="form-section-description">
                  View your government's configuration and details
                </p>

                {governmentInfo && (
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Government Name</label>
                      <div className="info-value">{governmentInfo.government_name}</div>
                    </div>

                    <div className="info-item">
                      <label>Country</label>
                      <div className="info-value">
                        {governmentInfo.country_name} ({governmentInfo.country_iso_code})
                      </div>
                    </div>

                    <div className="info-item">
                      <label>Currency</label>
                      <div className="info-value">{governmentInfo.currency_code}</div>
                    </div>

                    <div className="info-item">
                      <label>Timezone</label>
                      <div className="info-value">{governmentInfo.timezone}</div>
                    </div>

                    <div className="info-item">
                      <label>Status</label>
                      <div className="info-value">
                        <span className={`status-badge status-${governmentInfo.status}`}>
                          {governmentInfo.status.charAt(0).toUpperCase() + governmentInfo.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    {governmentInfo.legal_framework_version && (
                      <div className="info-item">
                        <label>Legal Framework</label>
                        <div className="info-value">{governmentInfo.legal_framework_version}</div>
                      </div>
                    )}

                    {governmentInfo.contact_email && (
                      <div className="info-item">
                        <label>Contact Email</label>
                        <div className="info-value">{governmentInfo.contact_email}</div>
                      </div>
                    )}

                    {governmentInfo.contact_phone && (
                      <div className="info-item">
                        <label>Contact Phone</label>
                        <div className="info-value">{governmentInfo.contact_phone}</div>
                      </div>
                    )}

                    <div className="info-item">
                      <label>Payment Gateway</label>
                      <div className="info-value">
                        {governmentInfo.payment_gateway_type.charAt(0).toUpperCase() + 
                         governmentInfo.payment_gateway_type.slice(1)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="info-notice">
                  <p>
                    <strong>ℹ️ Note:</strong> To update government information, please contact PayFine support.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .settings-tabs {
          display: flex;
          gap: 0.5rem;
          padding: 1.5rem 1.5rem 0;
          border-bottom: 2px solid #e9ecef;
          overflow-x: auto;
        }

        .tab-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          color: #6c757d;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .tab-button:hover {
          color: #003f87;
          background: #f8f9fa;
        }

        .tab-button.active {
          color: #003f87;
          border-bottom-color: #003f87;
        }

        .tab-icon {
          font-size: 1.2rem;
        }

        .tab-content {
          padding: 2rem 1.5rem;
        }

        .tab-pane {
          display: none;
        }

        .tab-pane.active {
          display: block;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .profile-header {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 1.5rem;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 2rem;
        }

        .profile-avatar {
          flex-shrink: 0;
        }


        .profile-info h4 {
          margin: 0 0 0.5rem 0;
          color: #212529;
          font-size: 1.25rem;
        }

        .role-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          color: white;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .form-section {
          margin-bottom: 2rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid #e9ecef;
        }

        .form-section:last-of-type {
          border-bottom: none;
        }

        .form-section h3 {
          color: #003f87;
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
        }

        .form-section-description {
          color: #6c757d;
          font-size: 0.9rem;
          margin-bottom: 1.5rem;
        }

        .logo-upload-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .logo-preview {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100px;
          height: 100px;
          background: #f8f9fa;
          border: 2px dashed #dee2e6;
          border-radius: 50%;
        }

        .logo-preview-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }

        .logo-preview-placeholder {
          color: #6c757d;
          font-style: italic;
        }

        .logo-upload-controls {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .color-picker-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .color-input-group {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .color-picker {
          width: 60px;
          height: 44px;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          cursor: pointer;
        }

        .color-text-input {
          flex: 1;
        }

        .form-help {
          display: block;
          margin-top: 0.5rem;
          color: #6c757d;
          font-size: 0.85rem;
        }

        .branding-preview {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 2px solid #e9ecef;
        }

        .input-disabled {
          background-color: #e9ecef;
          cursor: not-allowed;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .info-item {
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #003f87;
        }

        .info-item label {
          display: block;
          font-size: 0.85rem;
          color: #6c757d;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .info-value {
          font-size: 1rem;
          color: #212529;
          font-weight: 500;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .status-badge.status-active {
          background-color: #28a745;
          color: white;
        }

        .status-badge.status-pilot {
          background-color: #ffc107;
          color: #212529;
        }

        .status-badge.status-suspended {
          background-color: #dc3545;
          color: white;
        }

        .info-notice {
          padding: 1rem;
          background: #e7f3ff;
          border-left: 4px solid #007bff;
          border-radius: 4px;
          margin-top: 2rem;
        }

        .info-notice p {
          margin: 0;
          color: #004085;
        }

        @media (max-width: 768px) {
          .settings-tabs {
            padding: 1rem 1rem 0;
          }

          .tab-button {
            padding: 0.5rem 1rem;
            font-size: 0.9rem;
          }

          .tab-label {
            display: none;
          }

          .tab-icon {
            font-size: 1.5rem;
          }

          .tab-content {
            padding: 1.5rem 1rem;
          }

          .profile-header {
            flex-direction: column;
            text-align: center;
          }

          .color-picker-grid {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column;
          }

          .form-actions button {
            width: 100%;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default CompanySettings;
