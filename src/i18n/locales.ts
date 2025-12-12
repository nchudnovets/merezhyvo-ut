export type LocaleInfo = {
  id: string;
  label: string;
  nativeLabel: string;
  direction?: 'ltr' | 'rtl';
};

export const AVAILABLE_LOCALES: LocaleInfo[] = [
  { id: 'en', label: 'English', nativeLabel: 'English', direction: 'ltr' },
  { id: 'uk', label: 'Ukrainian', nativeLabel: 'Українська', direction: 'ltr' },
  { id: 'de', label: 'German', nativeLabel: 'Deutsch', direction: 'ltr' },
  { id: 'fr', label: 'French', nativeLabel: 'Français', direction: 'ltr' },
  { id: 'pl', label: 'Polish', nativeLabel: 'Polski', direction: 'ltr' },
  { id: 'es', label: 'Spanish', nativeLabel: 'Español', direction: 'ltr' },
  { id: 'it', label: 'Italian', nativeLabel: 'Italiano', direction: 'ltr' },
  { id: 'nl', label: 'Dutch', nativeLabel: 'Nederlands', direction: 'ltr' }
];

export const DEFAULT_LOCALE = AVAILABLE_LOCALES[0]?.id ?? 'en';
export const LOCALE_IDS = AVAILABLE_LOCALES.map((locale) => locale.id);

export const isValidLocale = (value: unknown): value is string =>
  typeof value === 'string' && LOCALE_IDS.includes(value);
