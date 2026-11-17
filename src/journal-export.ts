import { BiologicalSex, HeightEntry, WeightEntry } from './types';

export const EXPORT_JSON_FILENAME = 'weigh-way-export.json';
export const WEIGH_INS_CSV_FILENAME = 'weigh-way-weigh-ins.csv';

export type JournalExportFormat = 'json' | 'csv';

export type JournalExportFile = {
  filename: string;
  content: string;
  mimeType: string;
  uti: string;
};

export function buildJournalExportFile(
  format: JournalExportFormat,
  input: BuildJournalJsonInput,
): JournalExportFile {
  return format === 'json'
    ? {
        filename: EXPORT_JSON_FILENAME,
        content: buildJournalJson(input),
        mimeType: 'application/json',
        uti: 'public.json',
      }
    : {
        filename: WEIGH_INS_CSV_FILENAME,
        content: buildWeighInsCsv(input.weightEntries),
        mimeType: 'text/csv',
        uti: 'public.comma-separated-values-text',
      };
}

export type BuildJournalJsonInput = {
  weightEntries: WeightEntry[];
  heightEntries: HeightEntry[];
  birthDate: string | null;
  sex: BiologicalSex | null;
  now: Date;
};

export function buildJournalJson({
  weightEntries,
  heightEntries,
  birthDate,
  sex,
  now,
}: BuildJournalJsonInput): string {
  const payload = {
    exportedAt: now.toISOString(),
    birthDate,
    sex,
    heightEntries,
    weightEntries,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function canExportJournalData(options: {
  weightEntriesError: string | null;
  profileError: string | null;
  weightEntriesLoaded: boolean;
  profileLoaded: boolean;
}): boolean {
  return (
    options.weightEntriesLoaded &&
    options.profileLoaded &&
    !options.weightEntriesError &&
    !options.profileError
  );
}

export function buildWeighInsCsv(weightEntries: WeightEntry[]): string {
  const sorted = [...weightEntries].sort((a, b) => a.date.localeCompare(b.date));
  const lines = ['date,weight_kg', ...sorted.map((entry) => `${entry.date},${entry.weightKg}`)];
  return `${lines.join('\n')}\n`;
}
