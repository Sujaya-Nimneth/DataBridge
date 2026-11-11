/**
 * Reusable state primitives for app screens.
 *
 * Follows design/DESIGN-SYSTEM.md "States": flat skeleton bars at real sizes,
 * freshness stamps with a real source, empty states that keep the frame, and
 * errors inside the failed block (not a full-screen banner).
 */

import { HiOutlineRefresh } from 'react-icons/hi';

export function SkeletonBlock({ width = '100%', height = 14, className = '' }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ display: 'block', width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="skeleton-rows" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBlock key={i} width="100%" height={42} />
      ))}
    </div>
  );
}

/**
 * A freshness stamp. Never claims "live" — it states when data was last good
 * and offers a refresh. `stale` renders the explicit stale state used when a
 * polling cycle fails.
 */
export function Freshness({ updatedAt, onRefresh, loading = false, stale = false }) {
  const time = updatedAt
    ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(updatedAt)
    : null;

  return (
    <span className={`freshness ${stale ? 'freshness-stale' : ''}`} aria-live="polite">
      <span className="freshness-text">
        {stale ? 'Update failed · showing last good data' : time ? `Updated ${time}` : 'Not loaded'}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh data"
      >
        <HiOutlineRefresh aria-hidden="true" />
        Refresh
      </button>
    </span>
  );
}

/**
 * Empty state that keeps the frame and adds one sentence plus the first action.
 */
export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-state-icon">
          <Icon aria-hidden="true" />
        </div>
      )}
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

/**
 * Inline error for the block that failed: what failed, when data was last
 * good, and a Retry.
 */
export function InlineError({ message, onRetry, lastGood }) {
  return (
    <div className="alert alert-danger" role="alert">
      <span>
        {message}
        {lastGood ? ` Last updated ${lastGood}.` : ''}
      </span>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/** A real zero is printed in the normal style; missing is a grey dash. */
export function Value({ value, unit }) {
  const missing = value === null || value === undefined;
  return (
    <span className={missing ? 'value-missing' : 'value'}>
      {missing ? '–' : value}
      {!missing && unit ? <span className="value-unit"> {unit}</span> : null}
    </span>
  );
}

export default { SkeletonBlock, SkeletonRows, Freshness, EmptyState, InlineError, Value };
