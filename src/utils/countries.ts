import { normalizeCountryCode } from './savings';

export type CountryOption = {
  value: string;
  label: string;
};

const FALLBACK_COUNTRIES = [
  'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE',
  'GB', 'IE', 'FR', 'DE', 'ES', 'PT', 'IT', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'FI', 'DK',
  'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'UA', 'TR', 'IL', 'AE', 'SA',
  'IN', 'PK', 'BD', 'CN', 'JP', 'KR',
  'AU', 'NZ', 'ZA', 'EG', 'MA', 'NG', 'KE', 'GH',
  'SG', 'MY', 'TH', 'ID', 'VN', 'PH'
];

const getRegionCodes = (): string[] => {
  let supported: readonly string[] | null = null;
  const supportedValuesOf = (Intl as typeof Intl & {
    supportedValuesOf?: (type: string) => readonly string[];
  }).supportedValuesOf;
  if (typeof supportedValuesOf === 'function') {
    try {
      supported = supportedValuesOf('region');
    } catch {
      supported = null;
    }
  }
  const list = supported ?? FALLBACK_COUNTRIES;
  const unique = new Set<string>();
  list.forEach((code) => {
    const normalized = normalizeCountryCode(code);
    if (normalized) {
      unique.add(normalized);
    }
  });
  return Array.from(unique);
};

export const getCountryLabel = (locale: string, code: string): string => {
  if (typeof Intl.DisplayNames === 'function') {
    try {
      const formatter = new Intl.DisplayNames([locale], { type: 'region' });
      const label = formatter.of(code);
      if (label) return label;
    } catch {
      // ignore
    }
  }
  return code;
};

export const getCountryOptions = (locale: string): CountryOption[] => {
  const codes = getRegionCodes();
  const options = codes.map((code) => {
    const label = getCountryLabel(locale, code);
    const formatted = label === code ? code : `${label} (${code})`;
    return { value: code, label: formatted };
  });
  options.sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: 'base' }));
  return options;
};
