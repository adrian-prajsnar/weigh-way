import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';

import { configureAppNetInfo } from './src/network/connectivity';
import App from './app';

configureAppNetInfo();

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden in development reloads.
});

registerRootComponent(App);
