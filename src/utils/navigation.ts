import { defaultTabUrl } from '../store/tabs';

export const DEFAULT_URL = defaultTabUrl;

export type StartParams = {
  url: string;
  hasStartParam: boolean;
};

export const parseStartUrl = (): StartParams => {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('start');
    const providedParam = params.get('startProvided');

    let url = DEFAULT_URL;
    let hasStartParam = false;
    if (raw) {
      try {
        url = decodeURIComponent(raw);
      } catch {
        url = raw;
      }
      const normalizedRaw = url.trim();
      const providedFlag = (providedParam || '').toLowerCase();
      const explicitlyProvided = ['1', 'true', 'yes'].includes(providedFlag);
      if (explicitlyProvided && normalizedRaw) {
        hasStartParam = true;
      } else if (!providedParam && normalizedRaw && normalizedRaw !== DEFAULT_URL) {
        // Backwards compatibility with builds that don't set startProvided.
        hasStartParam = true;
      }
    }

    return { url, hasStartParam };
  } catch {
    return { url: DEFAULT_URL, hasStartParam: false };
  }
};

export const normalizeAddress = (value: string): string => {
  if (!value || !value.trim()) return DEFAULT_URL;
  const trimmed = value.trim();

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed; // already includes a scheme
  if (trimmed.includes(' ')) return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  if (!trimmed.includes('.') && trimmed.toLowerCase() !== 'localhost') {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
  try {
    const candidate = new URL(`https://${trimmed}`);
    return candidate.href;
  } catch {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
};

export const normalizeNavigationTarget = (
  value: string
): { targetUrl: string; originalUrl: string; upgradedFromHttp: boolean } => {
  const fallback = { targetUrl: DEFAULT_URL, originalUrl: DEFAULT_URL, upgradedFromHttp: false };
  if (!value || !value.trim()) return fallback;
  const trimmed = value.trim();
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
  if (hasScheme) {
    if (trimmed.toLowerCase().startsWith('http://')) {
      return {
        targetUrl: trimmed.replace(/^http:/i, 'https:'),
        originalUrl: trimmed,
        upgradedFromHttp: true
      };
    }
    return { targetUrl: trimmed, originalUrl: trimmed, upgradedFromHttp: false };
  }

  if (trimmed.includes(' ')) {
    const target = `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
    return { targetUrl: target, originalUrl: target, upgradedFromHttp: false };
  }
  if (!trimmed.includes('.') && trimmed.toLowerCase() !== 'localhost') {
    const target = `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
    return { targetUrl: target, originalUrl: target, upgradedFromHttp: false };
  }

  try {
    const httpsCandidate = new URL(`https://${trimmed}`);
    return {
      targetUrl: httpsCandidate.href,
      originalUrl: `http://${trimmed}`,
      upgradedFromHttp: true
    };
  } catch {
    const target = `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
    return { targetUrl: target, originalUrl: target, upgradedFromHttp: false };
  }
};

export const toHttpUrl = (original: string, fallback: string): string => {
  const tryUrl = (value: string): string | null => {
    try {
      const parsed = new URL(value);
      parsed.protocol = 'http:';
      return parsed.toString();
    } catch {
      return null;
    }
  };
  if (original && original.toLowerCase().startsWith('http://')) {
    return original;
  }
  const fromOriginal = tryUrl(original);
  if (fromOriginal) return fromOriginal;
  const fromFallback = tryUrl(fallback);
  if (fromFallback) return fromFallback;
  return '';
};
