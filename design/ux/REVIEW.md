# UX Review — Screen Spec Suite

**Date**: 2026-11-11
**Reviewer**: ux-review skill (Phase 3A checklist for UX Specs, 3C for the
pattern library)
**Platform Target**: Web (desktop-first; keyboard/mouse primary, touch
secondary) — from `design/accessibility-requirements.md`
**Accessibility Tier**: WCAG 2.2 AA — **committed** in
`design/accessibility-requirements.md` (so the accessibility gate has a real
criterion; it is not NOT ASSESSED).

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
- [x] Layout Specification — zones + a component inventory table with real class names
- [x] States & Variants — loading, empty/populated, error, stale, zero/missing all documented
- [x] Interaction Map — keyboard-only flow and focus order
- [x] Data Requirements — each element mapped to a real endpoint in `api/client.js`
- [x] URL State — each screen's query params / path params named
- [x] Accessibility Requirements — screen-level, tied to the committed tier
- [x] Localization Considerations — `Intl` usage, char counts, 40% expansion
- [x] Acceptance Criteria — 7 per spec, testable, including a performance and a responsive criterion

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

## GDD / pattern alignment

This is a brownfield web product, not a game: there are no GDDs and no
`design/gdd/systems-index.md`. The equivalent source of truth is
`docs/API.md` + `docs/ARCHITECTURE.md` + `design/DESIGN-SYSTEM.md`, which the
specs' Data Requirements and Layout sections cite. GDD alignment is therefore
**N/A**, recorded rather than silently passed.

Pattern library: `design/ux/interaction-patterns.md` exists, so this dimension
is assessed (not N/A and not NOT ASSESSED). All specs reference it.

## Dimensions not assessed

None of the four review dimensions is unassessed: the committed WCAG 2.2 AA
tier exists, the pattern library exists, the specs are readable, and the
checklists have criteria. GDD alignment is out of scope by product type, not
an unassessed dimension.

## Verdict: APPROVED

**Blocking issues**: 0
**Advisory issues**: 0
**Dimensions not assessed**: 0

All eight screen specs and the pattern library are implementation-ready and
match the code that shipped. The `ux-review` gate is satisfied for the
pipeline; handoff to visual design / implementation is complete.
