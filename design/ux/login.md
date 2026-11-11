> **Template**: UX Spec

# Login / Register — UX Spec

- **Status**: Approved
- **Platform Target**: Web (desktop-first; keyboard/mouse primary, touch secondary)
- **Accessibility Tier**: WCAG 2.2 AA
- **Route**: `/login` (see `frontend/src/App.jsx`)

## Purpose & User Need

- "I need to get into DataBridge (or create an account) with the least friction, and if I get something wrong I need to know exactly which field to fix."
- The user wants a clear statement of what the tool does and one obvious next action; errors must sit beside the field that caused them.

## User Context on Arrival

- Unauthenticated. Reached by `ProtectedRoute` redirect (expired/missing session), a 401 token-refresh failure in `api/client.js` (which sets `window.location.href = '/login'`), or after "Log out" in `Sidebar`.
- May be a first-time visitor (register mode) or a returning user (sign-in mode). No `AppLayout` / `Sidebar` / skip link is rendered on this route; the page is the whole view.
- If already authenticated, `/login` immediately redirects to `/` (`element={user ? <Navigate to="/" replace /> : <Login />}`).

## Navigation Position

- Standalone full-screen route outside `AppLayout`; the only navigation is the in-page mode toggle.
- Entry: unauthenticated redirects, logout, refresh-token failure, direct URL.
- Exit: successful `login()` / `register()` sets `user` in `AuthContext`, causing the `/login` route to `<Navigate to="/" replace />` (the dashboard). The mode toggle stays on the page rather than navigating.

## Screen's One Question & One Finding

- **One Question**: "How do I sign in, and what is this tool for?"
- **One Finding**: The `.login-header` answers it in one sentence under the `h1`: "Connect to your databases, explore schemas, and run transfers." (sign-in) or "Connect your databases and start moving data." (register). There is no data-driven finding on this screen — the equivalent is the plain statement of purpose.

## Layout Specification

Zones: `.login-page` (full-viewport ground, centred); one `.login-card` containing `.login-header` (solid-ink "D" mark, `h1`, purpose `<p>`); a `<form>` with conditional field groups; a full-width submit button; and `.login-toggle` below the form.

| Zone / component | Real class names (`frontend/src/index.css`, `Login.jsx`) |
|---|---|
| Page frame / card | `.login-page`, `.login-card` |
| Header | `.login-header`, `.login-logo`, `h1`, `<p>` |
| Form / fields | `.form-group`, `.form-label`, `.form-input`, `.input-invalid`, `.form-hint`, `.form-error` |
| Server/form error | `.alert`, `.alert-danger` (`role="alert"`) |
| Submit | `.btn`, `.btn-primary`, `.w-full`, `.btn-lg`, `.spinner` |
| Mode toggle | `.login-toggle`, `.login-toggle button` |
| Toasts | `Toaster` from `react-hot-toast` (`position="top-right"`, `role="status"`, `aria-live="polite"`) |

Field inventory (ids): `input-fullname` (register only), `input-email`, `input-password`, `input-confirm-password` (register only), `btn-login-submit`, `btn-toggle-auth`.

## States & Variants

- **Two modes**: `isRegister` toggles the `h1` ("Sign in to DataBridge" / "Create your account"), the subtitle, the visible extra fields (Full Name, Confirm Password), the password hint, the `autocomplete` value (`current-password` / `new-password`), the form `aria-label` ("Sign-in form" / "Registration form"), the submit label ("Sign In" / "Create Account"), and the toggle prompt.
- **Loading**: submit button is `disabled`, shows a `.spinner` (`aria-hidden`) plus "Signing in…" (this label is used in both modes); input fields remain editable.
- **Empty / populated**: empty initial form with placeholders only. There is no data list. "Empty" of content is not a distinct state; the fields start blank.
- **Error**: two kinds. (1) Client-side confirm-password mismatch → `fieldError` renders `.form-error` (`#confirm-error`, `role="alert"`) under the field, `.input-invalid` class, `aria-invalid="true"`, `aria-describedby="confirm-error"`, and focus moves to `#input-confirm-password`. (2) Server error → `serverError` renders a `.alert.alert-danger` (`role="alert"`) at the top of the form, message taken from `err.response.data.message || detail` or the fallback "Check your email and password, then try again." Both are cleared on the next submit and on mode toggle.
- **Stale**: not applicable — no data is fetched or polled, so no freshness stamp is shown.
- **Zero / missing**: `noValidate` is set on the form and native validation is bypassed for the mismatch check; `required`/`minLength={8}` are still present on inputs for semantics. There are no numeric values or missing-value dashes.

## Interaction Map

- Keyboard-only flow (sign-in): Email → Password → "Sign In" (submit) → "Create one" (mode toggle). Register: Full Name → Email → Password → Confirm Password → "Create Account" → "Sign In" (toggle).
- Focus order is pure DOM order; no autofocus, no roving tabindex, no focus trap. `Enter` in any text input submits the form (native form behaviour). On a confirm-password mismatch, focus is explicitly moved to `#input-confirm-password`. Changing a field clears its own `fieldError`.
- Toggling mode is an in-page `<button>` (`onClick={toggleMode}`), not a link; focus stays on the toggle button while the fields above it are added/removed.
- Success fires `toast.success('Signed in')` / `toast.success('Account created')`, then the route redirects; failure fires no toast (the inline error is the feedback).

## Data Requirements

Auth calls go through `useAuth()` in `frontend/src/context/AuthContext.jsx` → `authAPI` in `frontend/src/api/client.js`.

| Displayed element / action | Source |
|---|---|
| Sign in (submit) | `authAPI.login({ email, password })` → `POST /auth/login` |
| Register (submit) | `authAPI.register({ email, password, full_name })` → `POST /auth/register` |
| Session bootstrap / 401 recovery | `GET /auth/me` is available; the 401 interceptor calls `POST /auth/refresh` with `refresh_token` |
| Logout (elsewhere) | `authAPI.logout()` → `POST /auth/logout` |

- Null handling: no displayed data beyond strings. `register` sends `full_name: fullName` (blank string allowed). Error text falls back through `message → detail → a fix-oriented sentence`. On success, `access_token`, `refresh_token` and `user` are stored in `localStorage`; a malformed saved `user` is discarded on mount. There are no `Intl.*` values on this screen.

## URL State

- No query params on `/login`; no `?next=` redirect is implemented — a successful auth always goes to `/`. The route uses `<Navigate ... replace />`, so `/login` is replaced in history and Back does not return to it.

## Accessibility Requirements (WCAG 2.2 AA)

- One `h1` ("Sign in to DataBridge" / "Create your account"). The "D" logo is `aria-hidden="true"` (decorative); `<main className="login-card">` is the landmark.
- Every input has a real `<label htmlFor>`; `type` is `email` / `password` / `text`; `autocomplete` is `name`, `email`, `current-password` or `new-password`; `spellCheck="false"` on email and full name; paste is never blocked.
- Password hint uses `aria-describedby="password-hint"` (register). The confirm field uses `aria-invalid`, `aria-describedby` and an inline `role="alert"` error tied to the field; focus moves to the first error on submit.
- The server error and the field error are `role="alert"`; toasts are `role="status"` / `aria-live="polite"`. Loading button label ends with `…` ("Signing in…") and the spinner is `aria-hidden`.
- `:focus-visible` outline (2px `--accent`); contrast ≥ 4.5:1; 44×44 touch targets; `touch-action: manipulation`; reduced-motion fallback; `color-scheme: dark`. No colour-only error: the message is text plus a tinted alert.

## Localization Considerations

- All visible strings are hardcoded English literals (headings, subtitle, labels, placeholders, hint, toggle, error fallback, toast text) — extract whole sentences, not word fragments, so translators can reorder.
- Placeholders contain `…` and example data ("Alex Kim…", "name@company.com…"); keep them short (~24 chars) and budget ~40% expansion. "Connect to your databases, explore schemas, and run transfers." (~62 chars) is the longest string and must stay on ≤ 2 lines at 390px with 40% expansion.
- Numbers: none. Dates: none. Brand name "DataBridge" carries `translate="no"`; the "D" mark is decorative. Curly quotes in "Don't have an account?" should become locale quotes; the `…` ellipsis is the house form, not `...`.

## Acceptance Criteria

1. In sign-in mode exactly two inputs (email, password) and the submit button are shown; toggling "Create one" adds Full Name and Confirm Password, changes the `h1`, the form `aria-label`, password `autocomplete` to `new-password`, and the submit label to "Create Account".
2. A register submit with mismatched passwords sets `aria-invalid="true"` and `aria-describedby="confirm-error"` on `#input-confirm-password`, renders `.form-error[role="alert"]`, and moves focus to that field — with no network request.
3. A rejected `POST /auth/login` renders the server message in `.alert-danger[role="alert"]` at the top of the form; the "Sign In" button returns to enabled and the inline error clears on the next submit.
4. While a submit is in flight, `#btn-login-submit` is `disabled`, shows `.spinner[aria-hidden]` and "Signing in…"; the success toast ("Signed in" / "Account created") announces via `role="status"`.
5. Performance: submitting posts one `POST /auth/login` or `POST /auth/register`; a 401 elsewhere triggers a single `POST /auth/refresh` retry before redirecting to `/login`, with no repeated request loops.
6. Responsive: at 1440/768/390px the `.login-card` stays within the viewport with no horizontal scroll, `.w-full` submit is ≥ 44px tall, and at 390px `.login-card` uses the 24px padding rule with the subtitle wrapping but not clipping.
7. Keyboard: with Tab only, focus moves Email → Password → submit → toggle (and the register-mode extra fields in DOM order); `Enter` submits from any text field and every control shows the `:focus-visible` ring.
