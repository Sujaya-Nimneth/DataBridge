/**
 * Dashboard page with stats, activity feed, and connection health overview.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { monitoringAPI } from '../api/client';
import {
  HiOutlineDatabase,
  HiOutlineSwitchHorizontal,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineTrendingUp,
  HiOutlineClipboardList,
} from 'react-icons/hi';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [connStatuses, setConnStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [statsRes, activityRes, connRes] = await Promise.all([
        monitoringAPI.getDashboard(),
        monitoringAPI.getActivity(10),
        monitoringAPI.getConnectionStatuses(),
      ]);
      setStats(statsRes.data);
      setActivity(activityRes.data);
      setConnStatuses(connRes.data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case 'completed': return 'var(--color-success)';
      case 'running': return 'var(--color-primary)';
      case 'failed': return 'var(--color-danger)';
      case 'pending': return 'var(--color-warning)';
      case 'cancelled': return 'var(--color-text-muted)';
      default: return 'var(--color-text-muted)';
    }
  };

  const getStatusBadge = (status) => {
    const classes = {
      completed: 'badge-success',
      running: 'badge-primary',
      failed: 'badge-danger',
      pending: 'badge-warning',
      cancelled: 'badge-neutral',
      success: 'badge-success',
      unknown: 'badge-neutral',
    };
    return classes[status] || 'badge-neutral';
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-overlay">
          <div className="spinner spinner-lg"></div>
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of your data connectivity platform</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/connections')} style={{ cursor: 'pointer' }}>
          <div className="stat-card-icon primary">
            <HiOutlineDatabase />
          </div>
          <div className="stat-value">{stats?.total_connections || 0}</div>
          <div className="stat-label">Total Connections</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon success">
            <HiOutlineCheckCircle />
          </div>
          <div className="stat-value">{stats?.active_connections || 0}</div>
          <div className="stat-label">Active Connections</div>
        </div>

        <div className="stat-card" onClick={() => navigate('/transfers')} style={{ cursor: 'pointer' }}>
          <div className="stat-card-icon info">
            <HiOutlineSwitchHorizontal />
          </div>
          <div className="stat-value">{stats?.running_transfers || 0}</div>
          <div className="stat-label">Running Transfers</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon warning">
            <HiOutlineTrendingUp />
          </div>
          <div className="stat-value">{stats?.success_rate || 0}%</div>
          <div className="stat-label">Success Rate</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon success">
            <HiOutlineClipboardList />
          </div>
          <div className="stat-value">{stats?.completed_today || 0}</div>
          <div className="stat-label">Completed Today</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon danger">
            <HiOutlineExclamationCircle />
          </div>
          <div className="stat-value">{stats?.failed_today || 0}</div>
          <div className="stat-label">Failed Today</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid-2">
        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Activity</div>
              <div className="card-subtitle">Latest transfer operations</div>
            </div>
          </div>
          {activity.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-state-icon">📋</div>
              <h3>No activity yet</h3>
              <p>Start by creating a connection and running your first transfer</p>
            </div>
          ) : (
            <div className="activity-feed">
              {activity.map((item) => (
                <div key={item.id} className="activity-item">
                  <div
                    className="activity-dot"
                    style={{ background: statusColor(item.status) }}
                  />
                  <div className="activity-content">
                    <div className="activity-description">{item.description}</div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${getStatusBadge(item.status)}`}>
                        <span className="badge-dot"></span>
                        {item.status}
                      </span>
                      <span className="activity-time">{formatTime(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connection Health */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Connection Health</div>
              <div className="card-subtitle">Status of configured databases</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/connections')}>
              View All
            </button>
          </div>
          {connStatuses.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-state-icon">🔌</div>
              <h3>No connections</h3>
              <p>Add a database connection to get started</p>
              <button className="btn btn-primary" onClick={() => navigate('/connections')}>
                Add Connection
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {connStatuses.map((conn) => (
                <div
                  key={conn.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-glass)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div
                    className={`connection-type-icon ${conn.db_type}`}
                    style={{ width: '32px', height: '32px', fontSize: '12px' }}
                  >
                    {conn.db_type === 'postgresql' ? 'PG' : 'MY'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{conn.name}</div>
                  </div>
                  <span className={`badge ${getStatusBadge(conn.status)}`}>
                    <span className="badge-dot"></span>
                    {conn.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Total Rows Stats */}
      {stats?.total_rows_transferred > 0 && (
        <div className="card mt-6" style={{ textAlign: 'center', padding: '32px' }}>
          <div className="text-muted text-sm mb-4">Total Rows Transferred</div>
          <div style={{ fontSize: '48px', fontWeight: '800', letterSpacing: '-2px', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {stats.total_rows_transferred.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
