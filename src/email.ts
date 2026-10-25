/** Practical check for user-typed emails (not RFC-complete). */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.includes('..')) {
    return false;
  }

  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || atIndex !== trimmed.lastIndexOf('@')) {
    return false;
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!local || !domain || domain.startsWith('.') || domain.endsWith('.')) {
    return false;
  }

  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((label) => !label)) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
