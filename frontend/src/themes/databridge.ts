/**
 * DataBridge "Data Terminal" — a custom Astryx theme.
 *
 * Keeps the committed dark, figure-heavy developer-tool direction described in
 * design/DESIGN-SYSTEM.md (dealt from the design-taste-frontend devtools deck,
 * seed 788067068) while moving the component system to Astryx. The signature
 * move is a 1px accent selection line on the nearest edge of every selected
 * control; colour stays under 3% of the screen and never carries meaning alone.
 *
 * Extend the built neutral theme rather than forking it: typography, radius and
 * color scale configs replace the base's, so every one we need is restated.
 * Build for production with:
 *   npx astryx theme build src/themes/databridge.ts
 */

import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral';

export const databridgeTheme = defineTheme({
  extends: neutralTheme,
  name: 'databridge',

  // One text face for running text; mono is reserved for literal code / IDs.
  typography: {
    scale: { base: 14, ratio: 1.125 },
    body: {
      family: 'IBM Plex Sans',
      fallbacks: 'Inter, system-ui, -apple-system, sans-serif',
    },
    heading: { weight: 'semibold', weights: { 1: 'semibold', 2: 'normal' } },
    code: {
      family: 'JetBrains Mono',
      fallbacks: '"Fira Code", ui-monospace, monospace',
    },
  },

  // Three radii by role; a tight base keeps cards from the soft default.
  radius: { base: 4, multiplier: 1 },

  // Motion 3-4/10: quick, quiet feedback. Component-level reduced-motion
  // handling stays with Astryx; the legacy app-layer fallback covers old CSS.
  motion: { tempo: 0.8, character: 'crisp' },

  tokens: {
    // Surfaces are separated by a tone step; the ground is never pure black.
    '--color-background-body': ['#f4f4f6', '#171719'],
    '--color-background-surface': ['#ffffff', '#131217'],
    '--color-background-card': ['#ffffff', '#131217'],
    '--color-background-popover': ['#ffffff', '#212023'],
    '--color-background-muted': ['#e9e9ed', '#212023'],
    '--color-background-inverted': ['#171719', '#ffffff'],

    // Ink. --muted (#8a8c92) is >= 4.5:1 on #131217, per accessibility-requirements.md.
    '--color-text-primary': ['#171719', '#ffffff'],
    '--color-text-secondary': ['#5f6066', '#8a8c92'],
    '--color-text-disabled': ['#a9a9ae', '#5f6066'],
    '--color-icon-primary': ['#171719', '#ffffff'],
    '--color-icon-secondary': ['#5f6066', '#8a8c92'],

    // The accent is a 1px line only; it is never a large fill or a glow.
    '--color-accent': ['#3a6ea8', '#4a8ad6'],
    '--color-on-accent': ['#ffffff', '#101013'],
    '--color-text-accent': ['#3a6ea8', '#7fb0ea'],
    '--color-icon-accent': ['#3a6ea8', '#4a8ad6'],
    '--color-accent-muted': ['#4a8ad61a', '#4a8ad61f'],

    // 1px borders on panels/tables/controls; controls one step stronger.
    '--color-border': ['#e2e2e6', '#222224'],
    '--color-border-emphasized': ['#c9c9cf', '#3a3a3e'],
    '--color-skeleton': ['#e2e2e6', '#2e2e31'],
    '--color-track': ['#e2e2e6', '#212023'],
    '--color-shadow': ['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.45)'],

    // Polarity colours sit beside a text sign; red is a signal, not a texture.
    '--color-success': ['#2f7a61', '#44a282'],
    '--color-error': ['#c43f57', '#e5566f'],
    '--color-warning': ['#a97c25', '#d9a441'],
    '--color-info': ['#3a6ea8', '#4a8ad6'],
    '--color-success-muted': ['#44a2821a', '#44a2821f'],
    '--color-error-muted': ['#e5566f1a', '#e5566f1f'],
    '--color-warning-muted': ['#d9a4411a', '#d9a4411f'],
    '--color-info-muted': ['#4a8ad61a', '#4a8ad61f'],
    '--color-on-success': ['#ffffff', '#101013'],
    '--color-on-error': ['#ffffff', '#101013'],
    '--color-on-warning': ['#171719', '#101013'],
    '--color-on-info': ['#ffffff', '#101013'],

    // Focus is visible on every control (>= 3:1 against its surface).
    '--focus-outline-color': 'var(--color-accent)',
    '--focus-outline-width': '2px',
    '--focus-outline-offset': '2px',

    // No resting shadows; only menus/dialogs/tooltips float.
    '--shadow-low': ['0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)'],
    '--shadow-med': ['0 6px 16px rgba(0,0,0,0.12)', '0 12px 28px rgba(0,0,0,0.45)'],
  },

  // Per-component style overrides. Keys are the component's stable class minus
  // the `astryx-` prefix; see `astryx theme targets`. The 1px accent line is
  // the product's one selection mark, applied where a component exposes a
  // selected/active state rather than a filled pill.
  components: {
    card: {
      base: {
        borderRadius: 'var(--radius-container)',
        boxShadow: 'none',
        borderWidth: '1px',
        borderStyle: 'solid',
      },
    },
    button: {
      base: {
        borderRadius: 'var(--radius-element)',
        fontWeight: 'var(--font-weight-medium)',
      },
    },
    badge: {
      base: { borderRadius: 'var(--radius-full)' },
    },
    table: {
      base: { fontVariantNumeric: 'tabular-nums' },
    },
  },
});
