# Redesign Validation Report

**Date**: 2026-11-15
**Branch**: `testing-main`
**Scope**: Full frontend UI/UX redesign migrated onto React 19, React Router v7, and Astryx (`@astryxdesign/core@0.7.16`) with a custom dark *Data Terminal* `defineTheme` (`frontend/src/themes/databridge.ts`), explicit CSS cascade layers (`layers.css`), 8 updated UX specs (`APPROVED` in `design/ux/REVIEW.md`), accessibility polish, WIG/React best-practice fixes, tests, screenshots, and CI gating.

All figures below were measured on the current build unless stated otherwise. Where a check could not run, it is recorded under **Not run / limitations** rather than reported as a pass.

## Automated checks

| Check | Baseline (pre-redesign) | Current (Astryx + React 19) | Command |
|---|---|---|---|
| App-screen lint (`design-taste-frontend`) | **15 FAIL / 61 WARN** (3 files) | **0 FAIL / 38 WARN** (33 files) | `node scripts/lint.mjs --app frontend/src` |
| Production DOM/layout inspect (`inspect.mjs`) | 0 FAIL / 2 WARN (`/login` only) | **0 FAIL / 1 WARN** (`/login`) | `node scripts/inspect.mjs --app http://localhost:4173` |
| Cross-route viewport matrix (9 routes × 3 widths) | not automated across all 27 cells | **0 FAIL** across all 27 captures; **0 WARN / `overflowX: false`** on all `768px` & `390px` views | `inspect_all_routes.mjs` |
| Vitest | 18 passed (4 files) | **35 passed (8 files)** | `npm test` |
| ESLint | pass | **pass** | `npm run lint` |
| Prettier | n/a | **pass** | `npm run format:check` |
| Astryx theme parity check | n/a | **pass** (`databridge.ts` matches built CSS/JS/d.ts) | `npm run theme:check` |
| Vite production build | pass | **pass** (`2955` modules, `2.40s`) | `npm run build` |
| Astryx doctor (`dist/`) | n/a | **11 pass, 0 warn, 0 fail, 13 info** | `npm run astryx -- doctor --built dist` |
| Astryx doctor (source `.`) | n/a | **11 pass, 1 warn, 0 fail, 12 info** (`812` legacy-markup findings) | `npm run astryx -- doctor --built .` |

The 38 remaining `lint.mjs --app` WARNs match documented Data Terminal allowances: 28× `[mono]` (monospace reserved for SQL/code/identifiers/logs), 6× `[shadow]` (dialog overlays and generated `databridge.css` focus/selection rules), 3× `[eyebrow]` (`.section-label`), and 1× `[em-dash]` (`12` occurrences).

### Astryx `doctor` and `is-my-code-good` evidence

- `npm run astryx -- doctor --built dist` passes (`built-astryx-usage`: `[ok]`, Node `v24.13.1 >= 22.13.0`, `@astryxdesign/core` & `@astryxdesign/cli` aligned at `0.7.16`).
- `npm run astryx -- doctor --built .` reports `built-astryx-usage: [ok]` (`51 imports from @astryxdesign/core, @astryxdesign/theme-neutral in 21 files; 99 component uses`) alongside `built-astryx-purity: [warn]` (`812 findings`: Astryx components `415`, Styling `370`, Icons `27`).
- Under the `astryx docs is-my-code-good` rubric: **App fit**, theme tokens/overrides, `AppShell`/`SideNav`, `Modal` (`Dialog`), `Tabs` (`TabList`), `StatusBadge` (`Badge`), `States` (`EmptyState`/`Skeleton`/`Banner`), and `AdminUsers` (`Card`/`Table`) rate **good**; coexisting `@layer legacy` markup/CSS and `react-icons` usage across legacy route panels rate **needs work** until their incremental table/form rewrites land.

## Real-browser checks

Chrome rendered the **production build** (`vite preview`) against a representative mock API (`mock_api.mjs`) serving production response shapes:

- **Critical-path interactive smoke check (`smoke_check_browser.mjs`)**: **15 / 15 checks passed**, `consoleErrors: []`, `pageExceptions: []`.
  - Authenticated `/login` sign-in flow redirecting to `/` (`Dashboard`).
  - `/explorer?conn=...&schema=public&table=customer_orders&tab=preview` rendering table preview rows.
  - `/transfers?status=running` selecting the Running tab and clicking `All` clearing `?status=running` from the URL.
  - Clicking `#btn-new-transfer` opening native `<dialog open>`, advancing Step 1 (`Source`) → Step 2 (`Target`) → Step 3 (`Options` with column mappings), pressing `Escape` to trigger the `Discard` confirmation dialog, and confirming discard to close all dialogs cleanly.
  - `/transfers/:id` rendering `role="progressbar"` (`aria-valuenow="87420"`) and execution log entries.
  - `/connections`, `/monitoring?view=connections` (URL-synced tab), and `/admin/users` (`Table` rows).
- **27-cell viewport matrix (`1440×900`, `768×1024`, `390×844` across all 9 routes)**: `0 FAIL` everywhere; all `768px` and `390px` captures recorded `0 FAIL / 0 WARN / overflowX: false`. Remaining `@1440px` WARNs are `[hero-void]` / `[panel-void]` below sparse sample data tables/cards.

## Direction, critique, and guidelines polish

- **Data Terminal preserved**: Rejected `design-taste-frontend/scripts/draw.mjs --app` (`True-black flat`, which stripped surface tone separation and the `#4a8ad6` selection bar) and `ui-ux-pro-max --design-system` (light Flat Design `#F8FAFC`/`#2563EB`/`Inter`). Kept the dark Data Terminal palette (`#171719` canvas, `#131217` card/rail, `#4a8ad6` 1px accent selection line) with `IBM Plex Sans` + `JetBrains Mono`.
- **Round 1–3 visual fixes**: Consolidated `mobileNav={{ breakpoint: 'lg' }}` on `AppShell`, prevented status badge wrapping (`whiteSpace: 'nowrap', flexShrink: '0'`), widened `AdminUsers` email column (`minWidth: 265`), kept `.detail-head` back action compact, added inline wizard validation (`setWizardErrors`), aligned `--chart-1: var(--accent)`, aligned `.grid-2 { align-items: start; }`, and compacted `@media (max-width: 900px)` `.data-table` padding.
- **Web Interface Guidelines & React best-practice fixes**: Added `:focus-visible` outlines and dark `<option>` styling on legacy `.form-input`/`.form-select`, `scroll-margin-top: 24px` on `h1, h2, h3`, `autoComplete="off"` + `spellCheck={false}` on non-auth identifier fields, real `href="/connections"` navigation link on Explorer empty state, and hoisted `Intl.NumberFormat`/`Intl.DateTimeFormat` instances to module scope across 7 components/pages.

## Screenshots

All nine `docs/screenshots/*.png` files were recaptured from the production build at `1440×900` and visually inspected. Total PNG size is `724,794` bytes (~708 KB, down from ~7.7 MB baseline).

## Per-screen UX specs and review

`design/ux/` holds all 8 screen specs updated cleanly with Astryx component-inventory deltas (`design/ux/interaction-patterns.md` and `design/DESIGN-SYSTEM.md` updated to match `defineTheme`, cascade layers, and `theme targets`). `/ux-review all` verdict is **APPROVED** in `design/ux/REVIEW.md` against the committed WCAG 2.2 AA tier (`design/accessibility-requirements.md`); game-oriented inputs (`GDD`, `engine`, `gamepad`) are explicitly marked `N/A`.

## Not run / limitations

- **Full Docker demo stack** (Postgres + MySQL + Redis + Celery + FastAPI backend): NOT started; browser verification used mock `/api/*` endpoints. Run a manual live-transfer verification against the Docker demo stack before merge.
- **Remote GitHub Actions PR status**: NOT verified remotely (`gh` CLI unauthenticated locally).
- **Node 20 CI/Docker vs Astryx CLI**: `@astryxdesign/cli@0.7.16` requires Node `>=22.13.0` (`engines.node`), whereas `frontend-quality`, `frontend-tests`, and `frontend/Dockerfile` (`node:20-alpine`) target Node 20 (matching `npm ci` + `npm run build` without invoking the CLI). Added a dedicated `frontend-theme` job in `.github/workflows/ci.yml` pinned to Node 22 for `npm run theme:check` and `npm run astryx -- doctor --built dist`.
- **Automated accessibility & pixel contrast**: No `axe-core` scan and no pixel-sampled contrast run were executed; WCAG 2.2 AA conformance was verified by token math and code/DOM inspection.
- **Engine / game-pipeline validation**: **N/A** / `NOT ASSESSED` (web SPA, no game engine).
