import { describe, expect, it } from 'vitest';
import { getDemoModalLoadingState } from './demo-modal';

describe('getDemoModalLoadingState', () => {
  it('shows the skeleton while the demo iframe is loading', () => {
    expect(getDemoModalLoadingState(true)).toEqual({
      isLoading: true,
      ariaBusy: 'true',
      skeletonHidden: 'false',
    });
  });

  it('hides the skeleton after the demo iframe has loaded', () => {
    expect(getDemoModalLoadingState(false)).toEqual({
      isLoading: false,
      ariaBusy: 'false',
      skeletonHidden: 'true',
    });
  });
});
