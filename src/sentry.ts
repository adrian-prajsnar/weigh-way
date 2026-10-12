import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { isDemoMode } from './demo/is-demo-mode';
import { registerErrorReporter } from './report-error';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

export function isErrorReportingEnabled(): boolean {
  return Boolean(dsn) && !__DEV__ && !isDemoMode();
}

export function initErrorReporting(): void {
  if (!isErrorReportingEnabled() || !dsn) {
    registerErrorReporter(null);
    return;
  }

  const version = Constants.expoConfig?.version ?? 'unknown';

  Sentry.init({
    dsn,
    enabled: true,
    release: `weigh-way@${version}`,
    environment: 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
      }
      delete event.extra;
      if (event.user) {
        event.user = {};
      }
      return event;
    },
  });

  Sentry.setTag('app_version', version);

  registerErrorReporter({
    captureException(error) {
      const exception = error instanceof Error ? error : new Error('Unhandled error');
      Sentry.captureException(exception);
    },
    captureMessage(message, extra) {
      Sentry.captureMessage(message, {
        level: 'error',
        tags: extra?.tags,
      });
    },
  });
}

export function wrapRoot<T>(component: T): T {
  if (!isErrorReportingEnabled()) {
    return component;
  }
  return Sentry.wrap(component as never) as T;
}
