/** @vitest-environment happy-dom */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const iosModalMocks = vi.hoisted(() => ({
  autoDismissOnHide: true,
  pendingOnDismiss: null as (() => void) | null,
}));

vi.mock('react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vitest RN web shim
  const RNWeb = require('react-native-web') as typeof import('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');

  function Modal({
    visible,
    onDismiss,
    children,
  }: {
    visible?: boolean;
    onDismiss?: () => void;
    children?: React.ReactNode;
  }) {
    const wasVisibleRef = React.useRef(false);
    React.useEffect(() => {
      if (visible) {
        wasVisibleRef.current = true;
        iosModalMocks.pendingOnDismiss = null;
        return;
      }
      if (!wasVisibleRef.current || !onDismiss) {
        return;
      }
      wasVisibleRef.current = false;
      if (iosModalMocks.autoDismissOnHide) {
        onDismiss();
        return;
      }
      iosModalMocks.pendingOnDismiss = onDismiss;
    }, [visible, onDismiss]);

    if (!visible) {
      return null;
    }
    return React.createElement('div', { 'data-testid': 'confirm-modal' }, children);
  }

  return {
    ...RNWeb,
    Modal,
    Platform: { OS: 'ios', select: RNWeb.Platform.select },
  };
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
import { ConfirmProvider, useConfirm } from './confirm-context';
/* eslint-enable import/first */

let requestConfirm: ReturnType<typeof useConfirm>['confirm'] | undefined;

function CaptureConfirm() {
  const { confirm } = useConfirm();
  useEffect(() => {
    requestConfirm = confirm;
  }, [confirm]);
  return null;
}

function TestShell({ children }: { children?: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ConfirmProvider>
          <CaptureConfirm />
          {children}
        </ConfirmProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

async function waitForConfirm() {
  await waitFor(() => {
    expect(requestConfirm).toBeDefined();
  });
}

async function enableConfirmActions() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
}

describe('ConfirmProvider iOS dismiss', () => {
  afterEach(() => {
    cleanup();
    requestConfirm = undefined;
    iosModalMocks.autoDismissOnHide = true;
    iosModalMocks.pendingOnDismiss = null;
  });

  it('resolves confirm only after the modal onDismiss callback', async () => {
    iosModalMocks.autoDismissOnHide = false;

    render(<TestShell />);
    await waitForConfirm();

    let settled = false;
    let promise!: Promise<boolean>;
    act(() => {
      promise = requestConfirm!({ title: 'Update?', message: 'New version' });
      void promise.then(() => {
        settled = true;
      });
    });

    await screen.findByText('Update?');
    await enableConfirmActions();
    await act(async () => {
      screen.getByRole('button', { name: 'Confirm' }).click();
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    expect(iosModalMocks.pendingOnDismiss).toBeTypeOf('function');

    await act(async () => {
      iosModalMocks.pendingOnDismiss?.();
    });

    await expect(promise).resolves.toBe(true);
  });

  it('resolves cancel only after the modal onDismiss callback', async () => {
    iosModalMocks.autoDismissOnHide = false;

    render(<TestShell />);
    await waitForConfirm();

    let promise!: Promise<boolean>;
    act(() => {
      promise = requestConfirm!({ title: 'Discard?', message: 'Unsaved changes' });
    });

    await screen.findByText('Discard?');
    await act(async () => {
      screen.getByRole('button', { name: 'Cancel' }).click();
    });

    await Promise.resolve();
    expect(iosModalMocks.pendingOnDismiss).toBeTypeOf('function');

    await act(async () => {
      iosModalMocks.pendingOnDismiss?.();
    });

    await expect(promise).resolves.toBe(false);
  });

  it('fires onDismiss automatically when autoDismissOnHide is enabled', async () => {
    iosModalMocks.autoDismissOnHide = true;

    render(<TestShell />);
    await waitForConfirm();

    let promise!: Promise<boolean>;
    act(() => {
      promise = requestConfirm!({ title: 'Save?', message: 'Overwrite' });
    });

    await screen.findByText('Save?');
    await enableConfirmActions();
    await act(async () => {
      screen.getByRole('button', { name: 'Confirm' }).click();
    });

    await expect(promise).resolves.toBe(true);
    expect(iosModalMocks.pendingOnDismiss).toBeNull();
  });

  it('settles with the stored result when unmounted during dismissal', async () => {
    iosModalMocks.autoDismissOnHide = false;

    const { unmount: unmountTree } = render(<TestShell />);
    await waitForConfirm();

    let promise!: Promise<boolean>;
    act(() => {
      promise = requestConfirm!({ title: 'Leave?', message: 'Progress will be lost' });
    });

    await screen.findByText('Leave?');
    await enableConfirmActions();
    await act(async () => {
      screen.getByRole('button', { name: 'Confirm' }).click();
    });

    await Promise.resolve();
    expect(iosModalMocks.pendingOnDismiss).toBeTypeOf('function');

    unmountTree();

    await expect(promise).resolves.toBe(true);
  });

  it('ignores a second close while dismissal is in progress', async () => {
    iosModalMocks.autoDismissOnHide = false;

    render(<TestShell />);
    await waitForConfirm();

    let promise!: Promise<boolean>;
    act(() => {
      promise = requestConfirm!({ title: 'Delete?', message: 'Cannot undo' });
    });

    await screen.findByText('Delete?');
    await enableConfirmActions();
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await act(async () => {
      confirmButton.click();
      cancelButton.click();
    });

    await act(async () => {
      iosModalMocks.pendingOnDismiss?.();
    });

    await expect(promise).resolves.toBe(true);
  });

  it('settles a dismissing dialog with its chosen result when replaced', async () => {
    iosModalMocks.autoDismissOnHide = false;

    const { unmount: unmountTree } = render(<TestShell />);
    await waitForConfirm();

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = requestConfirm!({ title: 'First', message: 'First request' });
    });

    await screen.findByText('First');
    await enableConfirmActions();
    await act(async () => {
      screen.getByRole('button', { name: 'Confirm' }).click();
    });

    await Promise.resolve();
    act(() => {
      second = requestConfirm!({ title: 'Second', message: 'Second request' });
    });

    await expect(first).resolves.toBe(true);
    expect(screen.getByText('Second')).toBeTruthy();
    unmountTree();
    await expect(second).resolves.toBe(false);
  });
});
