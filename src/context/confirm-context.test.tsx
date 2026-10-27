/** @vitest-environment happy-dom */
import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

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

/* eslint-disable import/first -- after vi.mock */
import { LanguageProvider } from '../i18n/language-context';
import { ThemeProvider } from '../theme/theme-context';
import * as confirmDialogFocusWeb from './confirm-dialog-focus-web';
import { listConfirmDialogFocusables } from './confirm-dialog-focus-web';
import { ConfirmProvider, useConfirm } from './confirm-context';
/* eslint-enable import/first */

function OpenReplaceConfirmOnMount() {
  const { confirm } = useConfirm();

  useEffect(() => {
    void confirm({
      title: 'Replace entry?',
      message: 'Already logged for this date.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Replace',
    });
  }, [confirm]);

  return null;
}

function OpenPhraseConfirmOnMount() {
  const { confirm } = useConfirm();

  useEffect(() => {
    void confirm({
      title: 'Delete account?',
      message: 'This cannot be undone.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
      confirmationPhrase: 'DELETE',
    });
  }, [confirm]);

  return null;
}

function TestShell() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ConfirmProvider>
          <OpenReplaceConfirmOnMount />
        </ConfirmProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

describe('ConfirmProvider', () => {
  it('exposes labeled action buttons and keeps the backdrop out of the button list', async () => {
    render(<TestShell />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();
    });

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((node) => node.getAttribute('aria-label') ?? node.textContent)).toEqual([
      'Cancel',
      'Replace',
    ]);

    const dialog = document.querySelector('[data-ww-confirm-dialog="true"]');
    expect(dialog).toBeTruthy();
    const tabStops = listConfirmDialogFocusables(document);
    expect(tabStops.map((node) => node.getAttribute('aria-label'))).toEqual(['Cancel', 'Replace']);
  });

  it('registers capture-phase Tab handling when a phrase confirm is open', async () => {
    const subscribeSpy = vi.spyOn(confirmDialogFocusWeb, 'subscribeConfirmDialogKeydown');

    render(
      <ThemeProvider>
        <LanguageProvider>
          <ConfirmProvider>
            <OpenPhraseConfirmOnMount />
          </ConfirmProvider>
        </LanguageProvider>
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('DELETE')).toBeTruthy();
      expect(subscribeSpy).toHaveBeenCalled();
    });

    subscribeSpy.mockRestore();
  });
});
