/**
 * Dashboard — answers "is anything failing right now, and what ran today?".
 *
 * The largest block is the one divided KPI container; the one finding is stated
 * under the title next to the primary job. See design/DESIGN-SYSTEM.md.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { monitoringAPI } from '../api/client';
import { HiOutlineClipboardList, HiOutlineDatabase } from 'react-icons/hi';
import { SkeletonBlock } from '../components/States';
import { Freshness } from '../components/States';

const statusBadge = (status) =>
  ({
    completed: 'badge-success',
    running: 'badge-primary',
    failed: 'badge-danger',
    pending: 'badge-warning',
    cancelled: 'badge-neutral',
    success: 'badge-success',
    unknown: 'badge-neutral',
  })[status] || 'badge-neutral';

function formatTime(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const diff = Date.now() - date;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function Kpi({ label, value, unit, to }) {
  const inner = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {unit && <span className="stat-unit"> {unit}</span>}
      </span>
    </>
  );
  return to ? (
    <Link className="stat-card stat-card-action" to={to}>
      {inner}
    </Link>
  ) : (
    <div className="stat-card">{inner}</div>
  );
}

function Finding({ stats }) {
  if (!stats) return null;
  if (stats.failed_today > 0) {
    return (
      <p className="page-finding">
        <span className="finding-mark" aria-hidden="true">
          !
        </span>
        {stats.failed_today} transfer{stats.failed_today === 1 ? '' : 's'} failed today.{' '}
        <Link to="/transfers">Review the failures</Link>
      </p>
    );
  }
  if (stats.running_transfers > 0) {
    return (
      <p className="page-finding">
        {stats.running_transfers} transfer{stats.running_transfers === 1 ? '' : 's'} running now.{' '}
        <Link to="/transfers">Watch progress</Link>.
      </p>
    );
  }
  return (
    <p className="page-finding">
      No failures today. {stats.completed_today} transfer
      {stats.completed_today === 1 ? '' : 's'} completed.
    </p>
  );
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [connStatuses, setConnStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const loadDashboard = async () => {
    setLoadError(null);
    try {
      const [statsRes, activityRes, connRes] = await Promise.all([
        monitoringAPI.getDashboard(),
        monitoringAPI.getActivity(5),
        monitoringAPI.getConnectionStatuses(),
      ]);
      setStats(statsRes.data);
      setActivity(activityRes.data);
      setConnStatuses(connRes.data);
      setUpdatedAt(new Date());
    } catch (err) {
      setLoadError(err.response?.data?.message || "Couldn't load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          {!loading && !loadError && <Finding stats={stats} />}
        </div>
        <div className="page-header-actions">
          <Freshness updatedAt={updatedAt} onRefresh={loadDashboard} loading={loading} />
          <Link className="btn btn-primary" to="/transfers?new=1">
            New transfer
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="alert alert-danger" role="alert">
          <span>{loadError} Data below may be out of date.</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadDashboard}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="stats-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="stat-card" key={i}>
              <SkeletonBlock width="70%" height={12} />
              <SkeletonBlock width="45%" height={26} />
            </div>
          ))}
        </div>
      ) : (
        <div className="stats-grid">
          <Kpi label="Connections" value={stats?.total_connections ?? '–'} to="/connections" />
          <Kpi label="Reachable" value={stats?.active_connections ?? '–'} />
          <Kpi label="Running" value={stats?.running_transfers ?? '–'} to="/transfers" />
          <Kpi label="Completed today" value={stats?.completed_today ?? '–'} />
          <Kpi label="Failed today" value={stats?.failed_today ?? '–'} />
          <Kpi
            label="Finished successfully"
            value={stats ? `${stats.success_rate}` : '–'}
            unit={stats ? '%' : undefined}
          />
        </div>
      )}

      <div className="grid-2">
        <section className="card" aria-labelledby="recent-activity-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="recent-activity-title">
                Recent activity
              </h2>
              <div className="card-subtitle">Latest 5 transfer operations</div>
            </div>
            <Link className="btn btn-ghost btn-sm" to="/transfers">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="activity-feed" aria-hidden="true">
              {Array.from({ length: 3 }, (_, i) => (
                <div className="activity-item" key={i}>
                  <SkeletonBlock width="100%" height={14} />
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <HiOutlineClipboardList aria-hidden="true" />
              </div>
              <h3>No transfers yet</h3>
              <p>Create a connection, then move your first table.</p>
              <Link className="btn btn-primary" to="/connections">
                Add a connection
              </Link>
            </div>
          ) : (
            <div className="activity-feed">
              {activity.map((item) => (
                <div key={item.id} className="activity-item">
                  <div className={`activity-dot ${statusBadge(item.status)}`} aria-hidden="true" />
                  <div className="activity-content">
                    <div className="activity-description">{item.description}</div>
                    <div className="activity-meta">
                      <span className={`badge ${statusBadge(item.status)}`}>
                        <span className="badge-dot" aria-hidden="true" />
                        {item.status}
                      </span>
                      <time className="activity-time" dateTime={item.timestamp}>
                        {formatTime(item.timestamp)}
                      </time>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="connection-health-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="connection-health-title">
                Connection health
              </h2>
              <div className="card-subtitle">Most recent test per database</div>
            </div>
            <Link className="btn btn-ghost btn-sm" to="/connections">
              View all
            </Link>
          </div>
          {loading ? (
            <div aria-hidden="true">
              {Array.from({ length: 2 }, (_, i) => (
                <SkeletonBlock key={i} width="100%" height={42} />
              ))}
            </div>
          ) : connStatuses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <HiOutlineDatabase aria-hidden="true" />
              </div>
              <h3>No connections yet</h3>
              <p>Add a PostgreSQL or MySQL database to get started.</p>
              <Link className="btn btn-primary" to="/connections">
                Add a connection
              </Link>
            </div>
          ) : (
            <ul className="object-list">
              {connStatuses.map((conn) => (
                <li className="object-row" key={conn.id}>
                  <span className="object-kind font-mono" aria-hidden="true">
                    {conn.db_type === 'postgresql' ? 'PG' : 'MY'}
                  </span>
                  <span className="object-name truncate">{conn.name}</span>
                  <span className={`badge ${statusBadge(conn.status)}`}>
                    <span className="badge-dot" aria-hidden="true" />
                    {conn.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {!loading && stats?.total_rows_transferred > 0 && (
        <section className="card mt-6" aria-label="Total rows transferred">
          <div className="row-total">
            <span className="stat-label">Total rows transferred</span>
            <span className="row-total-value">
              {new Intl.NumberFormat().format(stats.total_rows_transferred)}
            </span>
            <span className="card-subtitle">Across {stats.total_transfers ?? 0} transfers</span>
          </div>
        </section>
      )}
    </div>
  );
}

export default Dashboard;
