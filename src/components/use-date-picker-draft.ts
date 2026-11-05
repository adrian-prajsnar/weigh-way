import { useEffect, useRef, useState } from 'react';
import { RangeSelection } from './date-range-selection';

type DraftOptions = {
  visible: boolean;
  initialKey: string;
  startKey: string | null;
  endKey: string | null;
};

export function useDatePickerDraft({ visible, initialKey, startKey, endKey }: DraftOptions) {
  const wasVisible = useRef(false);
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const [range, setRange] = useState<RangeSelection>({
    start: startKey,
    end: endKey,
    active: 'start',
  });
  const [panel, setPanel] = useState<'day' | 'month' | 'year'>('day');

  useEffect(() => {
    const opening = visible && !wasVisible.current;
    wasVisible.current = visible;
    // Applying can update the parent's value before its async confirmation closes the dialog.
    if (opening) {
      setSelectedKey(initialKey);
      setRange({ start: startKey, end: endKey, active: 'start' });
      setPanel('day');
    }
  }, [visible, initialKey, startKey, endKey]);

  return { selectedKey, setSelectedKey, range, setRange, panel, setPanel };
}
