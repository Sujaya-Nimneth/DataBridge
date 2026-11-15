# UX Review — Screen Spec Suite

**Date**: 2026-11-15 (re-reviewed after Astryx + React 19 UI architecture migration)
**Reviewer**: `/ux-review all` (Phase 3A checklist for UX Specs, 3C for the
pattern library, adapted to a web product)
**Platform Target**: Web (desktop-first; keyboard/mouse primary, touch
secondary) — from `design/accessibility-requirements.md`
**Accessibility Tier**: WCAG 2.2 AA — **committed** in
`design/accessibility-requirements.md` (re-cited for this review; not NOT ASSESSED).

## Summary

| File | Template / checklist | Verdict | Primary note |
|---|---|---|---|
| `dashboard.md` | UX Spec / 3A | APPROVED | — |
| `login.md` | UX Spec / 3A | APPROVED | — |
| `connections.md` | UX Spec / 3A | APPROVED | — |
| `explorer.md` | UX Spec / 3A | APPROVED | — |
| `transfers.md` | UX Spec / 3A | APPROVED | — |
| `transfer-detail.md` | UX Spec / 3A | APPROVED | — |
| `monitoring.md` | UX Spec / 3A | APPROVED | — |
| `admin-users.md` | UX Spec / 3A | APPROVED | — |
| `interaction-patterns.md` | Pattern Library / 3C | APPROVED | Sound N/A for a web data tool |

## Phase 3A — UX Spec checklist (all 8 specs)

- [x] Document header with Status, Platform Target, Accessibility Tier
- [x] Purpose & User Need — user-perspective statements, not system-perspective
- [x] User Context on Arrival — specific (first-run vs long-lived, from where)
- [x] Navigation Position — hierarchy, all entry & exit points
- [x] Layout Specification — zones + component inventory tables updated for Astryx components/props and remaining `index.css` layout rules
- [x] States & Variants — loading, empty/populated, error, stale, zero/missing preserved unchanged from approved spec baseline
- [x] Interaction Map — keyboard-only flow and focus order preserved unchanged
- [x] Data Requirements — each element mapped to a real endpoint in `api/client.js` (unchanged)
- [x] URL State — each screen's query params / path params preserved unchanged
- [x] Accessibility Requirements — screen-level, tied to the committed WCAG 2.2 AA tier (unchanged)
- [x] Localization Considerations — `Intl` usage, char counts, 40% expansion preserved unchanged
- [x] Acceptance Criteria — 7 per spec preserved unchanged

Quality checks: goals are unambiguous, states cover error/empty/loading,
focus order is defined for keyboard (the primary input), every displayed data
element names its API source, colour-coded states have non-colour text
alternatives, and no criterion requires reading another document.

Input methods: Web keyboard/mouse primary, touch secondary. No gamepad in the
platform target, so no gamepad checklist is due. Keyboard-only navigation is
fully specified per screen.

## Phase 3C — Pattern library checklist

- [x] Catalog index current
- [x] All standard control patterns present: buttons, tabs, modal/dialog,
  toast, progress bar, status badge, inline validation, table, tree, skeleton,
  empty state, inline error, freshness stamp, confirm/cancel
- [x] Each pattern has When to Use / When NOT to Use / states / accessibility
  / implementation notes
- [x] Animation Standards table present (subtle entrance + reduced motion)
- [x] Sound Standards N/A — documented as N/A for a web data tool (no audio events)
- [x] No conflicting "Back" behaviour; dialogs share one pattern (`Modal`)

## Accessibility findings raised during spec authoring — resolution

The spec authoring pass surfaced these real gaps against the committed tier.
All were **fixed in code** before this review, so the verdict is APPROVED rather
than NEEDS REVISION:

| Finding | Fix |
|---|---|
| Tabs lacked arrow-key roving focus and `tabpanel` semantics | New `components/Tabs.jsx` (WAI-ARIA tabs pattern: roving tabindex, arrows, Home/End, `aria-controls`); used on Monitoring, Transfers, Explorer, with `role="tabpanel"` wrappers. Unit-tested (4 tests). |
| `TransferDetail` cancel `alertdialog` lacked a focus trap/restore | Replaced with the shared, already-accessible `Modal` (portal, focus trap, initial focus, restore, Escape, scroll lock). |
| Wizard used `window.confirm` to discard | Replaced with an in-app `Modal` confirmation ("Keep editing" / "Discard"). `beforeunload` keeps the standard native guard for tab close. |
| Progress bars had no `progressbar` role | Added `role="progressbar"` with `aria-valuenow/min/max/valuetext` on the transfer list and detail. |
| Loading overlays had no live region | Added `role="status"` + a text label + `aria-hidden` spinner on every overlay. |
| `AdminUsers` counts were not `Intl`-formatted; refresh had no live region | `Intl.NumberFormat` on counts and the account total; `aria-live="polite"` on the finding line. |
| Astryx primitive & theme parity (`@astryxdesign/core` v0.7.16) | `AppShell` (`mobileNav={{ breakpoint: 'lg' }}`), `SideNav` (`databridgeTheme` 1px `#4a8ad6` `::before` bar), `Tabs.jsx` (`@astryxdesign/core/TabList`, WAI-ARIA arrow/Home/End verified in `Tabs.test.jsx`), `Modal.jsx` (`@astryxdesign/core/Dialog` native `<dialog showModal()>`), `ProgressBar`, `States.jsx` (`Skeleton`, `EmptyState`, `Banner`, `Button`), `StatusBadge.jsx` (`Badge` with contrast-verified dark/light muted semantic tokens ≥ 5.9:1), and inline wizard step-gating inside `<Modal>` (avoiding toasts behind `::backdrop`). |

## Game-oriented inputs & pattern alignment

DataBridge is a web data platform product, not a game: game-oriented inputs
(**GDD** / `design/gdd/systems-index.md`, **game engine**, and **gamepad**
input checklists) are **N/A** and are recorded explicitly rather than silently
passed or fabricated. The web sources of truth are
`design/accessibility-requirements.md` (committed WCAG 2.2 AA tier),
`design/DESIGN-SYSTEM.md` (`databridgeTheme` via `defineTheme` and theme targets),
`docs/API.md`, `docs/ARCHITECTURE.md`, and `docs/adr/0005-react19-astryx-adoption.md`.

Pattern library: `design/ux/interaction-patterns.md` has been updated with
Astryx component/prop implementation notes (`AppShell`, `SideNav`, `Dialog`,
`TabList`, `Badge`, `ProgressBar`, `Skeleton`, `EmptyState`, `Banner`, `Button`,
`Table`, `TextInput`) while keeping accessibility contracts and sound **N/A**. All
8 screen specs reference it.

## Dimensions not assessed

Automated `axe-core` scanning and pixel-sampled contrast checks were not run in
this pass; the committed **WCAG 2.2 AA** tier is satisfied by component-contract
verification, `vitest` unit/a11y tests, semantic token math, and visual inspection
at `1440`, `768`, and `390` (`design/VALIDATION.md`). Game-specific dimensions
(`GDD`, `engine`, `gamepad`) are **N/A** by product type.

## Verdict: APPROVED

**Blocking issues**: 0
**Advisory issues**: 0
**N/A (out of scope by web product type)**: GDD, engine, gamepad

All eight screen specs (`dashboard.md`, `login.md`, `connections.md`,
`explorer.md`, `transfers.md`, `transfer-detail.md`, `monitoring.md`,
`admin-users.md`), `interaction-patterns.md`, and `DESIGN-SYSTEM.md` match the
migrated React 19 + Astryx codebase (`docs/adr/0005-react19-astryx-adoption.md`)
and the committed WCAG 2.2 AA tier. The `/ux-review all` gate is **APPROVED**.
