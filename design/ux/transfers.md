> **Template**: UX Spec

# Data Transfers (List + Wizard) — UX Spec

- **Status**: Approved
- **Platform Target**: Web (desktop-first; keyboard/mouse primary, touch secondary)
- **Accessibility Tier**: WCAG 2.2 AA
- **Route**: `/transfers` (see `frontend/src/App.jsx`)

## Purpose & User Need

- "I need to see every transfer and its status, filter to the ones that matter, cancel a running one, and start a new transfer without losing my selections."
- The user wants progress on running jobs to update on its own, a shareable status filter, and a wizard that carries a source table chosen in the Explorer straight into step 2.

## User Context on Arrival

- Authenticated, via the sidebar "Transfers" `NavLink`, a Dashboard KPI/finding link, "View all", or `/transfers?new=1` from the Dashboard "New transfer" button.
- May arrive with router `state.sourceTable` from the Explorer's "Transfer this table", which opens the wizard at step 2 with source prefilled.
- The list may be empty, filtered, or contain running jobs that need live progress.

## Navigation Position

- Fourth item in `Sidebar` (`baseNavItems[3]`, path `/transfers`), inside `AppLayout` with the skip link and `main#main-content`.
- Entry: sidebar; Dashboard "New transfer" (`?new=1`), "Review the failures", "Watch progress", "View all"; Explorer "Transfer this table" (router state).
- Exits: each row's "View details" → `/transfers/:id`; the wizard and confirm/cancel modals are in-place overlays. The `?status=` filter and `?new=1` deep link are the URL-level entries.

## Screen's One Question & One Finding

- **One Question**: "Which transfers ran, which are running, and how far along are they?"
- **One Finding**: The `.card-header` subtitle on "Transfer history" — "{transfers.length} in this view" — plus each row's status `.badge`. Running rows additionally show a `.progress-bar` with "N / M rows", so progress is the primary per-row finding. There is no single headline finding like the Dashboard's.

## Layout Specification

Zones: `.page-container`; `.page-header` (h1 "Data transfers", subtitle "Move data between configured database connections", `.page-header-actions` with "New transfer"); one `.card` "Transfer history" containing `.card-header`, `.tabs` (5 status filters) and either an `.empty-state` or a `.data-table-wrapper` → `.data-table`; up to two `Modal`s: the 4-step "New transfer" wizard and the "Cancel Transfer" confirmation.

| Zone / component | Real class names (`frontend/src/index.css`, `Transfers.jsx`) |
|---|---|
| Page frame / header | `.page-container`, `.page-header`, `.page-header-actions` |
| History card | `.card`, `.card-header`, `.card-title`, `.card-subtitle` |
| Status filter tabs | `.tabs`, `.tab`, `.tab.active` (1px `::after` accent line), `role="tablist"` |
| Table | `.data-table-wrapper`, `.data-table`, `.transfer-endpoint-name`, `.transfer-arrow`, `.transfer-progress-cell`, `.progress-bar`, `.progress-bar-spaced`, `.progress-fill`, `.progress-fill.animated`, `.badge` + `.badge-*`, `.badge-dot`, `.font-mono`, `.text-xs`, `.text-sm`, `.text-muted` |
| Row actions | `.btn`, `.btn-ghost`, `.btn-sm`, `.btn-danger-icon`, `.flex`, `.gap-2` |
| Empty state | `.empty-state`, `.empty-state-icon`, `.btn-secondary` |
| Wizard modal | `.modal-overlay`, `.modal`, `.modal-header`, `.modal-body`, `.modal-footer`, `.wizard-steps`, `.wizard-steps-spaced`, `.wizard-step-group`, `.wizard-step`, `.wizard-step-label`, `.wizard-connector`, `.wizard-error-list`, `.alert-danger` |
| Wizard fields | `.form-group`, `.form-label`, `.form-input`, `.form-select`, `.form-hint`, `.form-checkbox`, `.column-mapping-section`, `.column-mapping-row`, `.column-mapping-name`, `.column-mapping-type`, `.column-mapping-rename`, `.form-input-sm` |
| Review summary | `.transfer-summary`, `.transfer-summary-grid`, `.transfer-summary-arrow`, `.transfer-summary-extra`, `.field-label` |
| Loading / toasts | `.loading-overlay`, `.spinner`, `.spinner-lg`, `react-hot-toast` |

Wizard steps (indicator labels): Source → Target → Options → Review, connected by `.wizard-connector`.

## States & Variants

- **Loading**: initial load renders only a `.loading-overlay` with `.spinner.spinner-lg` (no header, no skeleton). Schema/table/column sub-loads are toasts + inline states: `tablesLoading` changes the source-table `<select>` placeholder to "Loading tables…"; `columnsLoading` shows a `.loading-overlay` spinner inside `.column-mapping-section`.
- **Empty / populated**: zero rows → `.empty-state` "No transfers yet" / "Create your first data transfer to move data between databases." (no CTA), or "No {status} transfers" / "Try another status, or clear the filter." + "Show all" `.btn-secondary` when a filter is active. Populated → `.data-table` with 7 columns (Source, arrow, Target, Status, Progress, Duration, Actions). Progress cell: running → `.progress-bar` + "N / M rows"; completed → "N rows"; otherwise a grey dash `–`.
- **Error**: `loadData()` failure → `toast.error('Failed to load transfers')`. Wizard sub-load failures → "Failed to load schemas", "Failed to load tables", "Failed to load columns". `handleCreateTransfer` failure with `details[]` → `.alert-danger[role="alert"]` listing "field: message" per row plus `toast.error('Please fix the highlighted fields')`; otherwise `toast.error(message || 'Failed to create transfer')`. Cancel failure → "Failed to cancel transfer".
- **Stale**: `hasRunning` gates `usePolling(..., 5000, hasRunning)` — the list re-fetches every 5s only while a transfer is `running` or `pending`, honouring the URL `status` filter and passing an abort `signal`. There is no `Freshness` stamp; a failed poll is silent (the hook records an error that this screen does not surface), so old values remain.
- **Zero / missing**: `formatRows(null|undefined)` returns `?`; `formatDuration` returns `–` when `started_at` is missing. `total_rows` of 0 → `progress` 0 and no bar (running shows "? / ?" style values via `formatRows`). `target_table` empty falls back to `source_table`. `source_connection_name` / `target_connection_name` fall back to "Unknown". Column mapping with all columns included and no renames → `buildColumnMappings()` returns `null` ("transfer everything as-is"). "Columns unavailable — all source columns will be transferred." when `sourceColumns` is empty.
- **Unsaved guard**: while the wizard is open a `beforeunload` handler warns on reload/close; `requestCloseWizard` calls `window.confirm('Discard this transfer? Your selections will be lost.')` when any of source/target table, filter or target connection has content, and clears `?new=1`.

## Interaction Map

- Keyboard-only flow: skip link → `main` → "New transfer" → status tabs (left-to-right: All, Running, Completed, Failed, Cancelled) → table row actions ("View details" link, then "Cancel" button for running/pending) → next row.
- Tabs are `<button role="tab">` with `aria-selected`; there is no arrow-key roving tabindex — Tab moves through each in DOM order. Selecting a tab calls `setStatusFilter`, which writes `?status=` (or clears it for `all`) with `replace: true` and re-runs `loadData()`.
- Wizard focus order: `Modal` traps Tab, focuses the first focusable element, closes on `Escape` (mapped to `requestCloseWizard` → discard confirm) and restores focus on close. Within a step: fields in DOM order → `.modal-footer` "Back" (steps 2-4) → "Next" / "Start Transfer". Step 3 column-mapping rows: include `<input type="checkbox">` → rename `.form-input-sm` (disabled when the column is unticked). "Next" validates step 1 (source connection + table) and step 2 (target connection) via toasts before advancing, and calls `loadColumns()` when leaving step 2.
- Confirm/cancel modal footer: "Keep Running" → "Cancel Transfer". `usePolling` and the `beforeunload` guard do not steal focus.

## Data Requirements

Endpoints from `frontend/src/api/client.js` (`connectionsAPI`, `discoveryAPI`, `transfersAPI`).

| Displayed element / action | Source |
|---|---|
| Transfer rows (`id`, `source_connection_name`, `source_table`, `target_connection_name`, `target_table`, `status`, `transferred_rows`, `total_rows`, `started_at`, `completed_at`) | `transfersAPI.list(params, signal)` → `GET /transfers?status=` (polled every 5s while `hasRunning`) |
| Connection `<select>` options (filtered to `is_active`) | `connectionsAPI.list()` → `GET /connections` |
| Source/target schema options | `discoveryAPI.getSchemas(connId)` → `GET /discovery/:connId/schemas` |
| Source table options | `discoveryAPI.getTables(connId, schema)` → `GET /discovery/:connId/tables?schema=` |
| Column mapping (`name`, `type`) | `discoveryAPI.getColumns(connId, table, schema)` → `GET /discovery/:connId/tables/:table/columns?schema=` |
| Create transfer | `transfersAPI.create(payload)` → `POST /transfers` (payload includes `column_mappings`, `filter_query`, `create_target_table`, `source_schema`/`target_schema` as `null` when blank) |
| Cancel transfer | `transfersAPI.cancel(id)` → `POST /transfers/:id/cancel` |

- `transfersAPI.get`, `getLogs` are used by the detail screen, not here. `discoveryAPI.previewData` / `getRowCount` are not called here.
- Null handling: `transfers` / `connections` / `sourceColumns` default to `[]`; `columnSelection` to `{ include: {}, rename: {} }`; `wizardErrors` to `[]`. `formatRows` → `?` for null/undefined, else `Intl.NumberFormat`. Duration uses client-side `Date` math (no `Intl.*`). `target_table || source_table` fallback; `filter_query || null`; blank schemas → `null`. `getStatusBadge` falls back to `badge-neutral`. `connections.find(...)? .name || '–'` in the Review summary.

## URL State

- `?status=` — one of `all` (cleared), `running`, `completed`, `failed`, `cancelled`; deep-linkable, drives the tab and the list request.
- `?new=1` — opens the wizard at step 1 (Dashboard deep link); cleared with `replace: true` on wizard close and on successful creation.
- `/transfers/:id` — outbound only (row "View details").
- Router `state.sourceTable` (not URL params) — from the Explorer; opens the wizard at step 2 with `source_connection_id`, `source_schema`, `source_table` prefilled.

## Accessibility Requirements (WCAG 2.2 AA)

- One `h1` ("Data transfers"); the "Transfer history" card has `aria-label`; section title is `h2.card-title`. Skip link to `#main-content`; `:focus-visible` outline on every control.
- Tabs use `role="tablist"` / `role="tab"` / `aria-selected`; there are no `aria-controls`/`tabpanel` on this screen (a gap against the committed checklist). Icon-only row buttons have `aria-label` ("View details of X transfer", "Cancel transfer of X"); decorative icons are `aria-hidden="true"` except `HiOutlineStop` in the cancel button and `HiOutlinePlay` in "Start Transfer" (gaps for icon-label linting).
- Wizard fields have `<label htmlFor>` or `aria-label` ("Target name for X"); the filter input has `aria-describedby="wizard-filter-hint"` and `spellCheck="false"` / `autoComplete="off"`; step-3 validation is by toast (announced via `role="status"`) plus the `.alert-danger[role="alert"]` error list.
- `Modal` provides `role="dialog"`, `aria-modal="true"`, focus trap, initial focus, Escape, focus restore. Status badges carry a text label plus `.badge-dot`; progress has a numeric "N / M rows" text alongside the bar, so it is not colour- or shape-only.
- Toasts `role="status"` / `aria-live="polite"`; `spinner` `aria-hidden`. Contrast ≥ 4.5:1, 44×44 targets, reduced-motion fallback (`.progress-fill.animated` has no pulse — `::after { content: none }`), no horizontal page scroll (sticky first `.data-table` column ≤ 640px).

## Localization Considerations

- Hardcoded English: the header subtitle, all 5 tab labels, table headers, "in this view", empty-state sentences, wizard step labels, field labels/placeholders/hints, the discard `window.confirm`, and every toast/error string. Extract whole sentences.
- "{transfers.length} in this view", "No {status} transfers", "Showing" and "N / M rows" need `Intl.NumberFormat` and `Intl.PluralRules`; the `{status}` value interpolated into "No {status} transfers" is an API enum (`running`, `completed`, …) and must be localised as a status label, not concatenated raw.
- Longest strings: "Create your first data transfer to move data between databases." (~63 chars), "Leave empty to use the same name as source. The table will be auto-created if it doesn't exist." (~98 chars), and the column-mapping hint. Budget ~40% expansion; the 4-step `.wizard-step-label` must stay readable (font drops to `--fs-meta` at ≤ 640px).
- `source_table`, `target_table`, column names/types, the SQL `WHERE` filter placeholder and `PG`/`MY`/`db_type` are code tokens → `translate="no"`. `Intl.NumberFormat` handles row counts; durations are computed strings ("1m 4s") that need a locale-aware formatter. No `Intl.DateTimeFormat` on this screen.

## Acceptance Criteria

1. The 5 status tabs (All/Running/Completed/Failed/Cancelled) reflect `?status=`; selecting one writes the param with `replace: true`, sets `aria-selected` on the active tab, and re-runs `GET /transfers?status=` (or the unfiltered `GET /transfers` for All).
2. `?new=1` opens the wizard at step 1; after a successful `POST /transfers` the wizard closes, `?new=1` is cleared, and the form resets; `state.sourceTable` opens the wizard at step 2 with the source fields prefilled.
3. While any transfer is `running`/`pending`, `usePolling` re-fetches the list every 5s with the active `status` param and an abort signal; polling stops when no transfer is running, and a running row shows `.progress-bar` plus "N / M rows".
4. Step 1 "Next" without a source connection/table, and step 2 "Next" without a target connection, show the specific validation toast and do not advance; leaving step 2 calls `GET .../columns` and step 3 renders one `.column-mapping-row` per column with include checkbox + rename input.
5. Performance: mount issues `GET /transfers` and `GET /connections` concurrently via `Promise.all`; all columns included with no renames sends `column_mappings: null` (no redundant mapping payload), and a failed poll does not clear or blank the visible table.
6. Responsive: at 1440/1024px the 7-column table is intact; at ≤ 640px `.data-table` cells are `white-space: nowrap`, the first column is sticky, `.column-mapping-row` becomes 2 columns with the type hidden, `.transfer-summary-grid` becomes one column with the arrow rotated 90°, and no page-level horizontal scroll occurs.
7. Keyboard: the wizard traps Tab, closes on `Escape` (with the discard confirm when content exists), restores focus on close, and the confirm modal footer order is "Keep Running" → "Cancel Transfer"; `:focus-visible` is visible on every tab and row action.
