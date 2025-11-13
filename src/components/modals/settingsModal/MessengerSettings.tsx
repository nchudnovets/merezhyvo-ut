import React from 'react';
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
  // const [expanded, setExpanded] = useState<boolean>(false);

  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
  const blockBodyStyle = {
    ...styles.blockBody,
    ...(modeStyles.settingsBlockBody || {})
  };
  const actionIconWidth = (modeStyles.settingsMessengerActionIcn?.width ?? 14) as number | string;
  const actionIconHeight = (modeStyles.settingsMessengerActionIcn?.height ?? actionIconWidth) as number | string;

  return (
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
  );
};

export default MessengerSettings;
