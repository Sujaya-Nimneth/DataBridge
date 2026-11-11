> **Template**: UX Spec

# Monitoring — UX Spec

- **Status**: Approved
- **Platform Target**: Web (desktop-first; keyboard/mouse primary, touch secondary)
- **Accessibility Tier**: WCAG 2.2 AA
- **Route**: `/monitoring` (see `frontend/src/App.jsx`)

## Purpose & User Need

- "I need the platform-level picture — how many transfers ran, how often they succeed, how long they take, and which connections are unhealthy — with an activity log I can audit."
- The user wants a deeper cut than the Dashboard (last-7-day distributions, a 50-event log), a shareable tab selection, and a way to reach the Users list if they are an admin.

## User Context on Arrival

- Authenticated, via the sidebar "Monitoring" `NavLink`, a deep link `?view=`, or Back from `/admin/users`.
- Role matters: `user?.role === 'admin'` adds the "Users" link in `.page-header-actions`.
- The screen loads four datasets at once on mount; there is no polling.

## Navigation Position

- Fifth item in `Sidebar` (`baseNavItems[4]`, path `/monitoring`), inside `AppLayout` with the skip link and `main#main-content`.
- Entry: sidebar, deep link `?view=connections|activity`, Back from `/admin/users` (whose `.detail-head` links here).
- Exit: "Users" `.btn-secondary` → `/admin/users` (admin only); the sidebar. The three tabs are in-place, not routes.

## Screen's One Question & One Finding

- **One Question**: "Is the platform healthy, and what has it been doing?"
- **One Finding**: The Overview answers with a 4-cell `.stats-grid.stats-grid-4` — "Total transfers", "Finished successfully" (%), "Average duration", "Rows moved". "Transfer status" (last 7 days) and "Transfers per day" carry the trend, and the "peak N" subtitle states the single busiest-day figure.

## Layout Specification

Zones: `.page-container`; `.page-header` (h1 "Monitoring", subtitle "Platform health, metrics, and activity tracking", `.page-header-actions` with `Freshness` + admin-only "Users"); `.tabs` (Overview / Connections / Activity log); then one of three tab bodies.

| Zone / component | Real class names (`frontend/src/index.css`, `Monitoring.jsx`) |
|---|---|
| Page frame / header | `.page-container`, `.page-header`, `.page-header-actions` |
| Freshness / users | `.freshness`, `.freshness-stale`, `.freshness-text`, `.btn-secondary` |
| Tabs | `.tabs`, `.tab`, `.tab.active` (1px `::after` accent line), `role="tablist"` |
| Overview KPIs | `.stats-grid`, `.stats-grid-4`, `.stat-card`, `.stat-label`, `.stat-value`, `.stat-unit` |
| Status distribution | `.grid-2`, `.card`, `.card-header`, `.card-title`, `.card-subtitle`, `.distribution-list`, `.distribution-row`, `.distribution-label`, `.distribution-bar`, `.distribution-fill`, `.distribution-value`, `.badge`, `.badge-dot` |
| Daily chart | `.bar-chart`, `.bar-chart-column`, `.bar-chart-value`, `.bar-chart-track`, `.bar-chart-bar`, `.text-xs`, `.text-muted` |
| Connections / Activity tables | `.data-table-wrapper`, `.data-table`, `.badge-primary`, `.badge-info`, `.truncate` |
| Empty / loading | `.empty-state`, `.empty-state-icon`, `.skeleton` (`SkeletonBlock`, `SkeletonRows`), `.spinner` |

Overview is a `.grid-2` of two cards: "Transfer status" (distribution bars, "Last 7 days") and "Transfers per day" (bar chart, "Last 7 days · peak N").

## States & Variants

- **Loading**: `loading` renders a `.page-header` with the `h1` only (no subtitle, no actions), a `.stats-grid` of 4 `.stat-card` skeletons (each with 70%×12 and 45%×26 `SkeletonBlock`s, `aria-hidden="true"`), and one `.card` with `SkeletonRows rows={5}` (five 100%×42 bars). No layout shift when data arrives.
- **Empty / populated**: Overview with no `status_counts` → "No transfers in this range." in `.text-sm.text-muted`; empty `daily_transfers` → an empty `.bar-chart` (bars are mapped, so no columns) with the "Counts are labelled on each bar; the tallest is N." subtitle. "Connections" tab with zero statuses → `.empty-state` "No connections configured". "Activity log" tab with zero events → "No activity recorded". Populated → distribution rows, bar-chart columns, and the two tables.
- **Error**: `loadAll()` failure sets `loadError = true`, fires `toast.error("Couldn't load monitoring data")`, and passes `stale={loadError}` to `Freshness` — the explicit "Update failed · showing last good data" stamp with a Refresh button. Previously loaded values are kept (state is not cleared).
- **Stale**: no polling; staleness is the `Freshness` "Updated HH:MM" stamp plus the `stale` variant on a failed (re)load, with manual Refresh.
- **Zero / missing**: `number()` returns `–` for null/undefined; KPI defaults `?? 0` so zero prints as `0` / `0%`. `average_duration_seconds` null → `–`, else a rounded `"Ns"`. `formatTime('')` → `–`. `conn.message || '–'` for a missing message. `maxDailyCount` falls back to `1` when there are no daily counts, and each bar height is `max(..., 3)` so a zero-count day still has a 3% marker. `status_counts` missing → the "No transfers in this range." sentence. Unknown status → `badge-neutral`.

## Interaction Map

- Keyboard-only flow: skip link → `main` → `Freshness` "Refresh data" → (admin) "Users" link → the three tabs left-to-right (Overview, Connections, Activity log) → tab body content (tables/charts are non-interactive).
- Tabs are `<button role="tab">` with `id="tab-{id}"`, `aria-selected`, `aria-controls="panel-{id}"`; `setTab` writes `?view=` (cleared for `overview`) with `replace: true`. There are no matching `tabpanel` elements and no arrow-key roving tabindex — Tab moves through each button in DOM order (a gap against the committed checklist).
- Focus order is pure DOM order; no focus trap. `Refresh` calls `loadAll()`; the admin "Users" link is a real `<Link>`.
- The bar chart uses `title` on each `.bar-chart-bar` for a hover tooltip (mouse-only supplementary information); the same date and count are available in the `aria-label` and the visible `.bar-chart-value`, so no hover-only dependency for the core data.

## Data Requirements

Endpoints from `frontend/src/api/client.js` (`monitoringAPI`), all four issued in one `Promise.all` in `loadAll()`.

| Displayed element | Source |
|---|---|
| `total_transfers`, `success_rate`, `total_rows_transferred` | `monitoringAPI.getDashboard()` → `GET /monitoring/dashboard` |
| `average_duration_seconds`, `status_counts`, `daily_transfers` (`date`, `count`) | `monitoringAPI.getMetrics()` → `GET /monitoring/metrics` |
| Connections tab: `id`, `name`, `db_type`, `status`, `last_tested_at`, `message` | `monitoringAPI.getConnectionStatuses()` → `GET /monitoring/connections/status` |
| Activity tab: `id`, `description`, `status`, `rows`, `timestamp` | `monitoringAPI.getActivity(50)` → `GET /monitoring/activity?limit=50` |

- Null handling: `stats` / `metrics` start `null`, `connStatuses` / `activity` `[]`, `updatedAt` `null`. Guards: `stats?.x ?? 0`, `metrics?.average_duration_seconds != null`, `metrics?.status_counts && Object.keys(...).length > 0`, `metrics?.daily_transfers?.map`, `conn.message || '–'`. `number()` → `–`. `getStatusBadge` covers completed/running/failed/pending/cancelled/success/unknown and falls back to `badge-neutral`. Counts/dates via `Intl.NumberFormat` and `Intl.DateTimeFormat` (`dateStyle: medium, timeStyle: short` for timestamps; `weekday: 'short'` and medium date for the chart labels/titles).

## URL State

- `?view=` — `overview` (cleared, default), `connections`, `activity`. Deep-linkable; the active tab is `searchParams.get('view') || 'overview'`. Written with `replace: true` so tab changes do not stack history entries.
- No other params. Admin Users is a separate route `/admin/users`, not a Monitoring tab (it was promoted out of one), so Back from Users returns here.

## Accessibility Requirements (WCAG 2.2 AA)

- One `h1` ("Monitoring"); section headings are `h2.card-title` with `aria-labelledby` (`distribution-title`, `daily-title`); tab bodies use `.card` with their own `h2`. Skip link to `#main-content`; `:focus-visible` outline on every button/link.
- Tabs expose `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`, but the referenced `panel-*` elements are not rendered (gap). The `.bar-chart` has `role="img"` with an `aria-label` summarising the 7 days and the peak; counts also appear as visible `.bar-chart-value` text.
- Status badges carry a text label plus `.badge-dot`; `.distribution-value` prints "N (N%)" in text, so no colour-only information. `role="img"` chart is supplemented by the "Counts are labelled on each bar; the tallest is N." subtitle.
- `Freshness` announces via `aria-live="polite"`; toasts `role="status"`; loading skeletons are `aria-hidden="true"`; empty-state icons are `aria-hidden="true"`. Tables are semantic `<table>` with `scope="col"` headers and `font-variant-numeric: tabular-nums`.
- Contrast ≥ 4.5:1 (`--muted` on `--surface`), 44×44 targets, `touch-action: manipulation`, reduced-motion fallback (entrance travel drops; no animated bars), sticky first table column at ≤ 640px, no horizontal page scroll.

## Localization Considerations

- Hardcoded English: header subtitle, tab labels, all KPI labels, "Last 7 days", "Last 7 days · peak N", "Counts are labelled on each bar; the tallest is N.", "No transfers in this range.", "No connections configured", "No activity recorded", "N recent events", table headers, and the failure toast. Extract whole sentences.
- "Last 7 days · peak N", "N (N%)", "N recent events" and the `aria-label` "Transfers per day over the last 7 days. Peak N." need `Intl.NumberFormat` and `Intl.PluralRules`; the status keys in `status_counts` (e.g. `completed`) are API enums rendered raw and must be mapped to localised status labels.
- Chart weekday labels come from `Intl.DateTimeFormat(undefined, { weekday: 'short' })` and dates from `dateStyle: medium`; the `title` tooltip and `aria-label` must be built from those same formatted values, not hardcoded English.
- Longest strings are the chart subtitle and the "Counts are labelled…" sentence (~60 chars); budget ~40% expansion. `db_type`, `message` content, `description` and status enums are data/code tokens → `translate="no"`. `PG`/`MY` are not used here; `db_type` prints the full value ("postgresql"/"mysql") in a badge.

## Acceptance Criteria

1. Mount issues all four monitoring GETs concurrently via `Promise.all` (`/monitoring/dashboard`, `/monitoring/metrics`, `/monitoring/connections/status`, `/monitoring/activity?limit=50`) and renders 4 KPI cells plus the two Overview cards.
2. The three tabs reflect `?view=`; selecting one writes the param with `replace: true`, sets `aria-selected` / `aria-controls` on the active tab, and swaps the body without a network request.
3. With `status_counts` empty the "Transfer status" card shows "No transfers in this range."; with no `daily_transfers` the bar chart renders no columns, `maxDailyCount` is 1, and the "tallest is 1" subtitle and `role="img"` `aria-label` still state the peak.
4. A failed `loadAll()` fires "Couldn't load monitoring data", sets `Freshness` to the stale variant "Update failed · showing last good data", and keeps previously rendered KPI/table values visible; "Refresh" re-runs all four GETs.
5. Performance: `usePolling` is not used on this screen (no background requests); a Refresh issues exactly four concurrent GETs and the `Freshness` "Updated HH:MM" stamp changes on success; `Intl.NumberFormat` is applied to all counts and percentages.
6. Responsive: at 1440/1024px `.stats-grid-4` is 4 columns and `.grid-2` two columns; at ≤ 1024px `grid-2` collapses to one column; at ≤ 640px `.stats-grid-4` is 2 columns, `.bar-chart` gap drops to 4px, tables keep a sticky first column, and no page-level horizontal scroll occurs at 390px.
7. Keyboard: Tab reaches Refresh, the admin "Users" link (when `role === 'admin'`), then the three tabs in DOM order with a visible `:focus-visible` ring; non-admin users never see the "Users" link.
