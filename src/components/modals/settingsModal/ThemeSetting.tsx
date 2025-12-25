import React from 'react';
import type { CSSProperties } from 'react';
import type { Mode, ThemeName } from '../../../types/models';
import { useI18n } from '../../../i18n/I18nProvider';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';

type ThemeSettingProps = {
  mode: Mode;
  value: ThemeName;
  onChange: (value: ThemeName) => void;
};

const ThemeSetting: React.FC<ThemeSettingProps> = ({ mode, value, onChange }) => {
  const { t } = useI18n();
  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] ?? {};
  const radioSize = mode === 'mobile' ? 42 : 18;
  const merge = (key: keyof typeof settingsModalStyles): CSSProperties => ({
    ...styles[key],
    ...(modeStyles[key] ?? {})
  });
  const isMobile = mode === 'mobile';
  const options: { value: ThemeName; label: string }[] = [
    { value: 'dark', label: t('settings.theme.dark') },
    { value: 'light', label: t('settings.theme.light') }
  ];

  return (
    <div style={merge('themeContainer')}>
      <div style={merge('themeHeader')}>
        <span style={{ ...merge('themeLabel'), ...(isMobile ? { fontSize: 42 } : {}) }}>{t('settings.theme.label')}</span>
        <span style={{ ...merge('themeHelper'), ...(isMobile ? { fontSize: 42 } : {}) }}>{t('settings.theme.helper')}</span>
      </div>
      <div style={merge('themeOptions')}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <label
              key={opt.value}
              style={{
                ...merge('themeOption'),
                ...(active ? merge('themeOptionActive') : {})
              }}
            >
              <span style={{ position: 'relative', width: radioSize, height: radioSize, flexShrink: 0 }}>
                <input
                  type="radio"
                  name="ui-theme"
                  value={opt.value}
                  checked={active}
                  onChange={() => onChange(opt.value)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    margin: 0,
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                {active && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: radioSize,
                      height: radioSize,
                      borderRadius: 10,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      width={radioSize * 0.9}
                      height={radioSize * 0.9}
                      fill="none"
                      stroke="var(--mzr-accent)"
                      strokeWidth={mode === 'mobile' ? 4 : 3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 8.5 6.5 12 13 4" />
                    </svg>
                  </span>
                )}
              </span>
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSetting;
