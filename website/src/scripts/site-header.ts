import {
  LANGUAGE_STORAGE_KEY,
  SCROLL_STORAGE_KEY,
  THEME_STORAGE_KEY,
  localeHref,
  normalizeLanguagePreference,
  normalizeThemePreference,
  prefersDarkColorScheme,
  resolveLanguagePreference,
  resolveThemePreference,
  type LanguagePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '../lib/site-preferences';

declare global {
  interface Window {
    syncScreenshotImages?: () => void;
  }
}

function readInitOptions(): { pageLocale: 'en' | 'pl'; baseUrl: string } {
  const header = document.querySelector<HTMLElement>('.site-header');
  const pageLocale = header?.dataset.pageLocale === 'pl' ? 'pl' : 'en';
  const baseUrl = header?.dataset.baseUrl ?? '/';
  return { pageLocale, baseUrl };
}

export function initSiteHeader(): void {
  const { pageLocale, baseUrl } = readInitOptions();
  function markToggle(selector: string, attr: string, value: string): void {
    document.querySelectorAll(`${selector} button`).forEach((button) => {
      button.setAttribute('aria-pressed', button.getAttribute(attr) === value ? 'true' : 'false');
    });
  }

  function applyTheme(theme: ResolvedTheme): void {
    document.documentElement.setAttribute('data-theme', theme);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', theme === 'dark' ? '#080B12' : '#F4F5F8');
    }
  }

  function getResolvedTheme(preference: ThemePreference): ResolvedTheme {
    return resolveThemePreference(preference, prefersDarkColorScheme());
  }

  function getScreenshotIds(): string[] {
    const ids: string[] = [];
    document.querySelectorAll('[data-screenshot]').forEach((img) => {
      const id = img.getAttribute('data-screenshot');
      if (id && !ids.includes(id)) {
        ids.push(id);
      }
    });
    return ids;
  }

  function screenshotUrl(id: string, theme: ResolvedTheme): string {
    const locale = document.documentElement.getAttribute('data-screenshot-locale') || 'en';
    const base = baseUrl.replace(/\/$/, '');
    return `${base}/screenshots/${id}-${theme}-${locale}.webp`;
  }

  function preloadScreenshot(id: string, theme: ResolvedTheme): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (typeof img.decode === 'function') {
          img.decode().then(resolve).catch(resolve);
          return;
        }
        resolve();
      };
      img.onerror = () => {
        resolve();
      };
      img.src = screenshotUrl(id, theme);
    });
  }

  function preloadThemeScreenshots(theme: ResolvedTheme): Promise<void> {
    const ids = getScreenshotIds();
    if (!ids.length) {
      return Promise.resolve();
    }
    return Promise.all(ids.map((id) => preloadScreenshot(id, theme))).then(() => undefined);
  }

  function decodeDomScreenshots(): Promise<void> {
    const tasks: Promise<void>[] = [];
    document.querySelectorAll('[data-screenshot]').forEach((img) => {
      if (img instanceof HTMLImageElement && typeof img.decode === 'function') {
        tasks.push(img.decode().catch(() => undefined));
      }
    });
    return tasks.length ? Promise.all(tasks).then(() => undefined) : Promise.resolve();
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function fadeSplash(overlay: HTMLElement, from: number, to: number, duration: number): Promise<void> {
    return overlay
      .animate([{ opacity: from }, { opacity: to }], {
        duration,
        easing: 'cubic-bezier(0.22, 1, 0.28, 1)',
        fill: 'forwards',
      })
      .finished.then(() => undefined);
  }

  function runDesktopFlashTransition(next: ResolvedTheme, commit: () => void): Promise<void> {
    const overlay = document.querySelector<HTMLElement>('[data-theme-splash]');
    if (!overlay) {
      commit();
      return Promise.resolve();
    }

    const assets = preloadThemeScreenshots(next);
    overlay.setAttribute('data-mode', next);
    overlay.classList.add('is-on');
    overlay.classList.remove('is-ready');
    document.documentElement.classList.add('theme-animating');

    window.requestAnimationFrame(() => {
      overlay.classList.add('is-ready');
    });

    return fadeSplash(overlay, 0, 1, 280)
      .then(() => Promise.all([assets, wait(420)]))
      .then(() => {
        commit();
        return decodeDomScreenshots();
      })
      .then(() => wait(520))
      .then(() => fadeSplash(overlay, 1, 0, 380))
      .finally(() => {
        overlay.classList.remove('is-on', 'is-ready');
        overlay.removeAttribute('data-mode');
        document.documentElement.classList.remove('theme-animating');
        preloadThemeScreenshots(next === 'dark' ? 'light' : 'dark');
      });
  }

  let languagePref = normalizeLanguagePreference(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  let themePref = normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  let resolvedTheme = getResolvedTheme(themePref);

  function syncTheme(preference: ThemePreference, animate: boolean): void {
    const nextResolved = getResolvedTheme(preference);

    function commit(): void {
      themePref = preference;
      resolvedTheme = nextResolved;
      localStorage.setItem(THEME_STORAGE_KEY, preference);
      applyTheme(nextResolved);
      markToggle('[data-theme-toggle]', 'data-theme', preference);
      window.syncScreenshotImages?.();
    }

    if (!animate || nextResolved === resolvedTheme) {
      commit();
      preloadThemeScreenshots(nextResolved === 'dark' ? 'light' : 'dark');
      return;
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      commit();
      preloadThemeScreenshots(nextResolved === 'dark' ? 'light' : 'dark');
      return;
    }

    void runDesktopFlashTransition(nextResolved, commit);
  }

  markToggle('[data-language-toggle]', 'data-language', languagePref);
  markToggle('[data-theme-toggle]', 'data-theme', themePref);
  applyTheme(resolvedTheme);
  preloadThemeScreenshots(resolvedTheme === 'dark' ? 'light' : 'dark');

  const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const onColorSchemeChange = (): void => {
    if (themePref !== 'system') {
      return;
    }
    const nextResolved = getResolvedTheme('system');
    if (nextResolved === resolvedTheme) {
      return;
    }
    syncTheme('system', true);
  };

  if (typeof colorSchemeQuery.addEventListener === 'function') {
    colorSchemeQuery.addEventListener('change', onColorSchemeChange);
  } else if (typeof colorSchemeQuery.addListener === 'function') {
    colorSchemeQuery.addListener(onColorSchemeChange);
  }

  document.querySelectorAll('[data-language-toggle] button').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.getAttribute('data-language');
      if (next !== 'pl' && next !== 'en' && next !== 'system') {
        return;
      }
      const preference = next as LanguagePreference;
      if (preference === languagePref) {
        return;
      }

      languagePref = preference;
      localStorage.setItem(LANGUAGE_STORAGE_KEY, preference);
      markToggle('[data-language-toggle]', 'data-language', preference);

      const target = resolveLanguagePreference(preference, navigator.language);
      if (target === pageLocale) {
        return;
      }

      const href = localeHref(target, baseUrl, location.pathname);
      sessionStorage.setItem(SCROLL_STORAGE_KEY, String(window.scrollY));
      location.assign(href);
    });
  });

  document.querySelectorAll('[data-theme-toggle] button').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.getAttribute('data-theme');
      if (next !== 'light' && next !== 'dark' && next !== 'system') {
        return;
      }
      if (next === themePref) {
        return;
      }
      syncTheme(next as ThemePreference, true);
    });
  });

  const header = document.querySelector<HTMLElement>('.site-header');
  const menuToggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menuOverlay = document.querySelector<HTMLElement>('[data-menu-overlay]');
  const mobileMenu = document.getElementById('site-menu');
  const menuMq = window.matchMedia('(max-width: 900px)');

  function syncMenuA11y(open: boolean): void {
    if (!mobileMenu) {
      return;
    }
    if (menuMq.matches) {
      mobileMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
    } else {
      mobileMenu.removeAttribute('aria-hidden');
    }
  }

  let closeTimer: number | undefined;

  function syncMenuToggle(open: boolean): void {
    if (!menuToggle) {
      return;
    }
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (menuOverlay) {
      menuOverlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    syncMenuA11y(open);
    const label = menuToggle.getAttribute(open ? 'data-label-close' : 'data-label-open');
    if (label) {
      menuToggle.setAttribute('aria-label', label);
    }
  }

  function clearMenuMotionState(): void {
    window.clearTimeout(closeTimer);
    if (header) {
      header.classList.remove('is-closing', 'is-opening');
    }
    document.documentElement.classList.remove('menu-instant');
  }

  function finishMenuClose(): void {
    clearMenuMotionState();
    syncMenuToggle(false);
  }

  function setMenuOpen(open: boolean, instant = false): void {
    if (!header || !menuToggle) {
      return;
    }

    if (open) {
      clearMenuMotionState();
      header.classList.add('is-open', 'is-opening');
      document.documentElement.classList.add('menu-open');
      syncMenuToggle(true);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          header.classList.remove('is-opening');
        });
      });
      return;
    }

    if (!header.classList.contains('is-open')) {
      finishMenuClose();
      return;
    }

    header.classList.remove('is-open');
    document.documentElement.classList.remove('menu-open');

    if (instant) {
      document.documentElement.classList.add('menu-instant');
      finishMenuClose();
      window.requestAnimationFrame(() => {
        document.documentElement.classList.remove('menu-instant');
      });
      return;
    }

    header.classList.add('is-closing');
    syncMenuToggle(false);
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(finishMenuClose, 380);
  }

  if (mobileMenu) {
    mobileMenu.addEventListener('transitionend', (event) => {
      if (!header?.classList.contains('is-closing')) {
        return;
      }
      if (event.target !== mobileMenu) {
        return;
      }
      finishMenuClose();
    });
  }

  syncMenuA11y(false);

  menuToggle?.addEventListener('click', () => {
    setMenuOpen(!header?.classList.contains('is-open'));
  });

  menuOverlay?.addEventListener('click', () => {
    setMenuOpen(false);
  });

  document.querySelectorAll('.header-nav .nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      setMenuOpen(false, true);
    });
  });

  header?.querySelectorAll('.brand').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      if (header.classList.contains('is-open')) {
        setMenuOpen(false, true);
      }
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setMenuOpen(false);
    }
  });

  if (typeof menuMq.addEventListener === 'function') {
    menuMq.addEventListener('change', (event) => {
      if (!event.matches) {
        setMenuOpen(false);
      }
      syncMenuA11y(header?.classList.contains('is-open') ?? false);
    });
  } else if (typeof menuMq.addListener === 'function') {
    menuMq.addListener((event) => {
      if (!event.matches) {
        setMenuOpen(false);
      }
      syncMenuA11y(header?.classList.contains('is-open') ?? false);
    });
  }
}
