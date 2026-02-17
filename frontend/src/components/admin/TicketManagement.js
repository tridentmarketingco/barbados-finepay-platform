/**
 * Ticket Management Component
 * CRUD operations for tickets
 */

import React, { useState, useEffect, useCallback } from 'react';
import adminAPI from '../../services/adminApi';
import '../../styles/Admin.css';

function TicketManagement() {
  const [tickets, setTickets] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create', 'edit', 'void', 'refund', 'mark-paid'
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const [selectedPhotoTicket, setSelectedPhotoTicket] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    page: 1,
    per_page: 20
  });

  // Separate search input state for debouncing
  const [searchInput, setSearchInput] = useState('');

  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    current_page: 1
  });

  // Memoize loadTickets to prevent unnecessary re-renders
  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await adminAPI.getTickets(filters);
      setTickets(data.tickets);
      setPagination({
        total: data.total,
        pages: data.pages,
        current_page: data.current_page
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput, page: 1 }));
    }, 300); // 300ms debounce (faster response)

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const data = await adminAPI.getServices();
      setServices(data.services);
    } catch (err) {
      console.error('Failed to load services:', err);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const generateSerialNumber = () => {
    // Generate serial number: Random Letter (A-Z) + 6 digits
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
    const numbers = Math.floor(100000 + Math.random() * 900000);
    return `${letter}${numbers}`;
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedTicket(null);
    setFormData({
      serial_number: generateSerialNumber(),
      service_id: services[0]?.id || '',
      fine_amount: '',
      offense_description: '',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      location: '',
      vehicle_plate: '',
      officer_badge: '',
      driver_name: '',
      driver_license: '',
      notes: ''
    });
    setShowModal(true);
  };

  const openEditModal = (ticket) => {
    setModalMode('edit');
    setSelectedTicket(ticket);
    setFormData({
      fine_amount: ticket.fine_amount,
      offense_description: ticket.offense_description,
      location: ticket.location || '',
      vehicle_plate: ticket.vehicle_plate || '',
      officer_badge: ticket.officer_badge || '',
      driver_name: ticket.driver_name || '',
      driver_license: ticket.driver_license || '',
      due_date: ticket.due_date.split('T')[0],
      notes: ticket.notes || ''
    });
    setShowModal(true);
  };

  const openVoidModal = (ticket) => {
    setModalMode('void');
    setSelectedTicket(ticket);
    setFormData({ reason: '' });
    setShowModal(true);
  };

  const openRefundModal = (ticket) => {
    setModalMode('refund');
    setSelectedTicket(ticket);
    setFormData({
      refund_amount: ticket.payment_amount || ticket.fine_amount,
      reason: ''
    });
    setShowModal(true);
  };

  const openMarkPaidModal = (ticket) => {
    setModalMode('mark-paid');
    setSelectedTicket(ticket);
    setFormData({
      payment_method: 'cash',
      payment_amount: ticket.fine_amount,
      payment_reference: '',
      notes: ''
    });
    setShowModal(true);
  };

  const openUnvoidModal = (ticket) => {
    setModalMode('unvoid');
    setSelectedTicket(ticket);
    setShowModal(true);
  };

  const openPhotoModal = (ticket) => {
    setSelectedPhotoTicket(ticket);
    setShowPhotoModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      if (modalMode === 'create') {
        await adminAPI.createTicket(formData);
      } else if (modalMode === 'edit') {
        await adminAPI.updateTicket(selectedTicket.id, formData);
      } else if (modalMode === 'void') {
        await adminAPI.voidTicket(selectedTicket.id, formData.reason);
      } else if (modalMode === 'refund') {
        await adminAPI.refundTicket(selectedTicket.id, formData);
      } else if (modalMode === 'mark-paid') {
        await adminAPI.markTicketPaid(selectedTicket.id, formData);
      } else if (modalMode === 'unvoid') {
        await adminAPI.unvoidTicket(selectedTicket.id);
      }

      setShowModal(false);
      loadTickets();
    } catch (err) {
      setError(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (ticketId) => {
    if (!window.confirm('Are you sure you want to delete this ticket?')) return;

    try {
      await adminAPI.deleteTicket(ticketId);
      loadTickets();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete ticket');
    }
  };

  const handleUnvoid = async (ticketId) => {
    if (!window.confirm('Are you sure you want to unvoid this ticket?')) return;

    try {
      await adminAPI.unvoidTicket(ticketId);
      loadTickets();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unvoid ticket');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      unpaid: { class: 'badge-warning', text: 'Unpaid' },
      paid: { class: 'badge-success', text: 'Paid' },
      overdue: { class: 'badge-danger', text: 'Overdue' },
      voided: { class: 'badge-secondary', text: 'Voided' },
      refunded: { class: 'badge-info', text: 'Refunded' }
    };
    const badge = badges[status] || badges.unpaid;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  const getPhotoIndicator = (ticket) => {
    if (ticket.photo_url) {
      return (
        <div className="photo-thumbnail-wrapper" onClick={() => openPhotoModal(ticket)} title="Click to view full photo">
          <img
            src={ticket.photo_url}
            alt="Ticket photo"
            className="photo-thumbnail"
          />
          <div className="photo-overlay">
            <span className="photo-icon">🔍</span>
          </div>
        </div>
      );
    }
    return <span className="no-photo" title="No photo uploaded">📷</span>;
  };

  return (
    <div className="ticket-management">
      <div className="page-header">
        <h1>🎫 Ticket Management</h1>
        <button onClick={openCreateModal} className="btn btn-primary">
          ➕ Create Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Status:</label>
          <select 
            value={filters.status} 
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="voided">Voided</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Serial, plate, driver..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <button onClick={loadTickets} className="btn btn-secondary">
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          ❌ {error}
        </div>
      )}

      {/* Tickets Table */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading tickets...</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>Service</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Photo</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="serial">{ticket.serial_number}</td>
                    <td>{ticket.service?.name}</td>
                    <td>${ticket.fine_amount.toFixed(2)}</td>
                    <td>{getStatusBadge(ticket.status)}</td>
                    <td>{ticket.vehicle_plate || '-'}</td>
                    <td>{ticket.driver_name || '-'}</td>
                    <td>{new Date(ticket.issue_date).toLocaleDateString()}</td>
                    <td>{new Date(ticket.due_date).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'center' }}>
                      {getPhotoIndicator(ticket)}
                    </td>
                    <td className="actions">
                      <div className="action-buttons">
                        <button
                          onClick={() => openEditModal(ticket)}
                          className="btn-icon"
                          title="Edit"
                        >
                          ✏️
                        </button>

                        {/* Mark as Paid - Only for unpaid/overdue tickets */}
                        {(ticket.status.toLowerCase() === 'unpaid' || ticket.status.toLowerCase() === 'overdue') && (
                          <button
                            onClick={() => openMarkPaidModal(ticket)}
                            className="btn-icon"
                            title="Mark as Paid"
                          >
                            💰
                          </button>
                        )}

                        {/* Refund - Only for paid tickets */}
                        {ticket.status.toLowerCase() === 'paid' && (
                          <button
                            onClick={() => openRefundModal(ticket)}
                            className="btn-icon"
                            title="Refund"
                          >
                            💸
                          </button>
                        )}

                        {/* Void - For all tickets except already voided */}
                        {ticket.status.toLowerCase() !== 'voided' && (
                          <button
                            onClick={() => openVoidModal(ticket)}
                            className="btn-icon"
                            title="Void"
                          >
                            🚫
                          </button>
                        )}

                        {/* Delete - Always available */}
                        <button
                          onClick={() => handleDelete(ticket.id)}
                          className="btn-icon danger"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button 
              onClick={() => handlePageChange(filters.page - 1)}
              disabled={filters.page === 1}
              className="btn btn-secondary"
            >
              ← Previous
            </button>
            
            <span className="page-info">
              Page {pagination.current_page} of {pagination.pages} ({pagination.total} total)
            </span>
            
            <button 
              onClick={() => handlePageChange(filters.page + 1)}
              disabled={filters.page >= pagination.pages}
              className="btn btn-secondary"
            >
              Next →
            </button>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalMode === 'create' && '➕ Create Ticket'}
                {modalMode === 'edit' && '✏️ Edit Ticket'}
                {modalMode === 'void' && '🚫 Void Ticket'}
                {modalMode === 'refund' && '💸 Refund Ticket'}
                {modalMode === 'mark-paid' && '💰 Mark as Paid'}
                {modalMode === 'unvoid' && '🔄 Unvoid Ticket'}
              </h2>
              <button onClick={() => setShowModal(false)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleSubmit}>
              {modalMode === 'create' && (
                <>
                  <div className="form-group">
                    <label>Serial Number *</label>
                    <div className="input-with-button">
                      <input
                        type="text"
                        value={formData.serial_number}
                        onChange={(e) => setFormData({...formData, serial_number: e.target.value})}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, serial_number: generateSerialNumber()})}
                        className="btn-auto"
                        title="Generate new serial number"
                      >
                        Auto
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Service *</label>
                    <select
                      value={formData.service_id}
                      onChange={(e) => setFormData({...formData, service_id: e.target.value})}
                      required
                    >
                      {services.map(service => (
                        <option key={service.id} value={service.id}>{service.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Fine Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.fine_amount}
                      onChange={(e) => setFormData({...formData, fine_amount: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Offense Description *</label>
                    <textarea
                      value={formData.offense_description}
                      onChange={(e) => setFormData({...formData, offense_description: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Vehicle Plate</label>
                      <input
                        type="text"
                        value={formData.vehicle_plate}
                        onChange={(e) => setFormData({...formData, vehicle_plate: e.target.value})}
                      />
                    </div>

                    <div className="form-group">
                      <label>Officer Badge</label>
                      <input
                        type="text"
                        value={formData.officer_badge}
                        onChange={(e) => setFormData({...formData, officer_badge: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Driver Name</label>
                      <input
                        type="text"
                        value={formData.driver_name}
                        onChange={(e) => setFormData({...formData, driver_name: e.target.value})}
                      />
                    </div>

                    <div className="form-group">
                      <label>Driver License</label>
                      <input
                        type="text"
                        value={formData.driver_license}
                        onChange={(e) => setFormData({...formData, driver_license: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>Due Date *</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>
                </>
              )}

              {modalMode === 'edit' && (
                <>
                  <div className="form-group">
                    <label>Fine Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.fine_amount}
                      onChange={(e) => setFormData({...formData, fine_amount: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>Offense Description</label>
                    <textarea
                      value={formData.offense_description}
                      onChange={(e) => setFormData({...formData, offense_description: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>Due Date</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>

                  {/* Unvoid button for voided tickets */}
                  {selectedTicket && selectedTicket.status === 'voided' && (
                    <div className="info-box warning" style={{ marginTop: '20px' }}>
                      <p><strong>⚠️ This ticket is voided</strong></p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowModal(false);
                          openUnvoidModal(selectedTicket);
                        }}
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '10px' }}
                      >
                        🔄 Unvoid This Ticket
                      </button>
                    </div>
                  )}
                </>
              )}

              {modalMode === 'void' && (
                <div className="form-group">
                  <label>Void Reason *</label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    required
                    placeholder="Enter reason for voiding this ticket..."
                  />
                </div>
              )}

              {modalMode === 'refund' && (
                <>
                  <div className="form-group">
                    <label>Refund Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.refund_amount}
                      onChange={(e) => setFormData({...formData, refund_amount: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Refund Reason *</label>
                    <textarea
                      value={formData.reason}
                      onChange={(e) => setFormData({...formData, reason: e.target.value})}
                      required
                      placeholder="Enter reason for refund..."
                    />
                  </div>
                </>
              )}

              {modalMode === 'mark-paid' && (
                <>
                  <div className="form-group">
                    <label>Payment Method *</label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                      required
                    >
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                      <option value="manual">Manual Entry</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Payment Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.payment_amount}
                      onChange={(e) => setFormData({...formData, payment_amount: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Payment Reference</label>
                    <input
                      type="text"
                      value={formData.payment_reference}
                      onChange={(e) => setFormData({...formData, payment_reference: e.target.value})}
                      placeholder="Check number, receipt number, etc."
                    />
                  </div>

                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      placeholder="Additional notes..."
                    />
                  </div>
                </>
              )}

              {modalMode === 'unvoid' && (
                <div className="info-box warning">
                  <p><strong>⚠️ Confirm Unvoid Operation</strong></p>
                  <p>This will restore the ticket to its previous status before it was voided.</p>
                  <p>Ticket: <strong>{selectedTicket?.serial_number}</strong></p>
                  <p>Current Status: <strong>Voided</strong></p>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {modalMode === 'create' && 'Create'}
                  {modalMode === 'edit' && 'Update'}
                  {modalMode === 'void' && 'Void Ticket'}
                  {modalMode === 'refund' && 'Issue Refund'}
                  {modalMode === 'mark-paid' && 'Mark as Paid'}
                  {modalMode === 'unvoid' && 'Unvoid Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && selectedPhotoTicket && (
        <div className="modal-overlay" onClick={() => setShowPhotoModal(false)}>
          <div className="modal-content photo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📷 Ticket Photo - {selectedPhotoTicket.serial_number}</h2>
              <button onClick={() => setShowPhotoModal(false)} className="close-btn">×</button>
            </div>
            <div className="modal-body">
              {selectedPhotoTicket.photo_url ? (
                <img
                  src={selectedPhotoTicket.photo_url}
                  alt={`Ticket ${selectedPhotoTicket.serial_number}`}
                  className="ticket-photo"
                />
              ) : (
                <div className="no-photo-message">
                  <p>No photo available for this ticket.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TicketManagement;
