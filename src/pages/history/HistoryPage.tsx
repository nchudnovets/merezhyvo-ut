import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { HistoryVisit, Mode } from '../../types/models';
import type { ServicePageProps } from '../services/types';
import { historyStyles } from './historyStyles';
import { historyModeStyles } from './historyModeStyles';

const groupLabels = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'older', label: 'Older' }
] as const;

type GroupKey = (typeof groupLabels)[number]['key'];

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

const HistoryPage: React.FC<ServicePageProps> = ({ mode, openInNewTab }) => {
  const [visits, setVisits] = useState<HistoryVisit[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);

  const styles = historyStyles;
  const modeStyles = historyModeStyles[mode] || {};

  const profileModeStyle = (key: keyof typeof historyStyles) => ({
    ...styles[key],
    ...(modeStyles[key] ?? {})
  });

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
      setFeedback('History cleared');
      await refreshHistory();
    } finally {
      setClearBusy(false);
      setShowClearConfirm(false);
    }
  }, [refreshHistory]);

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
        <h1 style={profileModeStyle('title')}>History</h1>
        <button type="button" style={{...styles.button, ...modeStyles.button}} onClick={requestClearAll}>
          Clear History
        </button>
      </div>
      <input
        placeholder="Search history"
        style={profileModeStyle('searchInput')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {feedback && <div style={{ color: '#34d399', fontSize: '12px' }}>{feedback}</div>}
      <div style={groupsStyle} className="service-scroll">
        {loading && <div style={styles.placeholder}>Loading history…</div>}
        {!loading && !filteredVisits.length && <div style={styles.placeholder}>No history entries.</div>}
        {groupLabels.map(({ key, label }) => {
          const entries = groups[key];
          if (!entries || !entries.length) return null;
          return (
            <div key={key} style={styles.group}>
              <h3 style={groupsTitle}>{label}</h3>
              {entries.map((visit) => (
                <div key={visit.id} style={{ ...styles.entry, ...(modeStyles.entry ?? {}) }}>
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
              Confirm Clear
            </h2>
            <p style={{
              ...historyStyles.confirmMessage,
              ...(modeStyles.confirmMessage ?? {})
            }}>
              This will remove every visit from your history and cannot be undone.
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
                Cancel
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
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
