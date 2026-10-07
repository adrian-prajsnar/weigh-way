export function isDemoLocation(pathname: string, search: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.includes('demo')) {
    return true;
  }

  const query = search.startsWith('?') ? search.slice(1) : search;
  return new URLSearchParams(query).get('demo') === '1';
}
