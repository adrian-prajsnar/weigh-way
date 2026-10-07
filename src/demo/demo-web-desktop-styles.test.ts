import { describe, expect, it } from 'vitest';
import { palettes } from '../theme/tokens';
import { buildDemoWebDesktopCss } from './demo-web-desktop-styles';

describe('buildDemoWebDesktopCss', () => {
  it('scopes interaction styles to fine-pointer desktop devices', () => {
    const css = buildDemoWebDesktopCss(palettes.light);

    expect(css).toContain('(hover: hover) and (pointer: fine)');
    expect(css).toContain('--ww-accent: #4F46E5');
    expect(css).toContain('--ww-focus-ring-control');
    expect(css).toContain('--ww-focus-ring-button');
    expect(css).toContain(
      '--ww-focus-ring-button: inset 0 0 0 2px var(--ww-accent), inset 0 0 0 4px var(--ww-on-accent)',
    );
    expect(css).toContain(
      '[role="button"]:not([aria-disabled="true"]):not([data-ww-modal-dismiss="true"]):hover',
    );
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).not.toContain('outline-offset');
  });

  it('uses the active palette accent color', () => {
    const css = buildDemoWebDesktopCss(palettes.dark);

    expect(css).toContain('--ww-accent: #818CF8');
    expect(css).toContain('--ww-accent-border');
  });

  it('adds grab cursor styles for the embedded demo', () => {
    const css = buildDemoWebDesktopCss(palettes.light, true);

    expect(css).toContain('cursor: grab');
    expect(css).toContain('cursor: grabbing');
    expect(css).toContain('ww-demo-embedded');
    expect(css).toContain('user-select: none');
    expect(css).toContain('pointer-events: none');
  });

  it('uses overlay inset rings for modal dismiss areas', () => {
    const css = buildDemoWebDesktopCss(palettes.light);

    expect(css).toContain('[data-ww-modal-dismiss="true"]:focus-visible');
    expect(css).toContain('box-shadow: var(--ww-focus-ring-overlay)');
    expect(css).toContain('[data-ww-confirm-dismiss="true"]:focus-visible::after');
    expect(css).toContain('inset: 8px');
    expect(css).toContain('border-radius: 20px');
    expect(css).toContain('[data-ww-confirm-dialog="true"]');
    expect(css).toContain('overflow: visible');
  });

  it('uses compact inset rings for stepper buttons', () => {
    const css = buildDemoWebDesktopCss(palettes.light);

    expect(css).toContain('[data-ww-stepper-button="true"]:focus-visible');
    expect(css).toContain('box-shadow: var(--ww-focus-ring-compact)');
    expect(css).toContain('z-index: 1');
  });

  it('uses text and switch focus targets for compact controls', () => {
    const css = buildDemoWebDesktopCss(palettes.light);

    expect(css).toContain('[data-ww-text-button="true"]:focus-visible');
    expect(css).toContain('box-shadow: var(--ww-focus-ring-text)');
    expect(css).toContain('[data-ww-segmented-item="true"]:focus-visible');
    expect(css).toContain('[data-ww-switch="true"]:focus-within');
    expect(css).toContain('box-shadow: var(--ww-focus-ring-switch)');
  });
});
