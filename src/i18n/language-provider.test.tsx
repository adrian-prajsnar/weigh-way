/** @vitest-environment happy-dom */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vitest RN web shim
  const RNWeb = require('react-native-web') as typeof import('react-native');
  return { ...RNWeb, Platform: { OS: 'web', select: RNWeb.Platform.select } };
});

vi.mock('../storage/language-preference', () => ({
  getLanguagePreference: vi.fn(),
  setStoredLanguagePreference: vi.fn(),
}));

/* eslint-disable import/first -- after vi.mock */
import { formatDateLabel, formatWeightValue } from '../format';
import { getI18nLocale } from './index';
import { LanguageProvider, useTranslation } from './language-context';
import { getLanguagePreference } from '../storage/language-preference';
/* eslint-enable import/first */

function LocaleProbe() {
  const { locale } = useTranslation();
  return (
    <div>
      <span data-testid="global">{getI18nLocale()}</span>
      <span data-testid="locale">{locale}</span>
      <span data-testid="date">{formatDateLabel('2024-09-05')}</span>
      <span data-testid="weight">{formatWeightValue(82, 'metric', locale)}</span>
    </div>
  );
}

describe('LanguageProvider', () => {
  it('falls back to system language when preference storage rejects', async () => {
    vi.mocked(getLanguagePreference).mockRejectedValueOnce(new Error('storage blocked'));

    render(
      <LanguageProvider>
        <span data-testid="ready">ok</span>
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toBeTruthy();
    });
    expect(getI18nLocale()).toBe('en');
  });

  it('syncs global locale before children render with stored Polish preference', async () => {
    vi.mocked(getLanguagePreference).mockResolvedValueOnce('pl');

    render(
      <LanguageProvider>
        <LocaleProbe />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('weight').textContent).toBe('82,00');
    });

    expect(screen.getByTestId('global').textContent).toBe('pl');
    expect(screen.getByTestId('locale').textContent).toBe('pl');
    expect(screen.getByTestId('date').textContent).toMatch(/wrz/i);
  });
});
