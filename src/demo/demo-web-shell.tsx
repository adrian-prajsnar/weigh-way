import { ReactNode, useEffect } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLanguage } from '../i18n/language-context';
import { pxToRem } from '../theme/css-rem';
import { DemoViewportProvider } from './demo-viewport-context';
import { DEMO_PHONE_CORNER_RADIUS, getDemoFrameSize, shouldUseDemoPhoneFrame } from './demo-viewport';
import { isDemoEmbedded } from './is-demo-embedded';
import { isDemoMode } from './is-demo-mode';

const DEMO_CANVAS_COLOR = '#111318';
const DEMO_WEB_STYLE_ID = 'weigh-way-demo-web';

function useDemoWebDocumentStyles(active: boolean, embedded: boolean) {
  useEffect(() => {
    if (!active || Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyMargin = body.style.margin;
    const previousBodyBackground = body.style.backgroundColor;
    const previousBodyOverscroll = body.style.overscrollBehavior;
    const previousHtmlHeight = html.style.height;
    const previousBodyHeight = body.style.height;

    html.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.overflow = 'hidden';
    body.style.height = '100%';
    body.style.margin = '0';
    body.style.overscrollBehavior = 'none';

    if (!embedded) {
      body.style.backgroundColor = DEMO_CANVAS_COLOR;
    }

    const style = document.createElement('style');
    style.id = DEMO_WEB_STYLE_ID;
    style.textContent = `
      html {
        font-size: 100%;
      }
      #root {
        display: flex;
        height: 100%;
        overflow: hidden;
      }
      * {
        scrollbar-width: none;
      }
      *::-webkit-scrollbar {
        display: none;
      }
    `;
    document.head.appendChild(style);

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.height = previousHtmlHeight;
      body.style.overflow = previousBodyOverflow;
      body.style.height = previousBodyHeight;
      body.style.margin = previousBodyMargin;
      body.style.backgroundColor = previousBodyBackground;
      body.style.overscrollBehavior = previousBodyOverscroll;
      document.getElementById(DEMO_WEB_STYLE_ID)?.remove();
    };
  }, [active, embedded]);
}

export function DemoWebShell({ children }: { children: ReactNode }) {
  const demoWeb = Platform.OS === 'web' && isDemoMode();
  const embedded = demoWeb && isDemoEmbedded();
  const { locale } = useLanguage();
  const window = useWindowDimensions();
  useDemoWebDocumentStyles(demoWeb, embedded);

  useEffect(() => {
    if (!demoWeb) return;
    document.documentElement.lang = locale;
  }, [demoWeb, locale]);

  if (!demoWeb) {
    return <>{children}</>;
  }

  const usePhoneFrame = !embedded && shouldUseDemoPhoneFrame(window.width);
  const viewport = usePhoneFrame ? getDemoFrameSize(window.width, window.height) : window;

  return (
    <View style={[styles.root, usePhoneFrame && styles.canvas]}>
      <View
        style={
          usePhoneFrame
            ? [styles.phone, { width: viewport.width, height: viewport.height }]
            : styles.root
        }
      >
        <DemoViewportProvider width={viewport.width} height={viewport.height}>
          <View style={styles.app}>{children}</View>
        </DemoViewportProvider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DEMO_CANVAS_COLOR,
    overflow: 'hidden',
  },
  phone: {
    overflow: 'hidden',
    borderRadius: DEMO_PHONE_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#000000',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: `0 ${pxToRem(24)} ${pxToRem(80)} rgba(0, 0, 0, 0.45)`,
        }
      : null),
  },
  app: {
    flex: 1,
    overflow: 'hidden',
  },
});
