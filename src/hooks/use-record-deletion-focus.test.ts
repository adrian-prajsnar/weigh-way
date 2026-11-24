/** @vitest-environment happy-dom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useRecordDeletionFocus } from './use-record-deletion-focus';

vi.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));

const deletedDate = '2026-01-02';
const neighborDate = '2026-01-01';

function addButton() {
  const button = document.createElement('button');
  document.body.append(button);
  return button;
}

afterEach(() => document.body.replaceChildren());

it('focuses the adjacent edit action while the deletion refresh is still pending', async () => {
  const opener = addButton();
  const neighbor = addButton();
  const fallback = addButton();
  const editButtons = { current: new Map([[neighborDate, neighbor]]) };
  const initialProps: { dates: string[]; deletingDate: string | null } = {
    dates: [deletedDate, neighborDate],
    deletingDate: null,
  };
  const { result, rerender } = renderHook(
    ({ dates, deletingDate }) =>
      useRecordDeletionFocus(dates, deletingDate, editButtons, { current: fallback }),
    { initialProps },
  );

  opener.focus();
  const { promise: refresh, resolve: finishRefresh } = Promise.withResolvers<void>();
  let deletion: Promise<void>;
  act(() => {
    deletion = result.current.deleteRecord(opener, deletedDate, () => refresh);
  });
  rerender({ dates: [deletedDate, neighborDate], deletingDate: deletedDate });
  expect(result.current.canEdit).toBe(false);
  expect(document.activeElement).toBe(opener);

  opener.remove();
  rerender({ dates: [neighborDate], deletingDate: deletedDate });
  expect(result.current.canEdit).toBe(true);
  expect(document.activeElement).toBe(neighbor);

  fallback.focus();
  await act(async () => {
    finishRefresh();
    await deletion;
  });
  expect(document.activeElement).toBe(fallback);
});
