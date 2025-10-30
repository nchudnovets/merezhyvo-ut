import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback
} from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import {
  layouts as builtinLayouts,
  SPECIAL_KEYS,
  type KeyboardLayoutDefinition,
  type KeyboardLayoutId
} from '../../layouts/keyboard/layouts';

type ActionType =
  | 'shift'
  | 'backspace'
  | 'toggleSymbols'
  | 'nextLayout'
  | 'space'
  | 'arrowLeft'
  | 'arrowRight'
  | 'enter';

type CharKey = {
  id: string;
  type: 'char';
  label: string;
  value: string;
  colSpan: number;
  feedback: string;
};

type ActionKey = {
  id: string;
  type: 'action';
  action: ActionType;
  label: string;
  colSpan: number;
  feedback: string;
};

type KeyboardKey = CharKey | ActionKey;

interface SoftKeyboardProps {
  visible?: boolean;
  height?: number | string;
  layoutId?: KeyboardLayoutId;
  shift?: boolean;
  caps?: boolean;
  onKey?: (value: string) => void;
  onClose?: () => void;
  onToggleShift?: () => void;
  onToggleCaps?: () => void;
  onToggleSymbols?: () => void;
  onNextLayout?: () => void;
}

const SPECIAL_TOKEN_SET = new Set<string>(Object.values(SPECIAL_KEYS));
const SMALL_LABELS = new Set<string>(['ABC']);
const SMALL_ACTIONS: Set<ActionType> = new Set(['backspace']);

const defaultLayout: KeyboardLayoutDefinition =
  builtinLayouts.en ??
  Object.values(builtinLayouts)[0] ?? {
    name: 'Keyboard',
    rows: [],
    bottomRow: []
  };

function SoftKeyboard({
  visible = false,
  height = 650,
  layoutId = 'en',
  shift = false,
  caps = false,
  onKey,
  onClose,
  onToggleShift,
  onToggleCaps,
  onToggleSymbols,
  onNextLayout
}: SoftKeyboardProps): React.ReactElement | null {
  const layout: KeyboardLayoutDefinition = builtinLayouts[layoutId] ?? defaultLayout;

  const [activeKeyId, setActiveKeyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [keyFontSize, setKeyFontSize] = useState<number | null>(null);
  const [keySize, setKeySize] = useState<{ width: number | null; height: number | null }>({
    width: null,
    height: null
  });
  const feedbackTimer = useRef<number | null>(null);
  const rowsContainerRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo<KeyboardKey[][]>(() => {
    const isShifted = shift || caps;
    const layoutRows = layout.bottomRow ? [...layout.rows, layout.bottomRow] : [...layout.rows];
    const layoutLabel = layout.shortLabel ?? layout.name ?? '';

    return layoutRows.map((row, rowIndex) =>
      row.map<KeyboardKey>((item, colIndex) => {
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
          case SPECIAL_KEYS.SHIFT:
            return {
              id: `shift-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'shift',
              label: '⇧',
              colSpan: 1,
              feedback: shift || caps ? 'Shift (on)' : 'Shift'
            };
          case SPECIAL_KEYS.BACKSPACE:
            return {
              id: `backspace-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'backspace',
              label: '⌫',
              colSpan: 1,
              feedback: 'Backspace'
            };
          case SPECIAL_KEYS.TOGGLE_SYMBOLS:
            return {
              id: `toggle-symbols-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'toggleSymbols',
              label: layoutId === 'symbols' ? 'ABC' : '?!$',
              colSpan: 1,
              feedback: layoutId === 'symbols' ? 'Letters' : 'Symbols'
            };
          case SPECIAL_KEYS.NEXT_LAYOUT:
            return {
              id: `next-layout-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'nextLayout',
              label: '🌐',
              colSpan: 1,
              feedback: 'Language'
            };
          case SPECIAL_KEYS.SPACE: {
            const spaceLabel = layout.shortLabel ?? layout.name ?? 'Space';
            const spaceFeedback = layoutLabel ? `Space (${layoutLabel})` : 'Space';
            return {
              id: `space-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'space',
              label: spaceLabel,
              colSpan: 2,
              feedback: spaceFeedback
            };
          }
          case SPECIAL_KEYS.ARROW_LEFT:
            return {
              id: `arrow-left-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'arrowLeft',
              label: '<-',
              colSpan: 1,
              feedback: 'Cursor <-'
            };
          case SPECIAL_KEYS.ARROW_RIGHT:
            return {
              id: `arrow-right-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'arrowRight',
              label: '->',
              colSpan: 1,
              feedback: 'Cursor ->'
            };
          case SPECIAL_KEYS.ENTER:
            return {
              id: `enter-${rowIndex}-${colIndex}`,
              type: 'action',
              action: 'enter',
              label: '⏎',
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
      })
    );
  }, [layout, layoutId, shift, caps]);

  useEffect(
    () => () => {
      if (feedbackTimer.current !== null) {
        window.clearTimeout(feedbackTimer.current);
        feedbackTimer.current = null;
      }
    },
    []
  );

  const measureKeySize = useCallback(() => {
    const container = rowsContainerRef.current;
    if (!container) return;

    const sample = container.querySelector<HTMLButtonElement>('button[data-key-measure="true"]');
    if (!sample) return;

    const rect = sample.getBoundingClientRect();
    if (rect.height <= 0) return;

    const nextSize = Math.max(20, Math.round(rect.height * 0.8));
    setKeyFontSize((prev) => (prev !== null && Math.abs(prev - nextSize) < 1 ? prev : nextSize));
    setKeySize((prev) => {
      const width = rect.width;
      const height = rect.height;
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    measureKeySize();
  }, [visible, rows, measureKeySize]);

  useEffect(() => {
    if (!visible) return;
    window.addEventListener('resize', measureKeySize);
    return () => {
      window.removeEventListener('resize', measureKeySize);
    };
  }, [visible, measureKeySize]);

  const preventFocusLoss = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const scheduleFeedbackClear = useCallback(() => {
    if (feedbackTimer.current !== null) {
      window.clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = window.setTimeout(() => {
      setFeedback('');
      feedbackTimer.current = null;
    }, 500);
  }, []);

  const handlePressStart = (event: ReactPointerEvent<HTMLButtonElement>, key: KeyboardKey) => {
    preventFocusLoss(event);
    setActiveKeyId(key.id);
    if (feedbackTimer.current !== null) {
      window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = null;
    }
    setFeedback(key.feedback || key.label || '');
  };

  const handlePressEnd = () => {
    setActiveKeyId(null);
    scheduleFeedbackClear();
  };

  const handleButtonClick = (key: KeyboardKey) => {
    if (key.type === 'char') {
      onKey?.(key.value);
      return;
    }

    switch (key.action) {
      case 'shift':
        if (caps) {
          onToggleCaps?.();
          if (shift) {
            onToggleShift?.();
          }
          break;
        }
        if (shift) {
          onToggleShift?.();
          onToggleCaps?.();
        } else {
          onToggleShift?.();
        }
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

  const containerHeight = typeof height === 'number' ? `${height}px` : height;

  const baseButton: CSSProperties = {
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
    fontSize: keyFontSize ? `${keyFontSize}px` : 'clamp(26px, 6vw, 46px)',
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

  const containerStyle: CSSProperties = {
    width: '100%',
    maxWidth: '100vw',
    height: containerHeight,
    padding: '16px 16px 50px',
    background: 'rgba(18, 24, 38, 0.98)',
    boxShadow: '0 -6px 24px rgba(0, 0, 0, 0.35)',
    zIndex: 500,
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12
  };

  const feedbackWidth =
    keySize.width !== null ? Math.max(keySize.width * 2, 120) : 120;
  const feedbackHeight = keySize.height ?? 62;

  const feedbackStyle: CSSProperties = {
    minWidth: feedbackWidth,
    height: feedbackHeight,
    borderRadius: 12,
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: feedback ? 'rgba(59, 130, 246, 0.16)' : 'rgba(15, 23, 42, 0.65)',
    color: '#f8fafc',
    fontSize: keyFontSize ? `${keyFontSize}px` : 'clamp(26px, 6vw, 46px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 16px',
    boxSizing: 'border-box',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const closeButtonStyle: CSSProperties = {
    ...baseButton,
    width: keySize.width ?? 62,
    height: keySize.height ?? 62,
    fontSize: keyFontSize ? `${keyFontSize}px` : 'clamp(26px, 6vw, 46px)',
    margin: 0,
    flex: '0 0 auto'
  };

  const rowsContainerStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    minHeight: 0
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

      <div style={rowsContainerStyle} ref={rowsContainerRef}>
        {rows.map((row, rowIndex) => {
          const totalColumns = row.reduce<number>((sum, key) => sum + key.colSpan, 0);
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
              {row.map((key, keyIndex) => {
                const isActive =
                  activeKeyId === key.id ||
                  (key.type === 'action' && key.action === 'shift' && (shift || caps));
                const isSampleKey = rowIndex === 0 && keyIndex === 0;
                const isSmallFont =
                  key.type === 'action'
                    ? SMALL_ACTIONS.has(key.action)
                    : SMALL_LABELS.has(key.label);

                const computedStyle: CSSProperties = {
                  ...baseButton
                };

                if (key.colSpan > 1) {
                  computedStyle.gridColumn = `span ${key.colSpan}`;
                }
                if (isActive) {
                  computedStyle.background = '#2a344a';
                  computedStyle.borderColor = 'rgba(59, 130, 246, 0.65)';
                  computedStyle.transform = 'translateY(1px)';
                }
                if (isSmallFont) {
                  computedStyle.fontSize = keyFontSize
                    ? `${Math.max(14, Math.round(keyFontSize * 0.6))}px`
                    : 'clamp(16px, 4vw, 32px)';
                }

                return (
                  <button
                    type="button"
                    key={key.id}
                    onPointerDown={(event) => handlePressStart(event, key)}
                    onPointerUp={handlePressEnd}
                    onPointerLeave={handlePressEnd}
                    onPointerCancel={handlePressEnd}
                    onClick={() => handleButtonClick(key)}
                    style={computedStyle}
                    data-key-measure={isSampleKey ? 'true' : undefined}
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

export default SoftKeyboard;
