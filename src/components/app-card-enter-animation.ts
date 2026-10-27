/** FadeInDown duration in AppCard (ms). */
export const APP_CARD_ENTER_DURATION_MS = 320;

/** Extra buffer after delay+duration before forcing visibility (Reanimated entering fallback). */
export const APP_CARD_ENTER_FALLBACK_BUFFER_MS = 200;

export function getAppCardEnterFallbackMs(delay: number): number {
  return delay + APP_CARD_ENTER_DURATION_MS + APP_CARD_ENTER_FALLBACK_BUFFER_MS;
}
