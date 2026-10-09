import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayDate, toDateKey } from '../format';
import { BiologicalSex, HeightEntry, WeightEntry } from '../types';
import {
  DEMO_BIRTH_DATE,
  DEMO_HEIGHT_ENTRIES,
  DEMO_SEX,
  buildDemoWeightEntries,
} from './demo-data';

const STORAGE_KEY = '@weigh-way/demo-journal';

type DemoJournal = {
  weightEntries: WeightEntry[];
  heightEntries: HeightEntry[];
  birthDate: string | null;
  sex: BiologicalSex | null;
  seededFor: string;
};

function getSeedDateKey(): string {
  return toDateKey(getTodayDate());
}

function createDefaultJournal(): DemoJournal {
  return {
    weightEntries: buildDemoWeightEntries(getTodayDate()),
    heightEntries: [...DEMO_HEIGHT_ENTRIES],
    birthDate: DEMO_BIRTH_DATE,
    sex: DEMO_SEX,
    seededFor: getSeedDateKey(),
  };
}

function refreshDemoWeightEntries(journal: DemoJournal): DemoJournal {
  return {
    ...journal,
    weightEntries: buildDemoWeightEntries(getTodayDate()),
    seededFor: getSeedDateKey(),
  };
}

function needsWeightReseed(journal: DemoJournal): boolean {
  return journal.seededFor !== getSeedDateKey();
}

function sortWeightEntries(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

function sortHeightEntries(entries: HeightEntry[]): HeightEntry[] {
  return [...entries].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
}

function isWeightEntry(value: unknown): value is WeightEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as WeightEntry;
  return (
    typeof entry.date === 'string' &&
    typeof entry.weightKg === 'number' &&
    typeof entry.createdAt === 'string' &&
    typeof entry.updatedAt === 'string'
  );
}

function isHeightEntry(value: unknown): value is HeightEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as HeightEntry;
  return typeof entry.effectiveDate === 'string' && typeof entry.heightCm === 'number';
}

function isDemoJournal(value: unknown): value is DemoJournal {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const journal = value as DemoJournal;
  return (
    Array.isArray(journal.weightEntries) &&
    journal.weightEntries.every(isWeightEntry) &&
    Array.isArray(journal.heightEntries) &&
    journal.heightEntries.every(isHeightEntry) &&
    (journal.birthDate === null || typeof journal.birthDate === 'string') &&
    (journal.sex === null || journal.sex === 'female' || journal.sex === 'male') &&
    typeof journal.seededFor === 'string'
  );
}

function normalizeJournal(journal: DemoJournal): { journal: DemoJournal; didReseed: boolean } {
  const sorted: DemoJournal = {
    ...journal,
    weightEntries: sortWeightEntries(journal.weightEntries),
    heightEntries: sortHeightEntries(journal.heightEntries),
  };

  if (!needsWeightReseed(sorted)) {
    return { journal: sorted, didReseed: false };
  }

  const refreshed = refreshDemoWeightEntries(sorted);
  return {
    journal: {
      ...refreshed,
      weightEntries: sortWeightEntries(refreshed.weightEntries),
      heightEntries: sortHeightEntries(refreshed.heightEntries),
    },
    didReseed: true,
  };
}

async function loadJournal(): Promise<DemoJournal> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const journal = createDefaultJournal();
    await saveJournal(journal);
    return journal;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isDemoJournal(parsed)) {
      const journal = createDefaultJournal();
      await saveJournal(journal);
      return journal;
    }

    const { journal, didReseed } = normalizeJournal(parsed);
    if (didReseed) {
      await saveJournal(journal);
    }
    return journal;
  } catch {
    const journal = createDefaultJournal();
    await saveJournal(journal);
    return journal;
  }
}

async function saveJournal(journal: DemoJournal): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
}

export async function getDemoWeightEntries(): Promise<WeightEntry[]> {
  const journal = await loadJournal();
  return journal.weightEntries;
}

export async function saveDemoWeightEntry(date: string, weightKg: number): Promise<void> {
  const journal = await loadJournal();
  const now = new Date().toISOString();
  const existing = journal.weightEntries.find((entry) => entry.date === date);
  const nextEntry: WeightEntry = {
    date,
    weightKg,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await saveJournal({
    ...journal,
    weightEntries: sortWeightEntries([
      ...journal.weightEntries.filter((entry) => entry.date !== date),
      nextEntry,
    ]),
  });
}

export async function deleteDemoWeightEntry(date: string): Promise<void> {
  const journal = await loadJournal();
  await saveJournal({
    ...journal,
    weightEntries: journal.weightEntries.filter((entry) => entry.date !== date),
  });
}

export async function getDemoProfile(): Promise<{
  birthDate: string | null;
  sex: BiologicalSex | null;
  heightEntries: HeightEntry[];
}> {
  const journal = await loadJournal();
  return {
    birthDate: journal.birthDate,
    sex: journal.sex,
    heightEntries: journal.heightEntries,
  };
}

export async function saveDemoUserProfile(
  birthDate: string | null,
  sex: BiologicalSex | null,
): Promise<void> {
  const journal = await loadJournal();
  await saveJournal({
    ...journal,
    birthDate,
    sex,
  });
}

export async function saveDemoHeight(effectiveDate: string, heightCm: number): Promise<void> {
  const journal = await loadJournal();
  await saveJournal({
    ...journal,
    heightEntries: sortHeightEntries([
      ...journal.heightEntries.filter((entry) => entry.effectiveDate !== effectiveDate),
      { effectiveDate, heightCm },
    ]),
  });
}

export async function deleteDemoHeight(effectiveDate: string): Promise<void> {
  const journal = await loadJournal();
  await saveJournal({
    ...journal,
    heightEntries: journal.heightEntries.filter((entry) => entry.effectiveDate !== effectiveDate),
  });
}
