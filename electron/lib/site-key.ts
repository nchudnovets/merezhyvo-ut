import { getDomain } from 'tldts';

export const safeHostnameFromUrl = (url: string): string | null => {
  if (!url || typeof url !== 'string') return null;
  try {
    const host = new URL(url).hostname;
    return host ? host.toLowerCase() : null;
  } catch {
    return null;
  }
};

/**
 * Returns eTLD+1 (site key) using PSL. Falls back to the hostname itself.
 */
export const getSiteKey = (input: string | null | undefined): string | null => {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  let host = trimmed;
  try {
    const parsed = new URL(trimmed);
    host = parsed.hostname.toLowerCase();
  } catch {
    // not a URL, treat as hostname
  }
  const domain = getDomain(host, { allowPrivateDomains: true });
  return domain || host || null;
};

