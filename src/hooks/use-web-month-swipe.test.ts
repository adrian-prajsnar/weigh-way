import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  PanResponder: { create: () => ({ panHandlers: {} }) },
  Platform: { OS: 'web' },
}));

/* eslint-disable import/first -- after vi.mock */
import { getMonthSwipeDirection } from './use-web-month-swipe';
/* eslint-enable import/first */

describe('getMonthSwipeDirection', () => {
  it('goes to the next month on a left swipe and the previous on a right swipe', () => {
    expect(getMonthSwipeDirection(-60, 5)).toBe(1);
    expect(getMonthSwipeDirection(60, -5)).toBe(-1);
  });

  it('ignores short drags', () => {
    expect(getMonthSwipeDirection(-20, 0)).toBeNull();
  });

  it('ignores drags that drift too far vertically', () => {
    expect(getMonthSwipeDirection(-120, 90)).toBeNull();
  });
});
