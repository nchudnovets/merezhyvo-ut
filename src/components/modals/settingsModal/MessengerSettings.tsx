import React, { useState } from 'react';
import type { Mode, MessengerDefinition, MessengerId } from '../../../types/models';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import { styles as baseStyles } from '../../../styles/styles';

type MessengerSettingsProps = {
  mode: Mode;
  items: MessengerDefinition[];
  saving: boolean;
  message: string;
  onMove: (id: MessengerId, direction: 'up' | 'down') => void;
};

export const MessengerSettings: React.FC<MessengerSettingsProps> = ({
  mode,
  items,
  saving,
  message,
  onMove
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);

  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
  const blockBodyStyle = {
    ...styles.blockBody,
    ...(modeStyles.settingsBlockBody || {})
  };
  const actionIconWidth = (modeStyles.settingsMessengerActionIcn?.width ?? 14) as number | string;
  const actionIconHeight = (modeStyles.settingsMessengerActionIcn?.height ?? actionIconWidth) as number | string;

  return (
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
          Messenger toolbar
        </h3>
        <div
          style={{
            ...styles.keyboardHeaderActions,
            ...(modeStyles.settingsKeyboardHeaderActions || {})
          }}
        >
          {saving && (
            <span
              aria-live="polite"
              style={{
                ...styles.keyboardSavedPill,
                ...(modeStyles.settingsKeyboardSavedPill || {}),
                background: 'rgba(59,130,246,0.12)',
                color: '#93c5fd',
                borderColor: 'rgba(59,130,246,0.35)'
              }}
            >
              Saving…
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? 'Collapse messenger toolbar settings' : 'Expand messenger toolbar settings'}
            style={{
              ...styles.keyboardToggleButton,
              ...(modeStyles.settingsKeyboardToggleButton || {})
            }}
          >
            {expanded ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                <path fill="#ffffff" d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                <path fill="#ffffff" d="M297.4 470.6C309.9 483.1 330.2 483.1 342.7 470.6L534.7 278.6C547.2 266.1 547.2 245.8 534.7 233.3C522.2 220.8 501.9 220.8 489.4 233.3L320 402.7L150.6 233.4C138.1 220.9 117.8 220.9 105.3 233.4C92.8 245.9 92.8 266.2 105.3 278.7L297.3 470.7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={blockBodyStyle}>
          <p
            style={{
              ...styles.messengerHint,
              ...(modeStyles.settingsMessengerHint || {})
            }}
          >
            Arrange messengers to adjust their order in the messenger toolbar.
          </p>

          {items.length === 0 ? (
            <p
              style={{
                ...styles.messengerHint,
                ...(modeStyles.settingsMessengerHint || {})
              }}
            >
              No messengers available.
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
                        aria-label={`Move ${item.title} up`}
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
                        aria-label={`Move ${item.title} down`}
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
      )}
    </section>
  );
};

export default MessengerSettings;
