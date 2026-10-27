import type { Session } from '@supabase/supabase-js';
import {
  shouldRunFailClosedSignOut,
  validateFlaggedRestoredSession,
  type FailClosedSignOutContext,
} from './bootstrap-session-validation';

export const BOOTSTRAP_SESSION_DEADLINE_MS = 6000;

export type BootstrapAuthSessionDeps = {
  getAuthEventGeneration: () => number;
  getSession: () => Promise<{ data: { session: Session | null } }>;
  restoredSessionNeedsServerValidation: () => Promise<boolean>;
  validateRestoredSessionInBackground: () => Promise<void>;
  applyBootstrapSessionIfGeneration: (bootstrapGeneration: number, session: Session | null) => void;
  setRestoredSessionValidationPending: (pending: boolean) => void;
  setLoading: (loading: boolean) => void;
  onBootstrapComplete: () => void;
  onRestoredSessionBackgroundValidationBegin: () => void;
  onRestoredSessionBackgroundValidationEnd: () => void;
  runFailClosedLocalSignOut: (context: FailClosedSignOutContext) => Promise<void>;
};

export async function runBootstrapAuthSession(deps: BootstrapAuthSessionDeps): Promise<void> {
  const bootstrapAuthGeneration = deps.getAuthEventGeneration();
  let sessionApplied = false;
  let flagged = false;
  let accessTokenAtStart: string | null = null;
  let bootstrapFinished = false;
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;

  const failClosedContext = (): FailClosedSignOutContext => ({
    bootstrapAuthGeneration,
    accessTokenAtStart,
    getAuthEventGeneration: deps.getAuthEventGeneration,
    getCurrentAccessToken: async () => {
      const { data } = await deps.getSession().catch(() => ({
        data: { session: null as Session | null },
      }));
      return data.session?.access_token ?? null;
    },
  });

  const finishLoading = () => {
    deps.setRestoredSessionValidationPending(false);
    deps.setLoading(false);
  };

  deadlineTimer = setTimeout(() => {
    if (bootstrapFinished) {
      return;
    }
    finishLoading();
    if (flagged) {
      void (async () => {
        if (await shouldRunFailClosedSignOut(failClosedContext())) {
          await deps.runFailClosedLocalSignOut(failClosedContext());
        }
      })();
      return;
    }
    if (!sessionApplied) {
      deps.applyBootstrapSessionIfGeneration(bootstrapAuthGeneration, null);
    }
  }, BOOTSTRAP_SESSION_DEADLINE_MS);

  try {
    const sessionResult = await deps.getSession().catch(() => ({
      data: { session: null as Session | null },
    }));
    const activeSession = sessionResult.data.session;
    if (!activeSession) {
      deps.applyBootstrapSessionIfGeneration(bootstrapAuthGeneration, null);
      sessionApplied = true;
      return;
    }

    accessTokenAtStart = activeSession.access_token;
    flagged = await deps.restoredSessionNeedsServerValidation();
    if (!flagged) {
      deps.onRestoredSessionBackgroundValidationBegin();
      deps.applyBootstrapSessionIfGeneration(bootstrapAuthGeneration, activeSession);
      sessionApplied = true;
      void deps.validateRestoredSessionInBackground().finally(() => {
        deps.onRestoredSessionBackgroundValidationEnd();
      });
      return;
    }

    deps.setRestoredSessionValidationPending(true);
    deps.onRestoredSessionBackgroundValidationBegin();
    try {
      await validateFlaggedRestoredSession(
        () => deps.validateRestoredSessionInBackground(),
        () => deps.runFailClosedLocalSignOut(failClosedContext()),
        () => shouldRunFailClosedSignOut(failClosedContext()),
      );
    } finally {
      deps.onRestoredSessionBackgroundValidationEnd();
    }
    const afterSession = await deps.getSession().catch(() => ({
      data: { session: null as Session | null },
    }));
    deps.applyBootstrapSessionIfGeneration(bootstrapAuthGeneration, afterSession.data.session);
    sessionApplied = true;
  } catch {
    deps.applyBootstrapSessionIfGeneration(bootstrapAuthGeneration, null);
    sessionApplied = true;
  } finally {
    bootstrapFinished = true;
    if (deadlineTimer) {
      clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }
    finishLoading();
    deps.onBootstrapComplete();
  }
}
