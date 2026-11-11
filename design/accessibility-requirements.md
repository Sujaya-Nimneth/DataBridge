# Accessibility Requirements — DataBridge

**Committed tier: WCAG 2.2 AA.** This is the project-wide standard; every
per-screen UX spec and every implementation is checked against it. It is the
criterion the `/ux-review` and `/team-ui` gates compare against — without a
committed tier those gates would pass while checking nothing.

## Scope

The React SPA at `frontend/`: login/register, dashboard, connections, explorer,
transfers list + wizard + detail, monitoring, admin users. Target platform:
**Web, desktop-first, keyboard/mouse primary, touch secondary** (phone 390px,
tablet 768px, desktop 1024/1440px). No gamepad.

## Tier requirements

### Contrast and colour
- Text contrast ≥ 4.5:1 against its surface; large text ≥ 3:1. The muted token
  `#8a8c92` on `#131217` passes; anything dimmer is forbidden.
- Interactive state boundaries (focus rings, control borders) ≥ 3:1.
- Colour is never the only carrier of information. Transfer status, connection
  health and log level always have a text label or a shape/sign in addition to a
  hue; polarity colours always sit beside the value in text.
- Tested with a colourblind simulation; no red/green-only distinctions.

### Keyboard and focus
- Every control reachable and operable with the keyboard alone, in reading
  order. No gesture-only or hover-only action.
- Visible `:focus-visible` on every interactive element; never `outline: none`
  without a replacement. Grouped controls use `:focus-within`.
- Focus order defined for the wizard (step → fields → mapping rows → Back/Next),
  the explorer tree, tabs, tables and dialogs.
- Skip link to main content on every authenticated screen.
- Dialogs (existing `Modal`) trap focus, set initial focus, restore focus on
  close, close on Escape. This behaviour is a **keep** and must not regress.
- Sticky headers / overlays never cover the focused element;
  `scroll-margin-top` on heading anchors.

### Semantics and ARIA
- Semantic HTML before ARIA: `<button>` for actions, `<a>`/`<Link>` for
  navigation, `<label>`, `<table>`, hierarchical `h1`–`h6` (one `h1` per
  screen). No `<div onClick>`.
- Icon-only buttons need `aria-label`; decorative icons `aria-hidden="true"`.
- Async updates (toasts, progress, polling status, validation) announce with
  `aria-live="polite"`; errors with `role="alert"`.
- Form controls have `<label>` or `aria-label`, `autocomplete`, meaningful
  `name`, correct `type`/`inputmode`. Errors inline next to the field, tied with
  `aria-describedby`, focus moved to the first error on submit. Never block
  paste; disable spellcheck on emails/usernames.
- Tab/tablist/tabpanel, tree/treeitem, dialog and progressbar roles with correct
  `aria-selected`, `aria-expanded`, `aria-controls`.

### Motion
- Full `prefers-reduced-motion: reduce` fallback: content stays, travel drops.
- `transform` / `opacity` only; animations interruptible; autoplay loops over
  5s have pause/stop/hide; no `transition: all`.

### Touch and layout
- Touch targets ≥ 44×44px with ≥ 8px spacing; `touch-action: manipulation`.
- No horizontal scroll; tables become two-line rows below 640px or scroll in
  their own frame with a fixed first column.
- Zoom is never disabled (no `user-scalable=no`, no `maximum-scale=1`).
- Safe-area insets for full-bleed layouts on notched devices.

### Content
- Images have `alt` (or `alt=""` decorative) and explicit dimensions.
- `color-scheme: dark` on `<html>`; `<meta name="theme-color">` matches the
  ground so native scrollbars/inputs follow the theme.
- Dates/numbers via `Intl.*`; brand names and code tokens `translate="no"`.
- Loading strings end with `…`; specific button labels; error messages include
  a fix or next step.

## Verification

- Automated: lint rules for icon-button labels, form labels, focus-visible,
  `transition: all`, `outline: none`; `axe`-style checks in the manual pass.
- Manual: keyboard-only walkthrough of every flow; screen-reader spot check of
  login, transfer creation and live progress; 200% zoom; 390/768/1024/1440.
- Retained screenshots at every breakpoint per screen, in `production/qa/evidence/`.

## Assumptions

WCAG 2.2 AA was chosen as the default for a professional web tool with no
stated regulatory requirement. If a stricter tier (or a VPAT) is required,
revise this document before the UX specs are re-reviewed.
