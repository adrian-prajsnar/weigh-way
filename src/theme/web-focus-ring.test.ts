import { describe, expect, it } from 'vitest';
import { palettes } from './tokens';
import { buildWebFocusRingCssVars, webFocusRingBoxShadow } from './web-focus-ring';

describe('webFocusRingBoxShadow', () => {
  it('builds control rings with a 2px gap and 2px accent band', () => {
    expect(webFocusRingBoxShadow(palettes.light, 'control')).toBe(
      'inset 0 0 0 0.125rem #FFFFFF, inset 0 0 0 0.25rem #4F46E5',
    );
  });

  it('builds inset button rings with a 2px brand gap and 2px on-accent band', () => {
    expect(webFocusRingBoxShadow(palettes.light, 'button')).toBe(
      'inset 0 0 0 0.125rem #4F46E5, inset 0 0 0 0.25rem #FFFFFF',
    );
  });

  it('builds compact, text, switch, and overlay variants with 2px ring bands', () => {
    expect(webFocusRingBoxShadow(palettes.light, 'compact')).toBe(
      'inset 0 0 0 0.125rem #FFFFFF, inset 0 0 0 0.25rem #4F46E5',
    );
    expect(webFocusRingBoxShadow(palettes.light, 'text')).toBe(
      'inset 0 0 0 0.125rem #4F46E5, inset 0 0 0 0.25rem #FFFFFF',
    );
    expect(webFocusRingBoxShadow(palettes.light, 'switch')).toBe(
      'inset 0 0 0 0.125rem #4F46E5, inset 0 0 0 0.25rem #FFFFFF',
    );
    expect(webFocusRingBoxShadow(palettes.light, 'overlay')).toBe(
      'inset 0 0 0 0.125rem #EEF2FF, inset 0 0 0 0.25rem #4F46E5',
    );
  });
});

describe('buildWebFocusRingCssVars', () => {
  it('defines shared focus ring tokens', () => {
    const css = buildWebFocusRingCssVars();

    expect(css).toContain('--ww-focus-ring-control');
    expect(css).toContain('--ww-focus-ring-button');
    expect(css).toContain('--ww-focus-ring-compact');
    expect(css).toContain('--ww-focus-ring-text');
    expect(css).toContain('--ww-focus-ring-switch');
    expect(css).toContain('--ww-focus-ring-overlay');
    expect(css).not.toContain('outline');
  });
});
