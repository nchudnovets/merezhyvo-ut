export type LocaleInfo = {
  id: string;
  label: string;
  nativeLabel: string;
  direction?: 'ltr' | 'rtl';
};

export const AVAILABLE_LOCALES: LocaleInfo[] = [
  { id: 'en', label: 'English', nativeLabel: 'English', direction: 'ltr' },
  { id: 'uk', label: 'Ukrainian', nativeLabel: 'Українська', direction: 'ltr' },
  { id: 'de', label: 'German', nativeLabel: 'Deutsch', direction: 'ltr' }
];

export const DEFAULT_LOCALE = AVAILABLE_LOCALES[0].id;
export const LOCALE_IDS = AVAILABLE_LOCALES.map((locale) => locale.id);

export const isValidLocale = (value: unknown): value is string =>
  typeof value === 'string' && LOCALE_IDS.includes(value);
