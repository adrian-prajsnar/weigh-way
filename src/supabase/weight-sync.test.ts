import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POSTGREST_PAGE_SIZE } from './fetch-all-rows';

const supabaseFrom = vi.hoisted(() => vi.fn());
const getUserId = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  supabase: {
    from: supabaseFrom,
  },
}));

vi.mock('./auth-user', () => ({
  getUserId,
}));

vi.mock('./with-auth-retry', () => ({
  withAuthRetry: (operation: () => Promise<unknown>) => operation(),
}));

// eslint-disable-next-line import/first -- load after vi.mock
import { getEntries } from './weight-sync';

type WeightRow = {
  entry_date: string;
  weight_kg: number;
  created_at: string;
  updated_at: string;
};

function entryDateForIndex(index: number): string {
  const date = new Date('2020-01-01T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
}

function buildPage(startIndex: number, count: number): WeightRow[] {
  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset;
    const entry_date = entryDateForIndex(index);
    return {
      entry_date,
      weight_kg: 70,
      created_at: `${entry_date}T00:00:00.000Z`,
      updated_at: `${entry_date}T00:00:00.000Z`,
    };
  });
}

function mockWeightQuery(pages: WeightRow[][]) {
  let callIndex = 0;
  const chain: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  } = {} as never;

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.lt = vi.fn(() => chain);
  chain.limit = vi.fn(async () => {
    const data = pages[callIndex] ?? [];
    callIndex += 1;
    return { data, error: null };
  });

  supabaseFrom.mockReturnValue(chain);
  return chain;
}

describe('getEntries', () => {
  beforeEach(() => {
    getUserId.mockResolvedValue('user-1');
    supabaseFrom.mockReset();
  });

  it('loads more than POSTGREST_PAGE_SIZE rows across keyset pages', async () => {
    const page1 = buildPage(0, POSTGREST_PAGE_SIZE);
    const page2 = buildPage(POSTGREST_PAGE_SIZE, 100);

    const { lt, limit } = mockWeightQuery([page1, page2, []]);

    const entries = await getEntries();

    expect(entries).toHaveLength(POSTGREST_PAGE_SIZE + 100);
    expect(limit).toHaveBeenCalledTimes(2);
    expect(lt).toHaveBeenCalledTimes(1);
    expect(lt).toHaveBeenCalledWith('entry_date', page1[page1.length - 1]!.entry_date);
  });

  it('surfaces errors from a later page', async () => {
    const page1 = buildPage(0, POSTGREST_PAGE_SIZE);
    let callIndex = 0;
    const chain: {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      lt: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
    } = {} as never;
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.lt = vi.fn(() => chain);
    chain.limit = vi.fn(async () => {
      callIndex += 1;
      if (callIndex === 2) {
        return { data: null, error: { message: 'db unavailable' } };
      }
      return { data: page1, error: null };
    });
    supabaseFrom.mockReturnValue(chain);

    await expect(getEntries()).rejects.toMatchObject({ message: 'db unavailable' });
  });
});
