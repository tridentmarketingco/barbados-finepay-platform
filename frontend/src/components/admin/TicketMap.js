/**
 * Ticket Map Component
 * Displays ticket locations on Google Maps for government oversight
 * Professional government-level visualization with clustering and filtering
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, MarkerClusterer } from '@react-google-maps/api';
import { getTicketsMapData } from '../../services/adminApi';
import '../../styles/Admin.css';

const TicketMap = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 13.0969, lng: -59.6145 }); // Default: Barbados
  const [filters, setFilters] = useState({
    days: 30,
    status: ''
  });
  const [stats, setStats] = useState({
    total_tickets: 0,
    total_amount: 0,
    status_counts: {}
  });

  // Google Maps API key - should be in environment variables
  const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE';

  // Map container style
  const mapContainerStyle = {
    width: '100%',
    height: '600px',
    borderRadius: '12px'
  };

  // Map options
  const mapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: true,
    scaleControl: true,
    streetViewControl: true,
    rotateControl: false,
    fullscreenControl: true,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  };

  // Fetch map data
  const fetchMapData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await getTicketsMapData(filters);
      
      setTickets(data.tickets || []);
      setStats({
        total_tickets: data.total_tickets || 0,
        total_amount: data.total_amount || 0,
        status_counts: data.status_counts || {}
      });
      
      if (data.center) {
        setMapCenter(data.center);
      }
      
    } catch (err) {
      console.error('Failed to fetch map data:', err);
      setError('Failed to load ticket locations. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  // Get marker color based on ticket status
  const getMarkerColor = (status) => {
    const colors = {
      'paid': '#27ae60',      // Green
      'unpaid': '#f39c12',    // Orange
      'overdue': '#e74c3c',   // Red
      'voided': '#95a5a6',    // Gray
      'refunded': '#3498db',  // Blue
      'Dismissed': '#9b59b6', // Purple
      'Adjusted': '#1abc9c'   // Teal
    };
    return colors[status] || '#34495e';
  };

  // Get marker icon
  const getMarkerIcon = (ticket) => {
    const color = getMarkerColor(ticket.status);
    return {
      path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
      fillColor: color,
      fillOpacity: 0.8,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 8
    };
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Handle filter change
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchMapData();
  };

  if (loading && tickets.length === 0) {
    return (
      <div className="admin-section">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading ticket locations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="section-header">
        <h1>
          <span>🗺️</span>
          Ticket Location Map
        </h1>
        <button className="btn btn-primary" onClick={handleRefresh}>
          <span>🔄</span>
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <p>{error}</p>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon">📍</div>
          <div className="stat-content">
            <h3>Total Locations</h3>
            <p className="stat-value">{stats.total_tickets}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Total Amount</h3>
            <p className="stat-value">{formatCurrency(stats.total_amount)}</p>
          </div>
        </div>

        {Object.entries(stats.status_counts).map(([status, count]) => (
          <div key={status} className="stat-card">
            <div className="stat-icon">
              {status === 'paid' ? '✅' : status === 'overdue' ? '⚠️' : '🎫'}
            </div>
            <div className="stat-content">
              <h3>{status.charAt(0).toUpperCase() + status.slice(1)}</h3>
              <p className="stat-value">{count}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Time Period</label>
          <select name="days" value={filters.days} onChange={handleFilterChange}>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="180">Last 6 Months</option>
            <option value="365">Last Year</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Status</label>
          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">All Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="voided">Voided</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Map Container */}
      <div className="dashboard-section" style={{ padding: '0', overflow: 'hidden' }}>
        {tickets.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '3rem', margin: '0 0 16px 0' }}>🗺️</p>
            <h3 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>No Ticket Locations Found</h3>
            <p style={{ color: '#7f8c8d', margin: 0 }}>
              Tickets need latitude and longitude coordinates to appear on the map.
              <br />
              Add location data when creating tickets to enable map visualization.
            </p>
          </div>
        ) : (
          <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={12}
              options={mapOptions}
            >
              <MarkerClusterer
                options={{
                  imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m',
                  gridSize: 50,
                  maxZoom: 15
                }}
              >
                {(clusterer) =>
                  tickets.map((ticket) => (
                    <Marker
                      key={ticket.id}
                      position={{ lat: ticket.latitude, lng: ticket.longitude }}
                      icon={getMarkerIcon(ticket)}
                      onClick={() => setSelectedTicket(ticket)}
                      clusterer={clusterer}
                      title={`Ticket ${ticket.serial_number}`}
                    />
                  ))
                }
              </MarkerClusterer>

              {selectedTicket && (
                <InfoWindow
                  position={{
                    lat: selectedTicket.latitude,
                    lng: selectedTicket.longitude
                  }}
                  onCloseClick={() => setSelectedTicket(null)}
                >
                  <div style={{ maxWidth: '300px', padding: '8px' }}>
                    <h3 style={{ margin: '0 0 12px 0', color: '#003f87', fontSize: '1.1rem' }}>
                      Ticket #{selectedTicket.serial_number}
                    </h3>
                    
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Status:</strong>{' '}
                      <span
                        className="badge"
                        style={{
                          backgroundColor: getMarkerColor(selectedTicket.status),
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem'
                        }}
                      >
                        {selectedTicket.status}
                      </span>
                    </div>

                    {selectedTicket.offense_description && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Offense:</strong> {selectedTicket.offense_description}
                      </div>
                    )}

                    {selectedTicket.location && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Location:</strong> {selectedTicket.location}
                      </div>
                    )}

                    {selectedTicket.vehicle_plate && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Vehicle:</strong> {selectedTicket.vehicle_plate}
                      </div>
                    )}

                    <div style={{ marginBottom: '8px' }}>
                      <strong>Amount:</strong> {formatCurrency(selectedTicket.fine_amount)}
                    </div>

                    {selectedTicket.total_due > selectedTicket.fine_amount && (
                      <div style={{ marginBottom: '8px', color: '#e74c3c' }}>
                        <strong>Total Due:</strong> {formatCurrency(selectedTicket.total_due)}
                      </div>
                    )}

                    <div style={{ marginBottom: '8px' }}>
                      <strong>Issue Date:</strong> {formatDate(selectedTicket.issue_date)}
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <strong>Due Date:</strong> {formatDate(selectedTicket.due_date)}
                    </div>

                    {selectedTicket.is_overdue && (
                      <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                        <strong style={{ color: '#856404' }}>
                          ⚠️ Overdue by {selectedTicket.days_overdue} days
                        </strong>
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </LoadScript>
        )}
      </div>

      {/* Legend */}
      <div className="dashboard-section" style={{ marginTop: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#2c3e50' }}>Map Legend</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {[
            { status: 'paid', label: 'Paid', color: '#27ae60' },
            { status: 'unpaid', label: 'Unpaid', color: '#f39c12' },
            { status: 'overdue', label: 'Overdue', color: '#e74c3c' },
            { status: 'voided', label: 'Voided', color: '#95a5a6' },
            { status: 'refunded', label: 'Refunded', color: '#3498db' }
          ].map(({ status, label, color }) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              />
              <span style={{ fontSize: '0.9rem', color: '#495057' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      {tickets.length === 0 && (
        <div className="info-box info" style={{ marginTop: '24px' }}>
          <strong>💡 How to add ticket locations:</strong>
          <p style={{ margin: '8px 0 0 0' }}>
            When creating or editing tickets, add latitude and longitude coordinates to enable map visualization.
            You can use geocoding services to convert addresses to coordinates automatically.
          </p>
        </div>
      )}
    </div>
  );
};

export default TicketMap;
