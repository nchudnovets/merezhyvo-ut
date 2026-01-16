import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TopSite } from '../../types/models';
import type { ServicePageProps } from '../services/types';
import { useI18n } from '../../i18n/I18nProvider';

const SEARCH_ENDPOINT = 'https://duckduckgo.com/?q=';
const TOP_SITES_LIMIT = 6;
const TOP_SITES_DAYS = 30;

const getHostLabel = (origin: string): string => {
  if (!origin) return '';
  try {
    return new URL(origin).hostname.replace(/^www\./, '');
  } catch {
    return origin;
  }
};

const FaviconTile: React.FC<{
  faviconId?: string | null;
  label: string;
  size: number;
}> = ({ faviconId, label, size }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const api = typeof window !== 'undefined' ? window.merezhyvo?.favicons : undefined;
    if (!faviconId || !api) {
      void Promise.resolve().then(() => {
        if (!cancelled) setSrc(null);
      });
      return () => {
        cancelled = true;
      };
    }
    void api
      .getPath(faviconId)
      .then((path) => {
        if (cancelled) return;
        setSrc(path ? `file://${path}` : null);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [faviconId]);

  if (src) {
        return (
          <img
            src={src}
            alt=""
            style={{
              width: size,
              height: size,
              borderRadius: Math.round(size * 0.16),
              objectFit: 'cover'
            }}
          />
        );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.16),
        background: 'var(--mzr-surface-weak)',
        border: '1px solid var(--mzr-border-strong)',
        color: 'var(--mzr-text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(14, Math.round(size * 0.38)),
        fontWeight: 700,
        textTransform: 'uppercase'
      }}
    >
      {label.trim().charAt(0) || '?'}
    </div>
  );
};

const extractSuggestions = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const results: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || !('phrase' in item)) continue;
    const phrase = (item as { phrase?: unknown }).phrase;
    if (typeof phrase === 'string' && phrase.trim()) {
      results.push(phrase);
    }
  }
  return results;
};

const StartPage: React.FC<ServicePageProps> = ({ mode, openInTab }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [topSites, setTopSites] = useState<TopSite[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const api = typeof window !== 'undefined' ? window.merezhyvo?.history : undefined;
    if (!api) {
      return () => {
        cancelled = true;
      };
    }
    void api
      .topSites({ limit: TOP_SITES_LIMIT, days: TOP_SITES_DAYS })
      .then((sites) => {
        if (!cancelled) {
          setTopSites(Array.isArray(sites) ? sites : []);
        }
      })
      .catch(() => {
        if (!cancelled) setTopSites([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    const currentId = ++requestIdRef.current;
    debounceRef.current = window.setTimeout(() => {
      const run = async () => {
        try {
          const res = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(trimmed)}`);
          if (requestIdRef.current !== currentId) return;
          if (!res.ok) {
            setSuggestions([]);
            setSuggestionsOpen(false);
            return;
          }
          let data: unknown = null;
          try {
            data = await res.json();
          } catch {
            data = null;
          }
          const phrases = extractSuggestions(data);
          setSuggestions(phrases);
          setSuggestionsOpen(phrases.length > 0);
        } catch {
          if (requestIdRef.current !== currentId) return;
          setSuggestions([]);
          setSuggestionsOpen(false);
        }
      };
      void run();
    }, 250);
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [query]);

  const fontSize = mode === 'mobile' ? 45 : 16;
  const iconSize = mode === 'mobile' ? 100 : 50;
  const gap = mode === 'mobile' ? 30 : 16;
  const labelFontSize = mode === 'mobile' ? 32 : 16;
  const suggestionFontSize = fontSize;
  const searchRadius = mode === 'mobile' ? 18 : 10;
  const cardRadius = mode === 'mobile' ? 18 : 10;
  const cardMinSize = mode === 'mobile' ? 190 : 120;

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: mode === 'mobile' ? '140px 32px 60px' : '80px 24px 40px',
      gap: mode === 'mobile' ? 48 : 28,
      background: 'var(--mzr-surface)',
      color: 'var(--mzr-text-primary)',
      boxSizing: 'border-box',
      fontSize
    }),
    [mode, fontSize]
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;
      setSuggestionsOpen(false);
      openInTab(`${SEARCH_ENDPOINT}${encodeURIComponent(trimmed)}`);
    },
    [query, openInTab]
  );

  const handleInputFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (suggestions.length > 0) {
      setSuggestionsOpen(true);
    }
  }, [suggestions.length]);

  const handleInputBlur = useCallback(() => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = window.setTimeout(() => {
      setSuggestionsOpen(false);
      blurTimeoutRef.current = null;
    }, 120);
  }, []);

  const handleSuggestionPick = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setQuery(trimmed);
      setSuggestionsOpen(false);
      openInTab(`${SEARCH_ENDPOINT}${encodeURIComponent(trimmed)}`);
    },
    [openInTab]
  );

  return (
    <div style={containerStyle}>
      <div
        style={{
          width: 'min(760px, 100%)',
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: mode === 'mobile' ? 16 : 8
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'stretch',
            boxSizing: 'border-box'
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(event) => {
              const nextValue = event.target.value;
              setQuery(nextValue);
              if (!nextValue.trim()) {
                setSuggestions([]);
                setSuggestionsOpen(false);
              }
            }}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={t('start.search.placeholder')}
            style={{
              flex: 1,
              minWidth: 0,
            borderRadius: `${searchRadius}px 0 0 ${searchRadius}px`,
            border: '1px solid var(--mzr-border-strong)',
            borderRight: 'none',
            background: 'var(--mzr-surface-weak)',
              color: 'var(--mzr-text-primary)',
              padding: mode === 'mobile' ? '20px 24px' : '10px 16px',
              fontSize,
              outline: 'none',
              boxSizing: 'border-box'
            }}
            aria-label={t('start.search.placeholder')}
          />
          <button
            type="submit"
            style={{
            borderRadius: `0 ${searchRadius}px ${searchRadius}px 0`,
            border: '1px solid var(--mzr-border-strong)',
            borderLeft: 'none',
            background: 'var(--mzr-surface-elevated, var(--mzr-surface-weak))',
            color: 'var(--mzr-text-primary)',
            padding: mode === 'mobile' ? '20px 22px' : '10px 14px',
            fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            aria-label={t('start.search.button')}
            title={t('start.search.button')}
          >
            <svg
              width={mode === 'mobile' ? 36 : 18}
              height={mode === 'mobile' ? 36 : 18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </form>

        {suggestionsOpen && suggestions.length > 0 && (
          <div
            role="listbox"
            style={{
              width: '100%',
              borderRadius: cardRadius,
              border: '1px solid var(--mzr-border-strong)',
              background: 'var(--mzr-surface-weak)',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
          >
            {suggestions.slice(0, 8).map((item) => (
              <button
                key={item}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSuggestionPick(item);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: mode === 'mobile' ? '16px 20px' : '8px 12px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--mzr-text-primary)',
                  fontSize: suggestionFontSize,
                  cursor: 'pointer'
                }}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>

      {topSites.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(${cardMinSize}px, 1fr))`,
            gap,
            width: 'min(760px, 100%)',
            maxWidth: '100%'
          }}
        >
          {topSites.slice(0, TOP_SITES_LIMIT).map((site) => {
            const label = getHostLabel(site.origin);
            return (
              <button
                key={site.origin}
                type="button"
                onClick={() => openInTab(site.origin)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: mode === 'mobile' ? 18 : 10,
                  borderRadius: cardRadius,
                  border: '1px solid var(--mzr-border-strong)',
                  background: 'var(--mzr-surface-weak)',
                  cursor: 'pointer',
                  gap: mode === 'mobile' ? 14 : 8,
                  minWidth: cardMinSize,
                  aspectRatio: '1 / 1',
                  boxSizing: 'border-box'
                }}
                aria-label={label || site.origin}
              >
                <FaviconTile faviconId={site.faviconId} label={label} size={iconSize} />
                <span
                  style={{
                    fontSize: labelFontSize,
                    color: 'var(--mzr-text-primary)',
                    lineHeight: 1.15,
                    textAlign: 'center',
                    wordBreak: 'break-word'
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StartPage;
