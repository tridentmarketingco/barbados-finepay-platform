/**
 * Branding Settings Component
 * Allows admins to customize platform branding (logo, colors, platform name)
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';
import { useBranding } from '../../contexts/BrandingContext';
import { Card, Button, Input, Alert } from '../common';

function BrandingSettings() {
  const { branding: currentBranding, refreshBranding } = useBranding();
  const [formData, setFormData] = useState({
    logo_url: '',
    primary_color: '#003f87',
    secondary_color: '#ffc72c',
    platform_name: 'PayFine',
    tagline: 'Secure Government Payment Platform'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getBranding();
      
      if (response.branding) {
        setFormData({
          logo_url: response.branding.logo_url || '',
          primary_color: response.branding.primary_color || '#003f87',
          secondary_color: response.branding.secondary_color || '#ffc72c',
          platform_name: response.branding.platform_name || 'PayFine',
          tagline: response.branding.tagline || 'Secure Government Payment Platform'
        });
        setLogoPreview(response.branding.logo_url);
      }
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to load branding settings'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogoFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setAlert({
          type: 'error',
          message: 'Please select an image file'
        });
        return;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setAlert({
          type: 'error',
          message: 'Image file size must be less than 2MB'
        });
        return;
      }

      setLogoFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
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

      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const response = await adminAPI.uploadLogo(reader.result);
          
          setAlert({
            type: 'success',
            message: 'Logo uploaded successfully!'
          });

          // Update form data with new logo URL
          setFormData(prev => ({
            ...prev,
            logo_url: response.logo_url
          }));

          setLogoFile(null);
          
          // Refresh branding context
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setAlert(null);

      const response = await adminAPI.updateBranding(formData);

      setAlert({
        type: 'success',
        message: 'Branding settings updated successfully!'
      });

      // Refresh branding context to update header
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

  const handleReset = () => {
    setFormData({
      logo_url: currentBranding.logo_url || '',
      primary_color: currentBranding.primary_color || '#003f87',
      secondary_color: currentBranding.secondary_color || '#ffc72c',
      platform_name: currentBranding.platform_name || 'PayFine',
      tagline: currentBranding.tagline || 'Secure Government Payment Platform'
    });
    setLogoFile(null);
    setLogoPreview(currentBranding.logo_url);
    setAlert(null);
  };

  if (loading) {
    return (
      <div className="admin-content">
        <div className="card">
          <div className="card-header">
            <h2>⚙️ Branding Settings</h2>
            <p>Loading branding settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-content">
      <div className="card">
        <div className="card-header">
          <h2>⚙️ Branding Settings</h2>
          <p>Customize your platform's appearance and branding</p>
        </div>

        {alert && (
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        )}

        <form onSubmit={handleSubmit}>
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
                  value={formData.logo_url}
                  onChange={handleInputChange}
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
                value={formData.platform_name}
                onChange={handleInputChange}
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
                value={formData.tagline}
                onChange={handleInputChange}
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
                    value={formData.primary_color}
                    onChange={handleInputChange}
                    disabled={saving}
                    className="color-picker"
                  />
                  <Input
                    type="text"
                    value={formData.primary_color}
                    onChange={handleInputChange}
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
                    value={formData.secondary_color}
                    onChange={handleInputChange}
                    disabled={saving}
                    className="color-picker"
                  />
                  <Input
                    type="text"
                    value={formData.secondary_color}
                    onChange={handleInputChange}
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

          {/* Preview Section */}
          <div className="form-section">
            <h3>Preview</h3>
            <div className="branding-preview" style={{
              background: `linear-gradient(135deg, ${formData.primary_color} 0%, ${formData.primary_color}dd 100%)`,
              padding: '2rem',
              borderRadius: '8px',
              color: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {logoPreview && (
                  <img 
                    src={logoPreview} 
                    alt="Logo" 
                    style={{ height: '50px', width: 'auto', maxWidth: '200px', objectFit: 'contain' }}
                  />
                )}
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.75rem', color: 'white' }}>
                    {formData.platform_name || 'Platform Name'}
                  </h2>
                  {formData.tagline && (
                    <p style={{ margin: '0.25rem 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
                      {formData.tagline}
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
              onClick={handleReset}
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

      <style jsx>{`
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
          min-height: 100px;
          padding: 1rem;
          background: #f8f9fa;
          border: 2px dashed #dee2e6;
          border-radius: 8px;
        }

        .logo-preview-image {
          max-height: 80px;
          max-width: 300px;
          object-fit: contain;
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

        @media (max-width: 768px) {
          .color-picker-grid {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column;
          }

          .form-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default BrandingSettings;
