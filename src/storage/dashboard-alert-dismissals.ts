import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@weigh-way/dashboard-alert-dismissals';

export type DashboardAlertId =
  | 'missingBirthDate'
  | 'missingHeight'
  | 'missingSex'
  | 'missingProfile';

const VALID_IDS: DashboardAlertId[] = [
  'missingBirthDate',
  'missingHeight',
  'missingSex',
  'missingProfile',
];

function isDashboardAlertId(value: string): value is DashboardAlertId {
  return VALID_IDS.includes(value as DashboardAlertId);
}

export async function getDismissedDashboardAlerts(): Promise<DashboardAlertId[]> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is DashboardAlertId => typeof item === 'string' && isDashboardAlertId(item));
  } catch {
    return [];
  }
}

export async function dismissDashboardAlerts(ids: DashboardAlertId[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const dismissed = await getDismissedDashboardAlerts();
  const next = [...dismissed];
  for (const id of ids) {
    if (!next.includes(id)) {
      next.push(id);
    }
  }

  if (next.length === dismissed.length) {
    return;
  }

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort when storage is blocked.
  }
}

export async function dismissDashboardAlert(id: DashboardAlertId): Promise<void> {
  await dismissDashboardAlerts([id]);
}
