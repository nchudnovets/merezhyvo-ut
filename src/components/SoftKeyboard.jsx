import React, { useMemo } from 'react';
import { layouts as builtinLayouts } from '../keyboard/layouts';

export default function SoftKeyboard({
  visible = false,
  height = 260,
  layoutId = 'en',
  shift = false,
  caps = false,
  onKey,
  onClose,
  onToggleShift,
  onToggleCaps,
  onToggleSymbols,
  onNextLayout
}) {
  const layout = builtinLayouts[layoutId] || builtinLayouts.en;

  const rows = useMemo(() => {
    const base = layout.rows || [];
    return base.map((row) =>
      row.map((key) => (shift || caps ? key.toUpperCase() : key))
    );
  }, [layout, shift, caps]);

  if (!visible) return null;

  const baseButton = {
    flex: '0 0 auto',
    minWidth: 44,
    height: 44,
    margin: 4,
    borderRadius: 10,
    border: '1px solid rgba(148, 163, 184, 0.25)',
    background: '#1c2333',
    color: '#f8fafc',
    fontSize: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    touchAction: 'manipulation',
    padding: 0
  };

  const smallButton = {
    ...baseButton,
    minWidth: 44,
    width: 44,
    height: 40,
    fontSize: 16
  };

  const preventFocusLoss = (event) => {
    event.preventDefault();
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height,
        padding: '8px 8px calc(env(safe-area-inset-bottom,0) + 8px)',
        background: 'rgba(18, 24, 38, 0.98)',
        boxShadow: '0 -6px 24px rgba(0, 0, 0, 0.35)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 6
        }}
      >
        <div style={{ opacity: 0.75, padding: '4px 8px' }}>
          {layout.name} {caps ? '⇪' : shift ? '⇧' : ''}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={onNextLayout}
            onPointerDown={preventFocusLoss}
            style={smallButton}
            title="Next layout"
            aria-label="Next layout"
          >
            🌐
          </button>
          <button
            type="button"
            onClick={onClose}
            onPointerDown={preventFocusLoss}
            style={smallButton}
            title="Close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: 'flex', justifyContent: 'center' }}>
            {rowIndex === 2 && (
              <button
                type="button"
                onClick={onToggleCaps}
                onPointerDown={preventFocusLoss}
                style={{ ...baseButton, minWidth: 68 }}
                title="Caps"
              >
                ⇪
              </button>
            )}
            {row.map((key) => (
              <button
                type="button"
                key={key}
                onClick={() => onKey(key)}
                onPointerDown={preventFocusLoss}
                style={baseButton}
              >
                {key}
              </button>
            ))}
            {rowIndex === 2 && (
              <button
                type="button"
                onClick={onToggleShift}
                onPointerDown={preventFocusLoss}
                style={{ ...baseButton, minWidth: 68 }}
                title="Shift"
              >
                ⇧
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => onKey('Backspace')}
          onPointerDown={preventFocusLoss}
          style={{ ...baseButton, minWidth: 88 }}
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={onToggleSymbols}
          onPointerDown={preventFocusLoss}
          style={{ ...baseButton, minWidth: 88 }}
        >
          {layoutId === 'symbols' ? 'ABC' : '123'}
        </button>
        <button
          type="button"
          onClick={() => onKey(' ')}
          onPointerDown={preventFocusLoss}
          style={{ ...baseButton, minWidth: 200 }}
        >
          Space
        </button>
        <button
          type="button"
          onClick={() => onKey('Enter')}
          onPointerDown={preventFocusLoss}
          style={{ ...baseButton, minWidth: 88 }}
        >
          ⏎
        </button>
      </div>
    </div>
  );
}
