/**
 * Monitoring - platform health, metrics, and activity log
 */

import { useCallback, useEffect, useState } from 'react';
import { adminAPI, monitoringAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  HiOutlineRefresh,
  HiOutlineChartBar,
  HiOutlineClock,
  HiOutlineDatabase,
  HiOutlineClipboardList,
  HiOutlineCheckCircle,
} from 'react-icons/hi';

function Monitoring() {
  const [stats, setStats] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [connStatuses, setConnStatuses] = useState([]);
  const [activity, setActivity] = useState([]);
  const [users, setUsers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [
        monitoringAPI.getDashboard(),
        monitoringAPI.getMetrics(),
        monitoringAPI.getConnectionStatuses(),
        monitoringAPI.getActivity(50),
      ];
      if (isAdmin) requests.push(adminAPI.listUsers());
      const [statsRes, metricsRes, connRes, activityRes, usersRes] = await Promise.all(requests);
      setStats(statsRes.data);
      setMetrics(metricsRes.data);
      setConnStatuses(connRes.data);
      setActivity(activityRes.data);
      if (usersRes) setUsers(usersRes.data);
    } catch {
      toast.error('Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const getStatusBadge = (status) => {
    const map = {
      completed: 'badge-success',
      running: 'badge-primary',
      failed: 'badge-danger',
      pending: 'badge-warning',
      cancelled: 'badge-neutral',
      success: 'badge-success',
      unknown: 'badge-neutral',
    };
    return map[status] || 'badge-neutral';
  };

  const formatTime = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString();
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

  const maxDailyCount = metrics?.daily_transfers
    ? Math.max(...metrics.daily_transfers.map((d) => d.count), 1)
    : 1;

  return (
    <div className="page-container">
      <div className="page-header page-header-actions">
        <div>
          <h1>Monitoring</h1>
          <p>Platform health, metrics, and activity tracking</p>
        </div>
        <button className="btn btn-secondary" onClick={loadAll}>
          <HiOutlineRefresh /> Refresh
        </button>
      </div>

      <div className="tabs" role="tablist" aria-label="Monitoring sections">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'connections', label: 'Connections' },
          { id: 'activity', label: 'Activity Log' },
          ...(isAdmin ? [{ id: 'users', label: 'Users (Admin)' }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Key Metrics */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-icon primary">
                <HiOutlineChartBar />
              </div>
              <div className="stat-value">{stats?.total_transfers || 0}</div>
              <div className="stat-label">Total Transfers</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon success">
                <HiOutlineCheckCircle aria-hidden="true" />
              </div>
              <div className="stat-value">{stats?.success_rate || 0}%</div>
              <div className="stat-label">Success Rate</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon info">
                <HiOutlineClock />
              </div>
              <div className="stat-value">
                {metrics?.average_duration_seconds
                  ? `${Math.round(metrics.average_duration_seconds)}s`
                  : '—'}
              </div>
              <div className="stat-label">Avg Duration</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon warning">
                <HiOutlineChartBar aria-hidden="true" />
              </div>
              <div className="stat-value">
                {stats?.total_rows_transferred?.toLocaleString() || 0}
              </div>
              <div className="stat-label">Total Rows Moved</div>
            </div>
          </div>

          <div className="grid-2">
            {/* Transfer Status Distribution */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Transfer Status Distribution</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {metrics?.status_counts &&
                  Object.entries(metrics.status_counts).map(([status, count]) => {
                    const total = Object.values(metrics.status_counts).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={status}>
                        <div
                          className="flex justify-between items-center mb-4"
                          style={{ marginBottom: '6px' }}
                        >
                          <span className={`badge ${getStatusBadge(status)}`}>
                            <span className="badge-dot"></span>
                            {status}
                          </span>
                          <span className="text-sm">
                            {count} ({Math.round(pct)}%)
                          </span>
                        </div>
                        <div className="progress-bar" style={{ height: '4px' }}>
                          <div
                            className="progress-fill"
                            style={{
                              width: `${pct}%`,
                              background:
                                status === 'completed'
                                  ? 'var(--color-success)'
                                  : status === 'failed'
                                    ? 'var(--color-danger)'
                                    : status === 'running'
                                      ? 'var(--color-primary)'
                                      : 'var(--color-text-muted)',
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Daily Transfer Chart */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Transfers (Last 7 Days)</div>
              </div>
              <div
                className="bar-chart"
                role="img"
                aria-label={`Transfers per day over the last 7 days. Peak ${maxDailyCount}.`}
              >
                {metrics?.daily_transfers?.map((day) => {
                  const heightPct =
                    maxDailyCount > 0 ? Math.max((day.count / maxDailyCount) * 100, 3) : 3;
                  const label = new Date(day.date).toLocaleDateString('en', {
                    weekday: 'short',
                  });
                  return (
                    <div key={day.date} className="bar-chart-column">
                      <span className="bar-chart-value text-xs font-bold">{day.count}</span>
                      <div className="bar-chart-track">
                        <div
                          className="bar-chart-bar"
                          style={{ height: `${heightPct}%` }}
                          title={`${label}: ${day.count} transfer${day.count === 1 ? '' : 's'}`}
                        />
                      </div>
                      <span className="text-xs text-muted">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'connections' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Connection Health Status</div>
          </div>
          {connStatuses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <HiOutlineDatabase aria-hidden="true" />
              </div>
              <h3>No connections configured</h3>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Connection</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Last Tested</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {connStatuses.map((conn) => (
                    <tr key={conn.id}>
                      <td style={{ fontWeight: 600 }}>{conn.name}</td>
                      <td>
                        <span
                          className={`badge ${conn.db_type === 'postgresql' ? 'badge-primary' : 'badge-info'}`}
                        >
                          {conn.db_type}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadge(conn.status)}`}>
                          <span className="badge-dot"></span>
                          {conn.status}
                        </span>
                      </td>
                      <td className="text-sm text-muted">{formatTime(conn.last_tested_at)}</td>
                      <td className="text-sm text-muted truncate">{conn.message || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Activity Log</div>
            <div className="card-subtitle">{activity.length} recent events</div>
          </div>
          {activity.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <HiOutlineClipboardList aria-hidden="true" />
              </div>
              <h3>No activity recorded</h3>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Rows</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(item.status)}`}>
                          <span className="badge-dot"></span>
                          {item.status}
                        </span>
                      </td>
                      <td className="text-sm">{item.rows?.toLocaleString() || '—'}</td>
                      <td className="text-sm text-muted">{formatTime(item.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {activeTab === 'users' && isAdmin && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Platform Users</div>
            <div className="card-subtitle">{users?.length || 0} registered accounts</div>
          </div>
          {(!users || users.length === 0) && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <HiOutlineClipboardList aria-hidden="true" />
              </div>
              <h3>No users found</h3>
            </div>
          )}
          {users && users.length > 0 && (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Connections</th>
                    <th>Transfers</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.email}</td>
                      <td>{u.full_name}</td>
                      <td>
                        <span
                          className={`badge ${u.role === 'admin' ? 'badge-warning' : 'badge-neutral'}`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {u.is_active ? 'active' : 'disabled'}
                        </span>
                      </td>
                      <td className="text-sm">{u.connection_count}</td>
                      <td className="text-sm">{u.transfer_count}</td>
                      <td className="text-sm text-muted">{formatTime(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Monitoring;
