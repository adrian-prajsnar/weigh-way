export const SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS = 10_000;
export const SIGN_OUT_REFRESH_TIMEOUT_MS = 10_000;
export const SIGN_OUT_SESSION_USER_CHECK_TIMEOUT_MS = 3_000;
export const SIGN_OUT_FLOW_CAP_MS = 15_000;
export const VALIDATION_AUTH_USER_TIMEOUT_MS = 10_000;
export const SIGN_OUT_LOCAL_CLEAR_TIMEOUT_MS = 5_000;

export class SignOutDeadlineError extends Error {
  constructor() {
    super('sign_out_deadline');
    this.name = 'SignOutDeadlineError';
  }
}

export function isSignOutDeadlineError(error: unknown): boolean {
  return error instanceof SignOutDeadlineError;
}

export type SignOutDeadlineControl = {
  abandoned: boolean;
};

export async function withSignOutDeadline<T>(
  timeoutMs: number,
  operation: () => Promise<T>,
  control?: SignOutDeadlineControl,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          if (control) {
            control.abandoned = true;
          }
          reject(new SignOutDeadlineError());
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
