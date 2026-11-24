import { mediaMaxWidthRem } from './css-length';
import {
  prefersDarkColorScheme,
  readThemePreference,
  resolveThemePreference,
  saveThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '../lib/site-preferences';

declare global {
  interface Window {
    syncScreenshotImages?: () => void;
  }
}

export function initSiteHeader(): void {
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

  let themePref = readThemePreference();
  let resolvedTheme = getResolvedTheme(themePref);

  function syncTheme(preference: ThemePreference): void {
    themePref = preference;
    resolvedTheme = getResolvedTheme(preference);
    applyTheme(resolvedTheme);
    markToggle('[data-theme-toggle]', 'data-theme', preference);
    window.syncScreenshotImages?.();
  }

  markToggle('[data-theme-toggle]', 'data-theme', themePref);
  applyTheme(resolvedTheme);

  const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const onColorSchemeChange = (): void => {
    if (themePref !== 'system') {
      return;
    }
    const nextResolved = getResolvedTheme('system');
    if (nextResolved === resolvedTheme) {
      return;
    }
    syncTheme('system');
  };

  if (typeof colorSchemeQuery.addEventListener === 'function') {
    colorSchemeQuery.addEventListener('change', onColorSchemeChange);
  } else if (typeof colorSchemeQuery.addListener === 'function') {
    colorSchemeQuery.addListener(onColorSchemeChange);
  }

  document.querySelectorAll('[data-theme-toggle] button').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.getAttribute('data-theme');
      if (next !== 'light' && next !== 'dark' && next !== 'system') {
        return;
      }
      if (next === themePref) {
        return;
      }
      syncTheme(next);
      saveThemePreference(next);
    });
  });

  const header = document.querySelector<HTMLElement>('.site-header');
  const menuToggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menuOverlay = document.querySelector<HTMLElement>('[data-menu-overlay]');
  const mobileMenu = document.getElementById('site-menu');
  const menuMq = window.matchMedia(mediaMaxWidthRem(900));

  function syncMenuA11y(open: boolean): void {
    if (!mobileMenu) {
      return;
    }
    if (menuMq.matches) {
      mobileMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
    } else {
      mobileMenu.removeAttribute('aria-hidden');
    }
    // Closing animates the panel out after it has left the keyboard order.
    mobileMenu.inert = menuMq.matches && !open;
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

    if (menuMq.matches && mobileMenu?.contains(document.activeElement)) menuToggle.focus();
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

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && header?.classList.contains('is-open')) {
      setMenuOpen(false);
    }
  });

  document.addEventListener('focusin', (event) => {
    if (header?.matches('.is-open, .is-closing') && event.target instanceof Node && !header.contains(event.target)) {
      setMenuOpen(false, true);
    }
  });

  function onMenuViewportChange(event: MediaQueryListEvent): void {
    if (event.matches) {
      if (mobileMenu?.contains(document.activeElement)) {
        menuToggle?.focus();
      }
    } else {
      if (document.activeElement === menuToggle) {
        header?.querySelector<HTMLAnchorElement>('.brand')?.focus();
      }
      setMenuOpen(false, true);
    }
    syncMenuA11y(header?.classList.contains('is-open') ?? false);
  }

  if (typeof menuMq.addEventListener === 'function') {
    menuMq.addEventListener('change', onMenuViewportChange);
  } else if (typeof menuMq.addListener === 'function') {
    menuMq.addListener(onMenuViewportChange);
  }
}
