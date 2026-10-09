/** Matches app `css-rem.ts` and `global.css` (16px root at `html { font-size: 100% }`). */
export const CSS_REM_ROOT_PX = 16;

export function getRootFontSizePx(): number {
  if (typeof document === 'undefined') {
    return CSS_REM_ROOT_PX;
  }

  const size = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size : CSS_REM_ROOT_PX;
}

export function pxToRemCSSValue(px: number): string {
  if (px === 0) {
    return '0';
  }

  const rem = px / getRootFontSizePx();
  return `${parseFloat(rem.toFixed(4))}rem`;
}

export function parseCssLengthToPx(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  if (trimmed.endsWith('rem')) {
    return parseFloat(trimmed) * getRootFontSizePx();
  }

  if (trimmed.endsWith('px')) {
    return parseFloat(trimmed);
  }

  const asNumber = parseFloat(trimmed);
  return Number.isFinite(asNumber) ? asNumber : 0;
}

export function mediaMaxWidthRem(px: number): string {
  return `(max-width: ${pxToRemCSSValue(px)})`;
}
