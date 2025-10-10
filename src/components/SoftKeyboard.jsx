import React, { useMemo, useState, useRef, useEffect } from 'react';
import { layouts as builtinLayouts, SPECIAL_KEYS } from '../keyboard/layouts';

const {
  SHIFT,
  BACKSPACE,
  TOGGLE_SYMBOLS,
  NEXT_LAYOUT,
  SPACE,
  ARROW_LEFT,
  ARROW_RIGHT,
  ENTER
} = SPECIAL_KEYS;

const SPECIAL_TOKEN_SET = new Set(Object.values(SPECIAL_KEYS));

export default function SoftKeyboard({
  visible = false,
  height = 650,
  layoutId = 'en',
  shift = false,
  caps = false,
  onKey,
  onClose,
  onToggleShift,
  onToggleSymbols,
  onNextLayout
}) {
  const layout = builtinLayouts[layoutId] || builtinLayouts.en;

  const [activeKeyId, setActiveKeyId] = useState(null);
  const [feedback, setFeedback] = useState('');
  const feedbackTimer = useRef(null);

  useEffect(() => () => {
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
    }
  }, []);

  const rows = useMemo(() => {
    const isShifted = shift || caps;
    const rowsWithBottom = [...(layout.rows || [])];
    if (layout.bottomRow) {
      rowsWithBottom.push(layout.bottomRow);
    }

    return rowsWithBottom.map((row, rowIndex) => {
      return row.map((item, colIndex) => {
        if (typeof item === 'string' && !SPECIAL_TOKEN_SET.has(item)) {
          const label = isShifted ? item.toUpperCase() : item;
          return {
            id: `char-${rowIndex}-${colIndex}-${item}`,
            type: 'char',
            label,
            value: label,
            colSpan: 1,
            feedback: label
          };
        }

        switch (item) {
          case SHIFT:
            return {
              id: `shift-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'shift',
              label: '⇧',
              colSpan: 1,
              feedback: shift || caps ? 'Shift (on)' : 'Shift'
            };
          case BACKSPACE:
            return {
              id: `backspace-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'backspace',
              label: '⌫',
              colSpan: 1,
              feedback: 'Backspace'
            };
          case TOGGLE_SYMBOLS:
            return {
              id: `toggle-symbols-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'toggleSymbols',
              label: layoutId === 'symbols' ? 'ABC' : '?!$',
              colSpan: 1,
              feedback: layoutId === 'symbols' ? 'Letters' : 'Symbols'
            };
          case NEXT_LAYOUT:
            return {
              id: `next-layout-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'nextLayout',
              label: '🌐',
              colSpan: 1,
              feedback: 'Language'
            };
          case SPACE:
            return {
              id: `space-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'space',
              label: layout.shortLabel || layout.name || 'Space',
              colSpan: 2,
              feedback: `Space (${layout.shortLabel || layout.name || ''})`
            };
          case ARROW_LEFT:
            return {
              id: `arrow-left-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'arrowLeft',
              label: '<-',
              colSpan: 1,
              feedback: 'Cursor <-'
            };
          case ARROW_RIGHT:
            return {
              id: `arrow-right-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'arrowRight',
              label: '->',
              colSpan: 1,
              feedback: 'Cursor ->'
            };
          case ENTER:
            return {
              id: `enter-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'enter',
              label: 'Enter',
              colSpan: 1,
              feedback: 'Enter'
            };
          default:
            return {
              id: `unknown-${rowIndex}-${colIndex}`,
              type: 'char',
              label: '',
              value: '',
              colSpan: 1,
              feedback: ''
            };
        }
      });
    });
  }, [layout, layoutId, shift, caps]);

  const handleButtonClick = (key) => {
    if (!key) return;
    if (key.type === 'char') {
      onKey?.(key.value);
      return;
    }

    switch (key.action) {
      case 'shift':
        onToggleShift?.();
        break;
      case 'backspace':
        onKey?.('Backspace');
        break;
      case 'toggleSymbols':
        onToggleSymbols?.();
        break;
      case 'nextLayout':
        onNextLayout?.();
        break;
      case 'space':
        onKey?.(' ');
        break;
      case 'arrowLeft':
        onKey?.('ArrowLeft');
        break;
      case 'arrowRight':
        onKey?.('ArrowRight');
        break;
      case 'enter':
        onKey?.('Enter');
        break;
      default:
        break;
    }
  };

  if (!visible) {
    return null;
  }

  const baseButton = {
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(148, 163, 184, 0.25)',
    boxSizing: 'border-box',
    background: '#1c2333',
    color: '#f8fafc',
    fontSize: 'clamp(18px, 2.6vw, 26px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    touchAction: 'manipulation',
    padding: 0,
    transition: 'background 0.12s ease, transform 0.12s ease, border-color 0.12s ease',
    cursor: 'pointer',
    fontWeight: 600
  };

  const preventFocusLoss = (event) => {
    event.preventDefault();
  };

  const handlePressStart = (event, key) => {
    preventFocusLoss(event);
    setActiveKeyId(key.id);
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
    }
    setFeedback(key.feedback || key.label || '');
  };

  const scheduleFeedbackClear = () => {
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = setTimeout(() => {
      setFeedback('');
    }, 500);
  };

  const handlePressEnd = () => {
    setActiveKeyId(null);
    scheduleFeedbackClear();
  };

  const containerStyle = {
    width: '100%',
    maxWidth: '100vw',
    height: typeof height === 'number' ? `${height}px` : height,
    padding: '16px 16px 50px',
    background: 'rgba(18, 24, 38, 0.98)',
    boxShadow: '0 -6px 24px rgba(0, 0, 0, 0.35)',
    zIndex: 40,
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    position: 'relative'
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  };

  const feedbackStyle = {
    minWidth: 120,
    height: 48,
    borderRadius: 12,
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: feedback ? 'rgba(59, 130, 246, 0.16)' : 'rgba(15, 23, 42, 0.65)',
    color: '#f8fafc',
    fontSize: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '0 16px',
    boxSizing: 'border-box',
    fontWeight: 600
  };

  const closeButtonStyle = {
    ...baseButton,
    width: 56,
    height: 48,
    fontSize: 24,
    margin: 0
  };

  const rowsContainerStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    minHeight: 0
  };

  const activeStyle = {
    background: '#2a344a',
    borderColor: 'rgba(59, 130, 246, 0.65)',
    transform: 'translateY(1px)'
  };

  return (
    <div style={containerStyle} data-soft-keyboard="true">
      <div style={headerStyle}>
        <div style={feedbackStyle}>{feedback}</div>
        <button
          type="button"
          onPointerDown={preventFocusLoss}
          onClick={onClose}
          title="Close keyboard"
          aria-label="Close keyboard"
          style={closeButtonStyle}
        >
          ✕
        </button>
      </div>

      <div style={rowsContainerStyle}>
        {rows.map((row, rowIndex) => {
          const totalColumns = row.reduce((sum, key) => sum + (key.colSpan || 1), 0);
          return (
            <div
              key={`row-${rowIndex}`}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))`,
                gap: 12,
                flex: 1,
                minHeight: 0,
                gridAutoRows: '1fr',
                alignItems: 'stretch'
              }}
            >
              {row.map((key) => {
                const isActive = activeKeyId === key.id || (key.action === 'shift' && (shift || caps));
                return (
                  <button
                    type="button"
                    key={key.id}
                    onPointerDown={(event) => handlePressStart(event, key)}
                    onPointerUp={handlePressEnd}
                    onPointerLeave={handlePressEnd}
                    onPointerCancel={handlePressEnd}
                    onClick={() => handleButtonClick(key)}
                    style={{
                      ...baseButton,
                      ...(key.colSpan > 1 ? { gridColumn: `span ${key.colSpan}` } : null),
                      ...(isActive ? activeStyle : null)
                    }}
                  >
                    {key.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
