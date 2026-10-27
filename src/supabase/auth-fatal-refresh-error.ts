const FATAL_REFRESH_CODES = new Set(['refresh_token_not_found', 'refresh_token_already_used']);

export function isFatalRefreshTokenError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const authError = error as { code?: string; status?: number };
  if (authError.code && FATAL_REFRESH_CODES.has(authError.code)) {
    return true;
  }
  return false;
}

export function isFatalRefreshTokenResponseBody(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const record = body as { error_code?: string; code?: string };
  const code = record.error_code ?? record.code;
  return typeof code === 'string' && FATAL_REFRESH_CODES.has(code);
}
