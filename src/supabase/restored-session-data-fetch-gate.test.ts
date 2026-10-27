import { describe, expect, it } from 'vitest';
import { createRestoredSessionDataFetchGate } from './restored-session-data-fetch-gate';

describe('createRestoredSessionDataFetchGate', () => {
  it('tracks gated state until end is called', () => {
    const gate = createRestoredSessionDataFetchGate();
    gate.begin();
    expect(gate.isGated()).toBe(true);
    gate.end();
    expect(gate.isGated()).toBe(false);
  });
});
