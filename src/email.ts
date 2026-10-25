/** Practical check for user-typed emails (not RFC-complete). */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
