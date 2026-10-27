/** @vitest-environment happy-dom */
import { render, screen } from '@testing-library/react';
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

vi.mock('react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vitest RN web shim
  const RNWeb = require('react-native-web') as typeof import('react-native');
  return { ...RNWeb, Platform: { OS: 'web', select: RNWeb.Platform.select } };
});

vi.mock('../storage/theme-preference', () => ({
  getThemePreference: vi.fn().mockResolvedValue('system'),
  setStoredThemePreference: vi.fn(),
}));

vi.mock('../storage/language-preference', () => ({
  getLanguagePreference: vi.fn().mockResolvedValue('en'),
  setStoredLanguagePreference: vi.fn(),
}));

vi.mock('../context/user-profile-context', () => ({
  useSharedUserProfile: () => ({
    heightEntries: [],
    birthDate: null,
    sex: null,
    isLoading: true,
  }),
}));

vi.mock('../context/bmi-display-context', () => ({
  useSharedBmiDisplay: () => ({ showBmi: true }),
}));

vi.mock('../context/bmi-details-context', () => ({
  useBmiDetails: () => ({ openWeighIn: vi.fn() }),
}));

vi.mock('../context/unit-context', () => ({
  useUnits: () => ({ units: 'metric' }),
}));

vi.mock('./weight-chart', () => ({
  WeightChart: () => null,
}));

/* eslint-disable import/first -- after vi.mock */
import { LanguageProvider } from '../i18n/language-context';
import { ThemeProvider } from '../theme/theme-context';
import { HeroWeightCard } from './hero-weight-card';
/* eslint-enable import/first */

const sampleEntry = {
  date: '2026-01-15',
  weightKg: 80,
  createdAt: '2026-01-15T08:00:00.000Z',
  updatedAt: '2026-01-15T08:00:00.000Z',
};

describe('HeroWeightCard', () => {
  it('does not show BMI unavailable while profile height is loading', () => {
    render(
      <ThemeProvider>
        <LanguageProvider>
          <HeroWeightCard entries={[sampleEntry]} isLoading={false} />
        </LanguageProvider>
      </ThemeProvider>,
    );

    expect(screen.queryByLabelText('BMI N/A')).toBeNull();
    expect(screen.queryByText('BMI N/A')).toBeNull();
  });
});
