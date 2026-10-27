function isDevWarningsEnabled(): boolean {
  if (typeof __DEV__ !== 'undefined') {
    return __DEV__;
  }
  return process.env.NODE_ENV === 'development';
}

/** Dev-only signal when a preference read fell back because storage threw. */
export function warnPreferenceStorageFallback(scope: string): void {
  if (isDevWarningsEnabled()) {
    console.warn(`[weigh-way] ${scope} preference storage unavailable; using default.`);
  }
}

export { isDevWarningsEnabled };
