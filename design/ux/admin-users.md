> **Template**: UX Spec

# Admin → Users — UX Spec

- **Status**: Approved
- **Platform Target**: Web (desktop-first; keyboard/mouse primary, touch secondary)
- **Accessibility Tier**: WCAG 2.2 AA
- **Route**: `/admin/users` (see `frontend/src/App.jsx`)

## Purpose & User Need

- "As an admin, I need to see every account on the platform — who they are, their role and status, and how much they have used — in one place I can link to."
- A non-admin needs a clear, non-technical explanation of why they cannot see this page and a way back.

## User Context on Arrival

- Authenticated admin, via the "Users" `NavLink` appended to `baseNavItems` in `Sidebar` when `user?.role === 'admin'`, the "Users" `.btn-secondary` on `/monitoring`, a direct URL, or browser Back.
- A non-admin can still reach the URL; the page gates in the UI and the API also enforces the role (403).
- Promoted from a Monitoring tab to its own route so it deep-links and Back is predictable.

## Navigation Position

- Sixth (conditional) item in `Sidebar` appended only for admins; no sidebar item for non-admins. Inside `AppLayout` with the skip link and `main#main-content`.
- Entry: sidebar "Users", Monitoring "Users" button, deep link, browser history.
- Exit: `.detail-head` "Monitoring" → `/monitoring`; the non-admin empty state's "Back to dashboard" → `/`; the sidebar.

## Screen's One Question & One Finding

- **One Question**: "Which accounts exist, and what is each one's role, status and usage?"
- **One Finding**: The `.page-finding` under the `h1` — "{n} registered account(s)." (or "Loading…" while loading). Per-account role/status are then carried by `.badge`s in the table.

## Layout Specification

Zones: `.page-container`; for admins a `.detail-head` (back link to Monitoring), `.page-header` (h1 "Users" + `.page-finding`, `.page-header-actions` with "Refresh"), an optional `.alert.alert-danger`, then one `.card` "Registered users" containing either `SkeletonRows`, an `.empty-state`, or a `.data-table-wrapper` → `.data-table`. Non-admins get only an `h1` and one `.empty-state` card.

| Zone / component | Real class names (`frontend/src/index.css`, `AdminUsers.jsx`) |
|---|---|
| Page frame / header | `.page-container`, `.detail-head`, `.page-header`, `.page-header-actions`, `.page-finding`, `.mt-6` |
| Back / refresh | `.btn`, `.btn-ghost`, `.btn-sm`, `.btn-secondary` |
| Error | `.alert`, `.alert-danger`, `.btn-sm` |
| Table | `.card`, `.data-table-wrapper`, `.data-table`, `.object-name`, `.text-sm`, `.text-muted`, `.text-right` |
| Badges | `.badge`, `.badge-dot`, `.badge-warning` (admin role / inactive status), `.badge-neutral` (non-admin role), `.badge-success` (active), `.badge-danger` (inactive) |
| Loading / empty | `.skeleton`, `.skeleton-rows` (`SkeletonRows rows={4}`), `.empty-state` |

Table columns (`scope="col"`): Name, Email, Role, Status, Connections, Transfers, Joined.

## States & Variants

- **Role-gated (non-admin)**: returns an `h1` "Users" plus `.empty-state.mt-6` "Admins only" / "This page lists every account on the platform. Ask an admin if you need access." + "Back to dashboard" link to `/`. No request is made (`if (user?.role === 'admin') load(); else setLoading(false)`).
- **Loading**: admin view renders the full frame (detail head, header with "Loading…" finding, Refresh button `disabled`) with `.skeleton-rows` of four 100%×42 `SkeletonBlock`s inside the card.
- **Empty / populated**: zero users and no error → `.empty-state` "No users found" / "Accounts appear here once someone registers." (no CTA). Populated → the 7-column `.data-table` with one row per user.
- **Error**: a failed `adminAPI.listUsers()` sets a specific message — HTTP 403 → "You need the admin role to see this page."; anything else → "Couldn't load users." — rendered in `.alert.alert-danger[role="alert"]` above the card with a "Retry" `.btn-secondary.btn-sm`. The table is not rendered while `users` is empty and `error` is set.
- **Stale**: no polling and no `Freshness` stamp. Data is fresh only after `load()`; the "Refresh" button is the manual mechanism and is `disabled` while `loading`.
- **Zero / missing**: `users.length` prints `0 registered accounts.` in normal style. `u.full_name` falls back to a grey dash `–`. `u.connection_count` / `u.transfer_count` are printed directly (no `Intl.NumberFormat` — a gap). Role badge: `admin` → `badge-warning`, anything else → `badge-neutral`. Status badge: `is_active` → `badge-success` + "active", else `badge-danger` + "inactive", each with `.badge-dot`. There is no `null` guard on `created_at` before `new Date(...)`.

## Interaction Map

- Keyboard-only flow (admin): skip link → `main` → ".detail-head" "Monitoring" back link → "Refresh" button → table (no focusable cells). With an error, "Retry" appears in the alert before the card.
- Non-admin: skip link → `main` → "Back to dashboard" link (the only control). No table, no Refresh.
- Focus order is pure DOM order of `<Link>` / `<button>`; no roving tabindex, no tabs, no dialogs, no focus trap on this screen. `Refresh`/`Retry` both call `load()`.
- Refresh sets `loading = true` (unlike the Dashboard), so the card swaps to `.skeleton-rows` while the request runs; the header finding shows "Loading…" for that period.

## Data Requirements

Endpoint from `frontend/src/api/client.js` (`adminAPI`), gated by `user?.role === 'admin'`.

| Displayed element / action | Source |
|---|---|
| Users `id`, `full_name`, `email`, `role`, `is_active`, `connection_count`, `transfer_count`, `created_at` | `adminAPI.listUsers()` → `GET /admin/users` (requires the admin role; 403 otherwise) |
| Current user / role | `useAuth()` → `AuthContext`, backed by `authAPI.getProfile()` → `GET /auth/me` (available; the context reads `localStorage` `user` on mount) |

- Null handling: `users` defaults to `[]`, `error` to `null`, `loading` to `true`. `full_name || '–'`. `err.response?.status === 403` selects the role-specific error. `dateFormat` is a module-level `new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })` reused for every row; `new Date(u.created_at)` is unguarded. `connection_count` / `transfer_count` / `users.length` are raw numbers.

## URL State

- No query params and no route params on `/admin/users`; the route is the entire deep-linkable state. The "view" that used to be a Monitoring tab is now this path, so `?view=` on `/monitoring` does not select Users. Modal/selection state: none.

## Accessibility Requirements (WCAG 2.2 AA)

- One `h1` ("Users"); the card uses `aria-label="Registered users"`; `.empty-state` headings are `h3`. Skip link to `#main-content`; visible `:focus-visible` on back link, Refresh, Retry and the non-admin CTA.
- Table is semantic `<table>` with `<th scope="col">` on all 7 columns and `font-variant-numeric: tabular-nums`. Role/status are text `.badge`s plus `.badge-dot[aria-hidden="true"]`, so role and active state are never colour-only.
- Error alert is `role="alert"`; `SkeletonRows` are `aria-hidden="true"`; the decorative `HiOutlineArrowLeft` icon is `aria-hidden="true"`. The "Loading…" finding text ends with `…` per house copy.
- The Refresh button is `disabled` while loading (no `aria-busy` on the card — a gap worth noting). No live region announces the refreshed count; the `.page-finding` changes text but is not `aria-live` (gap).
- Contrast ≥ 4.5:1, 44×44 touch targets, `touch-action: manipulation`, reduced-motion fallback, no horizontal page scroll (sticky first `.data-table` column at ≤ 640px).

## Localization Considerations

- Hardcoded English: "Users", "Monitoring", the two `.page-finding` strings, "Refresh", "Admins only", "This page lists every account on the platform. Ask an admin if you need access.", "Back to dashboard", "No users found", "Accounts appear here once someone registers.", all 7 table headers, "active"/"inactive", and both error messages. Extract whole sentences.
- "{n} registered account(s)." uses an inline singular/plural — replace with `Intl.PluralRules`. `connection_count` / `transfer_count` should go through `Intl.NumberFormat` (currently raw). Role values (`admin`, etc.) are API enums rendered raw in a badge — map to localised labels.
- Joined dates use `Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })`, already locale-aware. Longest string is the non-admin explanation (~87 chars); budget ~40% expansion so the `.empty-state` does not clip at 390px.
- `email`, `full_name`, role enums and brand "DataBridge" / code tokens → `translate="no"` where appropriate. `active`/`inactive` should be translated, not shipped as raw API booleans.

## Acceptance Criteria

1. When `user.role !== 'admin'`, the screen shows only the `h1` plus the "Admins only" `.empty-state` and the "Back to dashboard" link to `/`, and issues no `GET /admin/users`.
2. When `user.role === 'admin'`, "Users" appears in the `Sidebar`, the `.detail-head` "Monitoring" link returns to `/monitoring`, and a populated `GET /admin/users` renders exactly 7 `scope="col"` headers with one row per account.
3. Each row shows `full_name || '–'`, email, a role badge (`badge-warning` for admin, else `badge-neutral`), an active/inactive badge with text + dot, the two counts, and a medium-format `Intl.DateTimeFormat` Joined date.
4. A 403 from `GET /admin/users` shows "You need the admin role to see this page." in `.alert-danger[role="alert"]` with a working "Retry"; any other failure shows "Couldn't load users."; in both cases no table is rendered.
5. Performance: mount issues exactly one `GET /admin/users`; "Refresh" sets `loading`, shows `SkeletonRows rows={4}` with `aria-hidden="true"`, disables the button, then restores the table — with no background polling.
6. Responsive: at 1440/1024px the 7-column table is intact; at ≤ 640px cells are `white-space: nowrap`, the first column is sticky, the table scrolls inside `.data-table-wrapper`, and the page has no horizontal scroll at 390px.
7. Keyboard: Tab order is "Monitoring" → "Refresh" (admin) or "Back to dashboard" (non-admin), plus "Retry" when an error is shown, each with a visible `:focus-visible` ring; zero users with no error shows the "No users found" `.empty-state` instead of an empty table.
