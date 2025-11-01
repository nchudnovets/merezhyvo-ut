import * as React from 'react';
import type { LayoutId } from '../../../keyboard/layouts';

type KeyboardLayoutId = Exclude<LayoutId, 'symbols'>;

type Props = {
  available: { id: KeyboardLayoutId; label: string }[];
  enabled: KeyboardLayoutId[];
  defaultId: KeyboardLayoutId;
  onToggle: (id: KeyboardLayoutId) => void;
  onMove: (id: KeyboardLayoutId, dir: 'up' | 'down') => void;
  onSetDefault: (id: KeyboardLayoutId) => void;
  onSave: () => void;
  saving?: boolean;
  message?: string;
};

const small: React.CSSProperties = { fontSize: 12, opacity: 0.8 };
const row: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto auto auto',
  gap: 8,
  alignItems: 'center',
  padding: '6px 0',
  borderBottom: '1px solid rgba(0,0,0,.08)',
};
const btn: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(0,0,0,.15)',
  background: 'transparent',
  cursor: 'pointer',
};

const KeyboardSettings: React.FC<Props> = (p) => {
  const { available, enabled, defaultId, onToggle, onMove, onSetDefault, onSave, saving, message } = p;

  const isEnabled = (id: KeyboardLayoutId) => enabled.includes(id);
  const indexOf = (id: KeyboardLayoutId) => enabled.indexOf(id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>Keyboard layouts</h3>
      <p style={small}>Увімкни потрібні розкладки, вистав порядок і обери дефолтну. Порядок впливає на перебір кнопкою 🌐.</p>

      <div role="list" aria-label="Available layouts">
        {available.map(({ id, label }) => {
          const checked = isEnabled(id);
          const idx = indexOf(id);
          return (
            <div key={id} role="listitem" style={row}>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="checkbox" checked={checked} onChange={() => onToggle(id)} />
                <span style={{ fontWeight: 500 }}>{label}</span>
                <span style={small}>({id})</span>
              </label>

              <div />

              <button type="button" style={btn} onClick={() => onMove(id, 'up')} disabled={!checked || idx <= 0}>↑</button>
              <button type="button" style={btn} onClick={() => onMove(id, 'down')} disabled={!checked || idx === enabled.length - 1}>↓</button>

              <button
                type="button"
                style={{ ...btn, ...(defaultId === id ? { borderColor: '#22d3ee' } : null) }}
                onClick={() => onSetDefault(id)}
                disabled={!checked}
                aria-pressed={defaultId === id}
                title="Set as default"
              >
                {defaultId === id ? 'Default ✓' : 'Make default'}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" style={btn} onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save layouts'}
        </button>
        {message ? <span style={small}>{message}</span> : null}
      </div>
    </div>
  );
};

export default KeyboardSettings;
