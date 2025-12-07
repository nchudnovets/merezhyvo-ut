import React from 'react';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import type { Mode } from '../../../types/models';
import { useI18n } from '../../../i18n/I18nProvider';

type TorSettingsProps = {
  mode: Mode;
  torEnabled: boolean;
  torCurrentIp: string;
  torIpLoading: boolean;
  torKeepEnabledDraft: boolean;
  torConfigSaving: boolean;
  torConfigFeedback: string;
  onTorKeepChange: (value: boolean) => void;
};

const TorSettings: React.FC<TorSettingsProps> = ({
  mode,
  torEnabled,
  torCurrentIp,
  torIpLoading,
  torKeepEnabledDraft,
  torConfigSaving,
  torConfigFeedback,
  onTorKeepChange
}) => {
  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
  const { t } = useI18n();
  const torStatusText = torEnabled ? t('tor.status.enabled') : t('tor.status.disabled');
  const torStatusStyle = torEnabled ? styles.torInfoValueEnabled : styles.torInfoValueDisabled;
  const torIpText = torIpLoading ? t('global.loading') : torCurrentIp || t('tor.ip.unavailable');
  return (
    <>
      <div style={styles.torInfoRow}>
        <span style={{
          ...styles.torInfoLabel,
          ...modeStyles.settingsTorInputLabel || {}
        }}>{t('tor.status.label')}</span>
        <span
          style={{
            ...styles.torInfoValue,
            ...torStatusStyle,
            ...(modeStyles.settingsTorInfoValue || {})
          }}
        >
          {torStatusText}
        </span>
      </div>
      <div style={styles.torInfoRow}>
        <span style={{
          ...styles.torInfoLabel,
          ...modeStyles.settingsTorInputLabel || {}
        }}>{t('tor.ip.label')}</span>
        <span
          style={{
            ...styles.torInfoValue,
            ...(modeStyles.settingsTorInfoValue || {})
          }}
        >
          {torIpText}
        </span>
      </div>
      <div style={styles.torInputGroup}>
        <label
          style={{
            ...styles.torKeepRow,
            ...(modeStyles.settingsTorKeepRow || {}),
            alignItems: 'center',
            gap: 10
          }}
        >
          <span
            style={{
              position: 'relative',
              width: mode === 'mobile' ? 74 : 48,
              height: mode === 'mobile' ? 40 : 20,
              flexShrink: 0,
              display: 'inline-block'
            }}
          >
            <input
              type="checkbox"
              checked={torKeepEnabledDraft}
              disabled={torConfigSaving}
              onChange={(event) => onTorKeepChange(event.target.checked)}
              style={{
                position: 'absolute',
                inset: 0,
                margin: 0,
                opacity: 0,
                cursor: torConfigSaving ? 'not-allowed' : 'pointer',
                zIndex: 2
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 999,
                backgroundColor: torKeepEnabledDraft ? '#2563ebeb' : 'transparent',
                border: `1px solid ${torKeepEnabledDraft ? '#ACB2B7' : '#ACB2B7'}`,
                transition: 'background-color 160ms ease, opacity 160ms ease, border-color 160ms ease'
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: mode === 'mobile' ? 4 : 2,
                left: torKeepEnabledDraft ? (mode === 'mobile' ? 36 : 26) : (mode === 'mobile' ? 4 : 2),
                width: mode === 'mobile' ? 32 : 16,
                height: mode === 'mobile' ? 32 : 16,
                borderRadius: '50%',
                backgroundColor: torKeepEnabledDraft ? '#ffffff' : '#ACB2B7',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                transition: 'left 160ms ease'
              }}
            />
          </span>
          <span
            style={{
              ...styles.torKeepLabel,
              ...(modeStyles.settingsTorKeepLabel || {})
            }}
          >
            {t('tor.keep.label')}
          </span>
        </label>
        {torConfigFeedback && (
          <p
            style={{
              ...styles.torMessage,
              ...(modeStyles.settingsTorMessage || {})
            }}
            aria-live="polite"
          >
            {torConfigFeedback}
          </p>
        )}
      </div>
    </>
  );
};

export default TorSettings;
