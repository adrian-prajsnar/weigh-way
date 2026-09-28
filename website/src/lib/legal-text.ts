export type LegalTextPart = { kind: 'text'; value: string } | { kind: 'email'; value: string };

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function isEmailOnly(text: string): boolean {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(text.trim());
}

export function splitLegalText(text: string): LegalTextPart[] {
  const parts: LegalTextPart[] = [];
  const pattern = new RegExp(EMAIL.source, 'g');
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ kind: 'text', value: text.slice(last, match.index) });
    }
    parts.push({ kind: 'email', value: match[0] });
    last = match.index + match[0].length;
  }

  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });
  return parts.length > 0 ? parts : [{ kind: 'text', value: text }];
}
