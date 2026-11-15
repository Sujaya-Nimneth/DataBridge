/**
 * Shared status badge, backed by the Astryx Badge.
 *
 * Replaces the five per-page `badge-*` class maps with one semantic mapping.
 * The status word is always rendered as text, so colour is never the only
 * carrier of information (WCAG 2.2 AA keep). Badge semantic variants use solid
 * fills; the committed Data Terminal theme overrides them to pale tints with
 * dark ink of the same hue.
 */

import { Badge } from '@astryxdesign/core/Badge';

const STATUS_VARIANT = {
  completed: 'success',
  success: 'success',
  active: 'success',
  running: 'info',
  pending: 'warning',
  failed: 'error',
  error: 'error',
  inactive: 'neutral',
  cancelled: 'neutral',
  unknown: 'neutral',
  admin: 'warning',
  user: 'neutral',
};

export function StatusBadge({ status, label, variant }) {
  const resolved = variant ?? STATUS_VARIANT[status] ?? 'neutral';
  return <Badge variant={resolved} label={label ?? status} />;
}

export default StatusBadge;
