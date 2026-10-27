import { useCallback, useEffect, useState } from 'react';
import {
  DashboardAlertId,
  dismissDashboardAlerts,
  getDismissedDashboardAlerts,
} from '../storage/dashboard-alert-dismissals';

export function useDashboardAlertDismissals() {
  const [dismissed, setDismissed] = useState<DashboardAlertId[] | null>(null);

  useEffect(() => {
    void getDismissedDashboardAlerts()
      .then(setDismissed)
      .catch(() => setDismissed([]));
  }, []);

  const isDismissed = useCallback(
    (id: DashboardAlertId) => dismissed?.includes(id) ?? false,
    [dismissed],
  );

  const dismiss = useCallback(async (ids: DashboardAlertId | DashboardAlertId[]) => {
    const list = Array.isArray(ids) ? ids : [ids];
    await dismissDashboardAlerts(list);
    setDismissed((current) => {
      const next = [...(current ?? [])];
      for (const id of list) {
        if (!next.includes(id)) {
          next.push(id);
        }
      }
      return next;
    });
  }, []);

  return {
    isReady: dismissed !== null,
    isDismissed,
    dismiss,
  };
}
