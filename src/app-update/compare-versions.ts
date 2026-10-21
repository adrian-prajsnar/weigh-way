export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

function parseVersionParts(version: string): number[] {
  return normalizeVersion(version)
    .split('.')
    .map((part) => {
      const parsed = Number.parseInt(part, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
}

export function isVersionNewer(latest: string, current: string): boolean {
  const latestParts = parseVersionParts(latest);
  const currentParts = parseVersionParts(current);

  for (let i = 0; i < 3; i += 1) {
    const latestValue = latestParts[i] ?? 0;
    const currentValue = currentParts[i] ?? 0;
    if (latestValue !== currentValue) {
      return latestValue > currentValue;
    }
  }

  return false;
}
