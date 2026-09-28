export type LegalBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'note'; lines: string[] }
  | { kind: 'definition'; term: string; detail: string }
  | { kind: 'subheading'; text: string }
  | { kind: 'list'; intro?: string; items: string[] };

function asNote(text: string): string[] | null {
  if (text.includes('\n\n')) return null;
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.some(isBulletLine)) return null;
  if (lines.length === 1 && /\d{2}-\d{3}\s+\S/.test(lines[0])) return lines;
  if (lines.length < 2) return null;
  if (lines.every((line) => line.length <= 72)) return lines;
  return null;
}

function asDefinition(text: string): { term: string; detail: string } | null {
  if (text.includes('\n')) return null;
  const match = /^([A-Za-z0-9][^—\n]{0,32}?)\s+—\s+(\S[\s\S]+)$/.exec(text.trim());
  if (!match) return null;
  return { term: match[1].trim(), detail: match[2].trim() };
}

function isBulletLine(line: string): boolean {
  return line.startsWith('• ') || line.startsWith('* ');
}

function bulletText(line: string): string {
  return line.slice(2).trim();
}

export function parseLegalBody(body: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];

  for (const block of body.split('\n\n')) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('### ')) {
      blocks.push({ kind: 'subheading', text: trimmed.slice(4).trim() });
      continue;
    }

    const lines = trimmed.split('\n');
    const bulletLines = lines.filter(isBulletLine);

    if (bulletLines.length > 0) {
      const introLines = lines.filter((line) => !isBulletLine(line));
      blocks.push({
        kind: 'list',
        intro: introLines.join(' ').trim() || undefined,
        items: bulletLines.map(bulletText),
      });
      continue;
    }

    const note = asNote(trimmed);
    if (note) {
      blocks.push({ kind: 'note', lines: note });
      continue;
    }

    const definition = asDefinition(trimmed);
    if (definition) {
      blocks.push({ kind: 'definition', ...definition });
      continue;
    }

    blocks.push({ kind: 'paragraph', text: trimmed });
  }

  return blocks;
}
