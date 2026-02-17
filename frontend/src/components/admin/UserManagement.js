/**
 * User Management Component
 * CRUD operations for users with role-based access control
 */

import React, { useState, useEffect } from 'react';
import adminAPI from '../../services/adminApi';
import UserPanelManager from './UserPanelManager';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({});
  const [showPanelManager, setShowPanelManager] = useState(false);
  const [panelManagerUser, setPanelManagerUser] = useState(null);

  useEffect(() => {
    loadUsers();
    loadAvailableRoles();
  }, []);

  const loadAvailableRoles = async () => {
    try {
      const data = await adminAPI.getAvailableRoles();
      setAvailableRoles(data.roles || []);
    } catch (err) {
      console.error('Failed to load roles:', err);
      // Fallback to basic roles if API fails
      setAvailableRoles([
        { value: 'admin', label: 'Administrator', description: 'Full access' },
        { value: 'user', label: 'User', description: 'Basic access' }
      ]);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await adminAPI.getUsers();
      setUsers(data.users);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({
      username: '',
      email: '',
      password: '',
      full_name: '',
      phone: '',
      role: 'user',
      is_active: true
    });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setModalMode('edit');
    setSelectedUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name || '',
      phone: user.phone || '',
      role: user.role,
      is_active: user.is_active
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === 'create') {
        await adminAPI.createUser(formData);
      } else {
        await adminAPI.updateUser(selectedUser.id, formData);
      }
      setShowModal(false);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Deactivate this user?')) return;
    try {
      await adminAPI.deleteUser(userId);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleResetPassword = async (userId) => {
    const newPassword = prompt('Enter new password:');
    if (!newPassword) return;
    
    try {
      await adminAPI.resetUserPassword(userId, newPassword);
      alert('Password reset successfully');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const openPanelManager = (user) => {
    setPanelManagerUser(user);
    setShowPanelManager(true);
  };

  const closePanelManager = () => {
    setShowPanelManager(false);
    setPanelManagerUser(null);
  };

  const handlePanelUpdate = () => {
    // Optionally reload users to show updated info
    loadUsers();
  };

  if (loading) return <div className="loading-container"><div className="loading-spinner"></div></div>;

  return (
    <div className="user-management">
      <div className="page-header">
        <h1>👥 User Management</h1>
        <button onClick={openCreateModal} className="btn btn-primary">➕ Create User</button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Full Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>{user.full_name || '-'}</td>
                <td><span className={`badge badge-${user.role}`}>{user.role}</span></td>
                <td><span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span></td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="actions">
                  <button onClick={() => openEditModal(user)} className="btn-icon" title="Edit">✏️</button>
                  <button onClick={() => openPanelManager(user)} className="btn-icon" title="Manage Panels">🎛️</button>
                  <button onClick={() => handleResetPassword(user.id)} className="btn-icon" title="Reset Password">🔑</button>
                  <button onClick={() => handleDelete(user.id)} className="btn-icon danger" title="Deactivate">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? '➕ Create User' : '✏️ Edit User'}</h2>
              <button onClick={() => setShowModal(false)} className="close-btn">×</button>
            </div>
            <form onSubmit={handleSubmit}>
              {modalMode === 'create' && (
                <>
                  <div className="form-group">
                    <label>Username *</label>
                    <input type="text" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Password *</label>
                    <input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required />
                  </div>
                </>
              )}
              <div className="form-group">
                <label>Email *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select 
                  value={formData.role} 
                  onChange={(e) => setFormData({...formData, role: e.target.value})} 
                  required
                  className="role-select"
                >
                  <option value="">Select a role...</option>
                  {availableRoles.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label} - {role.description}
                    </option>
                  ))}
                </select>
                {formData.role && (
                  <small className="role-description">
                    {availableRoles.find(r => r.value === formData.role)?.description}
                  </small>
                )}
              </div>
              <div className="form-group">
                <label>
                  <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({...formData, is_active: e.target.checked})} />
                  Active
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{modalMode === 'create' ? 'Create' : 'Update'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPanelManager && panelManagerUser && (
        <UserPanelManager
          user={panelManagerUser}
          onClose={closePanelManager}
          onUpdate={handlePanelUpdate}
        />
      )}
    </div>
  );
}

export default UserManagement;
