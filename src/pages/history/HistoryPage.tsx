import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { HistoryVisit } from '../../types/models';
import type { ServicePageProps } from '../services/types';
import { useIsMobile } from '../services/useIsMobile';

const pageStyles = {
  container: {
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    gap: '18px',
    overflowX: 'hidden'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    margin: 0,
    fontSize: '24px'
  },
  button: {
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid rgba(251, 113, 133, 0.8)',
    background: 'rgba(244, 63, 94, 0.22)',
    color: '#f8fafc',
    fontWeight: 600,
    cursor: 'pointer'
  },
  searchInput: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    background: 'rgba(15, 23, 42, 0.85)',
    color: '#f8fafc',
    width: 'min(640px, 100%)',
    boxSizing: 'border-box'
  },
  groups: {
    flex: 1,
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '18px',
    paddingRight: '12px',
    boxSizing: 'border-box',
    scrollbarWidth: 'thin',
    scrollbarColor: '#2563eb #111827'
  },
  group: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  groupTitle: {
    margin: 0,
    fontSize: '14px',
    color: '#94a3b8'
  },
  entry: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    paddingRight: '20px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.85)'
  },
  entryMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
    maxWidth: '50%',
    position: 'relative'
  },
  entryText: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    width: '100%',
    oveflow: 'hidden'
  },
  entryTitle: {
    fontSize: '14px',
    width: '100%',
    overflow: 'hidden'
  },
  entryUrl: {
    fontSize: '12px',
    color: '#94a3b8',
    width: '100%',
    overflow: 'hidden'
  },
  entryActions: {
    display: 'flex',
    gap: '8px'
  },
  actionButton: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    background: 'rgba(224, 231, 255, 0.08)',
    color: '#f8fafc',
    cursor: 'pointer'
  },
  favicon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    objectFit: 'cover'
  },
  placeholder: {
    color: '#94a3b8'
  }
};

const groupLabels = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'older', label: 'Older' }
] as const;

type GroupKey = (typeof groupLabels)[number]['key'];

const FaviconIcon: React.FC<{ faviconId?: string | null }> = ({ faviconId }) => {
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
    <img src={src} alt="favicon" style={pageStyles.favicon} />
  ) : (
    <span style={{ ...pageStyles.favicon, background: 'rgba(148, 163, 184, 0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>?</span>
  );
};

const HistoryPage: React.FC<ServicePageProps> = ({ openInNewTab }) => {
  const [visits, setVisits] = useState<HistoryVisit[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const refreshHistory = useCallback(async () => {
    const api = typeof window !== 'undefined' ? window.merezhyvo?.history : undefined;
    if (!api) return;
    setLoading(true);
    try {
      const result = await api.query({ limit: 600 });
      setVisits(result.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const filteredVisits = useMemo(() => {
    if (!search.trim()) return visits;
    const needle = search.trim().toLowerCase();
    return visits.filter((visit) => {
      const haystack = `${visit.title ?? ''} ${visit.url}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [visits, search]);

  const sortedVisits = useMemo(() => {
    const bucket = filteredVisits.slice();
    bucket.sort((a, b) => b.ts - a.ts);
    return bucket;
  }, [filteredVisits]);

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

  const handleRemoveVisit = useCallback(
    async (visit: HistoryVisit) => {
      const api = typeof window !== 'undefined' ? window.merezhyvo?.history : undefined;
      if (!api) return;
      await api.remove({ url: visit.url });
      setFeedback('Entry removed');
      await refreshHistory();
    },
    [refreshHistory]
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
      setFeedback('Domain removed');
      await refreshHistory();
    },
    [refreshHistory]
  );

  const handleClearAll = useCallback(async () => {
    const api = typeof window !== 'undefined' ? window.merezhyvo?.history : undefined;
    if (!api || !window.confirm('Clear entire history?')) return;
    await api.clearAll();
    setFeedback('History cleared');
    await refreshHistory();
  }, [refreshHistory]);

  const formatTime = (ts: number) => new Date(ts).toLocaleString();

  const entryActionsStyle = useMemo(
    () => ({
      ...pageStyles.entryActions,
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'stretch' : 'center',
      gap: isMobile ? '10px' : pageStyles.entryActions.gap
    }),
    [isMobile]
  );

  const actionButtonStyle = useMemo(
    () => ({
      ...pageStyles.actionButton,
      width: isMobile ? '100%' : 'auto',
      textAlign: 'center'
    }),
    [isMobile]
  );

  const entryTitleStyle = useMemo(
    () => ({
      ...pageStyles.entryTitle,
      fontSize: isMobile ? '28px' : pageStyles.entryTitle.fontSize
    }),
    [isMobile]
  );

  return (
    <div style={pageStyles.container}>
      <div style={pageStyles.header}>
        <h1 style={pageStyles.title}>History</h1>
        <button type="button" style={pageStyles.button} onClick={handleClearAll}>
          Clear History
        </button>
      </div>
      <input
        placeholder="Search history"
        style={pageStyles.searchInput}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {feedback && <div style={{ color: '#34d399', fontSize: '12px' }}>{feedback}</div>}
      <div style={pageStyles.groups} className="service-scroll">
        {loading && <div style={pageStyles.placeholder}>Loading history…</div>}
        {!loading && !filteredVisits.length && <div style={pageStyles.placeholder}>No history entries.</div>}
        {groupLabels.map(({ key, label }) => {
          const entries = groups[key];
          if (!entries || !entries.length) return null;
          return (
            <div key={key} style={pageStyles.group}>
              <h3 style={pageStyles.groupTitle}>{label}</h3>
              {entries.map((visit) => (
                <div key={visit.id} style={pageStyles.entry}>
                  <div style={pageStyles.entryMain}>
                    <FaviconIcon faviconId={visit.faviconId} />
                    <div style={pageStyles.entryText}>
                      <span style={entryTitleStyle}>{visit.title || visit.url}</span>
                      <span style={pageStyles.entryUrl}>{visit.url}</span>
                      <span style={pageStyles.entryUrl}>{formatTime(visit.ts)}</span>
                    </div>
                  </div>
                  <div style={entryActionsStyle}>
                    <button type="button" style={actionButtonStyle} onClick={() => openInNewTab(visit.url)}>
                      Open
                    </button>
                    <button type="button" style={actionButtonStyle} onClick={() => handleRemoveVisit(visit)}>
                      Delete
                    </button>
                    <button type="button" style={actionButtonStyle} onClick={() => handleRemoveDomain(visit)}>
                      Delete domain
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HistoryPage;
