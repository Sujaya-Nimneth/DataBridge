> **Template**: UX Spec

# Dashboard — UX Spec

- **Status**: Approved
- **Platform Target**: Web (desktop-first; keyboard/mouse primary, touch secondary)
- **Accessibility Tier**: WCAG 2.2 AA
- **Route**: `/` (see `frontend/src/App.jsx`)

## Purpose & User Need

- "I need to know, in one glance, whether anything is failing right now and what ran today — without hunting across screens."
- The user wants a trustworthy daily status and a fast path to act on it: review failures, watch running jobs, or start a new transfer.

## User Context on Arrival

- Authenticated user landing after sign-in, or returning via the sidebar "Dashboard" `NavLink` or browser Back.
- The session may be first-run (no connections, no transfers) or long-lived (large counts, many activity rows).
- No selection or filter is carried in; the screen always loads its own current data.

## Navigation Position

- First item in `Sidebar` (`baseNavItems[0]`, path `/`), rendered inside `AppLayout` with the skip link and `main#main-content`.
- Entry: `/login` after auth, sidebar, or redirect from `*` / unauthenticated `ProtectedRoute` (which sends to `/login`).
- Exits: "New transfer" → `/transfers?new=1`; "Review the failures" / "Watch progress" → `/transfers`; KPI links "Connections" → `/connections`, "Running" → `/transfers`; "View all" links → `/transfers` and `/connections`; empty-state CTA "Add a connection" → `/connections`.

## Screen's One Question & One Finding

- **One Question**: "Is anything failing right now, and what ran today?"
- **One Finding**: Rendered by `Finding` directly under the `h1` (`.page-finding`), chosen by priority: `failed_today > 0` → "N transfers failed today. Review the failures" with a `!` mark; else `running_transfers > 0` → "N transfers running now. Watch progress."; else "No failures today. N transfers completed." Hidden while loading or on load error.

## Layout Specification

Zones: a single `.page-container`; `.page-header` (title + finding on the left, `.page-header-actions` with `Freshness` + "New transfer" on the right); an optional full-width error `.alert`; a 6-cell `.stats-grid`; a `.grid-2` row of two cards ("Recent activity", "Connection health"); a conditional `.card.mt-6` "Total rows transferred".

| Zone / component | Real class names (`frontend/src/index.css`, `Dashboard.jsx`) |
|---|---|
| Page frame, header, actions | `.page-container`, `.page-header`, `.page-header-actions`, `.page-finding`, `.finding-mark` |
| KPI container / cells | `.stats-grid`, `.stat-card`, `.stat-card-action`, `.stat-label`, `.stat-value`, `.stat-unit` |
| Cards | `.card`, `.card-header`, `.card-title`, `.card-subtitle`, `.grid-2`, `.mt-6` |
| Recent activity | `.activity-feed`, `.activity-item`, `.activity-dot`, `.activity-content`, `.activity-description`, `.activity-meta`, `.activity-time` |
| Connection health | `.object-list`, `.object-row`, `.object-kind`, `.object-name`, `.truncate`, `.badge` |
| Rows total | `.row-total`, `.row-total-value` |
| Freshness / states / skeleton | `.freshness`, `.skeleton` (`SkeletonBlock`), `.empty-state`, `.empty-state-icon`, `.alert`, `.alert-danger` |
| Buttons / links | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-sm`, `.btn-ghost`, `.badge-*` (success/primary/danger/warning/neutral) |

Status text maps through the local `statusBadge()` helper to `.badge-*` classes.

## States & Variants

- **Loading**: `stats-grid` shows 6 `.stat-card` cells, each with two `SkeletonBlock` bars (label 70%×12, value 45%×26) inside `aria-hidden="true"`; "Recent activity" shows 3 skeleton `.activity-item` rows; "Connection health" shows 2 full-width 42px `SkeletonBlock` bars. The header, finding area and card chrome render immediately; no shimmer, no layout shift.
- **Empty / populated**: Empty "Recent activity" → `.empty-state` "No transfers yet" / "Create a connection, then move your first table." + "Add a connection" CTA. Empty "Connection health" → "No connections yet" / "Add a PostgreSQL or MySQL database to get started." + CTA. Populated activity renders up to 5 `.activity-item` rows with dot, description, `.badge` and `<time>`; populated health renders an `.object-list` of `.object-row` (PG/MY kind, name, status badge).
- **Error**: `loadError` renders a top `.alert.alert-danger` (`role="alert"`) with "<message> Data below may be out of date." and a "Retry" `.btn.btn-secondary.btn-sm`. Data already held is not cleared; the finding is suppressed.
- **Stale**: `Freshness` gets `updatedAt` set on each successful `loadDashboard()`; there is no polling on this screen, so staleness is expressed only by the "Updated HH:MM" stamp plus manual Refresh. A failed refresh keeps old values and sets the error alert.
- **Zero / missing**: Zero prints as `0` / `0%` in normal style (e.g. "No failures today. 0 transfers completed."). Missing stats fields fall back to a grey dash `–` via `stats?.x ?? '–'`; `formatTime('')` returns `''` for a missing timestamp. The "Total rows transferred" card renders only when `stats?.total_rows_transferred > 0` — it is absent, not shown empty.

## Interaction Map

- Keyboard-only flow: skip link → `main` → first header control is `Freshness`'s "Refresh data" button, then "New transfer" (`Link`) → KPI link cells are only tabbable where a `to` is set (`Connections`, `Running`) — plain `.stat-card` divs are not focusable → "View all" (activity) → "View all" (health) → any CTA in an empty state.
- Focus order follows DOM/reading order: header actions, then KPI grid, then activity card, then health card, then rows-total card.
- Tab order: native `Link`/`<button>` elements only; no roving tabindex. `Enter`/`Space` activate buttons and links. `Retry` and `Refresh` are ordinary buttons.
- On refresh, `loading` is not reset to true (only the initial mount is), so old values stay visible while the request runs and focus is not moved.

## Data Requirements

Loaded in one `Promise.all` via `loadDashboard()`; endpoints from `frontend/src/api/client.js`.

| Displayed element | Source |
|---|---|
| Stats: `total_connections`, `active_connections`, `running_transfers`, `completed_today`, `failed_today`, `success_rate`, `total_rows_transferred`, `total_transfers` | `monitoringAPI.getDashboard()` → `GET /monitoring/dashboard` |
| Recent activity (5): `id`, `description`, `status`, `timestamp` | `monitoringAPI.getActivity(5)` → `GET /monitoring/activity?limit=5` |
| Connection health: `id`, `name`, `db_type`, `status` | `monitoringAPI.getConnectionStatuses()` → `GET /monitoring/connections/status` |

- Null handling: each KPI uses `?? '–'`; `success_rate` renders as `${value}%` only when `stats` exists; `activity` and `connStatuses` default to `[]`. `formatTime` returns `''` for a falsy timestamp. `dateTime={item.timestamp}` keeps the raw value on `<time>`. Counts formatted with `Intl.NumberFormat`; relative time is computed client-side ("Just now", "Nm ago", "Nh ago", else `Intl.DateTimeFormat` medium). `db_type` falls back to `MY` for anything not `postgresql`; unknown status maps to `badge-neutral`.

## URL State

- No query params on `/`. Outbound params only: `?new=1` on the "New transfer" link; `?status=` is not set from here. No in-page selection is URL-encoded.

## Accessibility Requirements (WCAG 2.2 AA)

- One `h1` ("Dashboard"); section headings are `h2` with `aria-labelledby` (`recent-activity-title`, `connection-health-title`); the rows-total card uses `aria-label="Total rows transferred"`.
- Skip link "Skip to main content" → `#main-content` (present in `AppLayout`). Visible `:focus-visible` outline (2px `--accent`) on every button/link.
- Error alert uses `role="alert"`; `Finding` mark is `aria-hidden="true"` and the status is carried by text, not colour; badges include a text label plus a `badge-dot` (`aria-hidden`).
- Loading skeletons are `aria-hidden="true"`; KPI figures use `font-variant-numeric: tabular-nums`. Times use semantic `<time dateTime>`. Decorative icons (`HiOutlineClipboardList`, `HiOutlineDatabase`) are `aria-hidden`.
- Contrast: `--muted` on `--surface` ≥ 4.5:1; KPI values in `--text`. Touch targets ≥ 44×44 with `touch-action: manipulation`; no horizontal page scroll; reduced-motion fallback preserves content (`enter` animation travel drops).

## Localization Considerations

- All numbers/dates via `Intl.NumberFormat` / `Intl.DateTimeFormat` (`undefined` locale). Relative-time strings ("Just now", "m ago", "h ago") are hardcoded English — extract for translation; keep the numeric portion separate from the unit so RTL/locales can reorder.
- Singular/plural is handled inline for `failed_today`, `running_transfers`, `completed_today` and `total_transfers`; replace with `Intl.PluralRules` for locales with more than two forms.
- Longest strings: the finding "N transfers failed today. Review the failures" and empty-state subtitles (~55 chars). Budget ~40% expansion; labels above KPI values are short ("Finished successfully" ~21 chars) and must not wrap to two lines at 1024px. Connection `name` uses `.truncate`.
- Brand name "DataBridge" and code/identifier tokens (PG/MY, schema/table names) carry `translate="no"`. Sentence case, `…` ellipsis, curly quotes per house copy rules.

## Acceptance Criteria

1. On load, exactly 6 KPI cells appear; while loading, each contains two `.skeleton` bars with the real label/value dimensions and the surrounding `aria-hidden="true"`, with no layout shift once data arrives.
2. With `failed_today > 0`, the `.page-finding` states the count and links to `/transfers`; with `failed_today = 0` and `running_transfers > 0` it states the running count; otherwise it states "No failures today." — verified against stubbed `GET /monitoring/dashboard` responses.
3. When `GET /monitoring/dashboard` rejects, an `.alert-danger[role="alert"]` with a working "Retry" button appears, previously loaded KPI values remain on screen, and the finding is not rendered.
4. With empty activity and empty connection-status arrays, both cards show their specific `.empty-state` sentence and an "Add a connection" link to `/connections`; the "Total rows transferred" card is absent when the total is 0.
5. Performance: the three dashboard endpoints are issued concurrently via `Promise.all` (one round trip); a manual `Refresh` does not remount skeletons or clear existing values, and updates the `Freshness` "Updated HH:MM" stamp.
6. Responsive: at 1440/1024px the `.stats-grid` is 6 columns and `.grid-2` is two columns; at 768px the grid is 3 columns and `grid-2` collapses; at 390px it is 2 columns with no horizontal page scroll, and all buttons remain ≥ 44px tall.
7. Keyboard: from the skip link, Tab reaches Refresh, "New transfer", the focusable KPI `Link`s, and both "View all" links in DOM order; each shows a visible `:focus-visible` ring.
