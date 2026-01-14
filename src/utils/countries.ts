import { normalizeCountryCode } from './savings';
import isoCountries from 'i18n-iso-countries';

// JSON locales (ensure tsconfig: "resolveJsonModule": true)
import en from 'i18n-iso-countries/langs/en.json';
import uk from 'i18n-iso-countries/langs/uk.json';
import de from 'i18n-iso-countries/langs/de.json';
import fr from 'i18n-iso-countries/langs/fr.json';
import pl from 'i18n-iso-countries/langs/pl.json';
import es from 'i18n-iso-countries/langs/es.json';
import it from 'i18n-iso-countries/langs/it.json';
import nl from 'i18n-iso-countries/langs/nl.json';
import no from 'i18n-iso-countries/langs/no.json';

export type CountryOption = {
  value: string;
  label: string;
};

const BLOCKED = new Set(['RU']);

// Register locales once
let localesRegistered = false;
const ensureLocales = () => {
  if (localesRegistered) return;
  isoCountries.registerLocale(en);
  isoCountries.registerLocale(uk);
  isoCountries.registerLocale(de);
  isoCountries.registerLocale(fr);
  isoCountries.registerLocale(pl);
  isoCountries.registerLocale(es);
  isoCountries.registerLocale(it);
  isoCountries.registerLocale(nl);
  isoCountries.registerLocale(no);
  localesRegistered = true;
};

const LANGUAGE_MAP: Record<string, string> = {
  en: 'en',
  uk: 'uk',
  de: 'de',
  fr: 'fr',
  pl: 'pl',
  es: 'es',
  it: 'it',
  nl: 'nl',
  no: 'no'
};

const pickLang = (locale: string): string => {
  if (!locale) return 'en';
  const code = locale.split('-')[0]?.toLowerCase() || 'en';
  return LANGUAGE_MAP[code] ?? 'en';
};

// Full ISO alpha-2 list comes from i18n-iso-countries itself
const getAllIsoCountryCodes = (): string[] => {
  // Use english map just to get the keys deterministically
  const namesEn = isoCountries.getNames('en', { select: 'official' });
  return Object.keys(namesEn);
};

export const getCountryLabel = (locale: string, code: string): string => {
  ensureLocales();

  const normalized = normalizeCountryCode(code);
  if (!normalized) return code;

  const lang = pickLang(locale);

  // Primary: i18n-iso-countries
  const name =
    isoCountries.getName(normalized, lang, { select: 'official' }) ||
    isoCountries.getName(normalized, lang) ||
    null;

  if (name) return name;

  // Fallback: Intl.DisplayNames (if runtime supports it)
  if (typeof Intl.DisplayNames === 'function') {
    try {
      const formatter = new Intl.DisplayNames([locale], { type: 'region' });
      const label = formatter.of(normalized);
      if (label) return label;
    } catch {
      // ignore
    }
  }

  return normalized;
};

export const getCountryOptions = (locale: string): CountryOption[] => {
  ensureLocales();

  const codes = getAllIsoCountryCodes();
  const unique = new Set<string>();

  for (const raw of codes) {
    const normalized = normalizeCountryCode(raw);
    if (!normalized) continue;
    if (BLOCKED.has(normalized)) continue;
    unique.add(normalized);
  }

  const options = Array.from(unique).map((code) => {
    const label = getCountryLabel(locale, code);
    const formatted = label === code ? code : `${label} (${code})`;
    return { value: code, label: formatted };
  });

  options.sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: 'base' }));
  return options;
};
