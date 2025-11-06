import React, { useEffect, memo } from 'react';
import type { CSSProperties, RefObject, PointerEvent as ReactPointerEvent, FocusEvent as ReactFocusEvent } from 'react';
import type { InstalledApp, Mode, MessengerDefinition, MessengerId } from '../../../types/models';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import { styles as baseStyles } from '../../../styles/styles';
import KeyboardSettings from './KeyboardSettings';
import MessengerSettings from './MessengerSettings';
import { PermissionsSettings } from './PermissionsSettings';

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
  torEnabled: boolean;
  torCurrentIp: string;
  torIpLoading: boolean;
  torContainerValue: string;
  torSavedContainerId: string;
  torContainerSaving: boolean;
  torContainerMessage: string;
  torKeepEnabled: boolean;
  torKeepEnabledDraft: boolean;
  torInputRef: RefObject<HTMLInputElement | null>;
  onTorInputPointerDown: (event: ReactPointerEvent<HTMLInputElement>) => void;
  onTorInputFocus: (event: ReactFocusEvent<HTMLInputElement>) => void;
  onTorInputBlur: (event: ReactFocusEvent<HTMLInputElement>) => void;
  onTorContainerChange: (value: string) => void;
  onSaveTorContainer: () => void;
  onTorKeepChange: (value: boolean) => void;
  onClose: () => void;
  onRequestRemove: (app: InstalledApp) => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  messengerItems: MessengerDefinition[];
  messengerOrderSaving: boolean;
  messengerOrderMessage: string;
  onMessengerMove: (id: MessengerId, direction: 'up' | 'down') => void;
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
  torEnabled,
  torCurrentIp,
  torIpLoading,
  torContainerValue,
  torSavedContainerId,
  torContainerSaving,
  torContainerMessage,
  torKeepEnabled,
  torKeepEnabledDraft,
  torInputRef,
  onTorInputPointerDown,
  onTorInputFocus,
  onTorInputBlur,
  onTorContainerChange,
  onSaveTorContainer,
  onTorKeepChange,
  onClose,
  onRequestRemove,
  onCancelRemove,
  onConfirmRemove,
  messengerItems,
  messengerOrderSaving,
  messengerOrderMessage,
  onMessengerMove
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

  useEffect(() => {
    const styleId = 'mzr-settings-scroll-style';
    if (document.getElementById(styleId)) return undefined;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .settings-modal-body::-webkit-scrollbar,
      .settings-keyboard-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
      .settings-modal-body::-webkit-scrollbar-track,
      .settings-keyboard-scroll::-webkit-scrollbar-track { background: #111827; }
      .settings-modal-body::-webkit-scrollbar-thumb,
      .settings-keyboard-scroll::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(59,130,246,0.85), rgba(79,70,229,0.8));
        border-radius: 6px;
        border: 1px solid rgba(15, 23, 42, 0.6);
      }
      .settings-modal-body::-webkit-scrollbar-thumb:hover,
      .settings-keyboard-scroll::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,0.95); }
      .settings-modal-body,
      .settings-keyboard-scroll { scrollbar-color: rgba(59,130,246,0.85) #111827; scrollbar-width: thin; }
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
  const torStatusText = torEnabled ? 'Tor enabled' : 'Tor disabled';
  const torStatusStyle = torEnabled ? styles.torInfoValueEnabled : styles.torInfoValueDisabled;
  const torIpText = torIpLoading ? 'Loading…' : (torCurrentIp || 'Unavailable');
  const torContainerInputId = 'settings-tor-container-id';
  const trimmedTorValue = (torContainerValue || '').trim();
  const savedTorValue = (torSavedContainerId || '').trim();
  const keepCheckboxDisabled = trimmedTorValue.length === 0;
  const containerDirty = trimmedTorValue !== savedTorValue;
  const keepDirty = torKeepEnabledDraft !== torKeepEnabled;
  const torSaveDisabled = torContainerSaving || (!containerDirty && !keepDirty);

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

        <div style={styles.sections} className="settings-modal-body">
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
            <div style={blockBodyStyle}>
              <div style={styles.torInfoRow}>
                <span style={styles.torInfoLabel}>Tor status</span>
                <span
                  style={{
                    ...styles.torInfoValue,
                    ...torStatusStyle,
                    ...(modeStyles.settingsTorInfoValue || {})
                  }}
                >
                  {torStatusText}
                </span>
              </div>
              <div style={styles.torInfoRow}>
                <span style={styles.torInfoLabel}>Current IP</span>
                <span
                  style={{
                    ...styles.torInfoValue,
                    ...(modeStyles.settingsTorInfoValue || {})
                  }}
                >
                  {torIpText}
                </span>
              </div>
              <div style={styles.torInputGroup}>
                <label
                  htmlFor={torContainerInputId}
                  style={{
                    ...styles.torInputLabel,
                    ...(modeStyles.settingsTorInputLabel || {})
                  }}
                >
                  Tor Libertine container identifier
                </label>
                <div style={styles.torInputRow}>
                  <input
                    id={torContainerInputId}
                    type="text"
                    value={torContainerValue ?? ''}
                    onChange={(event) => onTorContainerChange(event.target.value)}
                    onPointerDown={onTorInputPointerDown}
                    onFocus={onTorInputFocus}
                    onBlur={onTorInputBlur}
                    ref={torInputRef}
                    style={{
                      ...styles.torInput,
                      ...(modeStyles.settingsTorInput || {})
                    }}
                    placeholder="e.g. main"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={onSaveTorContainer}
                    disabled={torSaveDisabled}
                    style={{
                      ...styles.torSaveButton,
                      ...(modeStyles.settingsTorSaveButton || {}),
                      ...(torSaveDisabled ? baseStyles.modalButtonDisabled : null)
                    }}
                  >
                    {torContainerSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
                <p
                  style={{
                    ...styles.torInputHint,
                    ...(modeStyles.settingsTorInputHint || {})
                  }}
                >
                  Set the Libertine container ID where Tor is installed.
                </p>
                <label
                  style={{
                    ...styles.torKeepRow,
                    ...(modeStyles.settingsTorKeepRow || {})
                  }}
                  title={keepCheckboxDisabled ? 'Set the Libertine container identifier first' : undefined}
                >
                  <input
                    type="checkbox"
                    checked={torKeepEnabledDraft}
                    disabled={keepCheckboxDisabled}
                    onChange={(event) => onTorKeepChange(event.target.checked)}
                    style={{
                      ...styles.torKeepCheckbox,
                      ...(modeStyles.settingsTorKeepCheckbox || {}),
                      ...(keepCheckboxDisabled ? { cursor: 'not-allowed' } : {})
                    }}
                  />
                  <span
                    style={{
                      ...styles.torKeepLabel,
                      ...(keepCheckboxDisabled ? styles.torKeepLabelDisabled : {}),
                      ...(modeStyles.settingsTorKeepLabel || {})
                    }}
                  >
                    Keep Tor enabled
                  </span>
                </label>
                {torContainerMessage && (
                  <p
                    style={{
                      ...styles.torMessage,
                      ...(modeStyles.settingsTorMessage || {})
                    }}
                    aria-live="polite"
                  >
                    {torContainerMessage}
                  </p>
                )}
              </div>
            </div>
          </section>

          <MessengerSettings
            mode={mode}
            items={messengerItems}
            saving={messengerOrderSaving}
            message={messengerOrderMessage}
            onMove={onMessengerMove}
          />

          <KeyboardSettings mode={mode} />

          <PermissionsSettings mode={mode} />

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
