export const FLAGGED_RESTORED_SESSION_VALIDATION_MS = 6000;

/** Runs server validation for a flagged restored session; signs out locally on timeout. */
export async function validateFlaggedRestoredSession(
  validate: () => Promise<void>,
  signOutLocal: () => Promise<void>,
): Promise<'completed' | 'timed_out'> {
  try {
    await Promise.race([
      validate(),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => {
          reject(new Error('flagged_session_validation_timeout'));
        }, FLAGGED_RESTORED_SESSION_VALIDATION_MS);
      }),
    ]);
    return 'completed';
  } catch {
    await signOutLocal();
    return 'timed_out';
  }
}
