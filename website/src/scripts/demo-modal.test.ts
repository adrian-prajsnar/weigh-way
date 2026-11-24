/** @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';
import { formatDemoStatusBarTime, getDemoModalLoadingState, initDemoModal, msUntilNextMinute } from './demo-modal';

describe('demo modal navigation', () => {
  it('returns focus to the link that opened the dialog', () => {
    document.body.innerHTML = `
      <button data-demo-open>Intro preview</button>
      <button data-demo-open>Footer preview</button>
      <main><section id="policy" tabindex="-1">Policy</section></main>
      <dialog data-demo-modal data-demo-url="about:blank">
        <button data-demo-close>Close</button>
        <iframe data-demo-iframe srcdoc=""></iframe>
      </dialog>
    `;
    const opener = document.querySelectorAll<HTMLButtonElement>('[data-demo-open]')[1];
    const dialog = document.querySelector('dialog')!;
    const close = document.querySelector<HTMLButtonElement>('[data-demo-close]')!;
    initDemoModal();

    opener.click();
    expect(dialog.open).toBe(true);
    expect(location.hash).toBe('#demo');

    close.focus();
    close.click();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(opener);
    expect(location.hash).toBe('');

    opener.click();
    history.replaceState(null, '', '#policy');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(document.getElementById('policy'));
    expect(location.hash).toBe('#policy');
    history.replaceState(null, '', location.pathname);

    opener.click();
    const iframe = document.querySelector('iframe')!;
    iframe.dispatchEvent(new Event('load'));
    const frameDocument = iframe.contentDocument!;
    const input = frameDocument.createElement('input');
    input.addEventListener('keydown', (event) => event.stopPropagation());
    frameDocument.body.append(input);
    const nestedDialog = frameDocument.createElement('div');
    nestedDialog.setAttribute('role', 'dialog');
    nestedDialog.setAttribute('aria-modal', 'true');
    frameDocument.body.append(nestedDialog);
    nestedDialog.append(input);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dialog.open).toBe(true);

    frameDocument.body.append(input);
    nestedDialog.remove();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
});

describe('formatDemoStatusBarTime', () => {
  it('formats hours and minutes for the status bar', () => {
    const formatted = formatDemoStatusBarTime(new Date(2026, 2, 9, 9, 41));
    expect(formatted).toMatch(/9:41/);
  });
});

describe('msUntilNextMinute', () => {
  it('returns the remaining ms in the current minute', () => {
    expect(msUntilNextMinute(new Date(2026, 2, 9, 9, 41, 12, 340))).toBe(47_660);
  });
});

describe('getDemoModalLoadingState', () => {
  it('shows the skeleton while the demo iframe is loading', () => {
    expect(getDemoModalLoadingState(true)).toEqual({
      isLoading: true,
      ariaBusy: 'true',
      skeletonHidden: 'false',
    });
  });

  it('hides the skeleton after the demo iframe has loaded', () => {
    expect(getDemoModalLoadingState(false)).toEqual({
      isLoading: false,
      ariaBusy: 'false',
      skeletonHidden: 'true',
    });
  });
});
