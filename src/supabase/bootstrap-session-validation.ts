import { forceLocalAuthSignOut } from './force-local-auth-sign-out';

export const FLAGGED_RESTORED_SESSION_VALIDATION_MS = 6000;

export type FailClosedSignOutContext = {
  bootstrapAuthGeneration: number;
  accessTokenAtStart: string | null;
  getAuthEventGeneration: () => number;
  getCurrentAccessToken: () => Promise<string | null>;
};

export async function shouldRunFailClosedSignOut(
  context: FailClosedSignOutContext,
): Promise<boolean> {
  if (context.getAuthEventGeneration() !== context.bootstrapAuthGeneration) {
    return false;
  }
  if (!context.accessTokenAtStart) {
    return true;
  }
  const currentToken = await context.getCurrentAccessToken();
  if (currentToken && currentToken !== context.accessTokenAtStart) {
    return false;
  }
  return true;
}

/** Runs server validation for a flagged restored session; signs out locally on timeout. */
export async function validateFlaggedRestoredSession(
  validate: () => Promise<void>,
  signOutLocal: () => Promise<void>,
  shouldSignOut: () => Promise<boolean> = async () => true,
): Promise<'completed' | 'timed_out'> {
  let validationTimer: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      validate(),
      new Promise<never>((_resolve, reject) => {
        validationTimer = setTimeout(() => {
          reject(new Error('flagged_session_validation_timeout'));
        }, FLAGGED_RESTORED_SESSION_VALIDATION_MS);
      }),
    ]);
    return 'completed';
  } catch {
    if (await shouldSignOut()) {
      await signOutLocal();
    }
    return 'timed_out';
  } finally {
    if (validationTimer) {
      clearTimeout(validationTimer);
    }
  }
}

export async function runFailClosedLocalSignOut(
  context: FailClosedSignOutContext,
  deps: {
    signOutViaSupabase: () => Promise<void>;
    clearReactSession: () => void;
    forcePersistSignedOutOnDisk: () => Promise<void>;
  },
): Promise<void> {
  if (!(await shouldRunFailClosedSignOut(context))) {
    return;
  }
  await forceLocalAuthSignOut(deps);
}
