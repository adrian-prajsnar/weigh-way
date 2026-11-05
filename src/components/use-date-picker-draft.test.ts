/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDatePickerDraft } from './use-date-picker-draft';

afterEach(cleanup);

const initial = {
  visible: true,
  initialKey: '2026-01-01',
  startKey: '2026-01-01',
  endKey: '2026-01-31',
};

describe('useDatePickerDraft', () => {
  it('preserves the end month and active endpoint when Apply updates the parent before closing', () => {
    const { result, rerender } = renderHook(useDatePickerDraft, { initialProps: initial });
    act(() => {
      result.current.setSelectedKey('2026-03-20');
      result.current.setRange({ start: '2026-02-01', end: '2026-03-20', active: 'end' });
    });

    rerender({
      ...initial,
      initialKey: '2026-02-01',
      startKey: '2026-02-01',
      endKey: '2026-03-20',
    });

    expect(result.current.selectedKey).toBe('2026-03-20');
    expect(result.current.range).toEqual({ start: '2026-02-01', end: '2026-03-20', active: 'end' });
  });

  it('discards unfinished selections on cancel and starts a fresh draft on reopening', () => {
    const { result, rerender } = renderHook(useDatePickerDraft, { initialProps: initial });
    act(() => {
      result.current.setSelectedKey('2025-12-01');
      result.current.setRange({ start: '2025-12-01', end: null, active: 'end' });
      result.current.setPanel('year');
    });
    rerender({ ...initial, visible: false });
    rerender(initial);

    expect(result.current.selectedKey).toBe(initial.initialKey);
    expect(result.current.range).toEqual({
      start: initial.startKey,
      end: initial.endKey,
      active: 'start',
    });
    expect(result.current.panel).toBe('day');
  });

  it('uses the latest saved values after closing and reopening', () => {
    const { result, rerender } = renderHook(useDatePickerDraft, { initialProps: initial });
    const saved = {
      ...initial,
      initialKey: '2026-02-01',
      startKey: '2026-02-01',
      endKey: '2026-03-20',
    };
    rerender({ ...saved, visible: false });
    rerender(saved);

    expect(result.current.selectedKey).toBe(saved.initialKey);
    expect(result.current.range).toEqual({
      start: saved.startKey,
      end: saved.endKey,
      active: 'start',
    });
  });
});
