import { describe, expect, it } from 'vitest';
import { palettes } from './tokens';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

describe('theme text contrast', () => {
  it.each(Object.entries(palettes))(
    'keeps muted and subtle text readable on %s surfaces',
    (_scheme, palette) => {
      const { textMuted, textSubtle, background, surface, surfaceMuted, surfaceSunken } =
        palette;

      for (const text of [textMuted, textSubtle]) {
        for (const fill of [background, surface, surfaceMuted, surfaceSunken]) {
          const foreground = luminance(text);
          const backdrop = luminance(fill);
          expect((Math.max(foreground, backdrop) + 0.05) / (Math.min(foreground, backdrop) + 0.05))
            .toBeGreaterThanOrEqual(4.5);
        }
      }
    },
  );
});
