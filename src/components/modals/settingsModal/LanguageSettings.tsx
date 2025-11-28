import React, { useEffect, useState, useCallback } from 'react';
import { ipc } from '../../../services/ipc/ipc';
import { useI18n } from '../../../i18n/I18nProvider';
import type { Mode } from '../../../types/models';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import { styles as baseStyles } from '../../../styles/styles';

type LanguageSettingsProps = {
  mode: Mode;
};

const LanguageSettings: React.FC<LanguageSettingsProps> = ({ mode }) => {
  const { language, setLanguage, availableLocales, t } = useI18n();
  const [selected, setSelected] = useState(language);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    setSelected(language);
  }, [language]);

  const handleSave = useCallback(async () => {
    if (!selected || selected === language) return;
    setSaving(true);
    const result = await ipc.ui.setLanguage(selected);
    setSaving(false);
    if (result?.ok) {
      await setLanguage(selected);
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt(0), 1800);
    }
  }, [language, selected, setLanguage]);

  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};

  return (
    <div>
      {savedAt > 0 && (
        <span
          aria-live="polite"
          style={{
            ...styles.keyboardSavedPill,
            ...(modeStyles.settingsKeyboardSavedPill || {})
          }}
        >
          {t('settings.language.saved')}
        </span>
      )}
      <p
        style={{
          ...styles.settingsMessage,
          ...(modeStyles.settingsMessage || {})
        }}
      >
        {t('settings.language.description')}
      </p>
      <div
        className="settings-keyboard-scroll"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '25px',
          marginBottom: '25px',
          maxHeight: '520px',
          overflow: 'auto'
        }}
      >
        {availableLocales.map((locale) => (
          <label
            key={locale.id}
            style={{
              ...styles.keyboardLayoutRow,
                ...(modeStyles.settingsKeyboardLayoutRow || {})
            }}
          >
            <input
              type="radio"
              name="ui-language"
              value={locale.id}
              checked={selected === locale.id}
              onChange={() => setSelected(locale.id)}
              style={modeStyles.settingsKeyboardInput}
            />
            <span>{locale.label}</span>
            <span style={{ opacity: 0.65, marginLeft: 'auto' }}>{locale.nativeLabel}</span>
          </label>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          marginTop: '4px'
        }}
      >
        <button
          type="button"
          onClick={handleSave}
          style={{
            ...baseStyles.modalButton,
            ...baseStyles.modalButtonPrimary,
            minWidth: mode === 'mobile' ? 'clamp(210px, 32vw, 280px)' : 120,
            height: mode === 'mobile' ? 'clamp(72px, 10vw, 92px)' : 40,
            borderRadius: mode === 'mobile' ? '24px' : baseStyles.modalButton.borderRadius,
            padding: mode === 'mobile' ? '0 clamp(40px, 6vw, 58px)' : '0 18px',
            fontSize: mode === 'mobile' ? 'clamp(30px, 4.5vw, 36px)' : 15
          }}
          disabled={saving || selected === language}
        >
          {saving ? t('settings.language.saving') : t('settings.language.save')}
        </button>
        {saving && (
          <span
            style={{
              ...styles.loading,
              ...(modeStyles.settingsLoading || {})
            }}
          >
            {t('settings.language.saving')}
          </span>
        )}
      </div>
    </div>
  );
};

export default LanguageSettings;
