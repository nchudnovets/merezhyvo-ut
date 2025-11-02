import React, { useEffect, useState, useCallback } from 'react';
import { ipc } from '../../../services/ipc/ipc';
import { LANGUAGE_LAYOUT_IDS, humanLabel } from '../../keyboard/layouts';

type KeyboardSettings = {
  enabledLayouts: string[];
  defaultLayout: string;
};

const ALL = LANGUAGE_LAYOUT_IDS; // e.g. ['en','uk','de','pl'] for now

export default function KeyboardSettings() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<string[]>(['en']);
  const [def, setDef] = useState<string>('en');
  const [savedAt, setSavedAt] = useState<number>(0);

  // Load keyboard-only settings from the settings store
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const kb: KeyboardSettings = await ipc.settings.keyboard.get();

      const nextEnabled =
        Array.isArray(kb?.enabledLayouts) && kb.enabledLayouts.length > 0
          ? Array.from(new Set(kb.enabledLayouts))
          : ['en'];

      const nextDefault =
        typeof kb?.defaultLayout === 'string' && nextEnabled.includes(kb.defaultLayout)
          ? kb.defaultLayout
          : (nextEnabled[0] || 'en');

      setEnabled(nextEnabled);
      setDef(nextDefault);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    load();
  }, [load]);

  // Live-sync when other parts of the app update keyboard settings
  useEffect(() => {
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<KeyboardSettings>).detail;
      if (!detail) return;

      const nextEnabled =
        Array.isArray(detail.enabledLayouts) && detail.enabledLayouts.length > 0
          ? Array.from(new Set(detail.enabledLayouts))
          : ['en'];

      const nextDefault =
        typeof detail.defaultLayout === 'string' && nextEnabled.includes(detail.defaultLayout)
          ? detail.defaultLayout
          : (nextEnabled[0] || 'en');

      setEnabled(nextEnabled);
      setDef(nextDefault);
    };

    window.addEventListener('mzr-osk-settings-changed', onChanged as EventListener);
    return () => window.removeEventListener('mzr-osk-settings-changed', onChanged as EventListener);
  }, []);

  // Toggle a layout; always keep at least one enabled and keep default valid
  const toggle = useCallback(
    (id: string) => {
      setEnabled(prev => {
        let next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];

        if (next.length === 0) {
          next = ['en'];
        }

        if (!next.includes(def)) {
          setDef(next[0] ?? 'en');
        }

        return next;
      });
    },
    [def]
  );

  // Set default layout; ensure it is enabled
  const setDefault = useCallback((id: string) => {
    setDef(id);
    setEnabled(prev => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  // Persist settings and show a small "Saved" confirmation
  const onSave = useCallback(async () => {
    const normalizedDefault = enabled.includes(def) ? def : (enabled[0] ?? 'en');

    const payload: KeyboardSettings = {
      enabledLayouts: enabled,
      defaultLayout: normalizedDefault,
    };

    await ipc.settings.keyboard.update(payload);

    // Notify the app (and this component) to stay in sync at runtime
    window.dispatchEvent(new CustomEvent('mzr-osk-settings-changed', { detail: payload }));

    // Visual confirmation
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(0), 1600);

    // If you'd like to re-read exactly what's persisted, uncomment next line:
    // await load();
  }, [enabled, def]);

  if (loading) return <div style={{ padding: 12 }}>Loading…</div>;

  return (
    <div style={{ padding: 12, display: 'grid', gap: 12 }}>
      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>Keyboard layouts</span>
        {!!savedAt && (
          <span
            aria-live="polite"
            style={{
              fontSize: 12,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
            }}
          >
            Saved ✓
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {ALL.map((id) => (
          <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={enabled.includes(id)}
              onChange={() => toggle(id)}
            />
            <span style={{ width: 48, textAlign: 'center', fontWeight: 600 }}>
              {humanLabel(id as any)}
            </span>
            <span style={{ opacity: 0.8 }}>{id}</span>

            <span style={{ marginInlineStart: 'auto' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="kb-default"
                  checked={def === id}
                  onChange={() => setDefault(id)}
                />
                <span>Default</span>
              </label>
            </span>
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSave} className="btn btn-primary">Save</button>
        <button onClick={load} className="btn">Reload</button>
      </div>

      <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
        Note: symbol pages (<b>1/2</b>) are switched on the keyboard itself and are not shown here.
      </p>
    </div>
  );
}
