import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportUnhandled } from '../report-error';
import {
  FetchAllRowsLimitError,
  fetchAllRows,
  MAX_FETCH_PAGES,
  POSTGREST_PAGE_SIZE,
} from './fetch-all-rows';

vi.mock('../report-error', () => ({
  reportUnhandled: vi.fn(),
}));

describe('fetchAllRows', () => {
  beforeEach(() => {
    vi.mocked(reportUnhandled).mockClear();
  });

  it('stops only on an empty page', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, index) => ({ id: index })))
      .mockResolvedValueOnce([]);

    const rows = await fetchAllRows(fetchPage);

    expect(rows).toHaveLength(500);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(2, POSTGREST_PAGE_SIZE, { id: 499 });
  });

  it('reports to Sentry when more data exists beyond the page cap', async () => {
    const fullPage = Array.from({ length: POSTGREST_PAGE_SIZE }, (_, index) => ({ id: index }));
    const fetchPage = vi.fn();
    for (let index = 0; index < MAX_FETCH_PAGES; index += 1) {
      fetchPage.mockResolvedValueOnce(fullPage);
    }
    fetchPage.mockResolvedValueOnce(fullPage);

    const rows = await fetchAllRows(fetchPage);
    expect(rows).toHaveLength(POSTGREST_PAGE_SIZE * MAX_FETCH_PAGES);
    expect(reportUnhandled).toHaveBeenCalledWith(expect.any(FetchAllRowsLimitError));
  });

  it('does not report when data ends exactly on a full final page', async () => {
    const fullPage = Array.from({ length: POSTGREST_PAGE_SIZE }, (_, index) => ({ id: index }));
    const fetchPage = vi.fn();

    for (let index = 0; index < MAX_FETCH_PAGES; index += 1) {
      fetchPage.mockResolvedValueOnce(fullPage);
    }
    fetchPage.mockResolvedValueOnce([]);

    const rows = await fetchAllRows(fetchPage);
    expect(rows).toHaveLength(POSTGREST_PAGE_SIZE * MAX_FETCH_PAGES);
    expect(reportUnhandled).not.toHaveBeenCalled();
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
