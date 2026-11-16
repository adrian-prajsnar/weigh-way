import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { SignedOutError, toSupabaseError, toSupabaseErrorFromUnknown } from './errors';
import { FetchAllRowsLimitError } from './fetch-all-rows';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each([toSupabaseError, toSupabaseErrorFromUnknown])('%s', (mapError) => {
  it('defaults generic read failures to the load message', () => {
    expect(mapError({ message: 'constraint violation', code: '23514' }).message).toBe(
      t('errors.couldNotLoadData'),
    );
  });

  it('uses the supplied fallback for generic write failures', () => {
    expect(mapError({ message: 'constraint violation' }, 'entryForm.saveFailed').message).toBe(
      t('entryForm.saveFailed'),
    );
  });

  it('preserves network and session errors with a write fallback', () => {
    expect(mapError(new Error('Network request failed'), 'entryForm.saveFailed').message).toBe(
      t('errors.noConnection'),
    );
    expect(mapError({ message: 'JWT expired', code: 'PGRST301' }, 'entryForm.saveFailed').message).toBe(
      t('errors.sessionExpired'),
    );
  });

  it('preserves the data limit message with a write fallback', () => {
    expect(mapError(new FetchAllRowsLimitError(), 'entryForm.saveFailed').message).toBe(
      t('errors.dataTooLarge'),
    );
  });

  it('preserves the dev permission message for reads and writes', () => {
    vi.stubGlobal('__DEV__', true);
    const error = { message: 'permission denied', code: '42501' };
    expect(mapError(error).message).toBe(t('errors.databasePermissionDev'));
    expect(mapError(error, 'entryForm.saveFailed').message).toBe(t('errors.databasePermissionDev'));
  });

  it('uses the write fallback for production permissions while preserving read behavior', () => {
    vi.stubGlobal('__DEV__', false);
    const error = { message: 'permission denied', code: '42501' };
    expect(mapError(error).message).toBe(t('errors.databasePermission'));
    expect(mapError(error, 'entryForm.saveFailed').message).toBe(t('entryForm.saveFailed'));
  });
});

describe('toSupabaseErrorFromUnknown', () => {
  it('uses the fallback for values without a message', () => {
    expect(toSupabaseErrorFromUnknown(null).message).toBe(t('errors.couldNotLoadData'));
    expect(toSupabaseErrorFromUnknown(null, 'history.deleteFailed').message).toBe(
      t('history.deleteFailed'),
    );
  });

  it('preserves SignedOutError with a write fallback', () => {
    const error = new SignedOutError();
    expect(toSupabaseErrorFromUnknown(error, 'entryForm.saveFailed')).toBe(error);
  });
});
