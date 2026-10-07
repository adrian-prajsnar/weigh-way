import { Platform } from 'react-native';

export function isDemoEmbedded(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  if (window.self !== window.top) {
    return true;
  }

  const query = window.location.search.startsWith('?')
    ? window.location.search.slice(1)
    : window.location.search;

  return new URLSearchParams(query).get('embed') === '1';
}
