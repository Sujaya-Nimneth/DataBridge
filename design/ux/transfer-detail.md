> **Template**: UX Spec

# Transfer Detail — UX Spec

- **Status**: Approved
- **Platform Target**: Web (desktop-first; keyboard/mouse primary, touch secondary)
- **Accessibility Tier**: WCAG 2.2 AA
- **Route**: `/transfers/:id` (see `frontend/src/App.jsx`)

## Purpose & User Need

- "I need a shareable answer to whether this transfer finished — and if it failed, exactly why — with progress I can trust while it is running."
- The user wants one URL they can send to a teammate, predictable Back to the list, a real rows/sec figure derived from actual samples, and an explicit statement when the data is stale.

## User Context on Arrival

- Authenticated, via a "View details" link on `/transfers`, a bookmarked/shared `/transfers/:id`, or browser Back.
- The job may be `running`/`pending` (live), `completed`, `failed`, or `cancelled`; the screen re-fetches on a 3s poll only while live.
- `id` comes from `useParams()`; there is no selection state carried from the list.

## Navigation Position

- A child of the Transfers section, reached from `/transfers` row actions; not a `Sidebar` item (the "Transfers" `NavLink` is not `end`, so it stays active for this route). Inside `AppLayout` with the skip link and `main#main-content`.
- Entry: `/transfers` "View details" (`<Link to={`/transfers/${tx.id}`}>`), deep link, browser history.
- Exit: `.detail-head` "All transfers" → `/transfers` (also present in the loading and not-found variants); the sidebar.

## Screen's One Question & One Finding

- **One Question**: "Did this transfer finish, and why did it fail?"
- **One Finding**: The `.page-finding` under the `h1` is status-specific: failed → "This transfer failed. The error and logs explain what happened."; running → "This transfer is running. Progress updates every 3 seconds."; completed → "Completed N rows in <duration>."; otherwise → "This transfer did not complete."

## Layout Specification

Zones: `.page-container`; `.detail-head` (back link on the left, `Freshness` on the right, omitted while loading); `.page-header` (h1 "Transfer detail" + `.page-finding` on the left, `.page-header-actions` with status `.badge` and a conditional "Cancel transfer" on the right); a source→target summary `.card`; a Progress `.card`; an optional Error `.card`; an Execution logs `.card`; and a `.confirm-overlay` / `.confirm-dialog` for cancellation.

| Zone / component | Real class names (`frontend/src/index.css`, `TransferDetail.jsx`) |
|---|---|
| Page frame / header | `.page-container`, `.detail-head`, `.page-header`, `.page-header-actions`, `.page-finding`, `.mt-4`, `.mt-6` |
| Navigation / freshness | `.btn`, `.btn-ghost`, `.btn-sm`, `.freshness`, `.freshness-stale`, `.freshness-text` |
| Status | `.badge`, `.badge-dot`, `.badge-success` / `.badge-primary` / `.badge-danger` / `.badge-warning` / `.badge-neutral` |
| Source→target summary | `.card`, `.transfer-summary-grid`, `.transfer-summary-arrow`, `.transfer-summary-extra`, `.field-label`, `.object-name`, `.font-mono`, `.text-sm`, `.text-muted` |
| Progress | `.card-header`, `.card-title`, `.progress-figures`, `.stat-label`, `.row-total-value`, `.progress-bar`, `.progress-fill`, `.card-subtitle` |
| Error / logs | `.form-error`, `.log-viewer`, `.log-entry`, `.log-time`, `.log-level` (+ `.info` / `.warning` / `.error`), `.log-message` |
| Cancel confirm | `.confirm-overlay`, `.confirm-dialog`, `.flex`, `.gap-2`, `.justify-between`, `.btn-danger`, `.btn-secondary` |
| Loading / not found | `.loading-overlay` (via `SkeletonBlock`), `.skeleton`, `.empty-state`, `.spinner` |

The source→target pair is a two-column `.transfer-summary-grid` joined by a `HiOutlineArrowRight` — the design system's "spine" artefact echoed in the wizard and the log.

## States & Variants

- **Loading**: `loading` renders `.detail-head` back link + one `.card[aria-hidden="true"]` with a `SkeletonBlock` (40%×26) and a 100%×42 bar; no `h1`, no `Freshness`. The layout is the final frame at real sizes.
- **Empty / populated**: `!job` → `.empty-state` "Transfer not found" with the load error or "This transfer may have been removed." and a "Retry" `.btn-secondary`. Populated → summary, progress, optional error card, and logs.
- **Error**: `loadError` sets "Couldn't load this transfer." and `stale = true`. When `job` already exists the finding/values stay on screen and `Freshness` shows the stale state; when there is no `job` the not-found empty state shows the error text with Retry. Cancel failure → `toast.error("Couldn't cancel this transfer. It may have already finished.")`.
- **Stale**: `Freshness` receives `stale={stale}` and renders "Update failed · showing last good data" in `.freshness-stale[aria-live="polite"]` with the Refresh button. `stale` is set when `load()` throws (excluding `CanceledError`/`AbortError`) or when `usePolling` reports `pollError`. A successful poll clears it and updates `updatedAt`.
- **Zero / missing**: `number()` returns a grey dash `–` for null/undefined, otherwise `Intl.NumberFormat`. `total = job.total_rows ?? null`; `transferred = job.transferred_rows ?? 0`; `pct` is `null` when `total` is falsy → the bar is hidden and the subtitle reads "Row total not available yet"; `0` prints as `0`. `formatDuration` returns `–` when `started_at` is missing. `source_connection_name` / `target_connection_name` fall back to "Unknown". `job.filter_query` and `job.error_message` cards render only when truthy. "No logs yet." when `logs` is empty. `rate` stays `null` (and the "rows/s" line is hidden) until two samples with increasing rows exist — nothing is labelled "live" without a current source.

## Interaction Map

- Keyboard-only flow: skip link → `main` → ".detail-head" "All transfers" → `Freshness` "Refresh data" → (if live) "Cancel transfer" → no other controls; the remaining cards are read-only.
- Focus order is DOM order of the back link, the Refresh button, then the header's Cancel button. Tables/cards contain no focusable elements. There is no roving tabindex.
- The cancel confirmation is a custom `.confirm-dialog[role="alertdialog"][aria-modal="true"]` (not the shared `Modal`): it closes on `Escape` via a document `keydown` listener, and its two buttons are "Keep running" → "Cancel transfer" in DOM order. Note: this dialog does not trap Tab or set/restore initial focus, unlike `Modal` (a gap against the committed tier).
- `Refresh` calls `load()` with no signal; polling is driven by `usePolling(load, 3000, isLive)` with `isLive = status === 'running' || status === 'pending'`.

## Data Requirements

Endpoints from `frontend/src/api/client.js` (`transfersAPI`) via `load()`.

| Displayed element / action | Source |
|---|---|
| Job: `status`, `source_connection_name`, `source_table`, `target_connection_name`, `target_table`, `filter_query`, `error_message`, `total_rows`, `transferred_rows`, `started_at`, `completed_at` | `transfersAPI.get(id, signal)` → `GET /transfers/:id` |
| Logs: `id`, `level`, `message`, `timestamp` | `transfersAPI.getLogs(id, signal)` → `GET /transfers/:id/logs` |
| Cancel transfer | `transfersAPI.cancel(id)` → `POST /transfers/:id/cancel` |

- Both GETs are issued concurrently in `Promise.all`, each with the abort `signal` from `usePolling`. On success `sampleRef` stores `{ rows: transferred_rows, at: now }`; the rate is `((next.rows - prev.rows) * 1000) / (now - prev.at)` only when rows increased and time advanced.
- Null handling: `job` / `rate` start `null`, `logs` `[]`, `updatedAt` `null`, `stale` `false`. `number()` → `–`. `total_rows` null → `pct` null → no bar. `pct` is clamped with `Math.min(100, ...)`. `transferred_rows` null → `0`. `Intl.NumberFormat` for counts and the rate (`maximumFractionDigits: 0`); `Intl.DateTimeFormat` for log times (hour/minute/second) and the `Freshness` stamp (hour/minute). `formatDuration` is client-side seconds→"Xs"/"Xm Ys"/"Xh Ym". `statusBadge` falls back to `badge-neutral`.

## URL State

- `/transfers/:id` — the `id` path param from `useParams()` is the whole state; `load` is keyed on `id` via `useCallback`. No query params, no `?view=` or `?tab=` on this screen. The URL is the shareable artefact that motivated promoting detail out of a modal.

## Accessibility Requirements (WCAG 2.2 AA)

- One `h1` ("Transfer detail"); cards use `aria-label` ("Source and target", "Progress", "Error", "Execution logs") rather than headings for the sections, with `h2.card-title` inside Progress/Error/Logs. Skip link to `#main-content`; `:focus-visible` on back link, Refresh and Cancel.
- `Freshness` announces via `aria-live="polite"`; the rows/s line is `aria-live="polite"`. The log viewer has `role="log"`, `aria-live="polite"`, `aria-relevant="additions"`. `<time dateTime>` carries raw timestamps. Status is a text `.badge` + `.badge-dot[aria-hidden]`, never colour-only; `log-level` is a text label (`info`/`warning`/`error`) with a hue.
- Decorative icons are `aria-hidden="true"`; the loading skeleton card is `aria-hidden="true"`. Progress bar is accompanied by the numeric `pct` text ("N% of M rows"), so it is not shape-only.
- Cancel dialog has `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby="cancel-title"` and Escape close, but lacks a focus trap / initial focus / focus restore (see Interaction Map). Toasts use `role="status"`.
- Contrast ≥ 4.5:1, 44×44 targets, `touch-action: manipulation`, reduced-motion fallback (`enter` travel drops), no horizontal page scroll.

## Localization Considerations

- Hardcoded English: the four `.page-finding` sentences, "Transfer detail", "All transfers", "Transferred / Total / Duration", "Row total not available yet", "No logs yet.", "N entries", "Error", "Execution logs", "Cancel this transfer?", "Rows already staged are discarded. The target table is left untouched.", "Keep running", "Cancel transfer", "Transfer not found", "This transfer may have been removed.", "Unknown". Extract whole sentences.
- "Completed N rows in <duration>." embeds two formatted values — keep them as separate tokens for `Intl.NumberFormat` / a locale-aware duration and `Intl.PluralRules`. "N% of M rows" and "N entries" likewise. "rows/s" is a unit that must stay adjacent to the number but may need reordering; budget ~40% expansion.
- Log timestamps use `Intl.DateTimeFormat(undefined, { hour, minute, second })`; `Freshness` uses hour/minute; both are locale-driven already. `filter_query`, `error_message`, `source_table`, `target_table`, connection names and log `level`/`message` are data/code tokens → `translate="no"`.
- Longest strings are the failure finding and the cancel-dialog explanation (~80 chars); the `.confirm-dialog` must accommodate 40% expansion at 390px without clipping its two buttons.

## Acceptance Criteria

1. The `.page-finding` matches the job status exactly (failed / running / completed-with-rows-and-duration / otherwise "This transfer did not complete."), and the header `.badge` uses the mapped `badge-*` class for that status.
2. With `total_rows` present and status `running` or `completed`, the `.progress-bar` width equals `Math.min(100, round(transferred/total*100))%` and the subtitle reads "N% of M rows"; with `total_rows` null the bar is absent and the subtitle reads "Row total not available yet".
3. While `status` is `running`/`pending`, `usePolling` re-fetches `GET /transfers/:id` and `GET /transfers/:id/logs` together every 3s; rows/s appears only after two samples with increasing `transferred_rows`, and a failed poll sets `Freshness` to "Update failed · showing last good data" without clearing the displayed job.
4. `!job` renders "Transfer not found" with a working "Retry"; `error_message` renders the Error card; logs render one `.log-entry` per item with `role="log"` and `<time dateTime>`, and empty logs show "No logs yet.".
5. Performance: the two GETs are concurrent via `Promise.all`, polling stops when the job leaves `running`/`pending`, in-flight requests are aborted with the `signal`, and no overlapping polls stack (chained-timeout hook).
6. Responsive: at 1440/768px `.transfer-summary-grid` is two columns; at ≤ 640px it collapses to one column with `.transfer-summary-arrow` rotated 90°, `.page-header h1` drops to 22px, and the page has no horizontal scroll at 390/768/1024/1440.
7. Keyboard: Tab order is "All transfers" → "Refresh data" → "Cancel transfer" (live only); the cancel `.confirm-dialog[role="alertdialog"]` closes on `Escape` and exposes "Keep running" then "Cancel transfer", with a visible `:focus-visible` ring on every control.
