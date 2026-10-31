import { WeightEntry } from '../types';
import { getUserId } from './auth-user';
import { supabase } from './client';
import { fetchAllRows } from './fetch-all-rows';

type WeightEntryRow = {
  entry_date: string;
  weight_kg: number;
  created_at: string;
  updated_at: string;
};

function mapRow(row: WeightEntryRow): WeightEntry {
  return {
    date: row.entry_date,
    weightKg: Number(row.weight_kg),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getEntries(): Promise<WeightEntry[]> {
  const userId = await getUserId();
  const rows = await fetchAllRows<WeightEntryRow>(async (limit, after) => {
    let query = supabase
      .from('weight_entries')
      .select('entry_date, weight_kg, created_at, updated_at')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false });

    if (after) {
      query = query.lt('entry_date', after.entry_date);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      throw error;
    }

    return data ?? [];
  });

  return rows.map(mapRow);
}

export async function saveEntry(date: string, weightKg: number): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase.from('weight_entries').upsert(
    {
      user_id: userId,
      entry_date: date,
      weight_kg: weightKg,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,entry_date' },
  );

  if (error) {
    throw error;
  }
}

export async function deleteEntry(date: string): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from('weight_entries')
    .delete()
    .eq('user_id', userId)
    .eq('entry_date', date);

  if (error) {
    throw error;
  }
}
