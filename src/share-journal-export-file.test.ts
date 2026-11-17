import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildJournalExportFile } from './journal-export';
import { shareJournalExportFile } from './share-journal-export-file';
import { Directory, File, Paths } from 'expo-file-system';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  delete: vi.fn(),
  write: vi.fn(),
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

vi.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  Directory: class {
    uri: string;
    create = mocks.create;
    list = mocks.list;
    get name() {
      return this.uri.split('/').at(-1);
    }
    delete() {
      mocks.delete(this.uri);
    }
    constructor(parent: string, name?: string) {
      this.uri = name ? `${parent}/${name}` : parent;
    }
  },
  File: class {
    uri: string;
    write = mocks.write;
    constructor(parent: { uri: string }, name: string) {
      this.uri = `${parent.uri}/${name}`;
    }
  },
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: mocks.isAvailableAsync,
  shareAsync: mocks.shareAsync,
}));

const input = {
  weightEntries: [{ date: '2026-11-17', weightKg: 75.5, createdAt: '', updatedAt: '' }],
  heightEntries: [{ effectiveDate: '2026-01-01', heightCm: 180 }],
  birthDate: '1990-01-01',
  sex: null,
  now: new Date('2026-11-17T12:00:00Z'),
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.isAvailableAsync.mockResolvedValue(true);
  mocks.list.mockReturnValue([]);
  mocks.write.mockResolvedValue(undefined);
  mocks.shareAsync.mockResolvedValue(undefined);
});

describe('shareJournalExportFile', () => {
  it.each(['json', 'csv'] as const)(
    'shares one %s file with its contents and type',
    async (format) => {
      const file = buildJournalExportFile(format, input);
      await shareJournalExportFile(file, 'Export');

      expect(mocks.create).toHaveBeenCalledOnce();
      expect(mocks.write).toHaveBeenCalledExactlyOnceWith(file.content);
      expect(mocks.shareAsync).toHaveBeenCalledExactlyOnceWith(
        expect.stringMatching(new RegExp(`^file:///cache/journal-export-.+/${file.filename}$`)),
        { mimeType: file.mimeType, UTI: file.uti, dialogTitle: 'Export' },
      );
      if (format === 'json') {
        expect(JSON.parse(file.content)).toMatchObject({
          birthDate: input.birthDate,
          heightEntries: input.heightEntries,
          weightEntries: input.weightEntries,
        });
      } else {
        expect(file.content).toBe('date,weight_kg\n2026-11-17,75.5\n');
      }
    },
  );

  it('keeps previous exports at separate URIs for receiving apps', async () => {
    const file = buildJournalExportFile('json', input);
    await shareJournalExportFile(file, 'Export');
    await shareJournalExportFile(file, 'Export');
    expect(mocks.shareAsync.mock.calls[0][0]).not.toBe(mocks.shareAsync.mock.calls[1][0]);
  });

  it('does not write data when sharing is unavailable', async () => {
    mocks.isAvailableAsync.mockResolvedValue(false);
    await expect(
      shareJournalExportFile(buildJournalExportFile('json', input), 'Export'),
    ).rejects.toThrow('File sharing is unavailable');
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('propagates write failures without opening the share sheet', async () => {
    mocks.write.mockRejectedValue(new Error('Disk full'));
    await expect(
      shareJournalExportFile(buildJournalExportFile('csv', input), 'Export'),
    ).rejects.toThrow('Disk full');
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('waits for the file write before opening the share sheet', async () => {
    let finishWrite!: () => void;
    let markWriteStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    mocks.write.mockImplementation(() => {
      markWriteStarted();
      return new Promise<void>((resolve) => {
        finishWrite = resolve;
      });
    });
    const exportResult = shareJournalExportFile(buildJournalExportFile('json', input), 'Export');
    await writeStarted;
    expect(mocks.shareAsync).not.toHaveBeenCalled();
    finishWrite();
    await exportResult;
    expect(mocks.shareAsync).toHaveBeenCalledOnce();
  });

  it('cleans only export directories older than one day, preserving recent shared files', async () => {
    const now = Date.now();
    const oldName = `journal-export-${now - 25 * 60 * 60 * 1000}-old`;
    const recentName = `journal-export-${now - 60 * 1000}-recent`;
    mocks.list.mockReturnValue([
      new Directory(Paths.cache, oldName),
      new Directory(Paths.cache, recentName),
      new Directory(Paths.cache, 'other-cache'),
      new File(new Directory(Paths.cache), oldName),
    ]);
    await shareJournalExportFile(buildJournalExportFile('csv', input), 'Export');
    expect(mocks.delete).toHaveBeenCalledExactlyOnceWith(`file:///cache/${oldName}`);
  });

  it('propagates share failures to the caller', async () => {
    mocks.shareAsync.mockRejectedValue(new Error('Share failed'));
    await expect(
      shareJournalExportFile(buildJournalExportFile('json', input), 'Export'),
    ).rejects.toThrow('Share failed');
  });
});
