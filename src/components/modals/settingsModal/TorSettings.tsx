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
          <span style={{ position: 'relative', width: mode === 'mobile' ? 32 : 18, height: mode === 'mobile' ? 32 : 18, flexShrink: 0 }}>
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
                cursor: torConfigSaving ? 'not-allowed' : 'pointer'
              }}
            />
            <span
              aria-hidden="true"
              style={{
                width: mode === 'mobile' ? 36 : 18,
                height: mode === 'mobile' ? 36 : 18,
                borderRadius: 6,
                border: torKeepEnabledDraft ? '1px solid #295EFA' : '1px solid rgba(148,163,184,0.6)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {torKeepEnabledDraft && (
                <svg
                  viewBox="0 0 16 16"
                  width={mode === 'mobile' ? 26 : 12}
                  height={mode === 'mobile' ? 26 : 12}
                  fill="none"
                  stroke="#295EFA"
                  strokeWidth={mode === 'mobile' ? 4 : 3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8.5 6.5 12 13 4" />
                </svg>
              )}
            </span>
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
