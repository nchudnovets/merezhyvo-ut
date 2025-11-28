import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import type { LocaleInfo } from './locales';
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from './locales';
import enTranslations from './translations/en';

type LocaleDictionary = Record<string, string>;

const localeLoaders: Record<string, () => Promise<LocaleDictionary>> = {
  en: async () => enTranslations
};

const interpolate = (
  template: string,
  vars?: Record<string, string | number>
): string => {
  if (!vars || !Object.keys(vars).length) return template;
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = vars[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
};

interface I18nContextValue {
  language: string;
  setLanguage: (language: string) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  availableLocales: LocaleInfo[];
  ready: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  children: ReactNode;
  initialLanguage?: string;
  fallback?: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  initialLanguage,
  fallback = null
}) => {
  const [language, setLanguage] = useState(initialLanguage || DEFAULT_LOCALE);
  const [dictionaryMap, setDictionaryMap] = useState<Record<string, LocaleDictionary>>({
    [DEFAULT_LOCALE]: enTranslations
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // noop
    }
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    const ensureLanguage = async () => {
      if (dictionaryMap[language]) {
        if (!ready) setReady(true);
        return;
      }
      setReady(false);
      try {
        const loader = localeLoaders[language] ?? localeLoaders[DEFAULT_LOCALE];
        const dictionary = await loader();
        if (cancelled) return;
        setDictionaryMap((prev) => ({ ...prev, [language]: dictionary }));
      } catch {
        // noop
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };
    void ensureLanguage();
    return () => {
      cancelled = true;
    };
  }, [language, dictionaryMap, ready]);

  const setLanguageAsync = useCallback(
    async (next: string) => {
      if (!next || next === language) return;
      setLanguage(next);
    },
    [language]
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = dictionaryMap[language] ?? dictionaryMap[DEFAULT_LOCALE] ?? {};
      const fallback = dictionaryMap[DEFAULT_LOCALE] ?? {};
      const template = dict[key] ?? fallback[key] ?? key;
      return interpolate(template, vars);
    },
    [dictionaryMap, language]
  );

  const contextValue = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage: setLanguageAsync,
      t,
      availableLocales: AVAILABLE_LOCALES,
      ready
    }),
    [language, setLanguageAsync, t, ready]
  );

  return (
    <I18nContext.Provider value={contextValue}>
      {!ready && fallback ? fallback : children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider.');
  }
  return context;
};
