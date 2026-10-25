/**
 * Database connections management
 */

import { useState, useEffect } from 'react';
import { connectionsAPI } from '../api/client';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineStatusOnline,
  HiOutlineDatabase,
} from 'react-icons/hi';

function Connections() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editConn, setEditConn] = useState(null);
  const [testing, setTesting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [formErrors, setFormErrors] = useState([]);
  const [form, setForm] = useState({
    name: '',
    db_type: 'postgresql',
    host: '',
    port: 5432,
    database_name: '',
    username: '',
    password: '',
    ssl_enabled: false,
  });

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const res = await connectionsAPI.list();
      setConnections(res.data);
    } catch {
      toast.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      db_type: 'postgresql',
      host: '',
      port: 5432,
      database_name: '',
      username: '',
      password: '',
      ssl_enabled: false,
    });
    setEditConn(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (conn) => {
    setForm({
      name: conn.name,
      db_type: conn.db_type,
      host: conn.host,
      port: conn.port,
      database_name: conn.database_name,
      username: conn.username,
      password: '',
      ssl_enabled: conn.ssl_enabled,
    });
    setEditConn(conn);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors([]);

    const port = Number(form.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setFormErrors(['port: must be a whole number between 1 and 65535']);
      return;
    }

    try {
      if (editConn) {
        const updateData = { ...form, port };
        if (!updateData.password) delete updateData.password;
        await connectionsAPI.update(editConn.id, updateData);
        toast.success('Connection updated');
      } else {
        await connectionsAPI.create({ ...form, port });
        toast.success('Connection created');
      }
      setShowModal(false);
      loadConnections();
    } catch (err) {
      const details = err.response?.data?.details;
      if (Array.isArray(details) && details.length > 0) {
        setFormErrors(details.map((d) => `${d.field}: ${d.message}`));
      } else {
        toast.error(err.response?.data?.message || 'Operation failed');
      }
    }
  };

  const handleDelete = async (id) => {
    try {
      await connectionsAPI.delete(id);
      toast.success('Connection deleted');
      setConfirmDelete(null);
      loadConnections();
    } catch (err) {
      const message = err.response?.data?.message;
      if (err.response?.status === 409) {
        toast.error(message || 'Connections with transfer history cannot be deleted');
      } else {
        toast.error('Failed to delete connection');
      }
      setConfirmDelete(null);
    }
  };

  const handleToggleActive = async (conn) => {
    try {
      await connectionsAPI.update(conn.id, { is_active: !conn.is_active });
      toast.success(conn.is_active ? 'Connection deactivated' : 'Connection activated');
      loadConnections();
    } catch {
      toast.error('Failed to update connection');
    }
  };

  const handleTest = async (id) => {
    setTesting(id);
    try {
      const res = await connectionsAPI.test(id);
      if (res.data.success) {
        toast.success(`Connected! (${res.data.latency_ms}ms)`);
      } else {
        toast.error(res.data.message);
      }
      loadConnections();
    } catch {
      toast.error('Connection test failed');
    } finally {
      setTesting(null);
    }
  };

  const getStatusBadge = (status) => {
    const map = { success: 'badge-success', failed: 'badge-danger', unknown: 'badge-neutral' };
    return map[status] || 'badge-neutral';
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-overlay">
          <div className="spinner spinner-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header page-header-actions">
        <div>
          <h1>Connections</h1>
          <p>Manage your database connections</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="btn-add-connection">
          <HiOutlinePlus /> Add Connection
        </button>
      </div>

      {connections.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <HiOutlineDatabase aria-hidden="true" />
            </div>
            <h3>No connections configured</h3>
            <p>Add your first database connection to start exploring and transferring data.</p>
            <button className="btn btn-primary" onClick={openCreate}>
              <HiOutlinePlus /> Add Connection
            </button>
          </div>
        </div>
      ) : (
        <div className="connection-grid">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className={`connection-card ${conn.is_active ? '' : 'connection-card-inactive'}`}
            >
              <div className="connection-card-header">
                <div>
                  <div className="connection-name">{conn.name}</div>
                  <div className="connection-host font-mono text-sm">
                    {conn.host}:{conn.port}/{conn.database_name}
                  </div>
                </div>
                <div className={`connection-type-icon ${conn.db_type}`}>
                  {conn.db_type === 'postgresql' ? 'PG' : 'MY'}
                </div>
              </div>

              <div className="connection-status">
                <span className={`badge ${getStatusBadge(conn.last_test_status)}`}>
                  <span className="badge-dot"></span>
                  {conn.last_test_status}
                </span>
                {!conn.is_active && <span className="badge badge-neutral">inactive</span>}
                {conn.last_tested_at && (
                  <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
                    Tested {new Date(conn.last_tested_at).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="connection-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleTest(conn.id)}
                  disabled={testing === conn.id}
                  id={`btn-test-${conn.id}`}
                >
                  {testing === conn.id ? (
                    <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                  ) : (
                    <HiOutlineStatusOnline />
                  )}
                  Test
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(conn)}>
                  <HiOutlinePencil /> Edit
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleToggleActive(conn)}
                  title={conn.is_active ? 'Deactivate connection' : 'Activate connection'}
                >
                  {conn.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  className="btn btn-ghost btn-sm btn-danger-icon"
                  onClick={() => setConfirmDelete(conn)}
                  aria-label={`Delete connection ${conn.name}`}
                >
                  <HiOutlineTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal
          title={editConn ? 'Edit Connection' : 'New Connection'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit}>
            {formErrors.length > 0 && (
              <div className="alert alert-danger" role="alert">
                <ul className="wizard-error-list">
                  {formErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="input-conn-name">
                Connection Name
              </label>
              <input
                id="input-conn-name"
                className="form-input"
                value={form.name}
                placeholder="My Production DB"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="input-conn-type">
                Database Type
              </label>
              <select
                id="input-conn-type"
                className="form-input form-select"
                value={form.db_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    db_type: e.target.value,
                    port: e.target.value === 'postgresql' ? 5432 : 3306,
                  })
                }
                disabled={!!editConn}
              >
                <option value="postgresql">PostgreSQL</option>
                <option value="mysql">MySQL</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="input-conn-host">
                  Host
                </label>
                <input
                  id="input-conn-host"
                  className="form-input"
                  value={form.host}
                  placeholder="localhost"
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="input-port">
                  Port
                </label>
                <input
                  id="input-port"
                  className="form-input"
                  type="number"
                  min="1"
                  max="65535"
                  value={form.port}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      port: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="input-conn-db">
                Database Name
              </label>
              <input
                id="input-conn-db"
                className="form-input"
                value={form.database_name}
                placeholder="mydb"
                onChange={(e) => setForm({ ...form, database_name: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="input-conn-user">
                  Username
                </label>
                <input
                  id="input-conn-user"
                  className="form-input"
                  value={form.username}
                  placeholder="postgres"
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="input-conn-pass">
                  Password
                </label>
                <input
                  id="input-conn-pass"
                  className="form-input"
                  type="password"
                  value={form.password}
                  placeholder={editConn ? '(unchanged)' : 'Enter password'}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editConn}
                />
              </div>
            </div>
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.ssl_enabled}
                onChange={(e) => setForm({ ...form, ssl_enabled: e.target.checked })}
              />
              <span className="text-sm">Enable SSL</span>
            </label>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" id="btn-save-connection">
                {editConn ? 'Update' : 'Create'} Connection
              </button>
            </div>
          </form>
        </Modal>
      )}
      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <Modal
          title="Delete Connection"
          maxWidth="440px"
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDelete(null)}
              >
                Keep Connection
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleDelete(confirmDelete.id)}
                id="btn-confirm-delete"
              >
                Delete
              </button>
            </>
          }
        >
          <p className="text-sm">
            Delete <span className="font-semibold">{confirmDelete.name}</span> permanently?
          </p>
          <p className="text-sm text-muted">
            Stored credentials are removed. Connections referenced by transfer history are protected
            and cannot be deleted.
          </p>
        </Modal>
      )}
    </div>
  );
}

export default Connections;
