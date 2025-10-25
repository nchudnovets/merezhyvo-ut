import React, { useEffect, memo } from 'react';
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
  displayTitle: (tab: Tab) => string;
  displaySubtitle: (tab: Tab) => string | null;
  fallbackInitial: (tab: Tab) => string;
}

const TabRow = memo(({
  tab,
  mode,
  isActive,
  onActivate,
  onTogglePin,
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
  onClose: (id: string) => void;
  displayTitle: (tab: Tab) => string;
  displaySubtitle: (tab: Tab) => string | null;
  fallbackInitial: (tab: Tab) => string;
}) => {
  const styles = tabsPanelStyles;
  const modeStyles = tabsPanelModeStyles[mode] || {};
  const pinButtonStyle = {
    ...styles.tabIconButton,
    ...(modeStyles.tabIconButton || {}),
    ...(tab.pinned ? styles.tabIconButtonActive : null)
  };
  const closeButtonStyle = {
    ...styles.tabIconButton,
    ...(modeStyles.tabIconButton || {})
  };
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
            style={{ ...styles.tabIcon, ...(modeStyles.tabIcon || {}) }}
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
            style={{ ...styles.tabIcon, ...(modeStyles.tabIcon || {}) }}
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
  onCloseTab,
  displayTitle,
  displaySubtitle,
  fallbackInitial
}) => {
  const styles = tabsPanelStyles;
  const modeStyles = tabsPanelModeStyles[mode] || {};

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
        style={containerStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tabs-panel-title"
      >
        <div style={styles.header}>
          <h2
            id="tabs-panel-title"
            style={{
              ...styles.title,
              ...(modeStyles.tabsPanelTitle || {})
            }}
          >
            Tabs
          </h2>
          <button
            type="button"
            aria-label="Close tabs dialog"
            style={closeButtonStyle}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

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
