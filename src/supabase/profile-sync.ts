import { getUserId } from './auth-user';
import { supabase } from './client';
import { BiologicalSex } from '../types';

type UserProfileRow = {
  birth_date: string | null;
  sex: string | null;
};

function parseSex(value: string | null | undefined): BiologicalSex | null {
  if (value === 'female' || value === 'male') {
    return value;
  }
  return null;
}

export type UserProfileFields = {
  birthDate: string | null;
  sex: BiologicalSex | null;
};

export async function getUserProfile(): Promise<UserProfileFields> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('birth_date, sex')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as UserProfileRow | null;
  return {
    birthDate: row?.birth_date ?? null,
    sex: parseSex(row?.sex),
  };
}

export async function saveUserProfile(profile: UserProfileFields): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase.from('user_profiles').upsert(
    {
      user_id: userId,
      birth_date: profile.birthDate,
      sex: profile.sex,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    throw error;
  }
}
