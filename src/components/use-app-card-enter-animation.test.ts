/** @vitest-environment happy-dom */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native-reanimated', () => {
  const useSharedValue = (initial: number) => ({ value: initial });
  const useAnimatedStyle = (factory: () => Record<string, unknown>) => factory();
  return {
    useSharedValue,
    useAnimatedStyle,
    withDelay: (_delay: number, animation: number) => animation,
    withTiming: (value: number) => value,
    useReducedMotion: () => false,
  };
});

/* eslint-disable import/first -- after vi.mock */
import { useAppCardEnterAnimation } from './use-app-card-enter-animation';
/* eslint-enable import/first */

describe('useAppCardEnterAnimation', () => {
  it('blocks pointer events while the delayed enter animation is active', () => {
    const { result } = renderHook(() => useAppCardEnterAnimation(60, false));
    expect(result.current.pointerEvents).toBe('none');
    expect(result.current.animatedStyle).toMatchObject({ opacity: 0 });
  });

  it('allows pointer events when enter animation is skipped', () => {
    const { result } = renderHook(() => useAppCardEnterAnimation(60, true));
    expect(result.current.pointerEvents).toBe('auto');
    expect(result.current.animatedStyle).toMatchObject({ opacity: 1 });
  });
});
