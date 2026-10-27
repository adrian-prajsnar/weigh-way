/** @vitest-environment happy-dom */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    vi.mocked(getLanguagePreference).mockReset();
    vi.mocked(getLanguagePreference).mockResolvedValue('en');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back to system language when preference storage rejects', async () => {
    const securityError = new DOMException('The operation is insecure.', 'SecurityError');
    vi.mocked(getLanguagePreference).mockRejectedValueOnce(securityError);

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

  it('falls back to system when preference storage never settles', async () => {
    vi.mocked(getLanguagePreference).mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();

    render(
      <LanguageProvider>
        <span data-testid="ready">ok</span>
      </LanguageProvider>,
    );

    await vi.advanceTimersByTimeAsync(2000);

    expect(screen.getByTestId('ready')).toBeTruthy();
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
