/** Assumes a 16px root font size (browser default / `html { font-size: 100% }`). */
export const CSS_REM_ROOT_PX = 16;

export function pxToRem(px: number): string {
  if (px === 0) {
    return '0';
  }

  const rem = px / CSS_REM_ROOT_PX;
  return `${parseFloat(rem.toFixed(4))}rem`;
}
