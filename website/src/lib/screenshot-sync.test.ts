import { describe, expect, it } from 'vitest';
import { buildScreenshotBootstrapScript, screenshotSrc } from './screenshot-sync';

describe('screenshot-sync', () => {
  it('builds theme- and locale-aware paths', () => {
    expect(screenshotSrc('/weigh-way/', 'home', 'dark', 'pl')).toBe(
      '/weigh-way/screenshots/home-dark-pl.webp',
    );
    expect(screenshotSrc('/weigh-way', 'history', 'light', 'en')).toBe(
      '/weigh-way/screenshots/history-light-en.webp',
    );
  });

  it('exposes syncScreenshotImages from the bootstrap script', () => {
    const script = buildScreenshotBootstrapScript('/weigh-way/');
    expect(script).toContain('window.syncScreenshotImages=syncScreenshotImages');
    expect(script).toContain('MutationObserver');
  });
});
