/** @vitest-environment happy-dom */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeightEntry } from '../types';
import { useWeightEntryPrefill } from './use-weight-entry-prefill';

const testLocale = vi.hoisted(() => ({ value: 'en' as 'en' | 'pl' }));

function PrefillProbe({
  entries,
  selectedDateKey = '2024-10-27',
}: {
  entries: WeightEntry[];
  selectedDateKey?: string;
}) {
  const existingEntryWeightKg = entries.find((entry) => entry.date === selectedDateKey)?.weightKg;
  const { weightInput } = useWeightEntryPrefill({
    selectedDateKey,
    units: 'metric',
    locale: testLocale.value,
    existingEntryWeightKg,
  });

  return <input readOnly aria-label="weight" value={weightInput} />;
}

const TODAY_ENTRY: WeightEntry = {
  date: '2024-10-27',
  weightKg: 80.5,
  createdAt: '2024-10-27T08:00:00.000Z',
  updatedAt: '2024-10-27T08:00:00.000Z',
};

describe('useWeightEntryPrefill', () => {
  beforeEach(() => {
    testLocale.value = 'en';
  });

  afterEach(() => {
    cleanup();
  });

  it('fills when entries arrive after mount', async () => {
    const view = render(<PrefillProbe entries={[]} />);
    expect(screen.getByLabelText('weight')).toHaveProperty('value', '');

    view.rerender(<PrefillProbe entries={[TODAY_ENTRY]} />);

    await waitFor(() => {
      expect(screen.getByLabelText('weight')).toHaveProperty('value', '80.50');
    });
  });

  it('clears when the entry for the selected date is removed', async () => {
    const view = render(<PrefillProbe entries={[TODAY_ENTRY]} />);

    await waitFor(() => {
      expect(screen.getByLabelText('weight')).toHaveProperty('value', '80.50');
    });

    view.rerender(<PrefillProbe entries={[]} />);

    await waitFor(() => {
      expect(screen.getByLabelText('weight')).toHaveProperty('value', '');
    });
  });

  it('reformats an untouched prefilled value when locale switches to Polish', async () => {
    const view = render(<PrefillProbe entries={[TODAY_ENTRY]} />);

    await waitFor(() => {
      expect(screen.getByLabelText('weight')).toHaveProperty('value', '80.50');
    });

    testLocale.value = 'pl';
    view.rerender(<PrefillProbe entries={[TODAY_ENTRY]} />);

    await waitFor(() => {
      expect(screen.getByLabelText('weight')).toHaveProperty('value', '80,50');
    });
  });
});
