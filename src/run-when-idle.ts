export type IdleTask = {
  cancel: () => void;
};

const IDLE_TIMEOUT_MS = 500;

export function runWhenIdle(callback: () => void): IdleTask {
  if (typeof requestIdleCallback === 'function') {
    // Screen content and save flows must progress even when the browser stays busy.
    const handle = requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS });
    return {
      cancel: () => cancelIdleCallback(handle),
    };
  }

  const frameId = requestAnimationFrame(callback);
  return {
    cancel: () => cancelAnimationFrame(frameId),
  };
}
