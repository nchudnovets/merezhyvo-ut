import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ServicePageProps } from '../services/types';
import type { Mode, SiteDataEntry } from '../../types/models';
import { useI18n } from '../../i18n/I18nProvider';

const rowBorder = '1px solid rgba(148,163,184,0.28)';
const PAGE_SIZE = 50;

type ClearFlags = {
  cookiesAndSiteData: boolean;
  cache: boolean;
  history: boolean;
};

const normalizeHost = (host: string | null | undefined): string => {
  if (!host) return '';
  let safe = host.trim().toLowerCase();
  if (!safe) return '';
  if (safe.startsWith('.')) safe = safe.slice(1);
  if (safe.startsWith('www.') && safe.length > 4) safe = safe.slice(4);
  return safe;
};

const parseHostFromUrl = (url: string | undefined): string => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return normalizeHost(parsed.searchParams.get('host') ?? '');
  } catch {
    return '';
  }
};

const formatLabel = (mode: Mode): React.CSSProperties => ({
  fontSize: mode === 'mobile' ? '34px' : '14px',
  color: 'rgba(226,232,240,0.75)'
});

const SiteDataPage: React.FC<ServicePageProps> = ({ mode, serviceUrl }) => {
  const { t } = useI18n();
  const initialFilter = parseHostFromUrl(serviceUrl);
  const [loading, setLoading] = useState<boolean>(true);
  const [entries, setEntries] = useState<SiteDataEntry[]>([]);
  const [query, setQuery] = useState<string>(initialFilter);
  const [debouncedQuery, setDebouncedQuery] = useState<string>(initialFilter);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [clearingHost, setClearingHost] = useState<string | null>(null);
  const [confirmingHost, setConfirmingHost] = useState<string | null>(null);
  const [globalExpanded, setGlobalExpanded] = useState<boolean>(true);
  const [globalFlags, setGlobalFlags] = useState<ClearFlags>({
    cookiesAndSiteData: true,
    cache: true,
    history: false
  });
  const [clearingGlobal, setClearingGlobal] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const [clearedCookiesHosts, setClearedCookiesHosts] = useState<Set<string>>(new Set());
  const [clearedStorageHosts, setClearedStorageHosts] = useState<Set<string>>(new Set());
  const [clearedHistoryHosts, setClearedHistoryHosts] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const refreshEntries = useCallback(
    async (
      overrides?: {
        clearedCookies?: Set<string>;
        clearedStorage?: Set<string>;
        clearedHistory?: Set<string>;
      }
    ) => {
      setLoading(true);
      try {
        const next = (await window.merezhyvo?.settings?.siteData?.list?.()) ?? [];
        const normalizedClearedCookies = overrides?.clearedCookies ?? clearedCookiesHosts;
        const normalizedClearedStorage = overrides?.clearedStorage ?? clearedStorageHosts;
        const normalizedClearedHistory = overrides?.clearedHistory ?? clearedHistoryHosts;
        const adjusted = next.map((entry) => {
          const hostNorm = normalizeHost(entry.host);
          const isCleared = (set: Set<string>) =>
            set.has(hostNorm) ||
            Array.from(set).some(
              (h) => hostNorm === h || hostNorm.endsWith(`.${h}`) || h.endsWith(`.${hostNorm}`)
            );
          const clearedCookies = isCleared(normalizedClearedCookies);
          const clearedStorage = isCleared(normalizedClearedStorage);
          const historyCleared = isCleared(normalizedClearedHistory);
          return {
            ...entry,
            hasCookies: clearedCookies ? false : entry.hasCookies,
            hasSiteStorage: clearedStorage ? false : entry.hasSiteStorage,
            hasHistory: historyCleared ? false : entry.hasHistory
          };
        });
        setEntries(adjusted);
        setVisibleCount(PAGE_SIZE);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [clearedCookiesHosts, clearedHistoryHosts, clearedStorageHosts]
  );

  useEffect(() => {
    void refreshEntries();
  }, [refreshEntries]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 180);
    return () => window.clearTimeout(id);
  }, [query]);

  const filteredEntries = useMemo(() => {
    if (!debouncedQuery) return entries;
    return entries.filter((entry) => entry.host.toLowerCase().includes(debouncedQuery));
  }, [entries, debouncedQuery]);

  useEffect(() => {
    if (!debouncedQuery) return;
    const idx = filteredEntries.findIndex((entry) => entry.host.toLowerCase().includes(debouncedQuery));
    if (idx >= 0) {
      setVisibleCount(Math.max(PAGE_SIZE, Math.ceil((idx + 1) / PAGE_SIZE) * PAGE_SIZE));
    }
  }, [debouncedQuery, filteredEntries]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const handler = () => {
      const { scrollTop, scrollHeight, clientHeight } = node;
      if (scrollHeight - (scrollTop + clientHeight) < 200) {
        setVisibleCount((prev) => prev + PAGE_SIZE);
      }
    };
    node.addEventListener('scroll', handler);
    return () => node.removeEventListener('scroll', handler);
  }, []);

  const handleClearCookies = useCallback(
    async (host: string) => {
      if (!host) return;
      setClearingHost(host);
      try {
        await window.merezhyvo?.settings?.siteData?.clearCookiesForSite?.(host);
        setToast(t('siteData.toast.cookiesCleared', { host }));
        const normalized = normalizeHost(host);
        setEntries((prev) =>
          prev.map((entry) => {
            const hostNorm = normalizeHost(entry.host);
            const matches =
              hostNorm === normalized ||
              hostNorm.endsWith(`.${normalized}`) ||
              normalized.endsWith(`.${hostNorm}`);
            return matches ? { ...entry, hasCookies: false } : entry;
          })
        );
        setClearedCookiesHosts((prev) => {
          const next = new Set(prev);
          next.add(normalized);
          void refreshEntries({ clearedCookies: next });
          return next;
        });
      } catch {
        setToast(t('siteData.toast.error'));
      } finally {
        setClearingHost(null);
        setConfirmingHost(null);
        window.setTimeout(() => setToast(null), 2000);
      }
    },
    [refreshEntries, t]
  );

  const handleClearStorage = useCallback(
    async (host: string) => {
      if (!host) return;
      setClearingHost(host);
      try {
        await window.merezhyvo?.settings?.siteData?.clearStorageForSite?.(host);
        setToast(t('siteData.toast.storageCleared', { host }));
        const normalized = normalizeHost(host);
        setEntries((prev) =>
          prev.map((entry) => {
            const hostNorm = normalizeHost(entry.host);
            const matches =
              hostNorm === normalized ||
              hostNorm.endsWith(`.${normalized}`) ||
              normalized.endsWith(`.${hostNorm}`);
            return matches ? { ...entry, hasSiteStorage: false } : entry;
          })
        );
        setClearedStorageHosts((prev) => {
          const next = new Set(prev);
          next.add(normalized);
          void refreshEntries({ clearedStorage: next });
          return next;
        });
      } catch {
        setToast(t('siteData.toast.error'));
      } finally {
        setClearingHost(null);
        setConfirmingHost(null);
        window.setTimeout(() => setToast(null), 2000);
      }
    },
    [refreshEntries, t]
  );

  const handleClearHistory = useCallback(
    async (host: string) => {
      if (!host) return;
      setClearingHost(host);
      try {
        await window.merezhyvo?.settings?.siteData?.clearHistoryForSite?.(host);
        setToast(t('siteData.toast.historyCleared', { host }));
        const normalized = normalizeHost(host);
        setEntries((prev) =>
          prev.map((entry) => {
            const hostNorm = normalizeHost(entry.host);
            const matches =
              hostNorm === normalized ||
              hostNorm.endsWith(`.${normalized}`) ||
              normalized.endsWith(`.${hostNorm}`);
            return matches ? { ...entry, hasHistory: false } : entry;
          })
        );
        setClearedHistoryHosts((prev) => {
          const next = new Set(prev);
          next.add(normalized);
          void refreshEntries({ clearedHistory: next });
          return next;
        });
      } catch {
        setToast(t('siteData.toast.error'));
      } finally {
        setClearingHost(null);
        setConfirmingHost(null);
        window.setTimeout(() => setToast(null), 2000);
      }
    },
    [refreshEntries, t]
  );

  const handleGlobalClear = useCallback(async () => {
    const { cookiesAndSiteData, cache, history } = globalFlags;
    if (!cookiesAndSiteData && !cache && !history) return;
    setClearingGlobal(true);
    try {
      const res = await window.merezhyvo?.settings?.siteData?.clearGlobal?.({
        cookiesAndSiteData,
        cache,
        history
      });
      if (res?.ok) {
        setToast(t('siteData.toast.globalCleared'));
        await refreshEntries();
      } else {
        setToast(t('siteData.toast.error'));
      }
    } catch {
      setToast(t('siteData.toast.error'));
    } finally {
      setClearingGlobal(false);
      window.setTimeout(() => setToast(null), 2000);
    }
  }, [globalFlags, refreshEntries, t]);

  const toggleFlag = (key: keyof ClearFlags) => {
    setGlobalFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const canClearGlobal = globalFlags.cache || globalFlags.cookiesAndSiteData || globalFlags.history;
  const visibleList = filteredEntries.slice(0, visibleCount);
  const showEmpty = !loading && filteredEntries.length === 0;

  return (
    <div
      ref={scrollRef}
      className="service-scroll"
      style={{
        width: '100%',
        height: '100%',
        padding: mode === 'mobile' ? '28px 22px 40px' : '22px 26px',
        boxSizing: 'border-box',
        color: '#e2e8f0'
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: mode === 'mobile' ? 18 : 12 }}>
        <div
          style={{
            borderRadius: 16,
            border: rowBorder,
            background: 'rgba(15,23,42,0.55)',
            overflow: 'hidden'
          }}
        >
          <button
            type="button"
            onClick={() => setGlobalExpanded((prev) => !prev)}
            style={{
              width: '100%',
              padding: mode === 'mobile' ? '18px 18px' : '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'transparent',
              border: 'none',
              color: '#e2e8f0',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontWeight: 800, fontSize: mode === 'mobile' ? '44px' : '18px' }}>{t('siteData.global.title')}</span>
            <svg
              viewBox="0 0 16 16"
              width={mode === 'mobile' ? 32 : 16}
              height={mode === 'mobile' ? 32 : 16}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ transform: globalExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }}
            >
              <path d="m6 3 5 5-5 5" />
            </svg>
          </button>
          {globalExpanded && (
            <div style={{ padding: mode === 'mobile' ? '0 18px 18px' : '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={formatLabel(mode)}>{t('siteData.global.lead')}</div>
              <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={globalFlags.cookiesAndSiteData}
                  onChange={() => toggleFlag('cookiesAndSiteData')}
                  style={{ marginTop: mode === 'mobile' ? 10 : 4, width: mode === 'mobile' ? 28 : 16, height: mode === 'mobile' ? 28 : 16 }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '38px' : '15px' }}>{t('siteData.global.cookies')}</div>
                  <div style={formatLabel(mode)}>{t('siteData.global.cookiesDesc')}</div>
                </div>
              </label>
              <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={globalFlags.cache}
                  onChange={() => toggleFlag('cache')}
                  style={{ marginTop: mode === 'mobile' ? 10 : 4, width: mode === 'mobile' ? 28 : 16, height: mode === 'mobile' ? 28 : 16 }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '38px' : '15px' }}>{t('siteData.global.cache')}</div>
                  <div style={formatLabel(mode)}>{t('siteData.global.cacheDesc')}</div>
                </div>
              </label>
              <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={globalFlags.history}
                  onChange={() => toggleFlag('history')}
                  style={{ marginTop: mode === 'mobile' ? 10 : 4, width: mode === 'mobile' ? 28 : 16, height: mode === 'mobile' ? 28 : 16 }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '38px' : '15px' }}>{t('siteData.global.history')}</div>
                  <div style={formatLabel(mode)}>{t('siteData.global.historyDesc')}</div>
                </div>
              </label>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() =>
                    setGlobalFlags({
                      cookiesAndSiteData: true,
                      cache: true,
                      history: false
                    })
                  }
                  style={{
                    padding: mode === 'mobile' ? '14px 16px' : '8px 12px',
                    borderRadius: 10,
                    border: rowBorder,
                    background: 'rgba(30,41,59,0.7)',
                    color: '#e2e8f0',
                    cursor: 'pointer'
                  }}
                >
                  {t('global.cancel')}
                </button>
                <button
                  type="button"
                  disabled={!canClearGlobal || clearingGlobal}
                  onClick={handleGlobalClear}
                  style={{
                    padding: mode === 'mobile' ? '14px 18px' : '9px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: canClearGlobal ? '#2563eb' : 'rgba(37,99,235,0.35)',
                    color: '#fff',
                    cursor: canClearGlobal ? 'pointer' : 'not-allowed',
                    minWidth: 120,
                    opacity: clearingGlobal ? 0.8 : 1
                  }}
                >
                  {clearingGlobal ? t('siteData.global.clearing') : t('siteData.global.clearAction')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            borderRadius: 16,
            border: rowBorder,
            background: 'rgba(15,23,42,0.45)',
            padding: mode === 'mobile' ? '16px 16px 10px' : '12px 12px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            flex: 1
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('siteData.search')}
              style={{
                flex: 1,
                padding: mode === 'mobile' ? '16px 14px' : '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: 'rgba(15,23,42,0.7)',
                color: '#e2e8f0',
                fontSize: mode === 'mobile' ? '34px' : '14px'
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  padding: mode === 'mobile' ? '12px 14px' : '8px 10px',
                  borderRadius: 10,
                  border: rowBorder,
                  background: 'rgba(30,41,59,0.7)',
                  color: '#e2e8f0',
                  cursor: 'pointer'
                }}
              >
                {t('global.clear')}
              </button>
            )}
          </div>

          {toast && (
            <div
              style={{
                padding: mode === 'mobile' ? '16px 14px' : '10px 12px',
                borderRadius: 10,
                border: rowBorder,
                background: 'rgba(34,197,94,0.15)',
                color: '#bbf7d0',
                fontSize: mode === 'mobile' ? '32px' : '13px'
              }}
            >
              {toast}
            </div>
          )}

          {loading ? (
            <div style={{ padding: 18, textAlign: 'center', fontSize: mode === 'mobile' ? '36px' : '15px' }}>{t('global.loading')}</div>
          ) : showEmpty ? (
            <div style={{ padding: 18, textAlign: 'center', opacity: 0.8, fontSize: mode === 'mobile' ? '36px' : '15px' }}>
              {t('siteData.empty')}
            </div>
          ) : (
            <div style={{ borderRadius: 12, border: rowBorder, overflow: 'hidden' }}>
              {visibleList.map((entry, idx) => {
                const confirming = confirmingHost === entry.host || confirmingHost?.startsWith(`${entry.host}-`);
                return (
                  <div
                    key={entry.host}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: mode === 'mobile' ? '1fr' : '2fr 2fr',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: mode === 'mobile' ? '16px 16px' : '12px 12px',
                      borderBottom: idx === visibleList.length - 1 ? 'none' : rowBorder
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '40px' : '15px', wordBreak: 'break-word' }}>{entry.host}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          border: rowBorder,
                          borderRadius: 10,
                          padding: mode === 'mobile' ? '12px 12px' : '8px 10px',
                          background: 'rgba(15,23,42,0.45)'
                        }}
                      >
                        <div style={{ fontSize: mode === 'mobile' ? '32px' : '13px' }}>
                          {entry.hasCookies ? t('siteData.row.cookiesHas') : t('siteData.row.cookiesNone')}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {confirmingHost === `${entry.host}-cookies` ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setConfirmingHost(null)}
                                style={{
                                  padding: mode === 'mobile' ? '10px 12px' : '8px 10px',
                                  borderRadius: 10,
                                  border: rowBorder,
                                  background: 'rgba(30,41,59,0.7)',
                                  color: '#e2e8f0',
                                  cursor: 'pointer'
                                }}
                              >
                                {t('global.cancel')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearCookies(entry.host)}
                                disabled={clearingHost === entry.host}
                                style={{
                                  padding: mode === 'mobile' ? '10px 14px' : '8px 12px',
                                  borderRadius: 10,
                                  border: 'none',
                                  background: '#ef4444',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  opacity: clearingHost === entry.host ? 0.75 : 1
                                }}
                              >
                                {t('siteData.row.confirm')}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmingHost(`${entry.host}-cookies`)}
                              style={{
                                padding: mode === 'mobile' ? '10px 14px' : '8px 12px',
                                borderRadius: 10,
                                border: rowBorder,
                                background: 'transparent',
                                color: '#e2e8f0',
                                cursor: 'pointer'
                              }}
                            >
                              {t('siteData.row.clearCookies')}
                            </button>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          border: rowBorder,
                          borderRadius: 10,
                          padding: mode === 'mobile' ? '12px 12px' : '8px 10px',
                          background: 'rgba(15,23,42,0.45)'
                        }}
                      >
                        <div style={{ fontSize: mode === 'mobile' ? '32px' : '13px' }}>
                          {entry.hasHistory ? t('siteData.row.historyHas') : t('siteData.row.historyNone')}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {confirmingHost === `${entry.host}-history` ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setConfirmingHost(null)}
                                style={{
                                  padding: mode === 'mobile' ? '10px 12px' : '8px 10px',
                                  borderRadius: 10,
                                  border: rowBorder,
                                  background: 'rgba(30,41,59,0.7)',
                                  color: '#e2e8f0',
                                  cursor: 'pointer'
                                }}
                              >
                                {t('global.cancel')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearHistory(entry.host)}
                                disabled={clearingHost === entry.host}
                                style={{
                                  padding: mode === 'mobile' ? '10px 14px' : '8px 12px',
                                  borderRadius: 10,
                                  border: 'none',
                                  background: '#ef4444',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  opacity: clearingHost === entry.host ? 0.75 : 1
                                }}
                              >
                                {t('siteData.row.confirm')}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmingHost(`${entry.host}-history`)}
                              style={{
                                padding: mode === 'mobile' ? '10px 14px' : '8px 12px',
                                borderRadius: 10,
                                border: rowBorder,
                                background: 'transparent',
                                color: '#e2e8f0',
                                cursor: 'pointer'
                              }}
                            >
                              {t('siteData.row.clearHistory')}
                            </button>
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          border: rowBorder,
                          borderRadius: 10,
                          padding: mode === 'mobile' ? '12px 12px' : '8px 10px',
                          background: 'rgba(15,23,42,0.45)'
                        }}
                      >
                        <div style={{ fontSize: mode === 'mobile' ? '32px' : '13px' }}>
                          {entry.hasSiteStorage ? t('siteData.row.storageHas') : t('siteData.row.storageNone')}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {confirmingHost === `${entry.host}-storage` ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setConfirmingHost(null)}
                                style={{
                                  padding: mode === 'mobile' ? '10px 12px' : '8px 10px',
                                  borderRadius: 10,
                                  border: rowBorder,
                                  background: 'rgba(30,41,59,0.7)',
                                  color: '#e2e8f0',
                                  cursor: 'pointer'
                                }}
                              >
                                {t('global.cancel')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearStorage(entry.host)}
                                disabled={clearingHost === entry.host}
                                style={{
                                  padding: mode === 'mobile' ? '10px 14px' : '8px 12px',
                                  borderRadius: 10,
                                  border: 'none',
                                  background: '#ef4444',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  opacity: clearingHost === entry.host ? 0.75 : 1
                                }}
                              >
                                {t('siteData.row.confirm')}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmingHost(`${entry.host}-storage`)}
                              style={{
                                padding: mode === 'mobile' ? '10px 14px' : '8px 12px',
                                borderRadius: 10,
                                border: rowBorder,
                                background: 'transparent',
                                color: '#e2e8f0',
                                cursor: 'pointer'
                              }}
                            >
                              {t('siteData.row.clearStorage')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SiteDataPage;
