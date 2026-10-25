import { reportUnhandled } from '../report-error';

/** Default PostgREST page size (see `max_rows` in `supabase/config.toml`). */
export const POSTGREST_PAGE_SIZE = 1000;

/** Guards against runaway paging if the API misbehaves. */
export const MAX_FETCH_PAGES = 200;

export class FetchAllRowsLimitError extends Error {
  constructor() {
    super('fetch_all_rows_limit_exceeded');
    this.name = 'FetchAllRowsLimitError';
  }
}

export async function fetchAllRows<T>(
  fetchPage: (limit: number, after: T | null) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  let after: T | null = null;
  let pageCount = 0;

  while (pageCount < MAX_FETCH_PAGES) {
    const page = await fetchPage(POSTGREST_PAGE_SIZE, after);
    if (page.length === 0) {
      break;
    }

    rows.push(...page);
    after = page[page.length - 1] ?? null;
    pageCount += 1;
  }

  if (pageCount >= MAX_FETCH_PAGES) {
    const probe = await fetchPage(POSTGREST_PAGE_SIZE, after);
    if (probe.length > 0) {
      const limitError = new FetchAllRowsLimitError();
      reportUnhandled(limitError);
      throw limitError;
    }
  }

  return rows;
}
