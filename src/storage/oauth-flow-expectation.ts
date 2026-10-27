import AsyncStorage from '@react-native-async-storage/async-storage';

const OAUTH_FLOW_EXPECTATION_KEY = '@weigh-way/oauth-flow-expectation';

export const OAUTH_FLOW_EXPECTATION_TTL_MS = 15 * 60 * 1000;

type StoredOAuthFlowExpectation = {
  flowId: string | null;
  expiresAt: number;
};

export async function persistOAuthFlowExpectation(
  flowId: string | null | undefined,
  expiresAt: number,
): Promise<void> {
  const payload: StoredOAuthFlowExpectation = {
    flowId: flowId ?? null,
    expiresAt,
  };
  try {
    await AsyncStorage.setItem(OAUTH_FLOW_EXPECTATION_KEY, JSON.stringify(payload));
  } catch {
    // Blocked storage must not break OAuth sign-in.
  }
}

export async function readOAuthFlowExpectation(): Promise<StoredOAuthFlowExpectation | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(OAUTH_FLOW_EXPECTATION_KEY);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredOAuthFlowExpectation;
    if (!Number.isFinite(parsed.expiresAt)) {
      await clearOAuthFlowExpectationStorage();
      return null;
    }
    if (Date.now() > parsed.expiresAt) {
      await clearOAuthFlowExpectationStorage();
      return null;
    }
    return parsed;
  } catch {
    await clearOAuthFlowExpectationStorage();
    return null;
  }
}

export async function clearOAuthFlowExpectationStorage(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OAUTH_FLOW_EXPECTATION_KEY);
  } catch {
    // Best-effort when storage is blocked.
  }
}
