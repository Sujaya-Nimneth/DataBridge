/**
 * Astryx foundation smoke test.
 *
 * A broken cascade-layer order fails silently on every page (an unlayered
 * legacy reset overrides Astryx component styles). This test pins the wiring
 * that makes the fix observable in jsdom: the Theme provider applies the built
 * DataBridge theme and dark mode to the document, and an Astryx primitive
 * renders with its component class inside that provider. The padding check
 * itself runs in a real browser during the visual gate (design-taste inspect).
 */
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Theme } from '@astryxdesign/core/theme';
import { Button } from '@astryxdesign/core/Button';
import { databridgeTheme } from '../themes/databridge.js';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-astryx-theme');
  document.documentElement.removeAttribute('data-theme');
});

describe('Astryx foundation', () => {
  it('applies the built DataBridge theme and dark mode to the document', () => {
    render(
      <Theme theme={databridgeTheme} mode="dark">
        <span>content</span>
      </Theme>,
    );

    expect(document.documentElement.getAttribute('data-astryx-theme')).toBe('databridge');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('renders an Astryx primitive with its component class', () => {
    render(
      <Theme theme={databridgeTheme} mode="dark">
        <Button label="Primary action" variant="primary" />
      </Theme>,
    );

    const button = screen.getByRole('button', { name: 'Primary action' });
    expect(button.className).toContain('astryx-button');
  });

  it('exposes the committed brand tokens on the built theme', () => {
    // The theme build resolves light/dark tuples; the dark ground must be the
    // committed #171719, not Astryx's neutral default.
    expect(databridgeTheme.__built).toBe(true);
    expect(databridgeTheme.tokens['--color-background-body']).toContain('#171719');
  });
});
