export type DownloadPlatform = 'android' | 'ios' | 'desktop';

export function detectDownloadPlatform(
  userAgent: string,
  maxTouchPoints = 0,
): DownloadPlatform {
  const ua = userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  }

  if (/android/.test(ua)) {
    return 'android';
  }

  if (/macintosh/.test(ua) && maxTouchPoints > 1) {
    return 'ios';
  }

  return 'desktop';
}

export function buildDownloadPlatformBootstrapScript(): string {
  return `(function(){var ua=navigator.userAgent;var tp=navigator.maxTouchPoints||0;var platform='desktop';if(/iphone|ipad|ipod/i.test(ua)){platform='ios';}else if(/android/i.test(ua)){platform='android';}else if(/macintosh/i.test(ua)&&tp>1){platform='ios';}document.documentElement.setAttribute('data-download-platform',platform);})();`;
}
