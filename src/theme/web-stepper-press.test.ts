import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ OS: 'ios' as 'ios' | 'web' }));

vi.mock('react-native', () => ({
  Platform: platform,
}));

// eslint-disable-next-line import/first -- load after vi.mock
import { resetWebStepperPressDedupeForTests, webStepperPressProps } from './web-stepper-press';

describe('webStepperPressProps', () => {
  beforeEach(() => {
    platform.OS = 'ios';
    resetWebStepperPressDedupeForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns only onPress on native platforms', () => {
    const onPress = vi.fn();
    expect(webStepperPressProps(onPress)).toEqual({ onPress });
  });

  it('runs once for a pointer click that emits press in and press on web', () => {
    platform.OS = 'web';

    const onPress = vi.fn();
    const preventDefault = vi.fn();
    const props = webStepperPressProps(onPress);

    props.onPressIn?.({ preventDefault } as never);
    props.onPress?.();

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('still supports keyboard activation through onPress on web', () => {
    platform.OS = 'web';

    const onPress = vi.fn();
    const props = webStepperPressProps(onPress);

    props.onPress?.();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('allows separate clicks after the suppress window', () => {
    platform.OS = 'web';

    const onPress = vi.fn();
    const props = webStepperPressProps(onPress);

    props.onPressIn?.({ preventDefault: vi.fn() } as never);
    props.onPress?.();
    expect(onPress).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-10-25T08:00:01.000Z'));
    props.onPress?.();
    expect(onPress).toHaveBeenCalledTimes(2);
  });
});
