export const OUTPUT_LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'ru', label: 'Русский' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'pl', label: 'Polski' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'th', label: 'ไทย' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'ms', label: 'Bahasa Melayu' },
] as const;

export type OutputLanguageCode = (typeof OUTPUT_LANGUAGE_OPTIONS)[number]['code'];

export const DEFAULT_OUTPUT_LANGUAGE: OutputLanguageCode = 'en';

const outputLanguageCodeSet = new Set<string>(OUTPUT_LANGUAGE_OPTIONS.map((option) => option.code));

const outputLanguageLabelMap = new Map<string, string>(
  OUTPUT_LANGUAGE_OPTIONS.map((option) => [option.code, option.label])
);

export function isSupportedOutputLanguage(code: string): code is OutputLanguageCode {
  return outputLanguageCodeSet.has(code);
}

export function parseOutputLanguage(code: unknown): OutputLanguageCode {
  if (typeof code !== 'string' || !code.trim()) {
    return DEFAULT_OUTPUT_LANGUAGE;
  }
  const normalized = code.trim();
  if (!isSupportedOutputLanguage(normalized)) {
    throw new Error('AI outputLanguage is invalid');
  }
  return normalized;
}

export function getOutputLanguageLabel(code: string | undefined): string {
  if (!code) {
    return outputLanguageLabelMap.get(DEFAULT_OUTPUT_LANGUAGE) ?? 'English';
  }
  return outputLanguageLabelMap.get(code) ?? outputLanguageLabelMap.get(DEFAULT_OUTPUT_LANGUAGE) ?? 'English';
}
