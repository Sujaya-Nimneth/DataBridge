/**
 * Reusable state primitives for app screens, backed by Astryx.
 *
 * Follows design/DESIGN-SYSTEM.md "States": flat skeleton bars at real sizes,
 * freshness stamps with a real source, empty states that keep the frame, and
 * errors inside the failed block (not a full-screen banner). The wrapper keeps
 * the app's existing named-export API so pages and tests keep working while
 * their internals migrate to the component system.
 */

import { Skeleton } from '@astryxdesign/core/Skeleton';
import { EmptyState as AstryxEmptyState } from '@astryxdesign/core/EmptyState';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { HiOutlineRefresh } from 'react-icons/hi';

export function SkeletonBlock({ width = '100%', height = 14, className = '' }) {
  return <Skeleton className={className} width={width} height={height} radius={1} />;
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
      <Button
        label="Refresh"
        variant="ghost"
        size="sm"
        aria-label="Refresh data"
        onClick={onRefresh}
        isLoading={loading}
        icon={<HiOutlineRefresh aria-hidden="true" />}
      />
    </span>
  );
}

/**
 * Empty state that keeps the frame and adds one sentence plus the first action.
 */
export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <AstryxEmptyState
      title={title}
      description={typeof children === 'string' ? children : undefined}
      icon={Icon ? <Icon /> : undefined}
      actions={action}
      headingLevel={3}
    >
      {typeof children !== 'string' ? children : null}
    </AstryxEmptyState>
  );
}

/**
 * Inline error for the block that failed: what failed, when data was last
 * good, and a Retry. role="alert" makes the failure announce immediately.
 */
export function InlineError({ message, onRetry, lastGood }) {
  return (
    <Banner
      status="error"
      role="alert"
      title={message}
      description={lastGood ? `Last updated ${lastGood}.` : undefined}
      collapsible={false}
      container="card"
      endContent={
        onRetry ? (
          <Button label="Retry" variant="secondary" size="sm" onClick={onRetry} />
        ) : undefined
      }
    />
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
