import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { shouldDisableSentryAutoUpload } = require('./sentry-build-upload.cjs');

describe('shouldDisableSentryAutoUpload', () => {
  it('disables upload when org, project, or auth token is missing', () => {
    expect(shouldDisableSentryAutoUpload({})).toBe(true);
    expect(
      shouldDisableSentryAutoUpload({
        SENTRY_ORG: 'org',
        SENTRY_PROJECT: 'proj',
      }),
    ).toBe(true);
  });

  it('enables upload when Sentry credentials are configured', () => {
    expect(
      shouldDisableSentryAutoUpload({
        SENTRY_AUTH_TOKEN: 'token',
        SENTRY_ORG: 'org',
        SENTRY_PROJECT: 'proj',
      }),
    ).toBe(false);
  });

  it('respects SENTRY_DISABLE_AUTO_UPLOAD=true', () => {
    expect(
      shouldDisableSentryAutoUpload({
        SENTRY_DISABLE_AUTO_UPLOAD: 'true',
        SENTRY_AUTH_TOKEN: 'token',
        SENTRY_ORG: 'org',
        SENTRY_PROJECT: 'proj',
      }),
    ).toBe(true);
  });
});
