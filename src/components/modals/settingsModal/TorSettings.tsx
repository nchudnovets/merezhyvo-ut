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
  const isMobile = mode === 'mobile';
  const toggleTrackWidth = isMobile ? 90 : 48;
  const toggleTrackHeight = isMobile ? 48 : 24;
  const toggleThumbSize = isMobile ? 40 : 18;
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
              width: toggleTrackWidth,
              height: toggleTrackHeight,
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
                background: torKeepEnabledDraft ? 'var(--mzr-accent)' : 'var(--mzr-surface-muted)',
                transition: 'background 0.2s ease',
                boxShadow: torKeepEnabledDraft ? '0 0 0 1px rgba(59,130,246,0.3)' : 'inset 0 0 0 1px var(--mzr-border)'
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: (toggleTrackHeight - toggleThumbSize) / 2,
                left: torKeepEnabledDraft ? toggleTrackWidth - toggleThumbSize - 4 : 4,
                width: toggleThumbSize,
                height: toggleThumbSize,
                borderRadius: '50%',
                backgroundColor: torKeepEnabledDraft ? '#ffffff' : 'var(--mzr-border-strong)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                transition: 'left 0.2s ease'
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
