import { describe, expect, it, vi } from 'vitest';
import {
  FetchAllRowsLimitError,
  fetchAllRows,
  MAX_FETCH_PAGES,
  POSTGREST_PAGE_SIZE,
} from './fetch-all-rows';

describe('fetchAllRows', () => {
  it('stops after a short page without requesting another page', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, index) => ({ id: index })));

    const rows = await fetchAllRows(fetchPage);

    expect(rows).toHaveLength(500);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(POSTGREST_PAGE_SIZE, null);
  });

  it('throws when the page cap is reached with a full last page', async () => {
    const fullPage = Array.from({ length: POSTGREST_PAGE_SIZE }, (_, index) => ({ id: index }));
    const fetchPage = vi.fn().mockResolvedValue(fullPage);

    await expect(fetchAllRows(fetchPage)).rejects.toBeInstanceOf(FetchAllRowsLimitError);
    expect(fetchPage).toHaveBeenCalledTimes(MAX_FETCH_PAGES);
  });

  it('propagates errors from a page fetch', async () => {
    const fullPage = Array.from({ length: POSTGREST_PAGE_SIZE }, (_, index) => ({ id: index }));
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(fullPage)
      .mockRejectedValueOnce(new Error('network down'));

    await expect(fetchAllRows(fetchPage)).rejects.toThrow('network down');
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});
