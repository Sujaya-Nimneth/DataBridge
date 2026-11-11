# Interaction Pattern Library — DataBridge

Reusable patterns for the Web app screens. All class names are real, from
`frontend/src/index.css`; the primitives live in `frontend/src/components/`
(`Modal.jsx`, `States.jsx`, `Sidebar.jsx`). Aligned with
[DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md) and the committed
[WCAG 2.2 AA tier](../accessibility-requirements.md). Web, desktop-first;
keyboard/mouse primary, touch secondary. Sound is **N/A** — DataBridge is a web
data tool with no audio layer; every confirmation is visual and textual.

---

## Button variants

- **When to Use**: any discrete action. `btn-primary` for the one primary job per screen ("New transfer", "Add connection", "Sign In"); `btn-secondary` for an alternative/neutral action ("Refresh", "Retry", "Back", "Show all"); `btn-success` only for the final commit of a creation flow ("Start Transfer"); `btn-danger` for a destructive action ("Cancel transfer", "Delete connection"); `btn-ghost` for low-emphasis/navigation ("View all", "All transfers", icon-only row actions).
- **When NOT to Use**: never two `btn-primary` in one header; never a coloured button for a link (use `<Link>`/`.btn-ghost`); never `btn-danger` for a reversible edit. Do not use a `<div onClick>` as a button.
- **States**: default, `:hover` (tone step only), `:focus-visible` (2px `--accent` outline, offset 2px), `:disabled` (opacity, `cursor` unchanged, no hover), loading (inline `.spinner` + a `…` label, e.g. "Signing in…"). Size modifiers: `btn-sm`, `btn-lg`, `btn-icon`, `w-full`; `btn-danger-icon` tints an icon-only ghost on hover.
- **Accessibility**: native `<button type="button">` (or `type="submit"` in forms); icon-only buttons require `aria-label`; decorative icons `aria-hidden="true"`; ≥ 44×44 touch target; `touch-action: manipulation`. Keep the same verb through the flow ("Save changes" → toast "Changes saved").
- **Implementation notes**: `.btn` uses `--control-height: 34px` base with `radius-control: 4px`; `.btn-primary` uses the single accent fill decision, `.btn-ghost` is transparent. No `transition: all` (only `color`/`background` via `--t-fast`). See `App.jsx` `<Toaster>` for feedback styling.

## Tabs (1px accent line)

- **When to Use**: switching between peer views of the same object without navigation: `/monitoring?view=`, `/transfers?status=`, `/explorer?tab=`. The selected tab gets a 1px `--accent` line exactly as wide as its label on the nearest edge (`.tab.active::after`, `bottom: -1px`, `height: 1px`).
- **When NOT to Use**: for navigation between screens (use `Sidebar` `NavLink`), for steps in a sequence (use the wizard indicator), or for a single view. Never use a filled/coloured active pill; the accent is a line only.
- **States**: default `color: var(--muted)`, `:hover` → `--text`, `.active` → `--text` + `::after` line, `:focus-visible`. The `.tabs` strip is `overflow-x: auto` so long label sets scroll in their own frame.
- **Accessibility**: `role="tablist"` on `.tabs`, `role="tab"`, `aria-selected`, and (`Monitoring`, `Explorer`) `aria-controls` / matching `role="tabpanel"` + `aria-labelledby`. Committed tier also expects arrow-key roving focus; current implementation uses plain Tab-through-DOM buttons (a known gap). Colour is never the only indicator — the active state also changes ink and gets the line.
- **Implementation notes**: `.tab` is a transparent `<button>` with `white-space: nowrap`; `.tab.active::after` is the only accent. `setTab` / `setStatusFilter` write the URL param with `replace: true`; Explorer deletes `tab` for `columns` and sets `tab=preview`.

## Modal / dialog

- **When to Use**: a focused sub-task that must not lose page context — the transfer wizard, connection create/edit, delete confirmation, and the list-page cancel confirmation (`components/Modal.jsx`).
- **When NOT to Use**: for a shareable/stateful view — transfer detail was promoted to `/transfers/:id` so it deep-links and Back is predictable; admin Users was promoted out of a Monitoring tab. Avoid stacking modals.
- **States**: closed (portal unmounted), open (`role="dialog"`, `aria-modal="true"`, `aria-label={title}`, `body.no-scroll` locked), overlay mousedown on the backdrop closes, `Escape` closes, footer present/absent, `maxWidth` variants (default 540px, wizard 600px, confirm 440px).
- **Accessibility**: focus trap over `a[href]`/`button`/`input`/`select`/`textarea`/`[tabindex]`, initial focus on the first focusable element, `Escape` close with `stopPropagation`, and focus restored to `previouslyFocused` on unmount. `modal-close` has `aria-label="Close dialog"`. This behaviour is a documented "keep"; `TransferDetail`'s custom `.confirm-dialog[role="alertdialog"]` is a partial implementation (Escape + labels, no trap/restore) and must not be copied as the standard.
- **Implementation notes**: `createPortal(..., document.body)`. The `.modal` is the one element allowed `--shadow`. `Transfers.requestCloseWizard` additionally calls `window.confirm` when the form has content and a `beforeunload` guard is registered while the wizard is open.

## Toast

- **When to Use**: transient confirmation of a completed mutation or a non-blocking failure ("Signed in", "Transfer started", "Failed to load schemas"), where no inline field error is appropriate.
- **When NOT to Use**: for field-level validation (use `.form-error`), for a block-level load failure (use `.alert-danger` + Retry), or for persistent/live status (use `Freshness`/`role="log"`). Never as the only confirmation of a destructive action.
- **States**: `success` / `error` variants from `react-hot-toast`; 4000ms duration; `position="top-right"`.
- **Accessibility**: `ariaProps: { role: 'status', 'aria-live': 'polite' }` on the `<Toaster>` in `App.jsx`. Toast text must name the outcome and keep the action's verb ("Changes saved").
- **Implementation notes**: `style` uses `--raised`, `--text`, `--control-border`, `--radius-control`, `--fs-small`, `boxShadow: 'none'`; icon theme uses `--pill-positive-ink` / `--pill-negative-ink`. No gradient, no glow, no autoplay loop.

## Progress bar

- **When to Use**: a true ratio with both ends labelled — running transfer rows (`Transfers`), the detail Progress card (`TransferDetail`), and status distribution bars (`Monitoring.distribution-fill`).
- **When NOT to Use**: as decoration, as a "live" pulse, or when the total is unknown. When `total_rows` is null the detail screen hides the bar and prints "Row total not available yet".
- **States**: filled (`width: ${pct}%`, `Math.min(100, ...)`), empty (0%), unknown (bar absent + text), running (`.progress-fill.animated` in the list — note `::after { content: none }`, so there is no shimmer/pulse). `progress-bar-spaced` adds 6px top margin in table cells.
- **Accessibility**: always accompanied by a text figure ("N / M rows", "N% of M rows", "N (N%)"). `.progress-bar` itself has no `progressbar` role in the current build (a gap against the committed tier); the numeric text is the accessible equivalent.
- **Implementation notes**: `.progress-bar` is a 6px `--raised` track with `radius-pill`; `.progress-fill` is `--chart-1` (white), `transition: width var(--t-base)`, no glow. Detail overrides to `height: 8px`.

## Status badge / pill

- **When to Use**: a short, static status inside a row or header — transfer status, connection health, log level, role, active/inactive, PK/FK, `db_type`.
- **When NOT to Use**: as a button, as a KPI value, in a page title, or as a saturated coloured chip. Pills live inside rows only; at most one red mark per object.
- **States**: `badge-success` (completed/success/active), `badge-primary` / `badge-info` (running, `db_type`, FK), `badge-warning` (pending, admin role, PK), `badge-danger` (failed, inactive), `badge-neutral` (cancelled/unknown). Each maps to a pale `--pill-*-bg` + dark `--pill-*-ink` pair. `badge-dot` is a 6px `currentColor` dot.
- **Accessibility**: the status word is always rendered as text beside the dot; never colour-only. `badge-dot` is `aria-hidden="true"`. Status enums come from the API and should be localised as labels.
- **Implementation notes**: `.badge` is `inline-flex`, `radius-pill`, `--fs-meta`, `white-space: nowrap`. Status→class maps are local helpers in each page (`statusBadge`, `getStatusBadge`) and fall back to `badge-neutral`. Log levels use `.log-level.info|warning|error` instead of a pill.

## Inline form validation

- **When to Use**: for a value the user entered that the client or server rejected — port range (Connections), confirm-password mismatch (Login), or `err.response.data.details[]` field messages (Connections, Transfers wizard).
- **When NOT to Use**: for a whole-block load failure (use `.alert-danger`), or for an informational hint (use `.form-hint`).
- **States**: valid (no message), hint (`form-hint`, e.g. "At least 8 characters.", "Whole number, 1–65535.", "Stored encrypted."), invalid (`.input-invalid`, `.form-error[role="alert"]`), error list (`.wizard-error-list` inside `.alert-danger`), clear-on-edit (`updateForm`, `setFormErrors({})`, `setWizardErrors([])`).
- **Accessibility**: `aria-invalid="true"`, `aria-describedby` pointing at the error/hint id, `role="alert"` on the message, and focus moved to the first error on submit (`#input-confirm-password`, `#input-port`). Forms use `noValidate`, real `<label htmlFor>`, `autocomplete`, `type`/`inputmode`, `spellCheck="false"` on emails/usernames, and paste is never blocked.
- **Implementation notes**: `.form-error` uses the negative pill ink; `.input-invalid` strengthens the control border. `Transfers` step gating uses a toast for missing required selects (an inline error would be preferable for keyboard users — see concerns).

## Table

- **When to Use**: homogeneous records with ≥ 2 comparable columns — transfer history, users, monitoring connections/activity, explorer columns/preview.
- **When NOT to Use**: for one record (use the `.transfer-summary-grid`), for a short KPI set (use `.stats-grid`), or for hierarchical data (use the tree).
- **States**: populated, empty (the surrounding `.empty-state`, not an empty `<tbody>`), loading (`SkeletonRows` or `.skeleton` bars), hover (`.data-table tr:hover td` → `--raised`), sticky-first-column at ≤ 640px.
- **Accessibility**: semantic `<table>`/`<thead>`/`<th scope="col">` where set (`AdminUsers`, `Monitoring`), `font-variant-numeric: tabular-nums`. No zebra striping (`tbody tr:nth-child(even)` is explicitly reset to transparent). Icon-only action cells have `aria-label`.
- **Implementation notes**: `.data-table-wrapper` is `overflow-x: auto`; `td` uses `--row-height: 42px` and a `--rule` bottom border. At ≤ 640px `th/td` are `white-space: nowrap`, the first column is `position: sticky; left: 0` with `--surface` background, so the page never scrolls sideways.

## Tree

- **When to Use**: the Explorer's database hierarchy: connection → schema → table/view.
- **When NOT to Use**: for flat lists, for peer views (tabs), or anywhere a plain table suffices.
- **States**: collapsed (`aria-expanded="false"`), expanded (children lazily fetched into `treeData`), selected (`.tree-node-button.selected` + `aria-current="true"`), branch loading ("Loading schemas…"), branch empty ("No tables found").
- **Accessibility**: `role="tree"` + `aria-label="Database objects"`, `role="treeitem"` with `aria-expanded` on connection and schema nodes. Committed tier expects arrow-key navigation and full treeitem semantics; the current build uses Tab-through `.tree-node-button`s in DOM order (a known gap).
- **Implementation notes**: `expanded` keys are `conn-${id}` / `schema-${id}-${name}`; `treeData` keys are `schemas-${connId}` / `tables-${connId}-${schema}`. Branches are cached once loaded. View nodes use `HiOutlineEye` + `--color-info`, tables `HiOutlineTable`.

## Skeleton loading

- **When to Use**: first load of a block where the final layout is known — Dashboard KPIs/activity/health, Monitoring KPIs/tables, TransferDetail card, AdminUsers table (`States.jsx`: `SkeletonBlock`, `SkeletonRows`).
- **When NOT to Use**: for a refresh of already-visible values (keep old values, update the `Freshness` stamp), or where the real dimensions are unknown (Connections/Explorer/Transfers instead use `.loading-overlay` + `.spinner.spinner-lg`).
- **States**: flat grey `.skeleton` bars at the real value sizes (e.g. 70%×12 label, 45%×26 value, 100%×42 row); `aria-hidden="true"` on the container; no shimmer.
- **Accessibility**: skeletons are `aria-hidden="true"`; `App.jsx`'s `PageFallback` adds `role="status" aria-live="polite"` and "Loading…" (strings end with `…`). Content is never hidden if the animation fails.
- **Implementation notes**: `.skeleton` is `background: var(--raised)` + `radius-control`. The Dashboard disables the `enter` animation on `.stats-grid .stat-card` so skeletons do not fade in. Reduced motion keeps content (travel drops).

## Empty state

- **When to Use**: a block with genuinely no records, or a first-run screen — every main screen has one (`States.jsx` `EmptyState`, plus inline variants).
- **When NOT to Use**: for an error (use `.alert-danger` + Retry) or for loading (use skeletons). Never show an empty table `<tbody>`.
- **States**: frame + header retained, one `.empty-state-icon` (`aria-hidden`), an `h3` title, one sentence, and — where an action exists — the first action located where the data will appear ("Add a connection", "Transfer this table"). Some states are intentionally CTA-free ("No transfers yet" on Transfers, "Select a table" on Explorer).
- **Accessibility**: `h3` under the screen's `h1`; decorative icon `aria-hidden="true"`; the CTA is a real `<button>`/`<Link>`. First-run copy states the setup progress at its true percentage where applicable.
- **Implementation notes**: `.empty-state` keeps the `.card` frame; `loadFailed` on Explorer and the non-admin `Admins only` state reuse this shape for error/gating rather than an alert (documented per-screen).

## Inline error

- **When to Use**: a block-level request failure where the rest of the screen is still usable — `States.jsx` `InlineError`, and the inline `.alert.alert-danger` implementations on Dashboard, Login, Connections, AdminUsers, TransferDetail (not-found), Transfers (wizard).
- **When NOT to Use**: for a field value (inline form validation) or a purely transient mutation failure (toast).
- **States**: message naming what failed, an optional "Last updated …" last-good clause, and a "Retry" `.btn-secondary.btn-sm`; `role="alert"`. Dashboard appends "Data below may be out of date."
- **Accessibility**: `role="alert"`; Retry is a labelled button; the message includes a fix or next step; previously loaded data stays visible.
- **Implementation notes**: `.alert-danger` uses `--pill-negative-bg` / `--pill-negative-ink` with a 1px `--negative` border and `radius-control`. `InlineError` is available in `States.jsx` but pages mostly render the same structure inline.

## Freshness stamp

- **When to Use**: any screen that holds data that can age — Dashboard, Monitoring, TransferDetail (`States.jsx` `Freshness`).
- **When NOT to Use**: on Login, Connections, Explorer, Transfers list or AdminUsers (no stamp is implemented there); never to imply "live" without a current source.
- **States**: `loading` (Refresh `disabled`), fresh ("Updated HH:MM" via `Intl.DateTimeFormat` hour/minute), `stale` (`.freshness-stale` → "Update failed · showing last good data"), `not loaded` ("Not loaded" when `updatedAt` is null). Always paired with a "Refresh data" `.btn-ghost.btn-sm`.
- **Accessibility**: `aria-live="polite"` on `.freshness`; the Refresh icon is `aria-hidden="true"` with `aria-label="Refresh data"` on the button. Stale text is explicit, not a colour or pulse.
- **Implementation notes**: `updatedAt` is set on each successful load; `stale` is driven by a failed poll (`TransferDetail` via `usePolling` `error`) or a failed `loadAll` (`Monitoring`). Poll intervals: 3000ms on detail (while `running`/`pending`), 5000ms on the transfers list (while `hasRunning`).

## Confirm / cancel

- **When to Use**: an irreversible or costly action — delete a connection, cancel a running transfer — or leaving an unsaved wizard.
- **When NOT to Use**: for reversible edits (save directly), or for a routine navigation. Never rely on a browser `window.confirm` as the only in-app confirmation for a normal close (it is used only as the discard guard alongside modal state).
- **States**: closed, open (`Modal` with `title="Delete Connection"` / `title="Cancel Transfer"`, `maxWidth="440px"`), footer "Keep connection" / "Keep Running" (secondary, safe) then "Delete connection" / "Cancel Transfer" (`btn-danger`); `TransferDetail` uses `.confirm-overlay` / `.confirm-dialog` with "Keep running" / "Cancel transfer". Unsaved wizard close shows `window.confirm('Discard this transfer? …')` and a `beforeunload` handler.
- **Accessibility**: `Modal` gives `role="dialog"`, `aria-modal="true"`, focus trap, initial focus, Escape, focus restore. `TransferDetail`'s `alertdialog` has `aria-modal`, `aria-labelledby="cancel-title"` and Escape, but no focus trap or restore (a gap). Safe action is first in DOM order; destructive verb is specific ("Delete connection", not "OK").
- **Implementation notes**: cancel calls `POST /transfers/:id/cancel`; delete calls `DELETE /connections/:id` and handles a 409 with a specific toast ("Connections with transfer history cannot be deleted"). Both reload their list after success.

---

## Animation Standards

One quiet entrance plus control feedback; motion intensity 3–4/10. Only
`transform` / `opacity` are animated; `transition: all` is banned. Full
`prefers-reduced-motion: reduce` fallback drops all animation/transition
duration to `0.001ms` but never hides content.

| Element | Animation | Duration / delay | Reduced motion | Notes |
|---|---|---|---|---|
| `.page-header` | `@keyframes enter` (opacity 0→1, `translateY(12px)`→0) | 320ms, 0ms | 0.001ms, content stays | First in the stagger |
| `.stats-grid` | `enter` | 320ms, 70ms delay | 0.001ms | Dashboard/Monitoring KPI container |
| `.page-container > .card`, `.grid-2 > .card`, `section.card` | `enter` | 320ms, 140ms delay | 0.001ms | Third in the stagger |
| `.stats-grid .stat-card` (all 6) | `animation: none` | — | — | Skeletons/KPIs do not fade individually |
| `.tab.active::after` | 1px accent line appears (colour transition on `.tab`) | `--t-fast` 150ms | 0.001ms | The signature selection line; no slide between tabs in the current build |
| `.progress-fill` | `transition: width` | `--t-base` 220ms | 0.001ms | Real ratio only; `::after { content: none }` (no pulse) |
| `.btn`, `.card:hover`, `.data-table tr:hover td` | colour/background tone step | `--t-fast` / `--t-base` | 0.001ms | Feedback on every control; no resting shadows |
| `.spinner` / `.spinner-lg` | `@keyframes spin` | 0.7s linear infinite | iteration count 1 | Loading only; not an autoplay "live" loop over 5s |
| `.sidebar` (≤ 1024px drawer) | `transform: translateX(-100%)`→0 | `--t-base` 220ms | 0.001ms | Mobile top bar + sheet drawer, kept over a bottom bar |
| Toasts | react-hot-toast entrance | 4000ms visible duration | n/a | No glow, `boxShadow: 'none'` |

**Sound**: N/A for a web data tool. There is no audio feedback, no sonification
of rates or statuses, and no speech output beyond what a screen reader supplies
from the ARIA live regions above.
