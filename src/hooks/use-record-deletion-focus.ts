import { useIsFocused } from '@react-navigation/native';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Platform } from 'react-native';

type FocusTarget = { focus: () => void };

export function useRecordDeletionFocus(
  dates: string[],
  deletingDate: string | null,
  editButtons: RefObject<ReadonlyMap<string, FocusTarget>>,
  fallback: RefObject<FocusTarget | null>,
) {
  const isFocused = useIsFocused();
  const deleting = useRef(false);
  const handledFocus = useRef(false);
  const [request, setRequest] = useState<{
    date: string;
    index: number;
    opener: Element | null;
    finished: boolean;
  } | null>(null);
  const recordRemoved = request !== null && !dates.includes(request.date);

  useLayoutEffect(() => {
    if (!request) return;
    if (request.finished) setRequest(null);
    if (handledFocus.current || (!recordRemoved && !request.finished)) return;
    handledFocus.current = true;

    const active = document.activeElement;
    if (!isFocused || (active !== document.body && active !== request.opener)) return;

    if (!recordRemoved) {
      if (active === document.body && request.opener instanceof HTMLElement) {
        request.opener.focus();
      }
      return;
    }

    const neighbor = dates[Math.min(request.index, dates.length - 1)];
    (editButtons.current.get(neighbor) ?? fallback.current)?.focus();
  }, [dates, editButtons, fallback, isFocused, recordRemoved, request]);

  const deleteRecord = async (
    opener: unknown,
    date: string,
    onDelete: (date: string) => Promise<void>,
  ) => {
    if (Platform.OS !== 'web') {
      await onDelete(date);
      return;
    }
    if (deleting.current) return;
    deleting.current = true;
    handledFocus.current = false;
    const request = {
      date,
      index: dates.indexOf(date),
      opener: opener instanceof HTMLElement ? opener : document.activeElement,
    };
    setRequest({ ...request, finished: false });
    try {
      await onDelete(date);
    } finally {
      deleting.current = false;
      setRequest({ ...request, finished: true });
    }
  };

  // As soon as the row is removed, Edit can receive focus even if the refresh is still running.
  const canEdit = deletingDate === null || (recordRemoved && request.date === deletingDate);
  return { deleteRecord, canEdit };
}
