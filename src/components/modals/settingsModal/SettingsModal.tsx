import React, { useEffect, memo } from 'react';
import type { CSSProperties } from 'react';
import type { InstalledApp, Mode } from '../../../types/models';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import { styles as baseStyles } from '../../../styles/styles';

interface SettingsAppInfo {
  name: string;
  version: string;
  description?: string;
  chromium?: string;
}

interface SettingsModalProps {
  mode: Mode;
  backdropStyle: CSSProperties;
  installedApps: InstalledApp[];
  loading: boolean;
  message: string;
  pendingRemoval: InstalledApp | null;
  busy: boolean;
  appInfo: SettingsAppInfo;
  onClose: () => void;
  onRequestRemove: (app: InstalledApp) => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
}

const SettingsAppRow = memo(({
  app,
  mode,
  isPending,
  busy,
  onRequestRemove,
  onCancelRemove,
  onConfirmRemove
}: {
  app: InstalledApp;
  mode: Mode;
  isPending: boolean;
  busy: boolean;
  onRequestRemove: (app: InstalledApp) => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
}) => {
  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};

  return (
    <li
      key={app.id}
      style={{
        ...styles.appRow,
        ...(modeStyles.settingsAppRow || {})
      }}
    >
      <div style={styles.appHeader}>
        <div style={styles.appInfo}>
          <span
            style={{
              ...styles.appTitle,
              ...(modeStyles.settingsAppTitle || {})
            }}
            title={app.title || app.url}
          >
            {app.title || app.url}
          </span>
          <span
            style={{
              ...styles.appUrl,
              ...(modeStyles.settingsAppUrl || {})
            }}
            title={app.url}
          >
            {app.url}
          </span>
        </div>
        <div
          style={{
            ...styles.appActions,
            ...(modeStyles.settingsAppActions || {})
          }}
        >
          <button
            type="button"
            aria-label={`Remove ${app.title || app.url}`}
            onClick={() => onRequestRemove(app)}
            disabled={busy && isPending}
            style={{
              ...styles.iconButton,
              ...(modeStyles.settingsIconButton || {}),
              ...(busy && isPending ? baseStyles.modalButtonDisabled : null)
            }}
          >
            <svg
              viewBox="0 0 16 16"
              style={{
                ...styles.icon,
                ...(modeStyles.settingsIcon || {})
              }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.5 4.5h9M6.5 4.5V3.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M6 7v5m4-5v5M4.5 4.5 5.2 13a1 1 0 0 0 .998.9h3.604a1 1 0 0 0 .998-.9l.7-8.5"
              />
            </svg>
          </button>
        </div>
      </div>

      {isPending && (
        <div style={styles.confirm}>
          <p
            style={{
              ...styles.confirmText,
              ...(modeStyles.settingsConfirmText || {})
            }}
          >
            {`Are you sure you want to remove ${app.title || app.url}?`}
          </p>
          <div style={styles.confirmActions}>
            <button
              type="button"
              style={{
                ...styles.confirmButton,
                ...(modeStyles.settingsConfirmButton || {})
              }}
              onClick={onCancelRemove}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              style={{
                ...styles.confirmButton,
                ...styles.confirmButtonPrimary,
                ...(modeStyles.settingsConfirmButton || {})
              }}
              onClick={onConfirmRemove}
              disabled={busy}
            >
              {busy ? 'Removing…' : 'OK'}
            </button>
          </div>
        </div>
      )}
    </li>
  );
});

SettingsAppRow.displayName = 'SettingsAppRow';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  mode,
  backdropStyle,
  installedApps,
  loading,
  message,
  pendingRemoval,
  busy,
  appInfo,
  onClose,
  onRequestRemove,
  onCancelRemove,
  onConfirmRemove
}) => {
  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};

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

  const containerStyle =
    mode === 'mobile' ? styles.containerMobile : styles.container;
  const closeButtonStyle =
    mode === 'mobile' ? baseStyles.modalCloseMobile : baseStyles.modalClose;
  const blockBodyStyle = {
    ...styles.blockBody,
    ...(modeStyles.settingsBlockBody || {})
  };
  const aboutNameRaw = (appInfo?.name || 'Merezhyvo').trim();
  const aboutName = aboutNameRaw
    ? aboutNameRaw.charAt(0).toUpperCase() + aboutNameRaw.slice(1)
    : 'Merezhyvo';
  const aboutVersion = appInfo?.version || '0.0.0';
  const chromiumVersion = appInfo?.chromium || 'Unknown';
  const aboutDescription = `A browser designed for Ubuntu Touch. Based on Chromium version: ${chromiumVersion || 'Unknown'}.`;

  return (
    <div
      style={backdropStyle}
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
        aria-labelledby="settings-modal-title"
      >
        <div style={styles.header}>
          <h2
            id="settings-modal-title"
            style={{
              ...styles.title,
              ...(modeStyles.settingsModalTitle || {})
            }}
          >
            Settings
          </h2>
          <button
            type="button"
            aria-label="Close settings dialog"
            style={closeButtonStyle}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div style={styles.sections}>
          <section
            style={{
              ...styles.block,
              ...(modeStyles.settingsBlock || {})
            }}
          >
            <div style={styles.blockHeader}>
              <h3
                style={{
                  ...styles.blockTitle,
                  ...(modeStyles.settingsBlockTitle || {})
                }}
              >
                Tor
              </h3>
            </div>
            <div style={blockBodyStyle} />
          </section>

          <section
            style={{
              ...styles.block,
              ...(modeStyles.settingsBlock || {})
            }}
          >
            <div style={styles.blockHeader}>
              <h3
                style={{
                  ...styles.blockTitle,
                  ...(modeStyles.settingsBlockTitle || {})
                }}
              >
                Permissions
              </h3>
            </div>
            <div style={blockBodyStyle} />
          </section>

          <section
            style={{
              ...styles.block,
              ...(modeStyles.settingsBlock || {})
            }}
          >
            <div style={styles.blockHeader}>
              <h3
                style={{
                  ...styles.blockTitle,
                  ...(modeStyles.settingsBlockTitle || {})
                }}
              >
                Installed Apps
              </h3>
              {loading && (
                <span
                  style={{
                    ...styles.loading,
                    ...(modeStyles.settingsLoading || {})
                  }}
                >
                  Loading…
                </span>
              )}
            </div>

            <div style={blockBodyStyle}>
              {!loading && installedApps.length === 0 ? (
                <p style={styles.empty}>No installed shortcuts yet.</p>
              ) : (
                <ul style={styles.appList}>
                  {installedApps.map((app) => (
                    <SettingsAppRow
                      key={app.id}
                      app={app}
                      mode={mode}
                      isPending={pendingRemoval?.id === app.id}
                      busy={busy}
                      onRequestRemove={onRequestRemove}
                      onCancelRemove={onCancelRemove}
                      onConfirmRemove={onConfirmRemove}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section
            style={{
              ...styles.block,
              ...(modeStyles.settingsBlock || {})
            }}
          >
            <div style={styles.blockHeader}>
              <h3
                style={{
                  ...styles.blockTitle,
                  ...(modeStyles.settingsBlockTitle || {})
                }}
              >
                About
              </h3>
            </div>
            <div style={blockBodyStyle}>
              <div
                style={{
                  ...styles.aboutCard,
                  ...(modeStyles.settingsAboutCard || {})
                }}
              >
                <p
                  style={{
                    ...styles.aboutName,
                    ...(modeStyles.settingsAboutName || {})
                  }}
                >
                  {aboutName}
                </p>
                <p
                  style={{
                    ...styles.aboutVersion,
                    ...(modeStyles.settingsAboutVersion || {})
                  }}
                >
                  Version {aboutVersion}
                </p>
                <p
                  style={{
                    ...styles.aboutDescription,
                    ...(modeStyles.settingsAboutDescription || {})
                  }}
                >
                  {aboutDescription}
                </p>
              </div>
            </div>
          </section>
        </div>

        {message && (
          <div
            style={{
              ...styles.message,
              ...(modeStyles.settingsMessage || {})
            }}
            role="status"
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
};
