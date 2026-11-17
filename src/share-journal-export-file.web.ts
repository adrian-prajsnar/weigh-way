import { JournalExportFile } from './journal-export';

export async function shareJournalExportFile(
  file: JournalExportFile,
  _dialogTitle: string,
): Promise<void> {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
