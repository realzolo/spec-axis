import { LanguageDescription } from '@codemirror/language';
import type { LanguageSupport } from '@codemirror/language';
import { languages } from '@codemirror/language-data';

const languageSupportCache = new Map<string, Promise<LanguageSupport | null>>();

export async function resolveLanguageSupportForPath(filePath: string | undefined): Promise<LanguageSupport | null> {
  const key = normalizeLanguageKey(filePath);
  if (!key) return null;

  let cached = languageSupportCache.get(key);
  if (!cached) {
    cached = loadLanguageSupport(filePath ?? '');
    languageSupportCache.set(key, cached);
  }
  return cached;
}

async function loadLanguageSupport(filePath: string): Promise<LanguageSupport | null> {
  const fileName = extractFileName(filePath);
  if (!fileName) return null;

  const byFilename = LanguageDescription.matchFilename(languages, fileName);
  if (byFilename) {
    return byFilename.load();
  }

  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() ?? '' : '';
  if (!extension) return null;
  const byName = LanguageDescription.matchLanguageName(languages, extension, true);
  if (!byName) return null;
  return byName.load();
}

function normalizeLanguageKey(filePath: string | undefined) {
  const fileName = extractFileName(filePath ?? '');
  return fileName.toLowerCase();
}

function extractFileName(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/').trim();
  if (!normalized) return '';
  const segments = normalized.split('/');
  return segments[segments.length - 1] ?? '';
}
