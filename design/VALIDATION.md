# Redesign Validation Report

**Date**: 2026-11-11
**Branch**: `testing-main`
**Scope**: Full frontend UI/UX redesign (design system, 8 screens, 2 new
routes, URL state, states, accessibility, copy, motion, tests, docs).

All figures below were measured, not estimated. Where a check could not run,
it is named under "Not run" rather than reported as a pass.

## Automated checks

| Check | Before | After | Command |
|---|---|---|---|
| App-screen lint (design-taste-frontend) | **15 FAIL / 61 WARN** on 3 files | **0 FAIL / 34 WARN** on all production files | `node lint.mjs --app frontend/src/...` |
| Vitest | 18 passed (4 files) | **32 passed (7 files)** | `npm test` |
| ESLint | pass | **pass** | `npm run lint` |
| Prettier | n/a | **pass** | `npm run format:check` |
| Vite production build | pass | **pass** | `npm run build` |

The 34 remaining WARNs are all app-screen allowances documented in
`DESIGN-SYSTEM.md`: monospace used only for literal code/identifiers,
shadows only on dialogs/focus/selection/inset selection marks, sentence-case
section labels, and em-dashes in comments. In page mode (wrong for a
dashboard) the same source would flag 1px table/panel borders — the app
rule set relaxes exactly those.

### What the lint FAILs were

Before: 13 gradient fills, 2 gradient-clipped text, 18 `backdrop-filter`
(glass), 21 shadows/glows, 10 `transition: all`, framework-default colours,
and monospace misuse. After: all gradients, glass, glows, resting shadows and
`transition: all` removed; the accent is a 1px line only.

## Real-browser checks

A throwaway Chrome (via the skill's CDP driver) rendered the **production
build** against a representative mock API at the same response shapes the
demo stack serves. Login was captured unauthenticated; authenticated pages
used an injected session.

| Width | Screens checked | Result |
|---|---|---|
| 1440 | login, dashboard, connections, explorer, transfers, transfer detail, monitoring, admin users, wizard step 3 | all render, no crashes |
| 768 | dashboard | no horizontal scroll; labelled off-canvas drawer |
| 390 | dashboard, transfers, transfer detail | `document.scrollWidth === innerWidth` (no horizontal scroll) |

Measured at 390px on `/transfers`:
`data-table-wrapper` client 316px / scroll 647px, and the tab strip
321px / 316px — i.e. the table and tabs scroll **inside their own frames**
and the first table column is sticky, per the app-screen phone rules. The
page itself never scrolls sideways.

The wizard was driven through Source → Target → Options to confirm the
`?new=1` deep link, the schema/table/column loading, the SQL filter hint and
the column-mapping rows all work.

## Before / after, side by side

| Dimension | Before | After |
|---|---|---|
| Styling | one 2,210-line CSS file, amber/teal gradients + glass + glows | one token-based CSS file, three-layer tokens |
| KPIs | 6 icon-topped gradient cards + a 48px gradient number | one divided 6-cell container, 26px tabular values, no icons |
| Navigation | 260px labelled sidebar, coloured active pill + pulsing dot | 56px icon rail, 1px accent line as the only selection mark |
| Transfer detail | modal state, not shareable | `/transfers/:id` route with live rows/sec, freshness, stale state, logs |
| Admin users | tab inside Monitoring | `/admin/users` route, role-gated |
| URL state | none | `?status=`, `?new=1`, `?conn=&schema=&table=&tab=`, `?view=` |
| States | spinner + top-of-form error list | flat skeletons, inline errors, empty frames, freshness/stale, real zero / grey dash |
| Forms | generic placeholders, error list | label + inline error via `aria-describedby`, visible rules, focus to first error |
| Dates/numbers | `toLocale*` | `Intl.DateTimeFormat` / `Intl.NumberFormat` |
| Toasts | hardcoded colours | semantic tokens + `aria-live="polite"` |
| Accessibility | partial | committed WCAG 2.2 AA, skip link, labelled main landmark, `focus-visible`, reduced motion |

## Per-screen UX specs and review

`design/ux/` holds one UX spec per screen plus the interaction pattern
library. Each spec records the screen's one question, states, data sources,
URL state, keyboard flow and 7 testable acceptance criteria. The review
verdict is **APPROVED** (0 blocking, 0 advisory, 0 unassessed dimensions) in
`design/ux/REVIEW.md`.

Spec authoring surfaced six real WCAG 2.2 AA gaps, all fixed before the
review: WAI-ARIA tabs with roving focus and `tabpanel` semantics (new
`components/Tabs.jsx`, 4 unit tests), the transfer-detail cancel dialog now
reuses the focus-trapping `Modal`, the wizard discard `window.confirm` became
an in-app dialog, `role="progressbar"` with aria values on both progress
bars, `role="status"` on every loading overlay, and `Intl` + `aria-live` on
the admin users view. See `design/ux/REVIEW.md` for the full table.

## Not run / limitations

- The **full Docker demo stack** (Postgres + MySQL + Redis + Celery + backend)
  was not started; the browser checks used a mock API with the same response
  shapes. A manual pass against a real transfer is still recommended before
  merge.
- The taste `inspect.mjs` was run against the **login page** (0 FAIL, 2 WARN:
  the deliberate centred-card rest and 12px labels, both allowed on app
  screens). It was not run against authenticated pages because its driver has
  no session-injection flag; those pages were measured with the CDP driver
  instead.
- No axe-core automated accessibility run; the WCAG 2.2 AA tier was applied
  by inspection against the Vercel Web Interface Guidelines checklist.
- Contrast was checked by the token values (`#8a8c92` on `#131217` ≥ 4.5:1),
  not by a pixel sampler.

## Screenshots

All nine `docs/screenshots/` files were recaptured from the production build
at 1440×900. Total size fell from ~7.7 MB to ~464 KB.
