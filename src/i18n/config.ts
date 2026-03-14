export const locales = ['en', 'zh', 'ja', 'es', 'zh-TW'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: 'Simplified Chinese',
  ja: 'Japanese',
  es: 'Español',
  'zh-TW': 'Traditional Chinese',
};
