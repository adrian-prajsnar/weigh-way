const LOCAL_HOST_RE = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i;

export function isLocalSupabaseEnvUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  return (
    LOCAL_HOST_RE.test(trimmed) ||
    trimmed.startsWith('http://10.0.2.2:') ||
    /^https?:\/\/192\.168\./i.test(trimmed) ||
    /^https?:\/\/10\./i.test(trimmed)
  );
}

export function isLocalhostSupabaseUrl(url: string): boolean {
  return LOCAL_HOST_RE.test(url.trim());
}
