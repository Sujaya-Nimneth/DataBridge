/**
 * Admin → Users. Promoted from a Monitoring tab to its own route so it
 * deep-links and has a predictable Back. Role-gated in the UI; the API also
 * enforces the admin role (403 otherwise).
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SkeletonRows } from '../components/States';
import { HiOutlineArrowLeft } from 'react-icons/hi';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminAPI.listUsers();
      setUsers(res.data);
    } catch (err) {
      setError(
        err.response?.status === 403
          ? 'You need the admin role to see this page.'
          : "Couldn't load users.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
    else setLoading(false);
  }, [user?.role]);

  if (user?.role !== 'admin') {
    return (
      <div className="page-container">
        <h1>Users</h1>
        <div className="empty-state mt-6">
          <h3>Admins only</h3>
          <p>This page lists every account on the platform. Ask an admin if you need access.</p>
          <Link className="btn btn-secondary" to="/">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="detail-head">
        <Link className="btn btn-ghost btn-sm" to="/monitoring">
          <HiOutlineArrowLeft aria-hidden="true" /> Monitoring
        </Link>
      </div>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="page-finding" aria-live="polite">
            {loading
              ? 'Loading…'
              : `${new Intl.NumberFormat().format(users.length)} registered account${users.length === 1 ? '' : 's'}.`}
          </p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <span>{error}</span>
          <button className="btn btn-secondary btn-sm" type="button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <section className="card" aria-label="Registered users">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : users.length === 0 && !error ? (
          <div className="empty-state">
            <h3>No users found</h3>
            <p>Accounts appear here once someone registers.</p>
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">
                    Connections
                  </th>
                  <th scope="col" className="text-right">
                    Transfers
                  </th>
                  <th scope="col">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="object-name">{u.full_name || '–'}</td>
                    <td className="text-sm text-muted">{u.email}</td>
                    <td>
                      <span
                        className={`badge ${u.role === 'admin' ? 'badge-warning' : 'badge-neutral'}`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        <span className="badge-dot" aria-hidden="true" />
                        {u.is_active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="text-right">
                      {new Intl.NumberFormat().format(u.connection_count)}
                    </td>
                    <td className="text-right">
                      {new Intl.NumberFormat().format(u.transfer_count)}
                    </td>
                    <td className="text-sm text-muted">
                      {dateFormat.format(new Date(u.created_at))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminUsers;
