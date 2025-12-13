import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HistoryVisit, Mode } from '../../types/models';
import type { ServicePageProps } from '../services/types';
import { historyStyles } from './historyStyles';
import { historyModeStyles } from './historyModeStyles';
import { useI18n } from '../../i18n/I18nProvider';

const groupLabels = ['today', 'yesterday', 'week', 'older'] as const;

type GroupKey = (typeof groupLabels)[number];

const FaviconIcon: React.FC<{ faviconId?: string | null, mode: Mode }> = ({ faviconId, mode }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!faviconId) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setSrc((prev) => (prev !== null ? null : prev));
        }
      });
      return;
    }
    const api = typeof window !== 'undefined' ? window.merezhyvo?.favicons : undefined;
    if (!api) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setSrc((prev) => (prev !== null ? null : prev));
        }
      });
      return;
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

  return src ? (
    <img src={src} alt="favicon" style={{
      ...historyStyles.favicon,
        ...historyModeStyles[mode].favicon
    }} />
  ) : (
    <span
      style={{
        ...historyStyles.favicon,
        ...historyModeStyles[mode].favicon,
        background: 'rgba(148, 163, 184, 0.2)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      ?
    </span>
  );
};

const HistoryPage: React.FC<ServicePageProps> = ({ mode, openInNewTab, onClose }) => {
  const [visits, setVisits] = useState<HistoryVisit[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const { t } = useI18n();

  const styles = historyStyles;
  const modeStyles = historyModeStyles[mode] || {};

  const profileModeStyle = (key: keyof typeof historyStyles) => ({
    ...styles[key],
    ...(modeStyles[key] ?? {})
  });
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<number | undefined>(undefined);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const queryRef = useRef<string>('');

  const groupLabelMap = useMemo(
    () => ({
      today: t('history.group.today'),
      yesterday: t('history.group.yesterday'),
      week: t('history.group.week'),
      older: t('history.group.older')
    }),
    [t]
  );

  const loadPage = useCallback(async (reset = false) => {
    const api = typeof window !== 'undefined' ? window.merezhyvo?.history : undefined;
    if (!api) return;
    if (reset) {
      loadingRef.current = true;
      setLoading(true);
      setHasMore(false);
      cursorRef.current = undefined;
      setVisits([]);
    } else {
      if (loadingRef.current || loadingMoreRef.current) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }
    try {
      const q = queryRef.current?.trim() ? queryRef.current.trim() : undefined;
      const result = await api.query({
        limit: 50,
        cursor: reset ? undefined : cursorRef.current,
        ...(q ? { q } : {})
      });
      const items = result.items ?? [];
      cursorRef.current = result.nextCursor;
      setHasMore(Boolean(result.nextCursor));
      setVisits((prev) => {
        const base = reset ? [] : prev;
        const existing = new Set(base.map((v) => v.id));
        const merged = [...base, ...items.filter((v) => !existing.has(v.id))];
        merged.sort((a, b) => b.ts - a.ts);
        return merged;
      });
    } finally {
      if (reset) {
        loadingRef.current = false;
        setLoading(false);
      } else {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    await loadPage(true);
  }, [loadPage]);

  const normalizedQuery = search.trim();
  useEffect(() => {
    queryRef.current = normalizedQuery;
    void loadPage(true);
  }, [normalizedQuery, loadPage]);

  const sortedVisits = useMemo(() => {
    const bucket = visits.slice();
    bucket.sort((a, b) => b.ts - a.ts);
    return bucket;
  }, [visits]);

  const sentinelId = useMemo(() => {
    if (!hasMore) return undefined;
    if (sortedVisits.length >= 10) {
      return sortedVisits[sortedVisits.length - 10]?.id;
    }
    return sortedVisits[sortedVisits.length - 1]?.id;
  }, [sortedVisits, hasMore]);

  const groups = useMemo(() => {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    const buckets: Record<GroupKey, HistoryVisit[]> = {
      today: [],
      yesterday: [],
      week: [],
      older: []
    };
    sortedVisits.forEach((visit) => {
      const diff = Math.floor((now - visit.ts) / msPerDay);
      if (diff <= 0) {
        buckets.today.push(visit);
      } else if (diff === 1) {
        buckets.yesterday.push(visit);
      } else if (diff <= 7) {
        buckets.week.push(visit);
      } else {
        buckets.older.push(visit);
      }
    });
    return buckets;
  }, [sortedVisits]);

  const loadMoreIfNeeded = useCallback(() => {
    if (!hasMore || loadingRef.current || loadingMoreRef.current) return;
    void loadPage(false);
  }, [hasMore, loadPage]);

  useEffect(() => {
    if (!hasMore) return;
    const target = sentinelRef.current;
    if (!target) return;
    const root = listRef.current ?? undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreIfNeeded();
        }
      },
      { root, rootMargin: '200px', threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMoreIfNeeded, sentinelId]);

  const handleRemoveVisit = useCallback(
    async (visit: HistoryVisit) => {
      const api = typeof window !== 'undefined' ? window.merezhyvo?.history : undefined;
      if (!api) return;
      await api.remove({ url: visit.url });
      setFeedback(t('history.feedback.entryRemoved'));
      await refreshHistory();
    },
    [refreshHistory, t]
  );

  const handleRemoveDomain = useCallback(
    async (visit: HistoryVisit) => {
      const api = typeof window !== 'undefined' ? window.merezhyvo?.history : undefined;
      if (!api) return;
      let origin = visit.origin;
      if (!origin) {
        try {
          origin = new URL(visit.url).origin;
        } catch {
          return;
        }
      }
      await api.remove({ origin });
      setFeedback(t('history.feedback.domainRemoved'));
      await refreshHistory();
    },
    [refreshHistory, t]
  );

  const requestClearAll = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const cancelClearAll = useCallback(() => {
    if (clearBusy) return;
    setShowClearConfirm(false);
  }, [clearBusy]);

  const handleClearAll = useCallback(async () => {
    const api = typeof window !== 'undefined' ? window.merezhyvo?.history : undefined;
    if (!api) return;
    setClearBusy(true);
    try {
      await api.clearAll();
      setFeedback(t('history.feedback.cleared'));
      await refreshHistory();
    } finally {
      setClearBusy(false);
      setShowClearConfirm(false);
    }
  }, [refreshHistory, t]);

  const formatTime = (ts: number) => new Date(ts).toLocaleString();

  const entryActionsStyle = {
    ...styles.entryActions,
    ...(modeStyles.entryActions ?? {})
  };

  const actionButtonStyle = {
    ...styles.actionButton,
    ...(modeStyles.actionButton ?? {})
  };

  const entryTitleStyle = {
    ...styles.entryTitle,
    ...(modeStyles.entryTitle ?? {})
  };

  const entryUrlStyle = {
    ...styles.entryUrl,
    ...(modeStyles.entryUrl ?? {})
  };

  const groupsStyle = {
    ...styles.groups,
    ...(modeStyles.groups ?? {})
  };

  const groupsTitle = {
    ...styles.groupTitle,
    ...(modeStyles.groupTitle ?? {})
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('global.close')}
              style={{
                width: mode === 'mobile' ? 56 : 36,
                height: mode === 'mobile' ? 56 : 36,
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: 'rgba(15,23,42,0.6)',
                color: '#e2e8f0',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <svg width={mode === 'mobile' ? 50 : 18} height={mode === 'mobile' ? 50 : 18} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          <h1 style={{ ...profileModeStyle('title'), marginLeft: mode === 'mobile' ? 10 : 0 }}>{t('history.title')}</h1>
        </div>
        <button type="button" style={{...styles.button, ...modeStyles.button}} onClick={requestClearAll}>
          {t('history.clear')}
        </button>
      </div>
      <input
        placeholder={t('history.search.placeholder')}
        style={profileModeStyle('searchInput')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {feedback && <div style={{ color: '#34d399', fontSize: '12px' }}>{feedback}</div>}
      <div style={groupsStyle} className="service-scroll" ref={listRef}>
        {loading && <div style={styles.placeholder}>{t('history.loading')}</div>}
        {!loading && !sortedVisits.length && <div style={styles.placeholder}>{t('history.empty')}</div>}
        {groupLabels.map((key) => {
          const entries = groups[key as GroupKey];
          if (!entries || !entries.length) return null;
          return (
            <div key={key as string} style={styles.group}>
              <h3 style={groupsTitle}>{groupLabelMap[key as GroupKey]}</h3>
              {entries.map((visit) => (
                <React.Fragment key={visit.id}>
                  <div style={{ ...styles.entry, ...(modeStyles.entry ?? {}) }}>
                    <div style={styles.entryMain}>
                      <FaviconIcon faviconId={visit.faviconId} mode={mode} />
                      <div style={styles.entryText}>
                        <span style={entryTitleStyle}>{visit.title || visit.url}</span>
                        <span style={entryUrlStyle}>{visit.url}</span>
                        <span style={entryUrlStyle}>{formatTime(visit.ts)}</span>
                      </div>
                    </div>
                    <div style={entryActionsStyle}>
                      <button type="button" style={actionButtonStyle} onClick={() => openInNewTab(visit.url)}>
                        {t('history.entry.open')}
                      </button>
                      <button type="button" style={actionButtonStyle} onClick={() => handleRemoveVisit(visit)}>
                        {t('history.entry.delete')}
                      </button>
                      <button type="button" style={actionButtonStyle} onClick={() => handleRemoveDomain(visit)}>
                        {t('history.entry.deleteDomain')}
                      </button>
                    </div>
                  </div>
                  {visit.id === sentinelId && hasMore && (
                    <div ref={sentinelRef} style={{ height: 1, width: '100%' }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          );
        })}
      </div>
      {showClearConfirm && (
        <div style={historyStyles.confirmBackdrop}>
          <div style={{
            ...historyStyles.confirmPanel,
            ...(modeStyles.confirmPanel ?? {})
          }}>
            <h2 style={{
              ...historyStyles.confirmTitle,
              ...(modeStyles.confirmTitle ?? {})
            }}>
              {t('history.confirm.title')}
            </h2>
            <p style={{
              ...historyStyles.confirmMessage,
              ...(modeStyles.confirmMessage ?? {})
            }}>
              {t('history.confirm.message')}
            </p>
            <div style={{
              ...historyStyles.confirmActions,
              ...(modeStyles.confirmActions ?? {})
            }}>
              <button
                type="button"
                style={{
                  ...historyStyles.confirmButton,
                  ...(modeStyles.confirmButton ?? {})
                }}
                onClick={cancelClearAll}
                disabled={clearBusy}
              >
                {t('history.confirm.cancel')}
              </button>
              <button
                type="button"
                style={{
                  ...historyStyles.confirmButton,
                  ...(modeStyles.confirmButton ?? {})
                }}
                onClick={handleClearAll}
                disabled={clearBusy}
              >
                {t('history.confirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
