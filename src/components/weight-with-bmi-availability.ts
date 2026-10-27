export function shouldShowBmiUnavailableBadge(
  isProfileLoading: boolean,
  heightCm: number | null,
): boolean {
  return !isProfileLoading && heightCm === null;
}
