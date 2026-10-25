import { afterEach, describe, expect, it } from 'vitest';
import { registerErrorReporter } from '../report-error';
import { FetchAllRowsLimitError } from './fetch-all-rows';
import { toSupabaseError, toSupabaseErrorFromUnknown } from './errors';

describe('mapped supabase failures', () => {
  afterEach(() => {
    registerErrorReporter(null);
  });

  it('reports the error code and not the database message', () => {
    const codes: string[] = [];
    registerErrorReporter({
      captureException() {
        throw new Error('unexpected exception report');
      },
      captureMessage(_message, extra) {
        codes.push(extra?.tags?.supabase_code ?? '');
        expect(JSON.stringify(extra)).not.toContain('77.25');
      },
    });

    toSupabaseError({
      code: 'PGRST303',
      message: 'JWT issued at future for weight 77.25',
    });

    expect(codes).toEqual(['PGRST303']);
  });

  it('maps fetch row cap errors through toSupabaseErrorFromUnknown', () => {
    const message = toSupabaseErrorFromUnknown(new FetchAllRowsLimitError()).message;
    expect(message).toContain('more history than the app can load');
  });

  it('does not report an offline network failure', () => {
    let calls = 0;
    registerErrorReporter({
      captureException() {
        calls += 1;
      },
      captureMessage() {
        calls += 1;
      },
    });

    toSupabaseError({ message: 'Network request failed' });
    expect(calls).toBe(0);
  });
});
