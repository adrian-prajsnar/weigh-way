/** @vitest-environment happy-dom */
import { render, screen, waitFor } from '@testing-library/react';
import { createElement, useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { formatWeightValue } from '../format';
import { getLanguagePreference, LanguagePreference } from '../storage/language-preference';
import { resolveLocale } from './resolve-locale';

vi.mock('../storage/language-preference', () => ({
  getLanguagePreference: vi.fn().mockResolvedValue('pl'),
  setStoredLanguagePreference: vi.fn(),
}));

function HydratedWeightProbe() {
  const [preference, setPreference] = useState<LanguagePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void getLanguagePreference().then((stored) => {
      setPreference(stored);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return null;
  }

  const locale = resolveLocale(preference);
  return createElement(
    'span',
    { 'data-testid': 'weight' },
    formatWeightValue(82, 'metric', locale),
  );
}

describe('stored language preference and number formatting', () => {
  it('shows Polish decimals after async preference hydration with English system locale', async () => {
    render(createElement(HydratedWeightProbe));

    await waitFor(() => {
      expect(screen.getByTestId('weight').textContent).toBe('82,00');
    });
  });
});
