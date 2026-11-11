> **Template**: UX Spec

# Data Explorer — UX Spec

- **Status**: Approved
- **Platform Target**: Web (desktop-first; keyboard/mouse primary, touch secondary)
- **Accessibility Tier**: WCAG 2.2 AA
- **Route**: `/explorer` (see `frontend/src/App.jsx`)

## Purpose & User Need

- "I need to find a table in one of my databases, see what columns and types it has, preview a few rows, and then move that table — without losing my place or having to re-navigate the tree."
- The user wants the current selection to survive a refresh or a shared link, and a direct hand-off into a new transfer.

## User Context on Arrival

- Authenticated, via the sidebar "Data Explorer" `NavLink`, or by a deep link carrying `?conn=&schema=&table=&tab=`.
- Only active connections are usable: `loadConnections()` filters `res.data` to `c.is_active`. A deactivated connection (set on `/connections`) disappears here.
- The tree is lazily loaded; nothing is expanded until the user expands it, except when a deep link is restored.

## Navigation Position

- Third item in `Sidebar` (`baseNavItems[2]`, path `/explorer`), inside `AppLayout` with the skip link and `main#main-content`.
- Entry: sidebar; a deep link; browser Back to a prior selection (URL is rewritten on each selection).
- Exit: "Transfer this table" → `navigate('/transfers', { state: { sourceTable: selectedTable } })` (opens the wizard at step 2, prefilled); "Add a connection" (empty state) → `navigate('/connections')`; the sidebar; browser Back through selection history.

## Screen's One Question & One Finding

- **One Question**: "What is in this database, and what does this table look like?"
- **One Finding**: The `.card-title` breadcrumb in `.explorer-main` — "{connName} / {schema} / {tableName}" — plus the `.card-subtitle` "N columns". With no selection the equivalent is the `.empty-state` "Select a table" / "Expand a connection in the tree to browse schemas, tables, and columns."

## Layout Specification

Zones: `.page-container`; `.page-header` (h1 "Data Explorer", subtitle "Browse database structures and preview data"); either a full-width state card (load failure / no connections) or the `.explorer-layout` two-column grid: `.explorer-sidebar` (tree) + `.explorer-main` (selection card with `.tabs` and a `.data-table-wrapper`).

| Zone / component | Real class names (`frontend/src/index.css`, `Explorer.jsx`) |
|---|---|
| Page frame / header | `.page-container`, `.page-header` |
| Two-column layout | `.explorer-layout`, `.explorer-sidebar`, `.explorer-main` |
| Tree | `.tree-view`, `.tree-node`, `.tree-node-button`, `.tree-node-icon`, `.tree-node-label`, `.tree-children`, `.selected`, `.section-label` |
| Selection card | `.card`, `.card-header`, `.card-title`, `.card-subtitle`, `.btn-primary`, `.btn-sm` |
| Tabs | `.tabs`, `.tab`, `.tab.active` (1px `::after` accent line) |
| Tables | `.data-table-wrapper`, `.data-table`, `.font-mono`, `.badge`, `.badge-warning`, `.badge-info`, `.text-muted`, `.text-sm`, `.text-xs` |
| Empty / error / loading | `.empty-state`, `.empty-state-icon`, `.loading-overlay`, `.spinner`, `.spinner-lg`, `.card` |

Tree levels: connection (`conn-${id}`) → schema (`schema-${id}-${name}`, shows `table_count`) → table (icon `HiOutlineTable` or `HiOutlineEye` for a view). `treeData` is keyed `schemas-${connId}` and `tables-${connId}-${schema}`.

## States & Variants

- **Loading**: initial `loading` renders only `.loading-overlay` with `.spinner.spinner-lg`. Preview loading (`previewLoading`) renders the same overlay inside the selection card. An expanded connection with no schemas yet shows "Loading schemas…" inside `.tree-children`; an expanded schema with no tables shows "No tables found".
- **Empty / populated**: `loadFailed` → `.empty-state` "Could not load connections" / "The server did not respond. Check that the API is running." + "Retry". Zero active connections → "No connections available" / "Add a database connection first to start exploring data." + "Add a connection". No selected table → "Select a table" (no CTA, icon only). Populated → tree on the left; on the right a columns table (Column / Type / Nullable / Key / Default) or a preview table ("Showing N of M rows" + up to 50 rows).
- **Error**: `loadFailed` is a full-pane empty state with Retry (`loadConnections()`). Per-branch failures are toasts: "Failed to load schemas", "Failed to load tables", "Failed to load columns", "Failed to load data preview", "Failed to load connections", and "Couldn't restore the selected table" for a failed deep-link restore.
- **Stale**: no polling and no `Freshness` stamp. Tree branches are cached in `treeData` once loaded and are not re-fetched on re-expand; columns reload on each `selectTable`.
- **Zero / missing**: `schema.table_count` prints as a number in parentheses; a default of `''` is used for `schema` so "Default schema" / empty breadcrumb segments can appear. Column `default` falls back to a grey dash `–` (`col.default || '–'`). A `null` preview cell renders the word "null" in `.text-muted`. `columns.length` prints `0 columns` in normal style. A null/empty `preview` with `previewLoading` false renders nothing inside the preview tab (no explicit empty message).

## Interaction Map

- Keyboard-only flow: skip link → `main` → tree connection buttons in DOM order → (after expand) schema buttons → table buttons → "Transfer this table" → Columns tab → Data Preview tab → table cells are non-interactive.
- Tree nodes are real `<button className="tree-node-button">`; `Enter`/`Space` expand/collapse or select. Every connection/schema node exposes `role="treeitem"` with `aria-expanded`; the selected table button gets `.selected` and `aria-current="true"`. There is no arrow-key roving tabindex — navigation is by Tab through the DOM buttons (a known gap against the committed "tree/treeitem with correct aria" checklist).
- Tabs are `<button role="tab">` with `aria-selected` and `aria-controls` (`panel-columns`, `panel-preview`); the columns panel has `role="tabpanel"` + `aria-labelledby`. Selecting "Data Preview" also calls `loadPreview()`; selecting "Columns" drops `tab` from the URL.
- `selectTable` writes `?conn=&schema=&table=` (and keeps `tab=preview` only when restoring), resets `preview` to `null`, resets `activeTab` to `columns` unless the deep link restored `preview`, and loads columns. Restore is guarded by `restoredRef` so it runs once when `connections` is ready and is cancelled on unmount.

## Data Requirements

Endpoints from `frontend/src/api/client.js` (`connectionsAPI`, `discoveryAPI`).

| Displayed element | Source |
|---|---|
| Connection nodes (active only) | `connectionsAPI.list()` → `GET /connections` (filtered to `is_active`) |
| Schema nodes + `table_count` | `discoveryAPI.getSchemas(connId)` → `GET /discovery/:connId/schemas` |
| Table nodes + `type` (view/table) | `discoveryAPI.getTables(connId, schema)` → `GET /discovery/:connId/tables?schema=` |
| Columns table (`name`, `type`, `nullable`, `is_primary_key`, `is_foreign_key`, `default`) | `discoveryAPI.getColumns(connId, table, schema)` → `GET /discovery/:connId/tables/:table/columns?schema=` |
| Data preview (`rows`, `columns`, `total_rows`, page 1 / `page_size` 50) | `discoveryAPI.previewData(connId, table, { schema, page: 1, page_size: 50 })` → `GET /discovery/:connId/tables/:table/preview?schema=&page=1&page_size=50` |

- `discoveryAPI.getRowCount()` → `GET /discovery/:connId/tables/:table/count` exists in the client but is not called by this page.
- Null handling: `connections` / `columns` default to `[]`, `treeData` / `expanded` to `{}`, `preview` to `null`, `selectedTable` to `null`. Deep-link restore returns early if `conn` or `table` is missing or the `conn` id is not in the active list. A missing `schema` is normalised to `''`. Preview cells use `cell ?? <span className="text-muted">null</span>`. `total_rows` uses `Intl.NumberFormat`; weekday/date labels are not used here (those are on Monitoring).

## URL State

- `?conn=` (connection id), `?schema=` (may be empty), `?table=` (table name), `?tab=preview` (only value ever set; `columns` deletes the param).
- `setSearchParams(next, { replace: true })` is used for selection and `setTab`, so selections replace the current history entry rather than stacking. Deep-link restore reads `conn`/`schema`/`table`/`tab` once after the connection list loads, re-fetches schemas and tables, sets `expanded` for the connection and schema nodes, selects the table, and loads the preview when `tab=preview`.
- `sourceTable` is passed as router `state` (not URL params) to `/transfers`.

## Accessibility Requirements (WCAG 2.2 AA)

- One `h1` ("Data Explorer"); the sidebar label is an `h2.section-label` ("Database objects"); the tree has `role="tree"` + `aria-label="Database objects"`, nodes `role="treeitem"` with `aria-expanded`, selection via `aria-current="true"`.
- Skip link to `#main-content`; `:focus-visible` outline on every `.tree-node-button`, tab and button. Decorative tree icons and empty-state icons are `aria-hidden="true"` where set; the view/table icon colour additionally uses `--color-info` for views but the node text carries the name, so it is not colour-only.
- Tabs use `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`; the columns panel is `role="tabpanel"` with `aria-labelledby`. The preview panel has no `tabpanel` wrapper (a gap worth noting).
- Tables are semantic `<table>` with `<th>`/`<td>` and `font-variant-numeric: tabular-nums`; PK/FK are text badges, not colour-only. `null` cells are the literal word "null".
- Toasts announce via `role="status"` / `aria-live="polite"`. `spinner` is `aria-hidden` where used; the loading overlay has no `role="status"` on this screen (a gap against `App.jsx`'s `PageFallback`, which does).
- Contrast ≥ 4.5:1, 44×44 targets, `touch-action: manipulation`, reduced-motion fallback, sticky first table column at ≤ 640px with no horizontal page scroll.

## Localization Considerations

- The breadcrumb "connName / schema / tableName" uses `/` separators and code tokens — mark identifiers `translate="no"`; the surrounding labels stay translatable.
- Hardcoded English strings: "Browse database structures and preview data", "Database objects", "Loading schemas…", "No tables found", "Select a table", "Transfer this table", "Columns", "Data Preview", "Showing N of M rows", "No connections available", "Could not load connections", "Columns unavailable — all source columns will be transferred." (that last one is on Transfers), and all failure toasts. Extract whole sentences.
- "Showing {n} of {m} rows" and "N columns" need `Intl.NumberFormat` and `Intl.PluralRules` (currently `columns.length` is concatenated with the word "columns"). Longest string is the "Select a table" explanatory sentence (~76 chars); budget ~40% expansion. `Yes`/`No` for nullable, `PK`/`FK`, column `type` and `default` values are data/code tokens → `translate="no"`.
- No dates are rendered on this screen. Counts use `Intl.NumberFormat` for `total_rows`; `table_count` is printed raw and should be localised too.

## Acceptance Criteria

1. Only connections with `is_active: true` appear as tree nodes; a deactivated connection is absent on a fresh mount.
2. Expanding a connection issues `GET /discovery/:id/schemas`, expanding a schema issues `GET /discovery/:id/tables?schema=`, and selecting a table issues `GET /discovery/:id/tables/:table/columns?schema=` and rewrites the URL to `?conn=&schema=&table=` with `replace: true`.
3. A deep link `?conn=X&schema=S&table=T&tab=preview` restores the expanded connection and schema nodes, selects the table, loads the preview, and shows "Showing N of M rows"; `restoredRef` prevents a second restore.
4. With no selection the right pane shows the "Select a table" `.empty-state`; with `loadFailed` it shows "Could not load connections" plus a working "Retry"; with zero active connections it shows "Add a connection" navigating to `/connections`.
5. Performance: mount issues one `GET /connections`; schema/table/column requests are per-branch and only on first expand/selection (cached in `treeData`), preview fetches page 1 with `page_size: 50`, and preview `null` cells render the word "null" without a crash.
6. Responsive: at 1440/1024px `.explorer-layout` is two columns; at ≤ 1024px it collapses to one column; at ≤ 640px the first `.data-table` column is sticky and the table scrolls in its own `.data-table-wrapper` with no page-level horizontal scroll.
7. Keyboard: Tab reaches each `.tree-node-button`, "Transfer this table", and both tabs in DOM order with a visible `:focus-visible` ring; the Columns tab exposes `role="tabpanel"` + `aria-selected`/`aria-controls`, and "Transfer this table" opens `/transfers` at wizard step 2 with the source prefilled.
