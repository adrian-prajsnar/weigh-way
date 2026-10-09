import { pxToRem } from './css-rem';
import { Palette } from './tokens';

export type WebFocusRingVariant = 'control' | 'button' | 'compact' | 'text' | 'switch' | 'overlay';

/** Inset spread for the separator gap between the control edge and the 2px ring band. */
const FOCUS_RING_GAP_SPREAD = 2;

/** Inset spread for the outer edge of the 2px ring band (gap spread + 2px ring). */
export const WEB_FOCUS_RING_OUTER_SPREAD = 4;

function insetFocusRing(gapColor: string, ringColor: string): string {
  return `inset 0 0 0 ${pxToRem(FOCUS_RING_GAP_SPREAD)} ${gapColor}, inset 0 0 0 ${pxToRem(WEB_FOCUS_RING_OUTER_SPREAD)} ${ringColor}`;
}

/** Accent gap is listed first so it paints above the outer ring band. */
export function buildWebFocusRingCssVars(): string {
  return `
    --ww-focus-ring-control: ${insetFocusRing('var(--ww-surface)', 'var(--ww-accent)')};
    --ww-focus-ring-button: ${insetFocusRing('var(--ww-accent)', 'var(--ww-on-accent)')};
    --ww-focus-ring-compact: ${insetFocusRing('var(--ww-surface)', 'var(--ww-accent)')};
    --ww-focus-ring-text: ${insetFocusRing('var(--ww-accent)', 'var(--ww-on-accent)')};
    --ww-focus-ring-switch: ${insetFocusRing('var(--ww-accent)', 'var(--ww-on-accent)')};
    --ww-focus-ring-overlay: ${insetFocusRing('var(--ww-accent-soft)', 'var(--ww-accent)')};
  `;
}

export function webFocusRingBoxShadow(
  colors: Pick<Palette, 'accent' | 'accentSoft' | 'onAccent' | 'surface'>,
  variant: WebFocusRingVariant = 'control',
): string {
  const rings: Record<WebFocusRingVariant, string> = {
    control: insetFocusRing(colors.surface, colors.accent),
    button: insetFocusRing(colors.accent, colors.onAccent),
    compact: insetFocusRing(colors.surface, colors.accent),
    text: insetFocusRing(colors.accent, colors.onAccent),
    switch: insetFocusRing(colors.accent, colors.onAccent),
    overlay: insetFocusRing(colors.accentSoft, colors.accent),
  };

  return rings[variant];
}
