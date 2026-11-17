import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { JournalExportFile } from './journal-export';

const EXPORT_RETENTION_MS = 24 * 60 * 60 * 1000;

export async function shareJournalExportFile(
  exportFile: JournalExportFile,
  dialogTitle: string,
): Promise<void> {
  if (!(await isAvailableAsync())) {
    throw new Error('File sharing is unavailable');
  }

  const now = Date.now();
  // Retain recent exports: a receiving app may still be reading a previous URI.
  for (const entry of new Directory(Paths.cache).list()) {
    if (!(entry instanceof Directory)) continue;
    const match = /^journal-export-(\d+)-[a-z0-9]+$/.exec(entry.name);
    if (match && Number(match[1]) < now - EXPORT_RETENTION_MS) {
      entry.delete();
    }
  }

  const directory = new Directory(
    Paths.cache,
    `journal-export-${now}-${Math.random().toString(36).slice(2)}`,
  );
  directory.create();
  const file = new File(directory, exportFile.filename);
  await file.write(exportFile.content);

  // Android can resolve shareAsync before the receiving app reads the file.
  // Keep each export in its own OS-managed cache directory to preserve that URI.
  await shareAsync(file.uri, {
    mimeType: exportFile.mimeType,
    UTI: exportFile.uti,
    dialogTitle,
  });
}
