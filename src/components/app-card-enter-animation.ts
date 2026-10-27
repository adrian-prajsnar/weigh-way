/** FadeInDown duration in AppCard (ms). */
export const APP_CARD_ENTER_DURATION_MS = 320;

/** Initial vertical offset (matches FadeInDown-style enter). */
export const APP_CARD_ENTER_OFFSET_Y = 12;

/** Extra buffer after delay+duration before forcing visibility (Reanimated entering fallback). */
export const APP_CARD_ENTER_FALLBACK_BUFFER_MS = 200;

export function getAppCardEnterFallbackMs(delay: number): number {
  return delay + APP_CARD_ENTER_DURATION_MS + APP_CARD_ENTER_FALLBACK_BUFFER_MS;
}

/** Forces final visible state without remounting (entering-animation fallback). */
export function applyAppCardEnterFallback(
  opacity: { value: number },
  translateY: { value: number },
): void {
  opacity.value = 1;
  translateY.value = 0;
}
