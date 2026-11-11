# DataBridge Design System

The source of truth for the frontend's visual language. Values live as CSS custom
properties in [frontend/src/index.css](../frontend/src/index.css); this document
explains their roles and the rules that constrain them.

## Direction

Dealt with the `design-taste-frontend` app-screen deck for `--kind devtools`:
**Data terminal** (dark, seed `788067068`). Chosen because DataBridge is read in
long sessions, is figure-heavy (rows, durations, rates, log levels) and is a
developer platform — the same brief that an independent `ui-ux-pro-max`
design-system query resolved to a dark developer tool with operations telemetry.

**The move:** every selection (tab, toggle, range, nav item) is a 1px accent line
exactly as wide as its label, placed on the nearest existing edge. Colour budget
stays under 3%; the accent is never more than a 1px line. Numbers stay white or
grey and carry their sign in the text. `font-variant-numeric: tabular-nums` on
every figure, table and KPI.

**The idea:** the source→target column mapping and the validated SQL `WHERE`
clause — the two artefacts only the transfer wizard produces — are the spine:
two aligned columns of names joined by thin rules, echoed in the wizard, the
live transfer strip and the detail log.

**One live thing:** the live transfer strip computes rows/sec from
`transferred_rows` deltas, shows a freshness stamp, and states a stale state when
polling fails. Nothing is labelled "live" without a current source.

**Dealt sheet deviations, recorded:**
- The dealt `settings` / `analytics` section blueprints carry light-mode values
  (`#fafafa` trays, white inputs). Rejected: every screen stays on the dark
  tokens.
- The dealt phone shell is a bottom bar. Rejected: the existing, tested mobile
  top bar + sheet drawer is kept (lower risk, already accessible).
- Brand mark was a gradient "D". Flattened to one solid ink.

## Three-layer tokens

Primitive (raw values) → semantic (purpose) → component (per-control). No raw
hex in components; components reference semantic tokens only.

### Colour

| Semantic token | Value | Role |
|---|---|---|
| `--ground` | `#171719` | page ground |
| `--surface` | `#131217` | panels darker than the ground |
| `--raised` | `#212023` | controls, pills, raised rows |
| `--border` | `#222224` | card / table / control edges |
| `--rule` | `#1b1a1f` | row rules, 3–7% darker than surface |
| `--control` | `#3a3a3e` | control borders, one step stronger |
| `--text` | `#ffffff` | full ink for running text |
| `--muted` | `#8a8c92` | secondary text, ≥ 4.5:1 on surface |
| `--accent` | `#4a8ad6` | 1px selection lines only |
| `--positive` | `#44a282` | success polarity |
| `--negative` | `#e5566f` | failure polarity |
| `--warning` | `#d9a441` | warning / pending polarity |
| `--chart-1/2/3` | white / negative / accent | one hue per chart |

Pills use a pale tint with dark text of the same hue, never saturated fills with
white text. Red is a signal, not a texture: one red mark per object at most.

### Type

One text face — **IBM Plex Sans** (400/500/600/700). **JetBrains Mono** is
reserved for literal code and identifiers only: SQL `WHERE` clauses, schema /
table / column names, IDs, log lines. This is a deliberate, product-grounded
decision, not decoration.

| Role | Size | Weight |
|---|---|---|
| Page title | 26px | 600 |
| Section title | 20px | 400, muted |
| Card title | 16px | 600 |
| KPI value | 24–30px | 400–600, in ink, never 48px, never brand-coloured |
| Body | 13–16px | 400 |
| Small / meta / axis | 12px | 400, ≥ 4.5:1 |

Sentence case everywhere. No tracked uppercase labels (at most one context
label per screen). No eyebrows, index numbers or accent words in headlines.

### Space, radius, motion

- One grid, equal outer margins, `--gap: 24px`, `--pad: 32px`,
  `--row-height: 42px`, `--control-height: 34px`.
- Three radii by role: `--radius-card: 6px`, `--radius-control: 4px`,
  `--radius-pill: 999px`. Chosen by function, not applied to everything.
- Surfaces are separated by a tone step, never a line *and* a shadow. A shadow
  belongs only to what truly floats (menu, dialog).
- Motion (3–4/10): one signature 1px selection-line slide, staggered section
  entrances, feedback on every control. `transform` / `opacity` only, no
  `transition: all`. Full `prefers-reduced-motion` fallback.

## House rules (app screens)

Allowed, within limits: 1px borders on panels/tables/controls; row rules 3–7%
darker than the surface; small sentence-case labels above values (12–14px);
3–6 peer KPI cells in one divided container; monospace for IDs/code; pills
inside rows only.

Banned (the generated-dashboard tells): gradient fills and gradient text,
glass / `backdrop-filter`, glows, shadows on resting elements, icon-topped KPI
cards, sparklines on every KPI, `+12.5%` pills, 48px KPI values, rainbow
charts, fat donuts, saturated status chips, tinted sidebars with coloured active
pills, "Welcome back" with an emoji, decorative "live" pulses, vanity totals,
zebra tables under uppercase tracked headers.

## States

Per the app-screen state rules:

- **Zero** is printed as `0` / `0%` in the normal style.
- **Missing / not applicable** is a grey dash at label size, never `--` at value
  size.
- **Loading** keeps the final layout, each value replaced by a flat grey bar at
  its real size; labels and headers show immediately, no shimmer, no layout
  shift. A refresh keeps old values and updates the freshness stamp.
- **Empty** keeps the frame and header and adds one sentence; first-run shows
  the first action where the data will appear, with setup progress at its true
  percentage.
- **Error** lives inside the block that failed, one sentence naming what failed
  and when data was last good, plus a Retry text button.
- **Stale** shows a freshness stamp with a refresh button.
- **Limits / usage** show a bar at the true ratio with both ends labelled.

## Copy

Sentence case, active voice, plain verbs. An action keeps the same name through
the whole flow ("Save changes" → toast "Changes saved"). Errors say what went
wrong and how to fix it; empty screens are an invitation to act. `…` not `...`,
curly quotes, numerals for counts, `Intl.DateTimeFormat` / `Intl.NumberFormat`
for all displayed dates and numbers. Brand names and code tokens carry
`translate="no"`.

## Accessibility

Committed tier: **WCAG 2.2 AA** — see
[accessibility-requirements.md](./accessibility-requirements.md). Contrast
4.5:1 for text, visible `:focus-visible`, keyboard for every control, no
colour-only information, 44px touch targets, reduced-motion fallback, semantic
HTML before ARIA. The full checklist is the Vercel Web Interface Guidelines.

## Validation

- `node <skill>/scripts/lint.mjs frontend/src` (app rules): 0 FAIL.
- `node <skill>/scripts/inspect.mjs --app <built app>`: 0 FAIL at 1440, 768, 390.
- `npm test`, `npm run lint`, `npm run build`, and the Vercel-guidelines audit.
