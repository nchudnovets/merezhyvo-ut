import React from 'react';
import type { MessengerDefinition, MessengerId, Mode } from '../../types/models';
import { messengerToolbarStyles, messengerToolbarModeStyles } from './messengerToolbarStyles';
import { MessengerIcon, BrowserIcon } from './MessengerIcon';

interface MessengerToolbarProps {
  mode: Mode;
  messengers: MessengerDefinition[];
  activeMessengerId: MessengerId | null;
  onSelectMessenger: (id: MessengerId) => void;
  onExit: () => void;
}

export const MessengerToolbar: React.FC<MessengerToolbarProps> = ({
  mode,
  messengers,
  activeMessengerId,
  onSelectMessenger,
  onExit
}) => {
  const base = messengerToolbarStyles;
  const modeStyles = messengerToolbarModeStyles[mode] || {};

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
          <BrowserIcon size={modeStyles.icon?.width} />
          <span style={{ ...base.label, ...(modeStyles.label || {}) }}>Browser</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ ...base.container, ...(modeStyles.container || {}) }}>
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
      </div>
      <button
        type="button"
        onClick={onExit}
        style={{
          ...base.exitButton,
          ...(modeStyles.exitButton || {})
        }}
      >
        <span style={base.icon}>
          <BrowserIcon size={modeStyles.icon?.width} />
        </span>
        <span style={{ ...base.label, ...(modeStyles.label || {}) }}>Browser</span>
      </button>
    </div>
  );
};

export default MessengerToolbar;
