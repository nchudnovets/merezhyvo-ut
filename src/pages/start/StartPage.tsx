import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MerchantEntry, StartPageFavorite, StartPageSettings, TopSite } from '../../types/models';
import type { ServicePageProps } from '../services/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useUrlSuggestions } from '../../hooks/useUrlSuggestions';
import { ipc } from '../../services/ipc/ipc';

const SEARCH_ENDPOINT = 'https://duckduckgo.com/?q=';
const TOP_SITES_LIMIT = 6;
const TOP_SITES_DAYS = 30;
const DEFAULT_START_PAGE_SETTINGS: StartPageSettings = {
  showTopSites: true,
  showFavorites: true,
  hidePanels: false,
  showCouponStores: true,
  favorites: []
};

const getHostLabel = (origin: string): string => {
  if (!origin) return '';
  try {
    return new URL(origin).hostname.replace(/^www\./, '');
  } catch {
    return origin;
  }
};

const normalizeFavoriteUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
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
        textTransform: 'uppercase',
        margin: '0 auto',
        marginBottom: '5px'
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

const readJsonSafe = async (res: Response): Promise<unknown> => {
  try {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
};

const StartPage: React.FC<ServicePageProps> = ({ mode, openInTab }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [topSites, setTopSites] = useState<TopSite[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [startSettings, setStartSettings] = useState<StartPageSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingsEnabled, setSavingsEnabled] = useState(true);
  const [savingsCountry, setSavingsCountry] = useState<string | null>(null);
  const [couponMerchants, setCouponMerchants] = useState<MerchantEntry[]>([]);
  const [favoriteInput, setFavoriteInput] = useState('');
  const [favoriteOpen, setFavoriteOpen] = useState(false);
  const [favoriteSuggestionsOpen, setFavoriteSuggestionsOpen] = useState(false);
  const [topSiteMenuOpen, setTopSiteMenuOpen] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const favoriteInputRef = useRef<HTMLInputElement | null>(null);
  const favoriteBlurTimeoutRef = useRef<number | null>(null);
  const { urlSuggestions, clearUrlSuggestions } = useUrlSuggestions(favoriteInput);

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
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const loaded = await ipc.settings.startPage.get();
        if (!cancelled) {
          setStartSettings(loaded);
        }
      } catch {
        if (!cancelled) {
          setStartSettings(DEFAULT_START_PAGE_SETTINGS);
        }
      }
    };
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSavings = async () => {
      try {
        const settings = await ipc.settings.savings.get();
        if (cancelled) return;
        setSavingsEnabled(Boolean(settings?.enabled));
        setSavingsCountry(settings?.countrySaved ?? null);
        const catalog = settings?.catalog;
        if (catalog && catalog.country && catalog.country === settings?.countrySaved) {
          setCouponMerchants(Array.isArray(catalog.merchants) ? catalog.merchants : []);
        } else {
          setCouponMerchants([]);
        }
      } catch {
        if (!cancelled) {
          setSavingsEnabled(true);
          setSavingsCountry(null);
          setCouponMerchants([]);
        }
      }
    };
    void loadSavings();
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
          const data = await readJsonSafe(res);
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

  const effectiveSettings = startSettings ?? DEFAULT_START_PAGE_SETTINGS;
  const favorites = effectiveSettings.favorites;
  const showPanels = !settingsOpen;
  const showTopSitesPanel = showPanels && effectiveSettings.showTopSites;
  const showFavoritesPanel = showPanels && effectiveSettings.showFavorites;
  const showCouponsPanel =
    showPanels &&
    effectiveSettings.showCouponStores &&
    savingsEnabled &&
    Boolean(savingsCountry) &&
    couponMerchants.length > 0;

  const fontSize = mode === 'mobile' ? 45 : 16;
  const iconSize = mode === 'mobile' ? 100 : 35;
  const gap = mode === 'mobile' ? 30 : 16;
  const labelFontSize = mode === 'mobile' ? 32 : 14;
  const suggestionFontSize = fontSize;
  const searchRadius = mode === 'mobile' ? 18 : 10;
  const cardRadius = mode === 'mobile' ? 18 : 10;
  const cardMinSize = mode === 'mobile' ? 190 : 80;
  const cardMaxSize = mode === 'mobile' ? 230 : 100;
  const settingsFontSize = mode === 'mobile' ? 36 : 16;
  const sectionTitleFontSize = mode === 'mobile' ? 36 : 18;
  const settingsIconSize = mode === 'mobile' ? 46 : 24;

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
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
      fontSize,
      position: 'relative',
      minHeight: '100%'
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

  const updateStartSettings = useCallback((patch: Partial<StartPageSettings>) => {
    setStartSettings((prev) => {
      const base = prev ?? DEFAULT_START_PAGE_SETTINGS;
      return { ...base, ...patch };
    });
    void ipc.settings.startPage
      .update(patch)
      .then((next) => {
        setStartSettings(next);
      })
      .catch(() => {});
  }, []);

  const resolveFavoriteFavicon = useCallback(async (origin: string): Promise<string | null> => {
    const api = typeof window !== 'undefined' ? window.merezhyvo?.history : undefined;
    if (!api?.query) return null;
    try {
      const result = await api.query({ origin, limit: 5 });
      const entry = result?.items?.find((item) => typeof item?.faviconId === 'string' && item.faviconId.trim());
      if (entry?.faviconId && typeof entry.faviconId === 'string') {
        return entry.faviconId;
      }
    } catch {
      return null;
    }
    return null;
  }, []);

  const handleOpenFavoriteEditor = useCallback(() => {
    setFavoriteOpen(true);
    window.setTimeout(() => {
      favoriteInputRef.current?.focus();
    }, 0);
  }, []);

  const handleCloseFavoriteEditor = useCallback(() => {
    setFavoriteOpen(false);
    setFavoriteInput('');
    setFavoriteSuggestionsOpen(false);
    clearUrlSuggestions();
  }, [clearUrlSuggestions]);

  const handleAddFavorite = useCallback(
    async (value: string) => {
      const normalized = normalizeFavoriteUrl(value);
      if (!normalized) return;
      const faviconId = await resolveFavoriteFavicon(normalized);
      const nextFavorites: StartPageFavorite[] = [];
      let exists = false;
      for (const item of favorites) {
        if (item.origin === normalized) {
          exists = true;
          nextFavorites.push({
            ...item,
            faviconId: item.faviconId ?? faviconId ?? null
          });
        } else {
          nextFavorites.push(item);
        }
      }
      if (!exists) {
        nextFavorites.push({ origin: normalized, faviconId });
      }
      updateStartSettings({ favorites: nextFavorites });
      handleCloseFavoriteEditor();
    },
    [favorites, handleCloseFavoriteEditor, resolveFavoriteFavicon, updateStartSettings]
  );

  const handleRemoveFavorite = useCallback(
    (target: string) => {
      const nextFavorites = favorites.filter((item) => item.origin !== target);
      updateStartSettings({ favorites: nextFavorites });
    },
    [favorites, updateStartSettings]
  );

  const sortedCouponMerchants = useMemo(() => {
    const list = Array.isArray(couponMerchants) ? couponMerchants : [];
    const locals: MerchantEntry[] = [];
    const globals: MerchantEntry[] = [];
    for (const m of list) {
      if (m?.hasLocal) {
        locals.push(m);
      } else {
        globals.push(m);
      }
    }
    const byFreshness = (a: MerchantEntry, b: MerchantEntry) => {
      const aTs = typeof a.freshestCoupon === 'string' ? Date.parse(a.freshestCoupon) : 0;
      const bTs = typeof b.freshestCoupon === 'string' ? Date.parse(b.freshestCoupon) : 0;
      if (Number.isFinite(aTs) && Number.isFinite(bTs) && aTs !== bTs) {
        return bTs - aTs;
      }
      const aName = (a.name ?? a.domain ?? '').toLowerCase();
      const bName = (b.name ?? b.domain ?? '').toLowerCase();
      return aName.localeCompare(bName);
    };
    locals.sort(byFreshness);
    globals.sort(byFreshness);
    return [...locals, ...globals].slice(0, 12);
  }, [couponMerchants]);

  const handleRemoveTopSite = useCallback((origin: string) => {
    setTopSiteMenuOpen(null);
    setTopSites((prev) => prev.filter((site) => site.origin !== origin));
    const api = typeof window !== 'undefined' ? window.merezhyvo?.history : undefined;
    if (api?.remove) {
      void api.remove({ origin }).catch(() => {});
    }
  }, []);

  const handleFavoriteFocus = useCallback(() => {
    if (favoriteBlurTimeoutRef.current) {
      window.clearTimeout(favoriteBlurTimeoutRef.current);
      favoriteBlurTimeoutRef.current = null;
    }
    if (urlSuggestions.length > 0) {
      setFavoriteSuggestionsOpen(true);
    }
  }, [urlSuggestions.length]);

  const handleFavoriteBlur = useCallback(() => {
    if (favoriteBlurTimeoutRef.current) {
      window.clearTimeout(favoriteBlurTimeoutRef.current);
    }
    favoriteBlurTimeoutRef.current = window.setTimeout(() => {
      setFavoriteSuggestionsOpen(false);
      favoriteBlurTimeoutRef.current = null;
    }, 120);
  }, []);

  const handleFavoriteSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleAddFavorite(favoriteInput);
    },
    [favoriteInput, handleAddFavorite]
  );

  const handleFavoriteKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseFavoriteEditor();
      }
    },
    [handleCloseFavoriteEditor]
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
            boxSizing: 'border-box',
            marginBottom: mode === 'mobile' ? 40 : 20
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

      {settingsOpen ? (
        <div
          style={{
            width: 'min(760px, 100%)',
            maxWidth: '100%',
            borderRadius: cardRadius,
            border: '1px solid var(--mzr-border-strong)',
            background: 'var(--mzr-surface-weak)',
            padding: mode === 'mobile' ? '26px 24px' : '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: mode === 'mobile' ? 22 : 12
          }}
        >
          {[
            {
              key: 'showTopSites',
              label: t('start.settings.showTopSites'),
              checked: effectiveSettings.showTopSites,
              disabled: false
            },
            {
              key: 'showFavorites',
              label: t('start.settings.showFavorites'),
              checked: effectiveSettings.showFavorites,
              disabled: false
            },
            {
              key: 'showCouponStores',
              label: t('start.settings.showCouponStores'),
              checked: savingsEnabled ? effectiveSettings.showCouponStores : false,
              disabled: !savingsEnabled
            }
          ].map((item) => {
            const toggleTrackWidth = mode === 'mobile' ? 120 : 62;
            const toggleTrackHeight = mode === 'mobile' ? 56 : 28;
            const toggleThumbSize = mode === 'mobile' ? 46 : 22;
            return (
              <label
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: mode === 'mobile' ? 20 : 12,
                  fontSize: settingsFontSize,
                  color: 'var(--mzr-text-primary)',
                  fontWeight: 600,
                  opacity: item.disabled ? 0.55 : 1
                }}
              >
                <span>{item.label}</span>
                <span
                  style={{
                    position: 'relative',
                    width: toggleTrackWidth,
                    height: toggleTrackHeight,
                    flexShrink: 0,
                    display: 'inline-block'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    disabled={item.disabled}
                    onChange={(event) => {
                      if (item.disabled) return;
                      const checked = event.target.checked;
                      if (item.key === 'showTopSites') {
                        updateStartSettings({ showTopSites: checked });
                      } else if (item.key === 'showFavorites') {
                        updateStartSettings({ showFavorites: checked });
                        if (!checked) {
                          handleCloseFavoriteEditor();
                        }
                      } else if (item.key === 'showCouponStores') {
                        updateStartSettings({ showCouponStores: checked });
                      }
                    }}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer'
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 999,
                      background: item.checked ? 'var(--mzr-accent)' : 'var(--mzr-surface-muted)',
                      transition: 'background 0.2s ease',
                      boxShadow: item.checked
                        ? '0 0 0 1px rgba(59,130,246,0.3)'
                        : 'inset 0 0 0 1px var(--mzr-border)'
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: (toggleTrackHeight - toggleThumbSize) / 2,
                      left: item.checked ? toggleTrackWidth - toggleThumbSize - 4 : 4,
                      width: toggleThumbSize,
                      height: toggleThumbSize,
                      borderRadius: '50%',
                      background: item.checked ? '#ffffff' : 'var(--mzr-border-strong)',
                      transition: 'left 0.2s ease'
                    }}
                  />
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: mode === 'mobile' ? 40 : 24,
            width: 'min(760px, 100%)',
            maxWidth: '100%'
          }}
        >
          {showTopSitesPanel && topSites.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: mode === 'mobile' ? 18 : 12 }}>
              {/* <div style={{ fontSize: sectionTitleFontSize, fontWeight: 700 }}>
                {t('start.topSites.title')}
              </div> */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fit, minmax(${cardMinSize}px, ${cardMaxSize}px))`,
                  gap,
                  width: '100%',
                  maxWidth: '100%',
                  justifyContent: topSites?.length < 5 ? 'start' : 'space-between'
                }}
              >
                {topSites.slice(0, TOP_SITES_LIMIT).map((site) => {
                  const label = getHostLabel(site.origin);
                  return (
                    <div
                      key={site.origin}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: mode === 'mobile' ? 18 : 10,
                        borderRadius: cardRadius,
                        border: '1px solid var(--mzr-border-strong)',
                        background: 'var(--mzr-surface-weak)',
                        gap: mode === 'mobile' ? 14 : 8,
                        width: '100%',
                        maxWidth: cardMaxSize,
                        maxHeight: cardMaxSize,
                        aspectRatio: '1 / 1',
                        boxSizing: 'border-box'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openInTab(site.origin)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: mode === 'mobile' ? 14 : 8,
                          overflow: 'hidden',
                          maxWidth: '100%'
                        }}
                        aria-label={label || site.origin}
                      >
                        <FaviconTile faviconId={site.faviconId} label={label} size={iconSize} />
                        <span
                          style={{
                            fontSize: labelFontSize,
                            color: 'var(--mzr-text-primary)',
                            lineHeight: 1.15,
                            textAlign: 'start',
                          }}
                        >
                          {label}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setTopSiteMenuOpen((prev) => (prev === site.origin ? null : site.origin));
                        }}
                        style={{
                          position: 'absolute',
                          top: mode === 'mobile' ? 10 : 6,
                          right: mode === 'mobile' ? 10 : 6,
                          width: mode === 'mobile' ? 36 : 22,
                          height: mode === 'mobile' ? 36 : 22,
                          borderRadius: '50%',
                          border: '1px solid var(--mzr-border-strong)',
                          background: 'var(--mzr-surface)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}
                        aria-label={t('start.topSites.menu')}
                        title={t('start.topSites.menu')}
                      >
                        <svg
                          width={mode === 'mobile' ? 18 : 12}
                          height={mode === 'mobile' ? 18 : 12}
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <circle cx="5" cy="12" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="19" cy="12" r="2" />
                        </svg>
                      </button>
                      {topSiteMenuOpen === site.origin && (
                        <div
                          style={{
                            position: 'absolute',
                            top: mode === 'mobile' ? 48 : 22,
                            right: mode === 'mobile' ? 8 : 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: mode === 'mobile' ? 15 : 6,
                            padding: mode === 'mobile' ? 16 : 8,
                            borderRadius: 10,
                            border: '1px solid var(--mzr-border-strong)',
                            background: 'var(--mzr-surface)',
                            zIndex: 2
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleRemoveTopSite(site.origin)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--mzr-text-primary)',
                              fontSize: mode === 'mobile' ? 32 : 14,
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            {t('start.topSites.removeFromHistory')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setTopSiteMenuOpen(null)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--mzr-text-primary)',
                              fontSize: mode === 'mobile' ? 32 : 14,
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            {t('global.cancel')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showFavoritesPanel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: mode === 'mobile' ? 18 : 12 }}>
              {/* <div style={{ fontSize: sectionTitleFontSize, fontWeight: 700 }}>
                {t('start.favorites.title')}
              </div> */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fit, minmax(${cardMinSize}px, ${cardMaxSize}px))`,
                  gap,
                  width: '100%',
                  maxWidth: '100%',
                  justifyContent: favorites?.length < 5 ? 'start' : 'space-between'
                }}
              >
                {favorites.map((favorite) => {
                  const origin = typeof favorite.origin === 'string' ? favorite.origin : '';
                  const label = getHostLabel(origin);
                  return (
                    <div
                      key={origin}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: mode === 'mobile' ? 18 : 10,
                        borderRadius: cardRadius,
                        border: '1px solid var(--mzr-border-strong)',
                        background: 'var(--mzr-surface-weak)',
                        gap: mode === 'mobile' ? 14 : 8,
                        width: '100%',
                        maxWidth: cardMaxSize,
                        maxHeight: cardMaxSize,
                        aspectRatio: '1 / 1',
                        boxSizing: 'border-box'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openInTab(origin)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: mode === 'mobile' ? 14 : 8,
                          cursor: 'pointer',
                          overflow: 'hidden',
                          maxWidth: '100%'
                        }}
                        aria-label={label || origin}
                      >
                        <FaviconTile faviconId={favorite.faviconId} label={label} size={iconSize} />
                        <span
                          style={{
                            fontSize: labelFontSize,
                            color: 'var(--mzr-text-primary)',
                            lineHeight: 1.15,
                            textAlign: 'center',
                            wordBreak: 'break-word',
                          }}
                        >
                          {label}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFavorite(origin)}
                        style={{
                          position: 'absolute',
                          top: mode === 'mobile' ? 10 : 6,
                          right: mode === 'mobile' ? 10 : 6,
                          width: mode === 'mobile' ? 45 : 22,
                          height: mode === 'mobile' ? 45 : 22,
                          borderRadius: '50%',
                          border: '1px solid var(--mzr-border-strong)',
                          background: 'var(--mzr-surface)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        aria-label={t('start.favorites.remove')}
                        title={t('start.favorites.remove')}
                      >
                        <svg
                          width={mode === 'mobile' ? 18 : 12}
                          height={mode === 'mobile' ? 18 : 12}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <line x1="6" y1="6" x2="18" y2="18" />
                          <line x1="6" y1="18" x2="18" y2="6" />
                        </svg>
                      </button>
                    </div>
                  );
                })}

                {!favoriteOpen && (
                  <button
                    type="button"
                    onClick={handleOpenFavoriteEditor}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: mode === 'mobile' ? 18 : 10,
                      borderRadius: cardRadius,
                      border: '1px dashed var(--mzr-border-strong)',
                      background: 'transparent',
                      cursor: 'pointer',
                      gap: mode === 'mobile' ? 14 : 8,
                      width: '100%',
                      maxWidth: cardMaxSize,
                      maxHeight: cardMaxSize,
                      aspectRatio: '1 / 1',
                      boxSizing: 'border-box'
                    }}
                        aria-label={t('start.favorites.add')}
                        title={t('start.favorites.add')}
                    >
                    <svg
                      width={mode === 'mobile' ? 60 : 28}
                      height={mode === 'mobile' ? 60 : 28}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                )}
              </div>

              {favoriteOpen && (
                <form
                  onSubmit={handleFavoriteSubmit}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: mode === 'mobile' ? 14 : 8
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
                    <input
                      ref={favoriteInputRef}
                      type="text"
                      value={favoriteInput}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setFavoriteInput(nextValue);
                        if (!nextValue.trim()) {
                          clearUrlSuggestions();
                          setFavoriteSuggestionsOpen(false);
                        } else {
                          setFavoriteSuggestionsOpen(true);
                        }
                      }}
                      onFocus={handleFavoriteFocus}
                      onBlur={handleFavoriteBlur}
                      onKeyDown={handleFavoriteKeyDown}
                      placeholder={t('start.favorites.addPlaceholder')}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        borderRadius: `${searchRadius}px 0 0 ${searchRadius}px`,
                        border: '1px solid var(--mzr-border-strong)',
                        borderRight: 'none',
                        background: 'var(--mzr-surface-weak)',
                        color: 'var(--mzr-text-primary)',
                        padding: mode === 'mobile' ? '18px 20px' : '10px 14px',
                        fontSize,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      aria-label={t('start.favorites.addPlaceholder')}
                    />
                    <button
                      type="submit"
                      style={{
                        borderRadius: `0 ${searchRadius}px ${searchRadius}px 0`,
                        border: '1px solid var(--mzr-border-strong)',
                        borderLeft: 'none',
                        background: 'var(--mzr-surface-elevated, var(--mzr-surface-weak))',
                        color: 'var(--mzr-text-primary)',
                        padding: mode === 'mobile' ? '18px 18px' : '10px 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                      aria-label={t('start.favorites.add')}
                      title={t('start.favorites.add')}
                    >
                      <svg
                        width={mode === 'mobile' ? 32 : 18}
                        height={mode === 'mobile' ? 32 : 18}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseFavoriteEditor}
                      style={{
                        marginLeft: mode === 'mobile' ? 12 : 8,
                        borderRadius: searchRadius,
                        border: '1px solid var(--mzr-border-strong)',
                        background: 'transparent',
                        color: 'var(--mzr-text-primary)',
                        padding: mode === 'mobile' ? '18px 18px' : '10px 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                      aria-label={t('global.close')}
                      title={t('global.close')}
                    >
                      <svg
                        width={mode === 'mobile' ? 28 : 16}
                        height={mode === 'mobile' ? 28 : 16}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <line x1="6" y1="6" x2="18" y2="18" />
                        <line x1="6" y1="18" x2="18" y2="6" />
                      </svg>
                    </button>
                  </div>

                  {favoriteSuggestionsOpen && urlSuggestions.length > 0 && (
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
                      {urlSuggestions.map((item) => {
                        const title = item.title?.trim() || getHostLabel(item.url);
                        const secondaryFontSize = mode === 'mobile' ? 36 : 13;
                        return (
                          <button
                            key={item.url}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              handleAddFavorite(item.url);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: mode === 'mobile' ? '16px 20px' : '8px 12px',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--mzr-text-primary)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: mode === 'mobile' ? 6 : 2
                            }}
                          >
                            <span style={{ fontSize: fontSize, fontWeight: 600 }}>{title}</span>
                            <span style={{ fontSize: secondaryFontSize, color: 'var(--mzr-text-secondary)' }}>
                              {item.url}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </form>
              )}
            </div>
          )}

          {showCouponsPanel && (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: mode === 'mobile' ? 18 : 12,
                marginTop: mode === 'mobile' ? 40 : 20
              }}>
              <div style={{ fontSize: sectionTitleFontSize, fontWeight: 700 }}>
                {t('start.coupons.title')}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fit, minmax(${cardMinSize}px, ${cardMaxSize}px))`,
                  gap,
                  width: '100%',
                  maxWidth: '100%',
                  justifyContent: sortedCouponMerchants?.length < 5 ? 'start' : 'space-between'
                }}
              >
                {sortedCouponMerchants.map((merchant) => {
                  const label = merchant.name?.trim() || merchant.domain;
                  return (
                    <button
                      key={merchant.domain}
                      type="button"
                      onClick={() => openInTab(`https://${merchant.domain}`)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: mode === 'mobile' ? 18 : 10,
                        borderRadius: cardRadius,
                        border: '1px solid var(--mzr-border-strong)',
                        background: 'var(--mzr-surface-weak)',
                        gap: mode === 'mobile' ? 14 : 8,
                        width: '100%',
                        maxWidth: cardMaxSize,
                        maxHeight: cardMaxSize,
                        aspectRatio: '1 / 1',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        overflow: 'hidden'
                      }}
                      aria-label={label}
                    >
                      {merchant.imageUrl ? (
                        <img
                          src={merchant.imageUrl}
                          alt=""
                          style={{
                            height: iconSize,
                            objectFit: 'contain',
                            borderRadius: Math.round(iconSize * 0.16),
                            background: 'var(--mzr-surface)'
                          }}
                        />
                      ) : (
                        <FaviconTile faviconId={null} label={merchant.domain} size={iconSize} />
                      )}
                      <span
                        style={{
                          fontSize: labelFontSize,
                          color: 'var(--mzr-text-primary)',
                          lineHeight: 1.15,
                          textAlign: 'center',
                        }}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setSettingsOpen((prev) => !prev)}
        style={{
          position: 'absolute',
          top: mode === 'mobile' ? 28 : 18,
          right: mode === 'mobile' ? 28 : 18,
          width: mode === 'mobile' ? 70 : 40,
          height: mode === 'mobile' ? 70 : 40,
          borderRadius: '50%',
          border: '1px solid var(--mzr-border-strong)',
          background: 'var(--mzr-surface-elevated, var(--mzr-surface))',
          color: 'var(--mzr-text-primary)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 10
        }}
        aria-label={t('start.settings.button')}
        title={t('start.settings.button')}
      >
        <svg
          width={settingsIconSize}
          height={settingsIconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  );
};

export default StartPage;
