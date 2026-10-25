import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ OS: 'ios' as 'ios' | 'web' }));

vi.mock('react-native', () => ({
  Platform: platform,
}));

// eslint-disable-next-line import/first -- load after vi.mock
import {
  createInitialWebStepperGestureState,
  createWebStepperPressHandlers,
} from './web-stepper-gesture';

function pressEvent(x = 0, y = 0) {
  return {
    preventDefault: vi.fn(),
    nativeEvent: { pageX: x, pageY: y },
  } as never;
}

/** Matches React Native Web: press in, press out, then press. */
function pointerClick(
  props: ReturnType<typeof createWebStepperPressHandlers>,
  holdMs = 0,
) {
  props.onPressIn?.(pressEvent());
  if (holdMs > 0) {
    vi.advanceTimersByTime(holdMs);
  }
  props.onPressOut?.(pressEvent());
  props.onPress?.();
}

describe('createWebStepperPressHandlers', () => {
  beforeEach(() => {
    platform.OS = 'ios';
    vi.useFakeTimers();
    vi.stubGlobal('document', { activeElement: { dataset: {} } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns only onPress on native platforms', () => {
    const onPress = vi.fn();
    expect(createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState())).toEqual({
      onPress,
    });
  });

  it('steps once for short and long pointer clicks on web', () => {
    platform.OS = 'web';

    for (const holdMs of [10, 30, 80, 150, 250, 400]) {
      const onPress = vi.fn();
      const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());
      pointerClick(props, holdMs);
      expect(onPress).toHaveBeenCalledTimes(1);
    }
  });

  it('steps on a quick tap when only press in and press out fire', () => {
    platform.OS = 'web';
    const onPress = vi.fn();
    const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());

    props.onPressIn?.(pressEvent());
    props.onPressOut?.(pressEvent());

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard Enter and Space through onKeyDown', () => {
    platform.OS = 'web';

    const onPress = vi.fn();
    const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());

    props.onKeyDown?.({ preventDefault: vi.fn(), nativeEvent: { key: 'Enter' } } as never);
    props.onKeyDown?.({ preventDefault: vi.fn(), nativeEvent: { key: ' ' } } as never);

    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('suppresses repeated Enter clicks until keyup', () => {
    platform.OS = 'web';

    const onPress = vi.fn();
    const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());

    props.onKeyDown?.({ preventDefault: vi.fn(), nativeEvent: { key: 'Enter' } } as never);
    expect(onPress).toHaveBeenCalledTimes(1);
    props.onPress?.();
    props.onPress?.();
    expect(onPress).toHaveBeenCalledTimes(1);
    props.onKeyUp?.({ preventDefault: vi.fn(), nativeEvent: { key: 'Enter' } } as never);
  });

  it('ignores OS key repeat for Enter and Space', () => {
    platform.OS = 'web';

    const onPress = vi.fn();
    const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());

    props.onKeyDown?.({
      preventDefault: vi.fn(),
      nativeEvent: { key: 'Enter', repeat: true },
    } as never);
    props.onKeyDown?.({
      preventDefault: vi.fn(),
      nativeEvent: { key: ' ', repeat: true },
    } as never);

    expect(onPress).not.toHaveBeenCalled();
  });

  it('steps once on press out when a nearby field is focused on web', () => {
    platform.OS = 'web';
    vi.stubGlobal('document', {
      activeElement: { dataset: { wwFieldInput: 'true' } },
    });

    const onPress = vi.fn();
    const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());

    pointerClick(props, 150);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('allows click then Enter after a focused-field tap', () => {
    platform.OS = 'web';
    vi.stubGlobal('document', {
      activeElement: { dataset: { wwFieldInput: 'true' } },
    });

    const onPress = vi.fn();
    const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());

    pointerClick(props, 150);
    props.onKeyDown?.({ preventDefault: vi.fn(), nativeEvent: { key: 'Enter' } } as never);

    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('allows click then a pointerless press after a focused-field tap', () => {
    platform.OS = 'web';
    vi.stubGlobal('document', {
      activeElement: { dataset: { wwFieldInput: 'true' } },
    });

    const onPress = vi.fn();
    const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());

    pointerClick(props, 150);
    vi.advanceTimersByTime(51);
    props.onPress?.();

    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('allows Enter then a pointerless press', () => {
    platform.OS = 'web';

    const onPress = vi.fn();
    const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());

    props.onKeyDown?.({ preventDefault: vi.fn(), nativeEvent: { key: 'Enter' } } as never);
    props.onKeyUp?.({ preventDefault: vi.fn(), nativeEvent: { key: 'Enter' } } as never);
    vi.advanceTimersByTime(100);
    props.onPress?.();

    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('does not step when the gesture is cancelled or scrolls', () => {
    platform.OS = 'web';

    const onPress = vi.fn();
    const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());

    props.onPressIn?.(pressEvent(0, 0));
    props.onTouchCancel?.();
    props.onPressOut?.(pressEvent(0, 0));
    expect(onPress).not.toHaveBeenCalled();

    props.onPressIn?.(pressEvent(0, 0));
    props.onPressOut?.(pressEvent(40, 0));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('allows five rapid taps at an 80ms cadence', () => {
    platform.OS = 'web';

    const onPress = vi.fn();
    const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());

    for (let index = 0; index < 5; index += 1) {
      pointerClick(props, 0);
      vi.advanceTimersByTime(80);
    }

    expect(onPress).toHaveBeenCalledTimes(5);
  });

  it('dedupes duplicate onPress events before pointer release', () => {
    platform.OS = 'web';

    const onPress = vi.fn();
    const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());

    props.onPressIn?.(pressEvent());
    props.onPressOut?.(pressEvent());
    expect(onPress).toHaveBeenCalledTimes(1);
    props.onPress?.();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not double-step when a slow main thread delays the synthetic press', () => {
    platform.OS = 'web';

    const onPress = vi.fn();
    const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());

    props.onPressIn?.(pressEvent());
    props.onPressOut?.(pressEvent());
    expect(onPress).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(120);
    props.onPress?.();

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not double-step when keydown preventDefault suppresses the native click', () => {
    platform.OS = 'web';

    const onPress = vi.fn();
    const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());

    props.onKeyDown?.({ preventDefault: vi.fn(), nativeEvent: { key: 'Enter' } } as never);
    props.onPress?.();

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not double-step when Space fires a native click on keyup', () => {
    platform.OS = 'web';

    const onPress = vi.fn();
    const props = createWebStepperPressHandlers(onPress, createInitialWebStepperGestureState());

    props.onKeyDown?.({ preventDefault: vi.fn(), nativeEvent: { key: ' ' } } as never);
    props.onKeyUp?.({ preventDefault: vi.fn(), nativeEvent: { key: ' ' } } as never);
    props.onPress?.();

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
