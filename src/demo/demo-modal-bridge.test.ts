import { describe, expect, it } from 'vitest';
import { DEMO_MODAL_MESSAGE_SOURCE, isDemoModalDragMessage } from './demo-modal-bridge';

describe('isDemoModalDragMessage', () => {
  it('accepts drag updates from the embedded demo', () => {
    expect(
      isDemoModalDragMessage({ source: DEMO_MODAL_MESSAGE_SOURCE, type: 'drag', x: 12, y: 40 }),
    ).toBe(true);
    expect(isDemoModalDragMessage({ source: DEMO_MODAL_MESSAGE_SOURCE, type: 'drag-end' })).toBe(true);
  });

  it('rejects unrelated messages', () => {
    expect(isDemoModalDragMessage({ source: 'other', type: 'drag', x: 1, y: 2 })).toBe(false);
    expect(isDemoModalDragMessage(null)).toBe(false);
  });
});
