/** @vitest-environment happy-dom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vitest RN web shim
  const RNWeb = require('react-native-web') as typeof import('react-native');
  return { ...RNWeb, Platform: { OS: 'web', select: RNWeb.Platform.select } };
});

/* eslint-disable import/first -- after vi.mock */
import { Pressable, Text } from 'react-native';
import { currentPageA11y, toggleButtonA11y } from './selection-a11y';
/* eslint-enable import/first */

afterEach(cleanup);

describe('toggleButtonA11y', () => {
  it('keeps accessibilityState on native', () => {
    expect(toggleButtonA11y(true, 'android')).toEqual({ accessibilityState: { selected: true } });
    expect(toggleButtonA11y(false, 'ios')).toEqual({ accessibilityState: { selected: false } });
  });

  it('renders aria-pressed in the DOM on web', () => {
    render(
      <>
        <Pressable accessibilityRole="button" {...toggleButtonA11y(true)}>
          <Text>30 days</Text>
        </Pressable>
        <Pressable accessibilityRole="button" {...toggleButtonA11y(false)}>
          <Text>90 days</Text>
        </Pressable>
      </>,
    );

    expect(screen.getByRole('button', { name: '30 days' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: '90 days' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });
});

describe('currentPageA11y', () => {
  it('keeps accessibilityState on native', () => {
    expect(currentPageA11y(true, 'android')).toEqual({ accessibilityState: { selected: true } });
  });

  it('marks only the current tab with aria-current on web', () => {
    render(
      <>
        <Pressable accessibilityRole="button" {...currentPageA11y(true)}>
          <Text>Home</Text>
        </Pressable>
        <Pressable accessibilityRole="button" {...currentPageA11y(false)}>
          <Text>History</Text>
        </Pressable>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Home' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'History' }).hasAttribute('aria-current')).toBe(
      false,
    );
  });
});
