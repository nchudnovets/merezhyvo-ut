import React, { useEffect, memo, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { Mode, Tab } from '../../../types/models';
import { tabsPanelStyles } from './tabsPanelStyles';
import { tabsPanelModeStyles } from './tabsPanelModeStyles';
import { styles as baseStyles } from '../../../styles/styles';

interface TabsPanelProps {
  mode: Mode;
  backdropStyle: CSSProperties;
  activeTabId: string | null;
  pinnedTabs: Tab[];
  regularTabs: Tab[];
  onClose: () => void;
  onNewTab: () => void;
  onActivateTab: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCleanClose: (id: string) => Promise<boolean>;
  displayTitle: (tab: Tab) => string;
  displaySubtitle: (tab: Tab) => string | null;
  fallbackInitial: (tab: Tab) => string;
  onOpenBookmarks: () => void;
  onOpenHistory: () => void;
}

const TabRow = memo(({
  tab,
  mode,
  isActive,
  onActivate,
  onTogglePin,
  onCleanClose,
  onClose,
  displayTitle,
  displaySubtitle,
  fallbackInitial
}: {
  tab: Tab;
  mode: Mode;
  isActive: boolean;
  onActivate: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCleanClose: (id: string) => Promise<boolean>;
  onClose: (id: string) => void;
  displayTitle: (tab: Tab) => string;
  displaySubtitle: (tab: Tab) => string | null;
  fallbackInitial: (tab: Tab) => string;
}) => {
  const styles = tabsPanelStyles;
  const modeStyles = tabsPanelModeStyles[mode] || {};
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const baseButtonStyle = {
    ...styles.tabIconButton,
    ...(modeStyles.tabIconButton || {})
  };
  const pinButtonStyle = {
    ...baseButtonStyle,
    ...(tab.pinned ? styles.tabIconButtonActive : null)
  };
  const closeButtonStyle = {
    ...baseButtonStyle
  };
  const toggleButtonStyle = {
    ...baseButtonStyle,
    ...(actionsExpanded ? styles.tabIconButtonActive : null)
  };
  const cleanButtonStyle = {
    ...baseButtonStyle
  };
  const iconStyle = {
    ...styles.tabIcon,
    ...(modeStyles.tabIcon || {})
  };
  const [bookmarkState, setBookmarkState] = useState<{ yes: boolean; nodeId?: string }>({ yes: false });
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [bookmarkRefreshToken, setBookmarkRefreshToken] = useState(0);
  const safeUrl = (tab.url ?? '').trim();
  const canBookmark = safeUrl.length > 0;
  const tabTitleLabel = displayTitle(tab);

  useEffect(() => {
    let cancelled = false;
    if (!safeUrl) {
      setBookmarkState({ yes: false });
      return () => {
        cancelled = true;
      };
    }
    const api = typeof window !== 'undefined' ? window.merezhyvo?.bookmarks : undefined;
    if (!api) {
      setBookmarkState({ yes: false });
      return () => {
        cancelled = true;
      };
    }
    void api
      .isBookmarked(safeUrl)
      .then((status) => {
        if (cancelled) return;
        setBookmarkState(status);
      })
      .catch(() => {
        if (cancelled) return;
        setBookmarkState({ yes: false });
      });
    return () => {
      cancelled = true;
    };
  }, [safeUrl, bookmarkRefreshToken]);

  useEffect(() => {
    const handler = () => {
      setBookmarkRefreshToken((prev) => prev + 1);
    };
    window.addEventListener('merezhyvo:bookmarks:changed', handler);
    return () => {
      window.removeEventListener('merezhyvo:bookmarks:changed', handler);
    };
  }, []);

  const handleBookmarkToggle = useCallback(async () => {
    if (!canBookmark || bookmarkBusy) return;
    const api = typeof window !== 'undefined' ? window.merezhyvo?.bookmarks : undefined;
    if (!api) return;
    setBookmarkBusy(true);
    try {
      if (bookmarkState.yes && bookmarkState.nodeId) {
        const result = await api.remove(bookmarkState.nodeId);
        if (result?.ok) {
          setBookmarkState({ yes: false });
        }
        return;
      }
      const result = await api.add({ type: 'bookmark', title: tabTitleLabel, url: safeUrl });
      if ('ok' in result && result.ok) {
        setBookmarkState({ yes: true, nodeId: result.nodeId });
      }
    } catch {
      // noop
    } finally {
      setBookmarkBusy(false);
    }
  }, [bookmarkBusy, bookmarkState, canBookmark, safeUrl, tabTitleLabel]);

  const renderBookmarkButton = () => {
    const active = bookmarkState.yes;
    const bookmarkButtonStyle = {
      ...baseButtonStyle,
      ...(active ? styles.tabIconButtonActive : null)
    };
    const ariaLabel = active ? 'Remove bookmark' : 'Add bookmark';
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={ariaLabel}
        style={bookmarkButtonStyle}
        disabled={!canBookmark || bookmarkBusy}
        onClick={(event) => {
          event.stopPropagation();
          void handleBookmarkToggle();
        }}
      >
        <svg viewBox="0 0 24 24" style={iconStyle} xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            fill={active ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
  };
  const renderToggleButton = () => (
    <button
      type="button"
      aria-label={actionsExpanded ? 'Collapse actions' : 'Expand actions'}
      aria-expanded={actionsExpanded}
      title={actionsExpanded ? 'Collapse actions' : 'Expand actions'}
      style={toggleButtonStyle}
      onClick={(event) => {
        event.stopPropagation();
        setActionsExpanded((prev) => !prev);
      }}
    >
      <svg
        viewBox="0 0 16 16"
        style={iconStyle}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d={
            actionsExpanded
              ? 'M6.5 4.5 10 8 6.5 11.5'
              : 'M9.5 4.5 6 8 9.5 11.5'
          }
        />
      </svg>
    </button>
  );

  const renderPinButton = () => (
    <button
      type="button"
      aria-label={tab.pinned ? 'Unpin tab' : 'Pin tab'}
      style={pinButtonStyle}
      onClick={(event) => {
        event.stopPropagation();
        onTogglePin(tab.id);
      }}
    >
      <svg
        viewBox="0 0 16 16"
        style={iconStyle}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill={tab.pinned ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.25 2.5h3.5a1 1 0 0 1 1 1v2.586l1.657 1.657a1 1 0 0 1-.707 1.707H10v3.3l-2 1.5-2-1.5V9.45H4.3a1 1 0 0 1-.707-1.707L5.25 6.086V3.5a1 1 0 0 1 1-1z"
        />
      </svg>
    </button>
  );

  const renderCleanButton = () => (
    <button
      type="button"
      aria-label="Clean and close tab"
      title="Clean and close tab"
      style={{
        ...cleanButtonStyle,
        ...(cleaning ? { opacity: 0.6, cursor: 'default' } : null)
      }}
      disabled={cleaning}
      onClick={async (event) => {
        event.stopPropagation();
        if (cleaning) return;
        setCleaning(true);
        try {
          const ok = await onCleanClose(tab.id);
          if (ok) {
            setActionsExpanded(false);
          }
        } catch {
          // noop, feedback handled upstream
        } finally {
          setCleaning(false);
        }
      }}
    >
      <svg
        viewBox="0 0 100 100"
        style={iconStyle}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g>
          <path
            fill="currentColor"
            d="M61.5 1.5C64.5715.9245 66.5715 2.0912 67.5 5c-4.6985 9.23-9.5318 18.3966-14.5 27.5-3.9393.9235-7.1059 3.0902-9.5 6.5-1 .6667-2 .6667-3 0C47.6388 26.5536 54.6388 14.0536 61.5 1.5Z"
          />
        </g>
        <g>
          <path
            fill="currentColor"
            d="M99.5 44.5v3c-6.1314 5.6305-12.1314 11.4638-18 17.5 5.8686 6.0362 11.8686 11.8695 18 17.5v2c-3.6774 3.5106-7.5107 6.8439-11.5 10-5.7756-5.8628-11.7756-11.5295-18-17-6.3333 5.6667-12.6667 11.3333-19 17-4.3023-3.1347-8.1356-6.8014-11.5-11 6-6.3333 12-12.6667 18-19-5.8185-6.3188-11.8185-12.4855-18-18.5 3.1667-4.5 7-8.3333 11.5-11.5C57.0145 40.6815 63.1812 46.6815 69.5 52.5c6.3333-6 12.6667-12 19-18 3.6867 3.3554 7.3534 6.6887 11 10Z"
          />
        </g>
        <g>
          <path
            fill="currentColor"
            d="M36.5 46.5c2.0837 1.5767 4.0837 3.41 6 5.5-1.5 2.1667-3 4.3333-4.5 6.5-1.8333-1.1667-3.6667-2.3333-5.5-3.5 1.7465-2.6587 3.0798-5.492 4-8.5Z"
          />
        </g>
        <g>
          <path
            fill="currentColor"
            d="M25.5 55.5c6.0422.9379 11.2088 3.6046 15.5 8-.5 1.5-1 3-1.5 4.5-.6476 1.4397-.9809 2.9397-1 4.5-7.4617-2.9813-14.6283-6.648-21.5-11 0-3.0584 1.8333-5.0584 4.5-6Z"
          />
        </g>
        <g>
          <path
            fill="currentColor"
            d="M6.5 56.5c4.3461-.1657 8.6794.001 13 .5-.4574.414-.7907.914-1 1.5-4.3333 1.3333-8.6667 1.3333-13 0 .3627-.6835.6961-1.3501 1-2Z"
          />
        </g>
        <g>
          <path
            fill="currentColor"
            d="M1.5 63.5h12c.17 1.3221-.1634 2.4887-1 3.5-3.6516.4986-7.3183.6653-11 .5v-4Z"
          />
        </g>
        <g>
          <path
            fill="currentColor"
            d="M-.5 81.5v-3c7.5254-3.6872 13.6921-9.0205 18.5-16 5.7248 3.3538 11.5581 6.5205 17.5 9.5 1.8266.8993 3.16 2.2326 4 4-2.6625 7.5469-7.4958 13.0469-14.5 16.5.0773-1.2376-.0894-2.2376-.5-3-1.6913 1.7562-3.6913 2.2562-6 1.5-4.9455-1.8061-9.6122-4.1394-14-7  .6667-.6667 1.3333-1.3333 2-2-2.3627.665-4.696  .4983-7- .5Z"
          />
        </g>
        <g>
          <path
            fill="currentColor"
            d="M-.5 71.5c9.0158.0089 9.0158 1.0089 0 3v-3Z"
          />
        </g>
        <g>
          <path
            fill="currentColor"
            d="M5.5 89.5c1.3488-1.2965 2.6821-1.1298 4  .5-1.4285.5791-2.7618.4124-4-.5Z"
          />
        </g>
      </svg>
    </button>
  );

  const renderCloseButton = () => (
    <button
      type="button"
      aria-label="Close tab"
      style={closeButtonStyle}
      onClick={(event) => {
        event.stopPropagation();
        onClose(tab.id);
      }}
    >
      <svg
        viewBox="0 0 16 16"
        style={iconStyle}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"
        />
      </svg>
    </button>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onActivate(tab.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          onActivate(tab.id);
        }
      }}
      style={{
        ...styles.tabRow,
        ...(modeStyles.tabRow || {}),
        ...(isActive ? styles.tabRowActive : null)
      }}
    >
      <span style={styles.tabInfo}>
        <span style={{ ...styles.faviconWrap, ...(modeStyles.tabFaviconWrap || {}) }}>
          {tab.favicon ? (
            <img src={tab.favicon} alt="" style={styles.favicon} />
          ) : (
            <span
              style={{
                ...styles.faviconFallback,
                ...(modeStyles.tabFaviconFallback || {})
              }}
            >
              {fallbackInitial(tab)}
            </span>
          )}
        </span>
        <span style={styles.tabTexts}>
          <span
            style={{
              ...styles.tabTitle,
              ...(modeStyles.tabTitle || {})
            }}
          >
            {displayTitle(tab)}
          </span>
          {(() => {
            const subtitle = displaySubtitle(tab);
            if (!subtitle) return null;
            return (
              <span
                style={{
                  ...styles.tabSubtitle,
                  ...(modeStyles.tabSubtitle || {})
                }}
              >
                {subtitle}
              </span>
            );
          })()}
        </span>
      </span>
        <span
          style={{
            ...styles.tabActions,
            ...(modeStyles.tabActions || {})
          }}
        >
          {actionsExpanded ? (
            <>
              {renderToggleButton()}
              {renderPinButton()}
              {renderBookmarkButton()}
              {renderCleanButton()}
            </>
          ) : (
            renderToggleButton()
          )}
        {renderCloseButton()}
      </span>
    </div>
  );
});

TabRow.displayName = 'TabRow';

export const TabsPanel: React.FC<TabsPanelProps> = ({
  mode,
  backdropStyle,
  activeTabId,
  pinnedTabs,
  regularTabs,
  onClose,
  onNewTab,
  onActivateTab,
  onTogglePin,
  onCleanClose,
  onCloseTab,
  displayTitle,
  displaySubtitle,
  fallbackInitial,
  onOpenBookmarks,
  onOpenHistory
}) => {
  const styles = tabsPanelStyles;
  const modeStyles = tabsPanelModeStyles[mode] || {};
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!feedbackMessage) return undefined;
    if (typeof window === 'undefined') return undefined;
    const timer = window.setTimeout(() => setFeedbackMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [feedbackMessage]);

  const handleCleanCloseTab = useCallback(
    async (id: string) => {
      const result = await onCleanClose(id);
      if (result) {
        setFeedbackMessage('All data related to the page has been removed');
      }
      return result;
    },
    [onCleanClose]
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const styleId = 'mzr-modal-scroll-style';
    if (document.getElementById(styleId)) return undefined;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .tabs-modal-body::-webkit-scrollbar { width: 8px; height: 8px; }
      .tabs-modal-body::-webkit-scrollbar-track { background: #111827; }
      .tabs-modal-body::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(59,130,246,0.85), rgba(79,70,229,0.8));
        border-radius: 6px;
        border: 1px solid rgba(15, 23, 42, 0.6);
      }
      .tabs-modal-body::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,0.95); }
      .tabs-modal-body { scrollbar-color: rgba(59,130,246,0.85) #111827; scrollbar-width: thin; }
    `;
    document.head.appendChild(style);
    return () => {
      try {
        if (style.parentNode) style.parentNode.removeChild(style);
      } catch {}
    };
  }, []);

  const containerStyle =
    mode === 'mobile' ? styles.containerMobile : styles.container;
  const closeButtonStyle =
    mode === 'mobile' ? baseStyles.modalCloseMobile : baseStyles.modalClose;
  const newTabButtonStyle =
    mode === 'mobile' ? styles.newTabButtonMobile : styles.newTabButton;

  return (
    <div
      style={{ ...styles.backdrop, ...backdropStyle }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{...containerStyle, ...{height: '95%', maxHeight: '100%'}}}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tabs-panel-title"
      >
        <div style={styles.header}>
          <div style={styles.headerTitleRow}>
            <h2
              id="tabs-panel-title"
              style={{
                ...styles.title,
                ...(modeStyles.tabsPanelTitle || {})
              }}
            >
              Tabs
            </h2>
              <div
                style={{
                  ...styles.headerButtons,
                  ...(modeStyles.headerButtons || {})
                }}
              >
                <button
                  type="button"
                  style={{
                    ...styles.headerButton,
                    ...(modeStyles.headerButton || {})
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenBookmarks();
                  }}
                >
                  ⭐ Bookmarks
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.headerButton,
                    ...(modeStyles.headerButton || {})
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenHistory();
                  }}
                >
                  🕘 History
                </button>
              </div>
          </div>
          <button
            type="button"
            aria-label="Close tabs dialog"
            style={closeButtonStyle}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {feedbackMessage && (
          <div
            role="status"
            aria-live="polite"
            style={{
              ...styles.feedbackBanner,
              ...(modeStyles.feedbackBanner || {})
            }}
          >
            {feedbackMessage}
          </div>
        )}

        <button
          type="button"
          style={{
            ...newTabButtonStyle,
            ...(modeStyles.newTabButton || {})
          }}
          onClick={onNewTab}
        >
          <svg
            viewBox="0 0 16 16"
            style={{ ...styles.tabIcon, ...(modeStyles.tabIcon || {}) }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 3v10M3 8h10"
            />
          </svg>
          <span>New Tab</span>
        </button>

        <div
          className="tabs-modal-body"
          style={{
            ...styles.body,
            ...(modeStyles.tabsPanelBody || {})
          }}
        >
          {pinnedTabs.length > 0 && (
            <div style={styles.section}>
              <p
                style={{
                  ...styles.sectionTitle,
                  ...(modeStyles.tabsSectionTitle || {})
                }}
              >
                Pinned
              </p>
              <div style={styles.list}>
                {pinnedTabs.map((tab) => (
                  <TabRow
                    key={tab.id}
                    tab={tab}
                    mode={mode}
                    isActive={tab.id === activeTabId}
                    onActivate={onActivateTab}
                    onTogglePin={onTogglePin}
                    onCleanClose={handleCleanCloseTab}
                    onClose={onCloseTab}
                    displayTitle={displayTitle}
                    displaySubtitle={displaySubtitle}
                    fallbackInitial={fallbackInitial}
                  />
                ))}
              </div>
            </div>
          )}

          {regularTabs.length > 0 && (
            <div style={styles.section}>
              {pinnedTabs.length > 0 && (
                <p
                  style={{
                    ...styles.sectionTitle,
                    ...(modeStyles.tabsSectionTitle || {})
                  }}
                >
                  Others
                </p>
              )}
              <div style={styles.list}>
                {regularTabs.map((tab) => (
                  <TabRow
                    key={tab.id}
                    tab={tab}
                    mode={mode}
                    isActive={tab.id === activeTabId}
                    onActivate={onActivateTab}
                    onTogglePin={onTogglePin}
                    onCleanClose={handleCleanCloseTab}
                    onClose={onCloseTab}
                    displayTitle={displayTitle}
                    displaySubtitle={displaySubtitle}
                    fallbackInitial={fallbackInitial}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
