import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type { AvailableAppUpdate } from '../app-update/get-available-app-update';
import { openAppUpdateDownload } from '../app-update/open-app-update-download';
import { useSharedAppUpdate } from '../context/app-update-context';
import { useConfirm } from '../context/confirm-context';
import { useSupabaseAuth } from '../context/supabase-auth-context';
import { useToast } from '../context/toast-context';
import { useTranslation } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/translation-keys';
import {
  getDismissedAppUpdateVersion,
  setDismissedAppUpdateVersion,
} from '../storage/app-update-dismissal';

const APP_UPDATE_PROMPT_DELAY_MS = 2500;

function getUpdateMessageKey(): TranslationKey {
  return Platform.OS === 'ios' ? 'update.messageIos' : 'update.messageAndroid';
}

export function AppUpdatePromptHandler() {
  const { confirm } = useConfirm();
  const { showInfo } = useToast();
  const { isAuthenticated } = useSupabaseAuth();
  const { t } = useTranslation();
  const { update, isLoading } = useSharedAppUpdate();
  const hasRunRef = useRef(false);

  // Read callbacks from a ref so the prompt is scheduled once per sign-in
  // instead of being reset when translation or dialog identity changes.
  const handlersRef = useRef({ confirm, showInfo, t });
  handlersRef.current = { confirm, showInfo, t };

  useEffect(() => {
    if (!isAuthenticated) {
      hasRunRef.current = false;
      return;
    }

    if (isLoading || !update || hasRunRef.current) {
      return;
    }

    const pendingUpdate = update;

    // Mark as run only once the dialog is actually shown. Cleanup can cancel
    // the timer (sign-out, React remounting the effect) and a later run retries.
    const timer = setTimeout(() => {
      hasRunRef.current = true;
      void showPrompt(pendingUpdate);
    }, APP_UPDATE_PROMPT_DELAY_MS);

    return () => clearTimeout(timer);

    async function showPrompt(available: AvailableAppUpdate) {
      const { confirm: confirmDialog, showInfo: showToast, t: translate } = handlersRef.current;

      // Mock mode always prompts so the flow can be retested locally.
      if (available.mode !== 'mock') {
        const dismissed = await getDismissedAppUpdateVersion();
        if (dismissed === available.latestVersion) {
          return;
        }
      }

      const confirmed = await confirmDialog({
        title: translate('update.title'),
        message: translate(getUpdateMessageKey(), {
          latest: available.latestVersion,
          current: available.currentVersion,
        }),
        confirmLabel: translate('update.download'),
        cancelLabel: translate('common.cancel'),
      });

      if (!confirmed) {
        if (available.mode !== 'mock') {
          await setDismissedAppUpdateVersion(available.latestVersion);
        }
        return;
      }

      const result = await openAppUpdateDownload();
      if (result === 'mocked') {
        showToast(translate('update.mockDownload'));
      }
    }
  }, [isAuthenticated, isLoading, update]);

  return null;
}
