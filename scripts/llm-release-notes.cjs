const {
  prepareChangelogForLlm,
  validateReleaseNotesMarkdown,
} = require('./user-facing-notes.cjs');

const DEFAULT_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite'];
const DEFAULT_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const RETRYABLE_STATUS = /\((429|503)\)|high demand|UNAVAILABLE|RESOURCE_EXHAUSTED/i;

const SHARED_RULES = `Coverage and grouping:
- Include every user-facing app change supported by the input. Do not drop real app features or fixes.
- There is no bullet limit — one bullet per meaningful change, or fewer when grouping related work.
- When several input items affect the same area (Dashboard, History, Compare, Profile, sign-in, app-wide performance, etc.), combine them into clear bullets that cover all of those changes together instead of repeating the screen name in many separate lines.
- Merge only true duplicates. Do not merge unrelated changes just to shorten the list.

Writing style:
- Focus on what the user can do or notice, not implementation details.
- Omit website, marketing site, CI, SDK, dependency, audit, and infrastructure work even if it appears in the input.
- Do not invent features that are not supported by the input.
- Use markdown bullet lists (* item). No numbered lists, no intro paragraph, no closing line.
- Output markdown only. No code fences.`;

const SYSTEM_PROMPTS = {
  en: `You write release notes for WeighWay, a personal weight-tracking mobile app (Android and iOS).

Audience: people who use the app to log weight, view trends, compare periods, and manage profile settings — not developers.

Language: English.

Section headings (use only these, when relevant):
- "### What's new" for features
- "### Bug fixes" for fixes
- "### Improvements" for UX/performance polish without new features
- "### Breaking changes" only when users must change behavior

App screen names to use when helpful: Dashboard, History, Compare, Profile.
Keep the brand name "WeighWay" unchanged.

${SHARED_RULES}`,

  pl: `Piszesz informacje o wydaniu aplikacji WeighWay — mobilnej aplikacji do śledzenia wagi (Android i iOS).

Odbiorca: osoby, które zapisują wagę, analizują trendy, porównują okresy i zarządzają profilem — nie programiści.

Język: naturalny polski (pisz od razu po polsku, nie tłumacz dosłownie z angielskiego).

Nagłówki sekcji (używaj tylko tych, gdy pasują):
- "### Co nowego" dla nowych funkcji
- "### Poprawki błędów" dla poprawek
- "### Ulepszenia" dla usprawnień UX/wydajności bez nowych funkcji
- "### Istotne zmiany" tylko gdy użytkownik musi zmienić sposób korzystania

Nazwy ekranów aplikacji: Dashboard, Historia, Porównaj, Profil.
Nazwa marki "WeighWay" pozostaje bez zmian.

${SHARED_RULES}`,
};

function getGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY is required to generate release notes (free key from Google AI Studio)',
    );
  }
  return key;
}

function buildUserPrompt({ version, filteredInput, locale }) {
  if (locale === 'pl') {
    return `Napisz informacje o wydaniu WeighWay w wersji ${version} dla użytkowników aplikacji.

Poniżej jest przefiltrowany wewnętrzny changelog. Przepisz go na język korzyści dla użytkownika.

${filteredInput}`;
  }

  return `Write customer-facing release notes for WeighWay version ${version}.

The input below is a filtered internal changelog. Rewrite it for app users.

${filteredInput}`;
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const visibleParts = parts.filter((part) => part.text && !part.thought);
  const source = visibleParts.length > 0 ? visibleParts : parts.filter((part) => part.text);
  const text = source
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();
  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason ?? 'unknown';
    throw new Error(`Gemini returned no release notes (finishReason: ${reason})`);
  }
  return text;
}

function getModelsToTry() {
  if (process.env.GEMINI_MODEL) {
    return [process.env.GEMINI_MODEL];
  }
  return FALLBACK_MODELS;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function callGeminiOnce({ model, systemPrompt, userPrompt, fetchImpl = fetch }) {
  const apiBase = process.env.GEMINI_API_URL || DEFAULT_API_BASE;
  const url = `${apiBase}/models/${model}:generateContent?key=${getGeminiApiKey()}`;

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini release notes failed for ${model} (${response.status}): ${err}`);
  }

  return extractGeminiText(await response.json());
}

async function callGemini({ systemPrompt, userPrompt, fetchImpl = fetch }) {
  const models = getModelsToTry();
  let lastError;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await callGeminiOnce({ model, systemPrompt, userPrompt, fetchImpl });
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        if (RETRYABLE_STATUS.test(message) && attempt < 2) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Gemini release notes failed for all configured models');
}

function getFilteredInput(version, changelogBody) {
  const filteredInput = prepareChangelogForLlm(changelogBody);
  if (!filteredInput) {
    throw new Error(
      `No app-facing changelog entries for ${version} after filtering internal scopes`,
    );
  }
  return filteredInput;
}

async function generateLocaleReleaseNotes({
  version,
  changelogBody,
  locale,
  fetchImpl = fetch,
}) {
  const filteredInput = getFilteredInput(version, changelogBody);
  const raw = await callGemini({
    systemPrompt: SYSTEM_PROMPTS[locale],
    userPrompt: buildUserPrompt({ version, filteredInput, locale }),
    fetchImpl,
  });
  return validateReleaseNotesMarkdown(raw, locale);
}

async function generateLocaleReleaseNotesSafely({
  version,
  changelogBody,
  locale,
  fetchImpl = fetch,
}) {
  try {
    const body = await generateLocaleReleaseNotes({
      version,
      changelogBody,
      locale,
      fetchImpl,
    });
    return { body, pending: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Release notes (${locale}) for ${version} failed: ${message}`);
    console.warn(`Using pending placeholder for ${version} (${locale}).`);
    return {
      body: require('./user-facing-notes.cjs').buildPendingReleaseNotes(locale),
      pending: true,
    };
  }
}

async function generateEnglishReleaseNotes({ version, changelogBody, fetchImpl = fetch }) {
  return generateLocaleReleaseNotes({ version, changelogBody, locale: 'en', fetchImpl });
}

async function generatePolishReleaseNotes({ version, changelogBody, fetchImpl = fetch }) {
  return generateLocaleReleaseNotes({ version, changelogBody, locale: 'pl', fetchImpl });
}

async function generateReleaseNotes({ version, changelogBody, fetchImpl = fetch }) {
  const [english, polish] = await Promise.all([
    generateLocaleReleaseNotesSafely({ version, changelogBody, locale: 'en', fetchImpl }),
    generateLocaleReleaseNotesSafely({ version, changelogBody, locale: 'pl', fetchImpl }),
  ]);

  return {
    notesEn: english.body,
    pendingEn: english.pending,
    notesPl: polish.body,
    pendingPl: polish.pending,
  };
}

module.exports = {
  DEFAULT_MODEL,
  FALLBACK_MODELS,
  SYSTEM_PROMPTS,
  buildUserPrompt,
  callGemini,
  generateEnglishReleaseNotes,
  generateLocaleReleaseNotesSafely,
  generatePolishReleaseNotes,
  generateReleaseNotes,
  getGeminiApiKey,
  getModelsToTry,
};
