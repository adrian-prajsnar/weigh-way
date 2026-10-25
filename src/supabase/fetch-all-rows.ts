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
  let lastPageLength = 0;

  while (pageCount < MAX_FETCH_PAGES) {
    const page = await fetchPage(POSTGREST_PAGE_SIZE, after);
    lastPageLength = page.length;
    if (page.length === 0) {
      break;
    }

    rows.push(...page);
    after = page[page.length - 1] ?? null;
    pageCount += 1;

    if (page.length < POSTGREST_PAGE_SIZE) {
      break;
    }
  }

  if (pageCount >= MAX_FETCH_PAGES && lastPageLength >= POSTGREST_PAGE_SIZE) {
    throw new FetchAllRowsLimitError();
  }

  return rows;
}
