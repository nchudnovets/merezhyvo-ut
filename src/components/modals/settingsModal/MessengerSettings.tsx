import React from 'react';
import type { Mode, MessengerDefinition, MessengerId } from '../../../types/models';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import { styles as baseStyles } from '../../../styles/styles';
import { useI18n } from '../../../i18n/I18nProvider';

type MessengerSettingsProps = {
  mode: Mode;
  items: MessengerDefinition[];
  saving: boolean;
  message: string;
  onMove: (id: MessengerId, direction: 'up' | 'down') => void;
  hideToolbar: boolean;
  onToggleHideToolbar: (hide: boolean) => void;
};

export const MessengerSettings: React.FC<MessengerSettingsProps> = ({
  mode,
  items,
  saving,
  message,
  onMove,
  hideToolbar,
  onToggleHideToolbar
}) => {
  // const [expanded, setExpanded] = useState<boolean>(false);

  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
  const { t } = useI18n();
  const blockBodyStyle = {
    ...styles.blockBody,
    ...(modeStyles.settingsBlockBody || {})
  };
  const actionIconWidth = (modeStyles.settingsMessengerActionIcn?.width ?? 14) as number | string;
  const actionIconHeight = (modeStyles.settingsMessengerActionIcn?.height ?? actionIconWidth) as number | string;
  const toggleTrackWidth = mode === 'mobile' ? 90 : 46;
  const toggleTrackHeight = mode === 'mobile' ? 48 : 24;
  const toggleThumbSize = mode === 'mobile' ? 40 : 18;

  return (
    <div style={blockBodyStyle}>
      <p
        style={{
          ...styles.messengerHint,
          ...(modeStyles.settingsMessengerHint || {})
        }}
      >
        {t('settings.messenger.arrange')}
      </p>

      {items.length === 0 ? (
        <p
          style={{
            ...styles.messengerHint,
            ...(modeStyles.settingsMessengerHint || {})
          }}
        >
          {t('settings.messenger.empty')}
        </p>
      ) : (
        <ul style={styles.messengerList}>
          {items.map((item, index) => {
            const disableUp = index === 0 || saving;
            const disableDown = index === items.length - 1 || saving;
            return (
              <li
                key={item.id}
                style={{
                  ...styles.messengerRow,
                  ...(modeStyles.settingsMessengerRow || {})
                }}
              >
                <div style={styles.messengerInfo}>
                  <span
                    style={{
                      ...styles.messengerName,
                      ...(modeStyles.settingsMessengerName || {})
                    }}
                    title={item.title}
                  >
                    {item.title}
                  </span>
                  <span
                    style={{
                      ...styles.messengerUrl,
                      ...(modeStyles.settingsMessengerUrl || {})
                    }}
                    title={item.url}
                  >
                    {item.url}
                  </span>
                </div>
                <div style={styles.messengerActions}>
                  <button
                    type="button"
                    onClick={() => onMove(item.id, 'up')}
                    disabled={disableUp}
                    aria-label={t('settings.messenger.moveUp', { title: item.title })}
                    style={{
                      ...styles.messengerActionButton,
                      ...(modeStyles.settingsMessengerActionButton || {}),
                      ...(disableUp ? baseStyles.modalButtonDisabled : null)
                    }}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      width={actionIconWidth}
                      height={actionIconHeight}
                      style={modeStyles.settingsMessengerActionIcn}
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path d="M8 4.25 3.75 8.5h2.5V12h3.5V8.5h2.5L8 4.25Z" fill="currentColor" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(item.id, 'down')}
                    disabled={disableDown}
                    aria-label={t('settings.messenger.moveDown', { title: item.title })}
                    style={{
                      ...styles.messengerActionButton,
                      ...(modeStyles.settingsMessengerActionButton || {}),
                      ...(disableDown ? baseStyles.modalButtonDisabled : null)
                    }}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      width={actionIconWidth}
                      height={actionIconHeight}
                      style={modeStyles.settingsMessengerActionIcn}
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path d="M8 11.75 12.25 7.5h-2.5V4h-3.5v3.5h-2.5L8 11.75Z" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div
        style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        <span
          style={{
            ...styles.messengerHint,
            ...(modeStyles.settingsMessengerHint || {}),
            margin: 0
          }}
        >
          {t('settings.messenger.hideToolbar')}
        </span>
        <label
          style={{
            position: 'relative',
            width: toggleTrackWidth,
            height: toggleTrackHeight,
            display: 'inline-block',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <input
            type="checkbox"
            checked={hideToolbar}
            onChange={(event) => onToggleHideToolbar(event.target.checked)}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              margin: 0,
              cursor: 'pointer',
              zIndex: 2
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 999,
              backgroundColor: hideToolbar ? 'var(--mzr-accent)' : 'var(--mzr-surface-muted)',
              border: '1px solid var(--mzr-border)',
              transition: 'background-color 160ms ease, border-color 160ms ease'
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: (toggleTrackHeight - toggleThumbSize) / 2,
              left: hideToolbar ? toggleTrackWidth - toggleThumbSize - 4 : 4,
              width: toggleThumbSize,
              height: toggleThumbSize,
              borderRadius: 999,
              backgroundColor: '#fff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              transition: 'left 160ms ease'
            }}
          />
        </label>
      </div>

      {message && (
        <p
          style={{
            ...styles.messengerMessage,
            ...(modeStyles.settingsMessengerMessage || {})
          }}
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default MessengerSettings;
