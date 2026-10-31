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

// eslint-disable-next-line import/first -- load after vi.mock
import { getHeightEntries } from './height-sync';

type HeightRow = {
  effective_date: string;
  height_cm: number;
};

function effectiveDateForIndex(index: number): string {
  const date = new Date('2018-06-01T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
}

function buildPage(startIndex: number, count: number): HeightRow[] {
  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset;
    const effective_date = effectiveDateForIndex(index);
    return {
      effective_date,
      height_cm: 175,
    };
  });
}

describe('getHeightEntries', () => {
  beforeEach(() => {
    getUserId.mockResolvedValue('user-1');
    supabaseFrom.mockReset();
  });

  it('loads height rows across keyset pages', async () => {
    const page1 = buildPage(0, POSTGREST_PAGE_SIZE);
    const page2 = buildPage(POSTGREST_PAGE_SIZE, 50);
    let callIndex = 0;
    const pages = [page1, page2, []];
    const lt = vi.fn().mockReturnThis();
    const limit = vi.fn().mockImplementation(async () => {
      const data = pages[callIndex] ?? [];
      callIndex += 1;
      return { data, error: null };
    });

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
    chain.lt = lt.mockImplementation(() => chain);
    chain.limit = limit;
    supabaseFrom.mockReturnValue(chain);

    const entries = await getHeightEntries();

    expect(entries).toHaveLength(POSTGREST_PAGE_SIZE + 50);
    expect(lt).toHaveBeenCalledWith('effective_date', page1[page1.length - 1]!.effective_date);
  });
});
