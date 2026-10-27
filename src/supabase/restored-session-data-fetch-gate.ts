export const RESTORED_SESSION_DATA_FETCH_CAP_MS = 1500;

export type RestoredSessionDataFetchGate = {
  begin: () => void;
  end: () => void;
  isGated: () => boolean;
};

/** Tracks whether protected data fetches should wait for restored-session validation. */
export function createRestoredSessionDataFetchGate(): RestoredSessionDataFetchGate {
  let gated = false;

  return {
    begin() {
      gated = true;
    },
    end() {
      gated = false;
    },
    isGated() {
      return gated;
    },
  };
}
