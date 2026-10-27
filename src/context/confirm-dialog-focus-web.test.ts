/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import {
  handleConfirmDialogTabKey,
  listConfirmDialogFocusables,
} from './confirm-dialog-focus-web';

function mountDialog() {
  document.body.innerHTML = `
    <div data-ww-confirm-dialog="true">
      <div tabindex="-1" data-testid="chrome">chrome</div>
      <button type="button">Cancel</button>
      <button type="button">Replace</button>
    </div>
  `;
  return document.querySelector('[data-ww-confirm-dialog="true"]') as HTMLElement;
}

describe('confirm-dialog-focus-web', () => {
  it('lists only enabled dialog action controls', () => {
    const root = mountDialog();
    const focusables = listConfirmDialogFocusables(root);
    expect(focusables.map((node) => node.textContent)).toEqual(['Cancel', 'Replace']);
  });

  it('cycles Tab and Shift+Tab within dialog controls', () => {
    const root = mountDialog();
    const focusables = listConfirmDialogFocusables(root);
    const cancel = focusables[0];
    const replace = focusables[1];
    cancel.focus();

    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    handleConfirmDialogTabKey(root, forward, cancel);
    expect(document.activeElement).toBe(replace);

    const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    handleConfirmDialogTabKey(root, backward, replace);
    expect(document.activeElement).toBe(cancel);
  });

  it('wraps Shift+Tab from outside the dialog onto the last control', () => {
    const root = mountDialog();
    const behind = document.createElement('div');
    behind.tabIndex = 0;
    document.body.appendChild(behind);
    behind.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    handleConfirmDialogTabKey(root, event, behind);
    expect(document.activeElement?.textContent).toBe('Replace');
    behind.remove();
  });

  it('pulls focus back from chrome wrappers onto the first control', () => {
    const root = mountDialog();
    const chrome = root.querySelector('[data-testid="chrome"]') as HTMLElement;
    chrome.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    handleConfirmDialogTabKey(root, event, chrome);
    expect(document.activeElement?.textContent).toBe('Cancel');
  });
});
