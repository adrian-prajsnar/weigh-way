/** @vitest-environment happy-dom */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../storage/dashboard-alert-dismissals', () => ({
  getDismissedDashboardAlerts: vi.fn(),
  dismissDashboardAlerts: vi.fn(),
}));

/* eslint-disable import/first -- after vi.mock */
import { getDismissedDashboardAlerts } from '../storage/dashboard-alert-dismissals';
import { useDashboardAlertDismissals } from './use-dashboard-alert-dismissals';
/* eslint-enable import/first */

function ReadinessProbe() {
  const { isReady, isDismissed } = useDashboardAlertDismissals();
  return (
    <div>
      <span data-testid="ready">{isReady ? 'yes' : 'no'}</span>
      <span data-testid="profile-banner">{isDismissed('missingProfile') ? 'hidden' : 'show'}</span>
    </div>
  );
}

describe('useDashboardAlertDismissals', () => {
  it('marks ready with nothing dismissed when storage read rejects', async () => {
    vi.mocked(getDismissedDashboardAlerts).mockRejectedValueOnce(
      new DOMException('The operation is insecure.', 'SecurityError'),
    );

    render(<ReadinessProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('yes');
    });
    expect(screen.getByTestId('profile-banner').textContent).toBe('show');
  });
});
