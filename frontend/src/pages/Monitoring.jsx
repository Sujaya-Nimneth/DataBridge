/**
 * Monitoring - platform health, metrics, and activity log
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { monitoringAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Freshness, SkeletonBlock, SkeletonRows } from '../components/States';
import { HiOutlineDatabase, HiOutlineClipboardList } from 'react-icons/hi';

const number = (n) => (n === null || n === undefined ? '–' : new Intl.NumberFormat().format(n));

function Monitoring() {
  const [stats, setStats] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [connStatuses, setConnStatuses] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('view') || 'overview';
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const setTab = (id) => {
    setSearchParams(id === 'overview' ? {} : { view: id }, { replace: true });
  };

  const loadAll = useCallback(async () => {
    setLoadError(false);
    try {
      const [statsRes, metricsRes, connRes, activityRes] = await Promise.all([
        monitoringAPI.getDashboard(),
        monitoringAPI.getMetrics(),
        monitoringAPI.getConnectionStatuses(),
        monitoringAPI.getActivity(50),
      ]);
      setStats(statsRes.data);
      setMetrics(metricsRes.data);
      setConnStatuses(connRes.data);
      setActivity(activityRes.data);
      setUpdatedAt(new Date());
    } catch {
      setLoadError(true);
      toast.error("Couldn't load monitoring data");
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (!ts) return '–';
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ts));
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Monitoring</h1>
        </div>
        <div className="stats-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div className="stat-card" key={i}>
              <SkeletonBlock width="70%" height={12} />
              <SkeletonBlock width="45%" height={26} />
            </div>
          ))}
        </div>
        <div className="card">
          <SkeletonRows rows={5} />
        </div>
      </div>
    );
  }

  const maxDailyCount = metrics?.daily_transfers
    ? Math.max(...metrics.daily_transfers.map((d) => d.count), 1)
    : 1;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Monitoring</h1>
          <p>Platform health, metrics, and activity tracking</p>
        </div>
        <div className="page-header-actions">
          <Freshness
            updatedAt={updatedAt}
            onRefresh={loadAll}
            loading={loading}
            stale={loadError}
          />
          {isAdmin && (
            <Link className="btn btn-secondary" to="/admin/users">
              Users
            </Link>
          )}
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Monitoring sections">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'connections', label: 'Connections' },
          { id: 'activity', label: 'Activity log' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="stats-grid stats-grid-4">
            <div className="stat-card">
              <span className="stat-label">Total transfers</span>
              <span className="stat-value">{number(stats?.total_transfers ?? 0)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Finished successfully</span>
              <span className="stat-value">
                {number(stats?.success_rate ?? 0)}
                <span className="stat-unit">%</span>
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Average duration</span>
              <span className="stat-value">
                {metrics?.average_duration_seconds != null
                  ? `${Math.round(metrics.average_duration_seconds)}s`
                  : '–'}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Rows moved</span>
              <span className="stat-value">{number(stats?.total_rows_transferred ?? 0)}</span>
            </div>
          </div>

          <div className="grid-2">
            <section className="card" aria-labelledby="distribution-title">
              <div className="card-header">
                <h2 className="card-title" id="distribution-title">
                  Transfer status
                </h2>
                <span className="card-subtitle">Last 7 days</span>
              </div>
              {metrics?.status_counts && Object.keys(metrics.status_counts).length > 0 ? (
                <div className="distribution-list">
                  {Object.entries(metrics.status_counts).map(([status, count]) => {
                    const total = Object.values(metrics.status_counts).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div className="distribution-row" key={status}>
                        <span className="distribution-label">
                          <span className={`badge ${getStatusBadge(status)}`}>
                            <span className="badge-dot" aria-hidden="true" />
                            {status}
                          </span>
                        </span>
                        <span className="distribution-bar">
                          <span className="distribution-fill" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="distribution-value">
                          {count} <span className="text-muted">({Math.round(pct)}%)</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted">No transfers in this range.</p>
              )}
            </section>

            <section className="card" aria-labelledby="daily-title">
              <div className="card-header">
                <h2 className="card-title" id="daily-title">
                  Transfers per day
                </h2>
                <span className="card-subtitle">Last 7 days · peak {maxDailyCount}</span>
              </div>
              <div
                className="bar-chart"
                role="img"
                aria-label={`Transfers per day over the last 7 days. Peak ${maxDailyCount}.`}
              >
                {metrics?.daily_transfers?.map((day) => {
                  const heightPct =
                    maxDailyCount > 0 ? Math.max((day.count / maxDailyCount) * 100, 3) : 3;
                  const date = new Date(day.date);
                  const label = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(
                    date,
                  );
                  const full = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                    date,
                  );
                  return (
                    <div key={day.date} className="bar-chart-column">
                      <span className="bar-chart-value">{day.count}</span>
                      <div className="bar-chart-track">
                        <div
                          className="bar-chart-bar"
                          style={{ height: `${heightPct}%` }}
                          title={`${full}: ${day.count} transfer${day.count === 1 ? '' : 's'}`}
                        />
                      </div>
                      <span className="text-xs text-muted">{label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="card-subtitle mt-4">
                Counts are labelled on each bar; the tallest is {maxDailyCount}.
              </p>
            </section>
          </div>
        </>
      )}

      {activeTab === 'connections' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Connection health</h2>
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
                    <th scope="col">Connection</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                    <th scope="col">Last tested</th>
                    <th scope="col">Message</th>
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
                      <td className="text-sm text-muted truncate">{conn.message || '–'}</td>
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
            <h2 className="card-title">Activity log</h2>
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
                    <th scope="col">Event</th>
                    <th scope="col">Status</th>
                    <th scope="col">Rows</th>
                    <th scope="col">Time</th>
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
                      <td className="text-sm">{number(item.rows)}</td>
                      <td className="text-sm text-muted">{formatTime(item.timestamp)}</td>
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
