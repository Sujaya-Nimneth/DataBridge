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
    '--color-success-muted': ['#e6f4ef', '#1b2828'],
    '--color-error-muted': ['#fbe9ec', '#2c1a20'],
    '--color-warning-muted': ['#fbf3df', '#2a2416'],
    '--color-info-muted': ['#e7f0fa', '#1a2330'],
    '--color-on-success': ['#ffffff', '#101013'],
    '--color-on-error': ['#ffffff', '#101013'],
    '--color-on-warning': ['#171719', '#101013'],
    '--color-on-info': ['#ffffff', '#101013'],
    '--color-on-success-muted': ['#1f5c47', '#5fc39c'],
    '--color-on-error-muted': ['#9e263c', '#f0758b'],
    '--color-on-warning-muted': ['#7a5712', '#d9a441'],
    '--color-on-info-muted': ['#285282', '#7fb0ea'],
    '--color-text-success': ['#1f5c47', '#5fc39c'],
    '--color-text-error': ['#9e263c', '#f0758b'],
    '--color-text-warning': ['#7a5712', '#d9a441'],
    '--color-text-info': ['#285282', '#7fb0ea'],

    // Three radii by role per DESIGN-SYSTEM.md (4px control, 6px card).
    '--radius-element': '4px',
    '--radius-container': '6px',

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
    'app-shell': {
      base: {
        backgroundColor: 'var(--color-background-body)',
        color: 'var(--color-text-primary)',
      },
    },
    'app-shell-header': {
      base: {
        backgroundColor: 'var(--color-background-surface)',
        borderBottom: '1px solid var(--color-border)',
      },
    },
    'app-shell-sidenav': {
      base: {
        backgroundColor: 'var(--color-background-surface)',
        borderInlineEnd: '1px solid var(--color-border)',
      },
    },
    'side-nav': {
      base: {
        backgroundColor: 'var(--color-background-surface)',
        color: 'var(--color-text-secondary)',
      },
    },
    'side-nav-item': {
      base: {
        position: 'relative',
        borderRadius: 'var(--radius-element)',
        color: 'var(--color-text-secondary)',
        ':hover': {
          backgroundColor: 'var(--color-background-muted)',
          color: 'var(--color-text-primary)',
        },
      },
      selected: {
        backgroundColor: 'transparent',
        color: 'var(--color-text-primary)',
        fontWeight: 'var(--font-weight-medium)',
        ':hover': {
          backgroundColor: 'var(--color-background-muted)',
          color: 'var(--color-text-primary)',
        },
        ':active': {
          backgroundColor: 'transparent',
        },
        '::before': {
          content: '""',
          position: 'absolute',
          insetBlock: '6px',
          insetInlineStart: '0',
          width: '1px',
          backgroundColor: 'var(--color-accent)',
        },
      },
    },
    tab: {
      base: {
        borderRadius: 'var(--radius-element)',
        color: 'var(--color-text-secondary)',
        ':hover': {
          color: 'var(--color-text-primary)',
        },
      },
      selected: {
        color: 'var(--color-text-primary)',
        fontWeight: 'var(--font-weight-medium)',
      },
    },
    'tab-indicator': {
      base: {
        height: '1px',
        borderRadius: '0px',
      },
      selected: {
        height: '1px',
        borderRadius: '0px',
        backgroundColor: 'var(--color-accent)',
        opacity: '1',
      },
    },
    card: {
      base: {
        borderRadius: 'var(--radius-container)',
        boxShadow: 'none',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--color-border)',
      },
    },
    button: {
      base: {
        borderRadius: 'var(--radius-element)',
        fontWeight: 'var(--font-weight-medium)',
      },
    },
    badge: {
      base: {
        borderRadius: 'var(--radius-full)',
        whiteSpace: 'nowrap',
        flexShrink: '0',
      },
      'variant:neutral': {
        backgroundColor: 'var(--color-background-muted)',
        color: 'light-dark(#4b4c52, #bdbdc0)',
      },
      'variant:info': {
        backgroundColor: 'var(--color-info-muted)',
        color: 'var(--color-on-info-muted)',
      },
      'variant:success': {
        backgroundColor: 'var(--color-success-muted)',
        color: 'var(--color-on-success-muted)',
      },
      'variant:warning': {
        backgroundColor: 'var(--color-warning-muted)',
        color: 'var(--color-on-warning-muted)',
      },
      'variant:error': {
        backgroundColor: 'var(--color-error-muted)',
        color: 'var(--color-on-error-muted)',
      },
    },
    table: {
      base: { fontVariantNumeric: 'tabular-nums' },
    },
  },
});
