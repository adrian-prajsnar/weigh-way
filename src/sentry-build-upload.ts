/** Whether native Sentry source-map upload should be skipped at build time. */
export function shouldDisableSentryAutoUpload(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.SENTRY_DISABLE_AUTO_UPLOAD === 'true') {
    return true;
  }

  const token = env.SENTRY_AUTH_TOKEN?.trim();
  const org = env.SENTRY_ORG?.trim();
  const project = env.SENTRY_PROJECT?.trim();

  return !(token && org && project);
}
