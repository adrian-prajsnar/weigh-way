/** Builds a minimal JWT-shaped access token for tests (includes `session_id`). */
export function makeTestAccessToken(
  sessionId: string,
  extraPayload: Record<string, unknown> = {},
): string {
  const header =
    typeof btoa !== 'undefined' ? btoa('{"alg":"none"}') : Buffer.from('{"alg":"none"}').toString('base64');
  const payloadJson = JSON.stringify({
    session_id: sessionId || undefined,
    sub: extraPayload.sub,
    ...extraPayload,
  });
  const payload =
    typeof btoa !== 'undefined'
      ? btoa(payloadJson).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
      : Buffer.from(payloadJson)
          .toString('base64')
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
  return `${header}.${payload}.test-signature`;
}
