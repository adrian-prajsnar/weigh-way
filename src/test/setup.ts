import { vi } from 'vitest';

vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

vi.mock('expo-linking', () => {
  function parse(url: string) {
    const match = url.match(/^([a-z][a-z0-9+.-]*):\/\/([^?#]*)(.*)?$/i);
    if (!match) {
      return { scheme: null, hostname: null, path: null };
    }

    const scheme = match[1];
    const authorityAndPath = match[2];
    const slashIndex = authorityAndPath.indexOf('/');

    if (slashIndex === -1) {
      return { scheme, hostname: authorityAndPath || null, path: null };
    }

    return {
      scheme,
      hostname: authorityAndPath.slice(0, slashIndex) || null,
      path: authorityAndPath.slice(slashIndex),
    };
  }

  return {
    createURL: (path: string) => `weigh-way://${path}`,
    parse,
  };
});
