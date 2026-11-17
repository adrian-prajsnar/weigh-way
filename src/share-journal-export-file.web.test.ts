// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { shareJournalExportFile } from './share-journal-export-file.web';

afterEach(() => vi.restoreAllMocks());

it('downloads one file using the selected filename and content', async () => {
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
  const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const downloads: { name: string; href: string }[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ name: this.download, href: this.href });
  });
  await shareJournalExportFile(
    { filename: 'weights.csv', content: 'date,weight_kg\n', mimeType: 'text/csv', uti: '' },
    'Export',
  );
  expect(downloads).toEqual([{ name: 'weights.csv', href: 'blob:export' }]);
  const blob = createUrl.mock.calls[0][0] as Blob;
  expect(blob.type).toBe('text/csv');
  expect(await blob.text()).toBe('date,weight_kg\n');
  expect(revokeUrl).toHaveBeenCalledWith('blob:export');
});
