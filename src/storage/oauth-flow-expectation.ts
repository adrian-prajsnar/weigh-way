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
  await AsyncStorage.setItem(OAUTH_FLOW_EXPECTATION_KEY, JSON.stringify(payload));
}

export async function readOAuthFlowExpectation(): Promise<StoredOAuthFlowExpectation | null> {
  const raw = await AsyncStorage.getItem(OAUTH_FLOW_EXPECTATION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredOAuthFlowExpectation;
    if (!Number.isFinite(parsed.expiresAt)) {
      await AsyncStorage.removeItem(OAUTH_FLOW_EXPECTATION_KEY);
      return null;
    }
    if (Date.now() > parsed.expiresAt) {
      await AsyncStorage.removeItem(OAUTH_FLOW_EXPECTATION_KEY);
      return null;
    }
    return parsed;
  } catch {
    await AsyncStorage.removeItem(OAUTH_FLOW_EXPECTATION_KEY);
    return null;
  }
}

export async function clearOAuthFlowExpectationStorage(): Promise<void> {
  await AsyncStorage.removeItem(OAUTH_FLOW_EXPECTATION_KEY);
}
