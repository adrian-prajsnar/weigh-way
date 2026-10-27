/** @vitest-environment happy-dom */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vitest RN web shim
  const RNWeb = require('react-native-web');
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

const profileState = vi.hoisted(() => ({
  heightEntries: [] as never[],
  isLoading: true,
}));

vi.mock('../context/user-profile-context', () => ({
  useSharedUserProfile: () => ({
    heightEntries: profileState.heightEntries,
    birthDate: null,
    sex: null,
    isLoading: profileState.isLoading,
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

vi.mock('./segmented-control', () => ({
  SegmentedControl: () => null,
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

function renderHero() {
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <HeroWeightCard entries={[sampleEntry]} isLoading={false} />
      </LanguageProvider>
    </ThemeProvider>,
  );
}

describe('HeroWeightCard', () => {
  it('does not show BMI unavailable while profile height is loading', async () => {
    profileState.isLoading = true;
    profileState.heightEntries = [];

    renderHero();

    await waitFor(() => {
      expect(screen.getByText('Latest weight')).toBeTruthy();
    });

    expect(screen.queryByLabelText('BMI N/A')).toBeNull();
    expect(screen.queryByText('BMI N/A')).toBeNull();
  });

  it('shows BMI unavailable after profile load when height is missing', async () => {
    profileState.isLoading = false;
    profileState.heightEntries = [];

    renderHero();

    await waitFor(() => {
      expect(screen.getByLabelText('BMI N/A')).toBeTruthy();
    });
  });
});
