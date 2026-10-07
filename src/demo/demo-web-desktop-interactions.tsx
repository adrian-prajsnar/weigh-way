import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTheme } from '../theme/theme-context';
import { buildDemoWebDesktopCss, DEMO_WEB_DESKTOP_STYLE_ID } from './demo-web-desktop-styles';
import { bindDemoWebEmbeddedScroll, markDemoEmbeddedDocument } from './demo-web-embedded-scroll';
import { isDemoEmbedded } from './is-demo-embedded';
import { isDemoMode } from './is-demo-mode';

/** Desktop-only hover, focus, grab cursor, and drag-scroll for the exported web demo. */
export function DemoWebDesktopInteractions() {
  const { colors } = useTheme();
  const active = Platform.OS === 'web' && isDemoMode();
  const embedded = active && isDemoEmbedded();

  useEffect(() => {
    if (!active || typeof document === 'undefined') {
      return;
    }

    let style = document.getElementById(DEMO_WEB_DESKTOP_STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = DEMO_WEB_DESKTOP_STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = buildDemoWebDesktopCss(colors, embedded);

    return () => {
      document.getElementById(DEMO_WEB_DESKTOP_STYLE_ID)?.remove();
    };
  }, [active, colors, embedded]);

  useEffect(() => {
    if (!embedded || typeof document === 'undefined') {
      return;
    }

    const clearEmbeddedClass = markDemoEmbeddedDocument();
    const unbindScroll = bindDemoWebEmbeddedScroll();

    return () => {
      unbindScroll();
      clearEmbeddedClass();
    };
  }, [embedded]);

  return null;
}
