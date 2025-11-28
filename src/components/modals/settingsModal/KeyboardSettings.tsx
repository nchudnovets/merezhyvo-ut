import React, {
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { ipc } from '../../../services/ipc/ipc';
import { LANGUAGE_LAYOUT_IDS, humanLabel } from '../../keyboard/layouts';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import { styles as baseStyles } from '../../../styles/styles';
import type { Mode } from '../../../types/models';
import { useI18n } from '../../../i18n/I18nProvider';

type KeyboardSettingsState = {
  enabledLayouts: string[];
  defaultLayout: string;
};

type KeyboardSettingsProps = {
  mode: Mode;
};

const ALL_LAYOUTS = LANGUAGE_LAYOUT_IDS;

export const KeyboardSettings: React.FC<KeyboardSettingsProps> = ({ mode }): ReactNode => {
  const [loading, setLoading] = useState<boolean>(true);
  const [enabled, setEnabled] = useState<string[]>(['en']);
  const [preferred, setPreferred] = useState<string>('en');
  const [savedAt, setSavedAt] = useState<number>(0);

  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
  const { t } = useI18n();
  
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
    <div>
      {!loading && savedAt > 0 && (
        <span aria-live="polite" style={{
          ...styles.keyboardSavedPill,
          ...(modeStyles.settingsKeyboardSavedPill || {})
        }}>
          {t('settings.language.saved')}
        </span>
      )}
      {loading ? (
        <span
          style={{
            ...styles.loading,
            ...(modeStyles.settingsLoading || {}),
            opacity: 0.85
          }}
        >
          {t('global.loading')}
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
                    <span>{t('settings.keyboard.default')}</span>
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
              {t('settings.language.save')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default KeyboardSettings;
