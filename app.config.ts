import { createRequire } from 'node:module';
import { ExpoConfig, ConfigContext } from 'expo/config';

const require = createRequire(import.meta.url);
const { shouldDisableSentryAutoUpload } = require('./scripts/sentry-build-upload.cjs');

const SPLASH_BACKGROUND = '#F6F7F9';

function requireSupabasePublicEnv(): void {
  if (process.env.EAS_BUILD !== 'true') {
    return;
  }

  const missing = [
    !process.env.EXPO_PUBLIC_SUPABASE_URL && 'EXPO_PUBLIC_SUPABASE_URL',
    !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY && 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `EAS Build requires: ${missing.join(', ')}. From your project root run: npx eas-cli env:push --environment production --path .env`,
    );
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  requireSupabasePublicEnv();

  return {
    ...config,
    ...(process.env.EXPO_PUBLIC_DEMO === 'true'
      ? {
          experiments: {
            ...config.experiments,
            baseUrl: '/weigh-way/demo',
          },
        }
      : {}),
    plugins: [
      ...(config.plugins ?? []),
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic:
              process.env.EXPO_PUBLIC_SUPABASE_URL?.startsWith('http://') === true,
          },
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: SPLASH_BACKGROUND,
        },
      ],
      'expo-web-browser',
      [
        '@sentry/react-native',
        {
          organization: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          disableAutoUpload: shouldDisableSentryAutoUpload(),
        },
      ],
    ],
    ios: {
      ...config.ios,
      buildNumber: '7',
    },
    android: {
      ...config.android,
      versionCode: 7,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: false,
          data: [
            {
              scheme: 'weigh-way',
              host: 'auth',
              pathPrefix: '/callback',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  } as ExpoConfig;
};
