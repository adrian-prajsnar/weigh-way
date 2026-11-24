import { describe, expect, it } from 'vitest';
import { palettes } from '../theme/tokens';
import { buildDemoWebDesktopCss } from './demo-web-desktop-styles';

describe('buildDemoWebDesktopCss', () => {
  it('scopes interaction styles to fine-pointer desktop devices', () => {
    const css = buildDemoWebDesktopCss(palettes.light);

    expect(css).toContain('(hover: hover) and (pointer: fine)');
    expect(css).toContain('(hover: none), (pointer: coarse)');
    expect(css).toContain('--ww-accent: #4F46E5');
    expect(css).toContain('--ww-focus-ring-control');
    expect(css).toContain('--ww-focus-ring-button');
    expect(css).toContain(
      '--ww-focus-ring-button: inset 0 0 0 0.125rem var(--ww-accent), inset 0 0 0 0.25rem var(--ww-on-accent)',
    );
    expect(css).toContain(
      '[role="button"]:not([aria-disabled="true"]):not([data-ww-modal-dismiss="true"]):hover',
    );
    expect(css).toContain('prefers-reduced-motion: reduce');
    const normalCss = css.split('@media (forced-colors: active)')[0];
    expect(
      normalCss.replace(/\[role="region"\]:focus-visible\s*\{[^}]*\}/, ''),
    ).not.toContain('outline-offset');
  });

  it('uses a system-color focus outline when forced colors suppress shadows', () => {
    const css = buildDemoWebDesktopCss(palettes.light);
    const forcedColors = css.split('@media (forced-colors: active)')[1];

    expect(forcedColors).toMatch(/\[role="switch"\].*:focus-visible\s*\{/);
    expect(forcedColors).toContain('outline: 0.125rem solid Highlight;');
    expect(forcedColors).toContain('outline-offset: -0.125rem;');
  });

  it('marks hovered buttons without changing their text or background colors', () => {
    const css = buildDemoWebDesktopCss(palettes.light);
    const hoverRule = css.match(/button:not\(:disabled\)[^{]*:hover\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(hoverRule).toContain('outline: 0.125rem solid var(--ww-accent);');
    expect(hoverRule).not.toMatch(/opacity|background|filter|color:/);
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
    expect(css).toContain('inset: 0.5rem');
    expect(css).toContain('border-radius: 1.25rem');
  });

  it('draws a visible inset outline on keyboard-focusable scroll regions', () => {
    const css = buildDemoWebDesktopCss(palettes.dark);
    const rule = css.match(/\[role="region"\]:focus-visible\s*\{([^}]*)\}/)?.[1];

    expect(rule).toContain('outline: 2px solid var(--ww-accent)');
    expect(rule).toContain('outline-offset: -2px');
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
    expect(css).toContain('[data-ww-switch="true"]:has([role="switch"]:focus-visible)');
    expect(css).toContain('box-shadow: var(--ww-focus-ring-switch)');
  });

  it('uses native-like borders instead of desktop focus rings on touch devices', () => {
    const css = buildDemoWebDesktopCss(palettes.light);

    expect(css).toContain('-webkit-tap-highlight-color: transparent');
    expect(css).toContain('[data-ww-field-group="true"]:focus-within');
    expect(css).toContain('input[data-ww-field-input="true"]');
    expect(css).toContain('box-shadow: none !important');
  });
});
