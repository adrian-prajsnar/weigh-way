export const LOCAL_SIGN_OUT_TIMEOUT_MS = 2500;

export async function forceLocalAuthSignOut(deps: {
  signOutViaSupabase: () => Promise<void>;
  clearReactSession: () => void;
  forcePersistSignedOutOnDisk: () => Promise<void>;
}): Promise<void> {
  try {
    await Promise.race([
      deps.signOutViaSupabase(),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => {
          reject(new Error('local_sign_out_timeout'));
        }, LOCAL_SIGN_OUT_TIMEOUT_MS);
      }),
    ]);
  } catch {
    deps.clearReactSession();
    await deps.forcePersistSignedOutOnDisk();
  }
}
