'use client';

import { useSyncExternalStore } from 'react';
import enDict from './dictionaries/en.json';
import zhDict from './dictionaries/zh.json';

export type ClientLocale = 'en' | 'zh';

function subscribeLocale() {
  return () => {};
}

function getLocaleFromDocument(): ClientLocale {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/);
  return match?.[1] === 'zh' ? 'zh' : 'en';
}

export function useClientLocale() {
  return useSyncExternalStore(subscribeLocale, getLocaleFromDocument, () => 'en');
}

export function useClientDictionary() {
  const locale = useClientLocale();
  return locale === 'zh' ? zhDict : enDict;
}

