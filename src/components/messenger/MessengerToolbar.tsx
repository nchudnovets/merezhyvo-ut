import React, { type Ref } from 'react';
import type { MessengerDefinition, MessengerId, Mode } from '../../types/models';
import { messengerToolbarStyles, messengerToolbarModeStyles } from './messengerToolbarStyles';
import { MessengerIcon } from './MessengerIcon';
import { useI18n } from '../../i18n/I18nProvider';

interface MessengerToolbarProps {
  mode: Mode;
  messengers: MessengerDefinition[];
  activeMessengerId: MessengerId | null;
  onSelectMessenger: (id: MessengerId) => void;
  onExit: () => void;
  toolbarRef?: Ref<HTMLDivElement>;
}

export const MessengerToolbar: React.FC<MessengerToolbarProps> = ({
  mode,
  messengers,
  activeMessengerId,
  onSelectMessenger,
  onExit
  ,
  toolbarRef
}) => {
  const base = messengerToolbarStyles;
  const modeStyles = messengerToolbarModeStyles[mode] || {};
  const { t } = useI18n();

  if (!messengers.length) {
    return (
      <div
        style={{
          ...base.container,
          ...(modeStyles.container || {}),
          justifyContent: 'flex-end'
        }}
      >
        <button
          type="button"
          onClick={onExit}
          style={{
            ...base.exitButton,
            ...(modeStyles.exitButton || {})
          }}
        >
          <span style={{ ...base.label, ...(modeStyles.label || {}) }}>
            {t('messenger.toolbar.back')}
          </span>
          <span style={{ ...base.icon, marginLeft: 6 }}>
            <svg
              width={modeStyles.icon?.width ?? 18}
              height={modeStyles.icon?.height ?? 18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div ref={toolbarRef} style={{ ...base.container, ...(modeStyles.container || {}) }}>
      <div style={{ ...base.list, ...(modeStyles.list || {}) }}>
        {messengers.map((messenger) => {
          const isActive = messenger.id === activeMessengerId;
          return (
            <button
              key={messenger.id}
              type="button"
              onClick={() => onSelectMessenger(messenger.id)}
              aria-pressed={isActive ? 'true' : 'false'}
              style={{
                ...base.button,
                ...(modeStyles.button || {}),
                ...(isActive ? { ...base.buttonActive, ...(modeStyles.buttonActive || {}) } : {})
              }}
            >
              <span style={base.icon}>
                <MessengerIcon id={messenger.id} size={modeStyles.icon?.width} />
              </span>
              <span style={{ ...base.label, ...(modeStyles.label || {}) }}>{messenger.title}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onExit}
          style={{
            ...base.exitButton,
            ...(modeStyles.exitButton || {})
          }}
        >
          <span style={{ ...base.label, ...(modeStyles.label || {}) }}>
            {t('messenger.toolbar.back')}
          </span>
          <span style={{ ...base.icon, marginLeft: 6 }}>
            <svg
              width={modeStyles.icon?.width ?? 18}
              height={modeStyles.icon?.height ?? 18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
};

export default MessengerToolbar;
