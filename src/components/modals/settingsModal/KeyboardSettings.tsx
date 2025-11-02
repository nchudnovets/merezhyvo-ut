import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  type CSSProperties
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

  const blockStyle = useMemo<CSSProperties>(
    () => ({
      ...styles.block,
      ...(modeStyles.settingsBlock || {})
    }),
    [modeStyles, styles.block]
  );

  const blockBodyStyle = useMemo<CSSProperties>(
    () => ({
      ...styles.blockBody,
      ...(modeStyles.settingsBlockBody || {})
    }),
    [modeStyles, styles.blockBody]
  );

  const layoutListStyle = useMemo<CSSProperties>(
    () => ({
      ...styles.keyboardLayoutsList,
      ...(modeStyles.settingsKeyboardLayoutsList || {})
    }),
    [modeStyles, styles.keyboardLayoutsList]
  );

  const layoutRowStyle = useMemo<CSSProperties>(
    () => ({
      ...styles.keyboardLayoutRow,
      ...(modeStyles.settingsKeyboardLayoutRow || {})
    }),
    [modeStyles, styles.keyboardLayoutRow]
  );

  const layoutCodeStyle = useMemo<CSSProperties>(
    () => ({
      ...styles.keyboardLayoutCode,
      ...(modeStyles.settingsKeyboardLayoutCode || {})
    }),
    [modeStyles, styles.keyboardLayoutCode]
  );

  const layoutIdStyle = useMemo<CSSProperties>(
    () => ({
      ...styles.keyboardLayoutId,
      ...(modeStyles.settingsKeyboardLayoutId || {})
    }),
    [modeStyles, styles.keyboardLayoutId]
  );

  const radioLabelStyle = useMemo<CSSProperties>(
    () => ({
      ...styles.keyboardRadioLabel,
      ...(modeStyles.settingsKeyboardRadioLabel || {})
    }),
    [modeStyles, styles.keyboardRadioLabel]
  );

  const actionsStyle = useMemo<CSSProperties>(
    () => ({
      ...styles.keyboardActions,
      ...(modeStyles.settingsKeyboardActions || {})
    }),
    [modeStyles, styles.keyboardActions]
  );

  const toggleButtonStyle = useMemo<CSSProperties>(
    () => ({
      ...styles.keyboardToggleButton,
      ...(modeStyles.settingsKeyboardToggleButton || {})
    }),
    [modeStyles, styles.keyboardToggleButton]
  );

  const savedPillStyle = useMemo<CSSProperties>(
    () => ({
      ...styles.keyboardSavedPill,
      ...(modeStyles.settingsKeyboardSavedPill || {})
    }),
    [modeStyles, styles.keyboardSavedPill]
  );

  const baseButtonStyle = useMemo<CSSProperties>(
    () => ({
      ...baseStyles.modalButton,
      minWidth: mode === 'mobile' ? 'clamp(210px, 32vw, 280px)' : 120,
      height: mode === 'mobile' ? 'clamp(74px, 10.5vw, 96px)' : 42,
      borderRadius: mode === 'mobile' ? '24px' : baseStyles.modalButton.borderRadius,
      padding: mode === 'mobile' ? '0 clamp(42px, 6vw, 60px)' : '0 18px',
      fontSize: mode === 'mobile' ? 'clamp(30px, 4.6vw, 36px)' : 15
    }),
    [mode]
  );

  const primaryButtonStyle = useMemo<CSSProperties>(
    () => ({
      ...baseButtonStyle,
      ...baseStyles.modalButtonPrimary
    }),
    [baseButtonStyle]
  );

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
    <section style={blockStyle}>
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
            <span aria-live="polite" style={savedPillStyle}>
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? 'Collapse keyboard layouts' : 'Expand keyboard layouts'}
            style={toggleButtonStyle}
          >
            {expanded ? '︿' : '﹀'}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={blockBodyStyle}>
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
                style={layoutListStyle}
                className="settings-keyboard-scroll"
              >
                {ALL_LAYOUTS.map((layoutId) => (
                  <label key={layoutId} style={layoutRowStyle}>
                    <input
                      type="checkbox"
                      checked={enabled.includes(layoutId)}
                      onChange={() => toggle(layoutId)}
                      style={{width: '50px', height: '50px'}}
                    />
                    <span style={layoutCodeStyle}>{humanLabel(layoutId as never)}</span>
                    <span style={layoutIdStyle}>{layoutId}</span>
                    <span style={{ marginInlineStart: 'auto' }}>
                      <label style={radioLabelStyle}>
                        <input
                          type="radio"
                          name="keyboard-default"
                          checked={preferred === layoutId}
                          onChange={() => setDefault(layoutId)}
                          style={{width: '50px', height: '50px'}}
                        />
                        <span>Default</span>
                      </label>
                    </span>
                  </label>
                ))}
              </div>

              <div style={actionsStyle}>
                <button type="button" onClick={onSave} style={primaryButtonStyle}>
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
