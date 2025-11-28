import type { LanguageId, LanguageLayout, Rows } from '../types';
import { enLayout } from './en';
import { ukLayout } from './uk';
import { deLayout } from './de';
import { plLayout } from './pl';
import { esLayout } from './es';
import { itLayout } from './it';
import { ptLayout } from './pt';
import { frLayout } from './fr';
import { trLayout } from './tr';
import { nlLayout } from './nl';
import { roLayout } from './ro';
import { arLayout } from './ar';

const FALLBACK_LANG: LanguageId = 'en';

export const LANGUAGE_LAYOUT_IDS: readonly LanguageId[] = [
  'en',
  'uk',
  'de',
  'pl',
  'es',
  'it',
  'pt',
  'fr',
  'tr',
  'nl',
  'ro',
  'ar'
] as const;

export const LANGUAGE_LAYOUTS: Record<LanguageId, LanguageLayout> = {
  en: enLayout,
  uk: ukLayout,
  de: deLayout,
  pl: plLayout,
  es: esLayout,
  it: itLayout,
  pt: ptLayout,
  fr: frLayout,
  tr: trLayout,
  nl: nlLayout,
  ro: roLayout,
  ar: arLayout
};

const isLetter = (value: string): boolean => {
  if (!value) return false;
  return value.toLowerCase() !== value.toUpperCase();
};

const uppercaseRows = (rows: Rows): Rows =>
  rows.map((row) =>
    row.map((key) =>
      key
        .split('')
        .map((ch) => (isLetter(ch) ? ch.toUpperCase() : ch))
        .join('')
    )
  );

export function getLanguageRows(id: LanguageId, shift: boolean): Rows {
  const layout = LANGUAGE_LAYOUTS[id] ?? LANGUAGE_LAYOUTS[FALLBACK_LANG];
  if (shift) {
    return layout.rows.shift ?? uppercaseRows(layout.rows.default);
  }
  return layout.rows.default;
}

export function getLanguageLongPress(id: LanguageId): Record<string, string[]> {
  const layout = LANGUAGE_LAYOUTS[id] ?? LANGUAGE_LAYOUTS[FALLBACK_LANG];
  return layout.longPress ?? {};
}

export function isLanguageRtl(id: LanguageId): boolean {
  return Boolean((LANGUAGE_LAYOUTS[id] ?? LANGUAGE_LAYOUTS[FALLBACK_LANG]).rtl);
}

export function getLanguageLabel(id: LanguageId): string {
  const layout = LANGUAGE_LAYOUTS[id] ?? LANGUAGE_LAYOUTS[FALLBACK_LANG];
  return layout.label || id.toUpperCase();
}
