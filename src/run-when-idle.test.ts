import { afterEach, expect, it, vi } from 'vitest';
import { runWhenIdle } from './run-when-idle';

afterEach(() => vi.unstubAllGlobals());

it('gives required work a deadline and lets callers cancel it', () => {
  const request = vi.fn<typeof requestIdleCallback>(() => 7);
  const cancel = vi.fn<typeof cancelIdleCallback>();
  const work = vi.fn();
  vi.stubGlobal('requestIdleCallback', request);
  vi.stubGlobal('cancelIdleCallback', cancel);

  const task = runWhenIdle(work);

  expect(request).toHaveBeenCalledWith(work, { timeout: 500 });
  task.cancel();
  expect(cancel).toHaveBeenCalledWith(7);
});

it('schedules and cancels a frame if idle callbacks are unavailable', () => {
  const request = vi.fn<typeof requestAnimationFrame>(() => 9);
  const cancel = vi.fn<typeof cancelAnimationFrame>();
  const work = vi.fn();
  vi.stubGlobal('requestIdleCallback', undefined);
  vi.stubGlobal('requestAnimationFrame', request);
  vi.stubGlobal('cancelAnimationFrame', cancel);

  const task = runWhenIdle(work);

  expect(request).toHaveBeenCalledWith(work);
  task.cancel();
  expect(cancel).toHaveBeenCalledWith(9);
});
