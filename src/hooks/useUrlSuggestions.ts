import { useCallback, useEffect, useRef, useState } from 'react';

export type UrlSuggestion = { url: string; title?: string | null; source: 'history' | 'bookmark' };

export const useUrlSuggestions = (query: string) => {
  const [urlSuggestions, setUrlSuggestions] = useState<UrlSuggestion[]>([]);
  const bookmarksCacheRef = useRef<
    { url: string; title?: string | null; createdAt?: number; updatedAt?: number }[]
  >([]);
  const bookmarksCacheReadyRef = useRef(false);

  const loadBookmarksCache = useCallback(async () => {
    if (bookmarksCacheReadyRef.current) {
      return bookmarksCacheRef.current;
    }
    try {
      const result = await window.merezhyvo?.bookmarks?.query?.({
        q: '',
        limit: 100,
        includeDeleted: false
      });
      const items = (result?.items ?? []) as {
        url?: unknown;
        title?: unknown;
        createdAt?: unknown;
        updatedAt?: unknown;
      }[];
      const filtered = items.filter((item) => item && typeof item.url === 'string' && item.url.trim().length > 0);
      bookmarksCacheRef.current = filtered.map((b) => ({
        url: (b.url as string).trim(),
        title: typeof b.title === 'string' ? b.title : '',
        createdAt: typeof b.createdAt === 'number' ? b.createdAt : undefined,
        updatedAt: typeof b.updatedAt === 'number' ? b.updatedAt : undefined
      }));
    } catch {
      bookmarksCacheRef.current = [];
    } finally {
      bookmarksCacheReadyRef.current = true;
    }
    return bookmarksCacheRef.current;
  }, []);

  useEffect(() => {
    const onBookmarksChanged = () => {
      bookmarksCacheReadyRef.current = false;
      bookmarksCacheRef.current = [];
    };
    window.addEventListener('merezhyvo:bookmarks:changed', onBookmarksChanged);
    return () => {
      window.removeEventListener('merezhyvo:bookmarks:changed', onBookmarksChanged);
    };
  }, []);

  const fetchUrlSuggestions = useCallback(
    async (rawQuery: string) => {
      if (typeof window === 'undefined') {
        return;
      }
      if (!window.merezhyvo?.history && !window.merezhyvo?.bookmarks) {
        return;
      }
      const needle = rawQuery.trim();
      if (!needle) {
        setUrlSuggestions([]);
        return;
      }
      const normalizedNeedle = needle.toLowerCase();
      const apiHistory = window.merezhyvo?.history;
      let historyItems: { url: string; title?: string | null }[] = [];
      try {
        const result = await apiHistory?.query?.({ q: needle, limit: 20 });
        historyItems =
          result?.items?.map((item: any) => ({ url: item.url, title: item.title })) ?? [];
      } catch (err) {
        console.error('[suggestions] history query failed', err);
        historyItems = [];
      }

      let bookmarkItems:
        | { url: string; title?: string | null; createdAt?: number; updatedAt?: number }[]
        | [] = [];
      try {
        const cache = await loadBookmarksCache();
        bookmarkItems = cache.filter((entry) => {
          const haystack = `${entry.url} ${entry.title ?? ''}`.toLowerCase();
          return haystack.includes(normalizedNeedle);
        });
        bookmarkItems.sort((a, b) => {
          const aTs = a.updatedAt ?? a.createdAt ?? 0;
          const bTs = b.updatedAt ?? b.createdAt ?? 0;
          return bTs - aTs;
        });
      } catch (err) {
        console.error('[suggestions] bookmark scan failed', err);
        bookmarkItems = [];
      }

      const seen = new Set<string>();
      const combined: UrlSuggestion[] = [];
      for (const item of historyItems) {
        const key = item.url;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        combined.push({ url: key, title: item.title, source: 'history' });
        if (combined.length >= 5) break;
      }
      if (combined.length < 5) {
        for (const bm of bookmarkItems) {
          const key = bm.url;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          combined.push({ url: key, title: bm.title, source: 'bookmark' });
          if (combined.length >= 5) break;
        }
      }
      if (combined.length > 0) {
        try {
          const firstEntry = combined[0];
          if (!firstEntry) {
            return;
          }
          const first = new URL(firstEntry.url);
          const baseOrigin = first.origin;
          const allSameOrigin = combined.every((item) => {
            try {
              return new URL(item.url).origin === baseOrigin;
            } catch {
              return false;
            }
          });
          const hasOriginEntry = combined.some((item) => {
            try {
              const parsed = new URL(item.url);
              return parsed.origin === baseOrigin && (parsed.pathname === '/' || parsed.pathname === '');
            } catch {
              return false;
            }
          });
          if (allSameOrigin && !hasOriginEntry && !seen.has(baseOrigin)) {
            combined.unshift({ url: baseOrigin, title: baseOrigin, source: 'history' });
            seen.add(baseOrigin);
            if (combined.length > 5) {
              combined.length = 5;
            }
          }
        } catch {
          // ignore malformed URLs
        }
      }
      setUrlSuggestions(combined);
    },
    [loadBookmarksCache]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const timer = window.setTimeout(() => {
      void fetchUrlSuggestions(query);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [query, fetchUrlSuggestions]);

  const clearUrlSuggestions = useCallback(() => setUrlSuggestions([]), []);

  return { urlSuggestions, clearUrlSuggestions };
};
