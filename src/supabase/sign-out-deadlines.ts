export const SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS = 10_000;
export const SIGN_OUT_REFRESH_TIMEOUT_MS = 10_000;

export class SignOutDeadlineError extends Error {
  constructor() {
    super('sign_out_deadline');
    this.name = 'SignOutDeadlineError';
  }
}

export function isSignOutDeadlineError(error: unknown): boolean {
  return error instanceof SignOutDeadlineError;
}

export async function withSignOutDeadline<T>(
  timeoutMs: number,
  operation: () => Promise<T>,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
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
