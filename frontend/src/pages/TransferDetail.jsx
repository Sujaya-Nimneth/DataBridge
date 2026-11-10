/**
 * Transfer detail — the sharable answer to "did it finish, and why did it fail?".
 *
 * Promoted from a modal state to /transfers/:id so it deep-links and Back is
 * predictable. The live strip computes rows/sec from transferred_rows deltas
 * and states a stale state when a poll fails; nothing is labelled "live"
 * without a current source.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { transfersAPI } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { Freshness, SkeletonBlock } from '../components/States';
import { HiOutlineArrowRight, HiOutlineArrowLeft, HiOutlineStop } from 'react-icons/hi';

const statusBadge = (status) =>
  ({
    completed: 'badge-success',
    running: 'badge-primary',
    failed: 'badge-danger',
    pending: 'badge-warning',
    cancelled: 'badge-neutral',
  })[status] || 'badge-neutral';

function formatDuration(start, end) {
  if (!start) return '–';
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const diff = Math.max(0, Math.floor((e - s) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

const number = (n) =>
  n === null || n === undefined ? '–' : new Intl.NumberFormat().format(n);

function TransferDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [stale, setStale] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Keep the previous sample to derive a real rate, never a decorative pulse.
  const sampleRef = useRef(null);
  const [rate, setRate] = useState(null);

  const load = useCallback(async (signal) => {
    try {
      const [jobRes, logsRes] = await Promise.all([
        transfersAPI.get(id, signal),
        transfersAPI.getLogs(id, signal),
      ]);
      const next = jobRes.data;
      const now = Date.now();
      const prev = sampleRef.current;
      if (prev && next.transferred_rows > prev.rows && now > prev.at) {
        const rowsPerSec = ((next.transferred_rows - prev.rows) * 1000) / (now - prev.at);
        setRate(rowsPerSec);
      }
      sampleRef.current = { rows: next.transferred_rows, at: now };
      setJob(next);
      setLogs(logsRes.data);
      setUpdatedAt(new Date());
      setStale(false);
      setLoadError(null);
      return next;
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') throw err;
      setLoadError("Couldn't load this transfer.");
      setStale(true);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isLive = job?.status === 'running' || job?.status === 'pending';
  const { error: pollError } = usePolling(load, 3000, Boolean(isLive));

  useEffect(() => {
    if (pollError) setStale(true);
  }, [pollError]);

  const cancelTransfer = async () => {
    try {
      await transfersAPI.cancel(id);
      toast.success('Transfer cancelled');
      setConfirmCancel(false);
      load();
    } catch {
      toast.error("Couldn't cancel this transfer. It may have already finished.");
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="detail-head">
          <Link className="btn btn-ghost btn-sm" to="/transfers">
            <HiOutlineArrowLeft aria-hidden="true" /> All transfers
          </Link>
        </div>
        <div className="card" aria-hidden="true">
          <SkeletonBlock width="40%" height={26} />
          <div className="mt-4">
            <SkeletonBlock width="100%" height={42} />
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page-container">
        <div className="detail-head">
          <Link className="btn btn-ghost btn-sm" to="/transfers">
            <HiOutlineArrowLeft aria-hidden="true" /> All transfers
          </Link>
        </div>
        <div className="empty-state">
          <h3>Transfer not found</h3>
          <p>{loadError || 'This transfer may have been removed.'}</p>
          <button className="btn btn-secondary" type="button" onClick={() => load()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const total = job.total_rows ?? null;
  const transferred = job.transferred_rows ?? 0;
  const pct = total ? Math.min(100, Math.round((transferred / total) * 100)) : null;

  return (
    <div className="page-container">
      <div className="detail-head">
        <Link className="btn btn-ghost btn-sm" to="/transfers">
          <HiOutlineArrowLeft aria-hidden="true" /> All transfers
        </Link>
        <Freshness updatedAt={updatedAt} onRefresh={() => load()} stale={stale} />
      </div>

      <div className="page-header">
        <div>
          <h1>Transfer detail</h1>
          <p className="page-finding">
            {job.status === 'failed'
              ? 'This transfer failed. The error and logs explain what happened.'
              : job.status === 'running'
                ? 'This transfer is running. Progress updates every 3 seconds.'
                : job.status === 'completed'
                  ? `Completed ${number(transferred)} rows in ${formatDuration(job.started_at, job.completed_at)}.`
                  : 'This transfer did not complete.'}
          </p>
        </div>
        <div className="page-header-actions">
          <span className={`badge ${statusBadge(job.status)}`}>
            <span className="badge-dot" aria-hidden="true" />
            {job.status}
          </span>
          {isLive && (
            <button className="btn btn-danger" type="button" onClick={() => setConfirmCancel(true)}>
              <HiOutlineStop aria-hidden="true" /> Cancel transfer
            </button>
          )}
        </div>
      </div>

      <section className="card" aria-label="Source and target">
        <div className="transfer-summary-grid">
          <div>
            <div className="field-label">Source</div>
            <div className="object-name">{job.source_connection_name || 'Unknown'}</div>
            <div className="font-mono text-sm text-muted">{job.source_table}</div>
          </div>
          <HiOutlineArrowRight className="transfer-summary-arrow" aria-hidden="true" />
          <div>
            <div className="field-label">Target</div>
            <div className="object-name">{job.target_connection_name || 'Unknown'}</div>
            <div className="font-mono text-sm text-muted">{job.target_table}</div>
          </div>
        </div>
        {job.filter_query && (
          <div className="transfer-summary-extra">
            Filter <code className="font-mono">{job.filter_query}</code>
          </div>
        )}
      </section>

      <section className="card mt-6" aria-label="Progress">
        <div className="card-header">
          <h2 className="card-title">Progress</h2>
          {isLive && rate !== null && (
            <span className="text-sm text-muted" aria-live="polite">
              {new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(rate)} rows/s
            </span>
          )}
        </div>
        <div className="progress-figures">
          <div>
            <span className="stat-label">Transferred</span>
            <span className="row-total-value">{number(transferred)}</span>
          </div>
          <div>
            <span className="stat-label">Total</span>
            <span className="row-total-value">{number(total)}</span>
          </div>
          <div>
            <span className="stat-label">Duration</span>
            <span className="row-total-value">
              {formatDuration(job.started_at, job.completed_at)}
            </span>
          </div>
        </div>
        {(isLive || job.status === 'completed') && pct !== null && (
          <div className="progress-bar mt-4" style={{ height: '8px' }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
        <span className="card-subtitle">
          {pct !== null ? `${pct}% of ${number(total)} rows` : 'Row total not available yet'}
        </span>
      </section>

      {job.error_message && (
        <section className="card mt-6" aria-label="Error">
          <h2 className="card-title">Error</h2>
          <p className="form-error font-mono mt-4">{job.error_message}</p>
        </section>
      )}

      <section className="card mt-6" aria-label="Execution logs">
        <div className="card-header">
          <h2 className="card-title">Execution logs</h2>
          <span className="card-subtitle">{logs.length} entries</span>
        </div>
        <div className="log-viewer" role="log" aria-live="polite" aria-relevant="additions">
          {logs.length === 0 ? (
            <p className="text-muted text-sm">No logs yet.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="log-entry">
                <time className="log-time" dateTime={log.timestamp}>
                  {new Intl.DateTimeFormat(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }).format(new Date(log.timestamp))}
                </time>
                <span className={`log-level ${log.level}`}>{log.level}</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {confirmCancel && (
        <div className="confirm-overlay" role="presentation" onClick={() => setConfirmCancel(false)}>
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cancel-title">Cancel this transfer?</h2>
            <p className="text-sm text-muted mt-4">
              Rows already staged are discarded. The target table is left untouched.
            </p>
            <div className="flex gap-2 justify-between mt-6">
              <button className="btn btn-secondary" type="button" onClick={() => setConfirmCancel(false)}>
                Keep running
              </button>
              <button className="btn btn-danger" type="button" onClick={cancelTransfer}>
                Cancel transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransferDetail;
