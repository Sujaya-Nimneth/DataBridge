# ADR-0005: Frontend component system — React 19 + Astryx

- **Status**: Accepted
- **Date**: 2026-11-15

## Context

The frontend is a React 18 + Vite SPA whose visual language is a bespoke dark
"Data Terminal" system expressed as one ~2,300-line CSS file with a three-layer
token set (`design/DESIGN-SYSTEM.md`). It has eight approved UX specs, a pattern
library, URL-synced state and a committed WCAG 2.2 AA tier
(`design/accessibility-requirements.md`).

A complete UI/UX redesign is being undertaken with **Astryx** as the component
system. Astryx `@astryxdesign/core` declares `react`/`react-dom >= 19` as peer
dependencies, so the current React 18 runtime cannot host it. The redesign must
also preserve what already works: routing, auth, polling, data fetching,
URL state, business logic, the 32 tests and the accessibility "keeps" (focus
trap/restore, roving tabs, `progressbar`, `role="status"`, `aria-live`).

The `ui-styling` skill's shadcn/Tailwind stack and Astryx are competing
component systems; Astryx's own migration guidance describes migrating *from*
shadcn/Tailwind *to* Astryx. Running both would produce two sources of truth
for controls, tokens and accessibility behaviour.

## Decision

1. **Upgrade the runtime to React 19** before any UI work. Align `@types/react`
   and `@types/react-dom` to 19. Verify tests, lint, format and the production
   build at the spike; keep `react-router-dom@7`, `@testing-library/react@16`
   and Vite 6, all of which support React 19.
2. **Adopt Astryx as the single component system.** Pin `@astryxdesign/core`,
   `@astryxdesign/cli` and `@astryxdesign/theme-neutral` to one release. Use
   `@stylexjs/stylex` for local overrides; use Astryx per-entry imports and
   token-backed styling only. Do **not** add Tailwind or shadcn/ui.
3. **Keep the Data Terminal identity as a custom Astryx theme.** Author it with
   `defineTheme({extends: neutralTheme, ...})`, map the committed semantic
   tokens onto Astryx token names, and use `theme targets` component overrides
   for the signature 1px accent selection line, tone-step surfaces, flat pale
   pills, tabular figures and reduced motion. Build the theme to static CSS for
   production first paint. Do not adopt a bundled light theme.
4. **Make CSS cascade layers explicit.** Import a `layers.css` first declaring
   `@layer reset, astryx-base, astryx-theme, app`; import the Astryx reset,
   `astryx.css` and theme CSS into their layers; demote the legacy `index.css`
   into the `app` layer during migration. Run the foundation smoke test before
   migrating any surface, because an unlayered reset silently overrides every
   component style.
5. **Wrap the app root in `<Theme theme={databridge} mode="dark">`** and keep
   `color-scheme: dark` plus the matching `theme-color` meta.
6. **Migrate incrementally, shell-first, one route per PR**, per Astryx's
   `migration/migration-setup`: Theme + CSS → AppShell/SideNav → shared
   primitives → global workflows (toasts, dialogs, tabs, tables) → routes.
   Keep each page's data source, URL state and business logic intact; start
   every page from an Astryx page template and keep its frame/gap/padding.
7. **Preserve the approved UX layer.** Delta the eight UX specs' component
   inventories and the pattern library to name Astryx components/props, then
   re-run `/ux-review all` to APPROVED. The committed WCAG 2.2 AA tier, the
   interaction map, states and acceptance criteria stay unchanged.
8. **Keep the app in JavaScript (`.jsx`)**; Astryx theme sources are `.ts` and
   Vite transpiles them natively. Add `typescript` as a dev dependency and
   extend lint/format globs to `.ts`; do not rewrite the app to TypeScript.

## Alternatives considered

- **Stay on the bespoke vanilla-CSS system.** Rejected: the task is a complete
  redesign onto Astryx; hand-maintaining one large CSS file keeps every control
  an accessibility and consistency risk.
- **Adopt shadcn/ui + Tailwind.** Rejected: competes with Astryx, which is the
  requested primary system; introduces a second token and primitive layer.
- **Big-bang rewrite of all screens at once.** Rejected: high regression risk
  for routing, URL state and accessibility; the incremental shell-first path is
  Astryx's documented recommendation and keeps every step verifiable.
- **Adopt a bundled Astryx theme verbatim.** Rejected: bundled themes are light
  or editorially styled and would discard the committed, validated Data
  Terminal direction and its WCAG contrast decisions.

## Consequences

- The React 19 upgrade is a prerequisite for every later phase; it changes the
  production bundle size and requires CI/Docker Node compatibility to be
  re-verified (CI currently pins Node 20, Docker `node:20-alpine`).
- Components import from their own `@astryxdesign/core/<Name>` entry points;
  raw `<div>`/`<span>` layout, inline styles and hardcoded hex/px in components
  are disallowed, replaced by layout components and design tokens.
- Tests that assert legacy CSS class names and ids (`.sidebar`, `.tab.active`,
  `#nav-*`) must be updated per route; prefer semantic/role queries.
- The legacy `index.css` is reduced to a thin app-layer shim and eventually
  removed only after every route is migrated and the visual gate passes.
- `react-icons` and `react-hot-toast` become redundant once Astryx `Icon` and
  `useToast` are adopted; remove them after their replacements are verified.
- Game-oriented pipeline skills (team-ui, gate-check, qa-plan, ux-design,
  design-review, code-review) are used for their review/verdict discipline
  adapted to a web product; inputs they expect (GDDs, engine, sprints,
  gamepad) are recorded as out of scope rather than fabricated as passes.
