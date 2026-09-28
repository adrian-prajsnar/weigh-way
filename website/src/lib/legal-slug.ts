const FOLDS: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
};

export function legalSectionId(title: string): string {
  const folded = title
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (char) => FOLDS[char] ?? char)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

  const slug = folded.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'section';
}
