> **Template**: UX Spec

# Connections — UX Spec

- **Status**: Approved
- **Platform Target**: Web (desktop-first; keyboard/mouse primary, touch secondary)
- **Accessibility Tier**: WCAG 2.2 AA
- **Route**: `/connections` (see `frontend/src/App.jsx`)

## Purpose & User Need

- "I need to see which databases are wired up, check that each one is reachable, and add, edit, deactivate or remove a connection without losing my place."
- The user wants per-connection reachability ("Test") and a clear reason when a delete is refused because transfer history references the connection.

## User Context on Arrival

- Authenticated, via the sidebar "Connections" `NavLink`, the Dashboard's "Add a connection" empty-state CTA, the Explorer's "Add a connection" CTA, or a Dashboard "View all" link.
- May have zero connections (first run) or many; the wizard on `/transfers` and the Explorer both depend on `is_active` connections, so deactivating here has downstream effects.
- No selection is carried in; the screen reloads its own list on mount and after every mutation.

## Navigation Position

- Second item in `Sidebar` (`baseNavItems[1]`, path `/connections`), inside `AppLayout` with the skip link and `main#main-content`.
- Entry: sidebar, Dashboard links/CTA, Explorer "Add a connection" (which uses `navigate('/connections')`).
- Exit: no outbound links from the populated list; the empty state's CTA opens the create modal in place. The sidebar and browser Back are the exits; there is no detail route per connection.

## Screen's One Question & One Finding

- **One Question**: "Which databases are configured, and are they reachable?"
- **One Finding**: The `.page-header` subtitle states the count plainly — "N databases configured" (singular "1 database configured"). Per-connection reachability is then carried by each card's `last_test_status` badge and "Tested <date>" stamp, not by a single headline.

## Layout Specification

Zones: `.page-container`; `.page-header` (title + count subtitle on the left, `.page-header-actions` with "Add connection" on the right); either one `.card` holding the empty state or a `.connection-grid` of `.connection-card`s; up to two `Modal` overlays (create/edit form, delete confirmation).

| Zone / component | Real class names (`frontend/src/index.css`, `Connections.jsx`) |
|---|---|
| Page frame / header | `.page-container`, `.page-header`, `.page-header-actions` |
| Grid / card | `.connection-grid`, `.connection-card`, `.connection-card-inactive`, `.connection-card-header`, `.connection-name`, `.connection-host`, `.connection-type-icon` (+ `.postgresql` / `.mysql`) |
| Status row | `.connection-status`, `.badge`, `.badge-dot`, `.badge-success`, `.badge-danger`, `.badge-neutral`, `.text-xs`, `.text-muted` |
| Card actions | `.connection-actions`, `.btn`, `.btn-secondary`, `.btn-ghost`, `.btn-sm`, `.btn-danger-icon`, `.spinner` |
| Empty state | `.card`, `.empty-state`, `.empty-state-icon`, `.btn-primary` |
| Form modal | `.modal-overlay`, `.modal`, `.modal-header`, `.modal-body`, `.modal-footer`, `.modal-close`, `.form-group`, `.form-label`, `.form-input`, `.form-select`, `.form-row`, `.form-checkbox`, `.form-error`, `.form-hint`, `.alert`, `.alert-danger` |
| Delete modal | `.modal`, `.modal-footer`, `.btn-danger`, `.btn-secondary`, `.font-semibold`, `.text-sm`, `.text-muted` |
| Toasts / load | `.loading-overlay`, `.spinner`, `.spinner-lg`, `react-hot-toast` |

## States & Variants

- **Loading**: initial load renders a full `.page-container` with only a `.loading-overlay` containing `.spinner.spinner-lg` (no skeleton rows, no header). `loadConnections()` failures also end the loading state.
- **Empty / populated**: zero connections → one `.card` with `.empty-state` "No connections yet" / "Add a PostgreSQL or MySQL database to start exploring and moving data." + "Add connection" `.btn-primary`. Populated → `.connection-grid` of cards, each with name, `host:port/database_name` in `.font-mono`, PG/MY type icon, `last_test_status` badge, an "inactive" `badge-neutral` when `!is_active`, a "Tested <date>" stamp when `last_tested_at` exists, and five actions.
- **Error**: load failure → `toast.error('Failed to load connections')`; the grid is not shown because `connections` stays `[]`, so the empty state appears. Form validation failures map `err.response.data.details` into `formErrors` and render `.form-error[role="alert"]` beside each field; otherwise `toast.error(message || 'Check the fields and try again.')`. Delete with HTTP 409 → `toast.error(message || 'Connections with transfer history cannot be deleted')`. Test failure → `toast.error('Connection test failed')`; a test that returns `success: false` → `toast.error(res.data.message)`.
- **Stale**: no polling and no `Freshness` stamp. Data is fresh only immediately after `loadConnections()`; a refresh is implicit in every mutation.
- **Zero / missing**: count prints `0 databases configured` in normal style. `last_test_status` unknown → `badge-neutral` (map falls through). Missing `last_tested_at` → the "Tested" stamp is omitted. Missing `password` on edit → the "Leave blank to keep…" placeholder and the payload drops `password` entirely. Blank `database_name`/`username` are allowed by the UI (only `port` is validated client-side).
- **Per-card transient**: `testing === conn.id` disables that card's Test button and replaces its icon with a 14px `.spinner`. `editConn` switches the modal title and submit label; `db_type` select is `disabled` while editing; `confirmDelete` opens the second modal.

## Interaction Map

- Keyboard-only flow: skip link → `main` → "Add connection" (header) → per card in DOM order: Test → Edit → Deactivate/Activate → Delete (icon button) → next card. In the empty state the CTA is the only control.
- Modal focus: the shared `Modal` component traps Tab, focuses the first focusable element on open, closes on `Escape` (and on overlay mousedown), and restores focus to `previouslyFocused` on close. The connection form's own tab order is fields in DOM order then `.modal-footer` Cancel → "Add connection" / "Save changes".
- Delete modal footer order: "Keep connection" → "Delete connection". A client-side invalid port moves focus to `#input-port` and returns before any request.
- Tab order is native DOM order of `<button>` / `<input>` / `<select>`; no roving tabindex. All icon-driven destructive buttons have `aria-label`.

## Data Requirements

Endpoints from `frontend/src/api/client.js` (`connectionsAPI`).

| Displayed element / action | Source |
|---|---|
| Connection list, count, name, `db_type`, `host`, `port`, `database_name`, `username`, `is_active`, `last_test_status`, `last_tested_at`, `ssl_enabled` | `connectionsAPI.list()` → `GET /connections` |
| Create | `connectionsAPI.create(data)` → `POST /connections` |
| Edit (prefill from the list row, not a `get`) | `connectionsAPI.update(id, data)` → `PUT /connections/:id` |
| Delete | `connectionsAPI.delete(id)` → `DELETE /connections/:id` |
| Test / reachability | `connectionsAPI.test(id)` → `POST /connections/:id/test` (returns `success`, `latency_ms`, `message`) |
| Activate / deactivate | `connectionsAPI.update(id, { is_active: !conn.is_active })` → `PUT /connections/:id` |

- `connectionsAPI.get(id)` → `GET /connections/:id` exists in the client but is not called by this page.
- Null handling: `connections` defaults to `[]`; `formErrors` defaults to `{}`; the list uses `res.data` directly. `getStatusBadge` falls back to `badge-neutral` for a null/unknown status. `last_tested_at` is guarded before `Intl.DateTimeFormat`. Port is coerced with `Number()` and validated as an integer 1–65535; an empty string is kept as `''` so the field can be cleared. `db_type` changes auto-set the port to 5432 (PostgreSQL) or 3306 (MySQL). Dates via `Intl.DateTimeFormat` medium + short time; no `Intl.NumberFormat` on this screen.

## URL State

- No query params and no route params on `/connections`. Modal open/close and edit/delete targets are component state only (`showModal`, `editConn`, `confirmDelete`), so a reload closes every dialog and deep-linking to a specific connection is not supported.

## Accessibility Requirements (WCAG 2.2 AA)

- One `h1` ("Connections"); modal titles are `h2` via `Modal`'s `aria-label`/header. Skip link to `#main-content`.
- Form inputs have `<label htmlFor>`; `type="number"` with `inputMode="numeric"`, `min`/`max` on port; `autocomplete="off"` / `"new-password"` on password; `spellCheck` not disabled here. Errors use `.form-error[role="alert"]` with `aria-invalid` + `aria-describedby` (`err-conn-name`, `err-conn-host`, `err-conn-port`); focus moves to `#input-port` on the port error.
- Icon-only delete button has `aria-label={`Delete connection ${conn.name}`}`; decorative icons (`HiOutlinePlus`, `HiOutlinePencil`, `HiOutlineStatusOnline`, `HiOutlineDatabase`) are `aria-hidden="true"`; the `.connection-type-icon` text is PG/MY.
- `Modal` provides `role="dialog"`, `aria-modal="true"`, focus trap, initial focus, Escape close and focus restore (a documented "keep" in the committed tier). Toasts announce via `role="status"` / `aria-live="polite"`.
- `:focus-visible` outline; status badges carry a text label plus a dot (not colour-only); `--muted` on `--surface` ≥ 4.5:1; 44×44 targets; reduced-motion fallback; no horizontal page scroll.

## Localization Considerations

- Count string "{n} database(s) configured" uses an inline singular/plural — replace with `Intl.PluralRules`. Test toast "Connected! (Nms)" embeds a number in a sentence; keep `latency_ms` as a separate token for `Intl.NumberFormat`.
- All labels, hints, placeholders and errors are hardcoded English ("Whole number, 1–65535.", "Stored encrypted.", "Leave blank to keep the stored password.", "Enable SSL", "Connections referenced by transfer history are protected and cannot be deleted."). Extract whole sentences; the delete-confirmation explanation (~95 chars) is the longest and must fit with ~40% expansion without clipping the `.modal-footer`.
- `host:port/database_name`, PG/MY, `db_type` values and the SQL-ish field names are code tokens → `translate="no"`. `Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })` handles the "Tested" stamp. No brand-coloured numbers; curly quotes and `…` per house copy.

## Acceptance Criteria

1. With `GET /connections` returning `[]`, the screen shows exactly one `.card` with the `.empty-state` "No connections yet", its explanatory sentence, and an "Add connection" button that opens the create `Modal`.
2. Each populated `.connection-card` shows name, `host:port/database_name`, PG/MY icon, a `last_test_status` badge, an "inactive" badge when `is_active` is false, and a "Tested" date only when `last_tested_at` is present.
3. Submitting a port of 0, 70000 or a non-integer sets `formErrors.port`, renders `.form-error[role="alert"]` with `aria-invalid` on `#input-port`, moves focus to that field, and issues no `POST`/`PUT`.
4. `POST /connections/:id/test` with `{ success: true, latency_ms }` produces the "Connected! (Nms)" toast, disables only that card's Test button with a `.spinner` while in flight, and re-runs `GET /connections`.
5. Performance: mount issues exactly one `GET /connections`; each successful create/edit/delete/toggle issues one mutation followed by one `loadConnections()` refresh, and a 401 triggers the single `POST /auth/refresh` retry in `client.js` rather than a request loop.
6. Responsive: at 1440/768px `.connection-grid` is multi-column; at 390px it collapses to one column (`max-width: 640px` rule), the `.page-header` title drops to 22px, and no control is under 44px tall.
7. Keyboard: opening the create modal moves focus to its first field, Tab is trapped inside, `Escape` closes and restores focus to the triggering button; in the delete modal the footer order is "Keep connection" then "Delete connection".
