import React, {
  useEffect,
  useState,
  useCallback,
} from 'react';
import { ipc } from '../../../services/ipc/ipc';
import { LANGUAGE_LAYOUT_IDS, humanLabel } from '../../keyboard/layouts';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import { styles as baseStyles } from '../../../styles/styles';
import type { Mode } from '../../../types/models';

type KeyboardSettingsState = {
  enabledLayouts: string[];
  defaultLayout: string;
};

type KeyboardSettingsProps = {
  mode: Mode;
};

const ALL_LAYOUTS = LANGUAGE_LAYOUT_IDS;

export const KeyboardSettings: React.FC<KeyboardSettingsProps> = ({ mode }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [enabled, setEnabled] = useState<string[]>(['en']);
  const [preferred, setPreferred] = useState<string>('en');
  const [savedAt, setSavedAt] = useState<number>(0);
  const [expanded, setExpanded] = useState<boolean>(false);

  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
  
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload: KeyboardSettingsState = await ipc.settings.keyboard.get();

      const nextEnabled =
        Array.isArray(payload?.enabledLayouts) && payload.enabledLayouts.length > 0
          ? Array.from(new Set(payload.enabledLayouts))
          : ['en'];

      const nextDefault =
        typeof payload?.defaultLayout === 'string' && nextEnabled.includes(payload.defaultLayout)
          ? payload.defaultLayout
          : nextEnabled[0] || 'en';

      setEnabled(nextEnabled);
      setPreferred(nextDefault);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<KeyboardSettingsState>).detail;
      if (!detail) return;

      const nextEnabled =
        Array.isArray(detail.enabledLayouts) && detail.enabledLayouts.length > 0
          ? Array.from(new Set(detail.enabledLayouts))
          : ['en'];

      const nextDefault =
        typeof detail.defaultLayout === 'string' && nextEnabled.includes(detail.defaultLayout)
          ? detail.defaultLayout
          : nextEnabled[0] || 'en';

      setEnabled(nextEnabled);
      setPreferred(nextDefault);
    };

    window.addEventListener('mzr-osk-settings-changed', handleChange as EventListener);
    return () => window.removeEventListener('mzr-osk-settings-changed', handleChange as EventListener);
  }, []);

  const toggle = useCallback(
    (id: string) => {
      setEnabled((prev) => {
        let next = prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id];
        if (next.length === 0) {
          next = ['en'];
        }
        if (!next.includes(preferred)) {
          setPreferred(next[0] ?? 'en');
        }
        return next;
      });
    },
    [preferred]
  );

  const setDefault = useCallback((id: string) => {
    setPreferred(id);
    setEnabled((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const onSave = useCallback(async () => {
    const normalizedDefault = enabled.includes(preferred) ? preferred : enabled[0] ?? 'en';
    const payload: KeyboardSettingsState = {
      enabledLayouts: enabled,
      defaultLayout: normalizedDefault
    };

    await ipc.settings.keyboard.update(payload);
    window.dispatchEvent(new CustomEvent('mzr-osk-settings-changed', { detail: payload }));

    setSavedAt(Date.now());
    window.setTimeout(() => setSavedAt(0), 1600);
  }, [enabled, preferred]);

  return (
    <section style={{
      ...styles.block,
      ...(modeStyles.settingsBlock || {})
    }}>
      <div style={styles.blockHeader}>
        <h3
          style={{
            ...styles.blockTitle,
            ...(modeStyles.settingsBlockTitle || {})
          }}
        >
          Keyboard layouts
        </h3>
        <div
          style={{
            ...styles.keyboardHeaderActions,
            ...(modeStyles.settingsKeyboardHeaderActions || {})
          }}
        >
          {!loading && savedAt > 0 && (
            <span aria-live="polite" style={{
              ...styles.keyboardSavedPill,
              ...(modeStyles.settingsKeyboardSavedPill || {})
            }}>
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? 'Collapse keyboard layouts' : 'Expand keyboard layouts'}
            style={{
              ...styles.keyboardToggleButton,
              ...(modeStyles.settingsKeyboardToggleButton || {})
            }}
          >
            {
              expanded
                ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                    {/* <!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--> */}
                    <path fill="#ffffff" d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z"/>
                  </svg>
                : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                    {/* <!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--> */}
                    <path fill="#ffffff" d="M297.4 470.6C309.9 483.1 330.2 483.1 342.7 470.6L534.7 278.6C547.2 266.1 547.2 245.8 534.7 233.3C522.2 220.8 501.9 220.8 489.4 233.3L320 402.7L150.6 233.4C138.1 220.9 117.8 220.9 105.3 233.4C92.8 245.9 92.8 266.2 105.3 278.7L297.3 470.7z"/>
                  </svg>
            }
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{
          ...styles.blockBody,
          ...(modeStyles.settingsBlockBody || {})
        }}>
          {loading ? (
            <span
              style={{
                ...styles.loading,
                ...(modeStyles.settingsLoading || {}),
                opacity: 0.85
              }}
            >
              Loading…
            </span>
          ) : (
            <>
              <div
                style={{
                  ...styles.keyboardLayoutsList,
                  ...(modeStyles.settingsKeyboardLayoutsList || {})
                }}
                className="settings-keyboard-scroll"
              >
                {ALL_LAYOUTS.map((layoutId) => (
                  <label key={layoutId}
                    style={{
                    ...styles.keyboardLayoutRow,
                    ...(modeStyles.settingsKeyboardLayoutRow || {})
                  }}>
                    <input
                      type="checkbox"
                      checked={enabled.includes(layoutId)}
                      onChange={() => toggle(layoutId)}
                      style={modeStyles.settingsKeyboardInput}
                    />
                    <span style={{
                      ...styles.keyboardLayoutCode,
                      ...(modeStyles.settingsKeyboardLayoutCode || {})
                    }}>
                      {humanLabel(layoutId as never)}
                    </span>
                    <span style={{
                      ...styles.keyboardLayoutId,
                      ...(modeStyles.settingsKeyboardLayoutId || {})
                    }}>
                      {layoutId}
                    </span>
                    <span style={{ marginInlineStart: 'auto' }}>
                      <label style={{
                        ...styles.keyboardRadioLabel,
                        ...(modeStyles.settingsKeyboardRadioLabel || {})
                      }}>
                        <input
                          type="radio"
                          name="keyboard-default"
                          checked={preferred === layoutId}
                          onChange={() => setDefault(layoutId)}
                          style={modeStyles.settingsKeyboardInput}
                        />
                        <span>Default</span>
                      </label>
                    </span>
                  </label>
                ))}
              </div>

              <div style={{
                ...styles.keyboardActions,
                ...(modeStyles.settingsKeyboardActions || {})
              }}>
                <button type="button" onClick={onSave} style={{
                  ...baseStyles.modalButton,
                  minWidth: mode === 'mobile' ? 'clamp(210px, 32vw, 280px)' : 120,
                  height: mode === 'mobile' ? 'clamp(74px, 10.5vw, 96px)' : 42,
                  borderRadius: mode === 'mobile' ? '24px' : baseStyles.modalButton.borderRadius,
                  padding: mode === 'mobile' ? '0 clamp(42px, 6vw, 60px)' : '0 18px',
                  fontSize: mode === 'mobile' ? 'clamp(30px, 4.6vw, 36px)' : 15,
                  ...baseStyles.modalButtonPrimary
                }}>
                  Save
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default KeyboardSettings;
