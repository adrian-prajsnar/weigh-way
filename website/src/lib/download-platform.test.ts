import { describe, expect, it } from 'vitest';
import { detectDownloadPlatform } from './download-platform';

describe('detectDownloadPlatform', () => {
  it('detects Android mobile browsers', () => {
    expect(
      detectDownloadPlatform(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('android');
  });

  it('detects iPhone browsers', () => {
    expect(
      detectDownloadPlatform(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('ios');
  });

  it('detects iPad browsers', () => {
    expect(
      detectDownloadPlatform(
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('ios');
  });

  it('detects iPad desktop user agents via touch points', () => {
    expect(
      detectDownloadPlatform(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
        5,
      ),
    ).toBe('ios');
  });

  it('treats desktop browsers as desktop', () => {
    expect(
      detectDownloadPlatform(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBe('desktop');

    expect(
      detectDownloadPlatform(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBe('desktop');
  });
});
