import React from 'react';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import type { Mode } from '../../../types/models';

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
  const torStatusText = torEnabled ? 'Tor enabled' : 'Tor disabled';
  const torStatusStyle = torEnabled ? styles.torInfoValueEnabled : styles.torInfoValueDisabled;
  const torIpText = torIpLoading ? 'Loading…' : torCurrentIp || 'Unavailable';
  return (
    <>
      <div style={styles.torInfoRow}>
        <span style={styles.torInfoLabel}>Tor status</span>
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
        <span style={styles.torInfoLabel}>Current IP</span>
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
            ...(modeStyles.settingsTorKeepRow || {})
          }}
        >
          <input
            type="checkbox"
            checked={torKeepEnabledDraft}
            disabled={torConfigSaving}
            onChange={(event) => onTorKeepChange(event.target.checked)}
            style={{
              ...styles.torKeepCheckbox,
              ...(modeStyles.settingsTorKeepCheckbox || {}),
              ...(torConfigSaving ? { cursor: 'not-allowed' } : {})
            }}
          />
          <span
            style={{
              ...styles.torKeepLabel,
              ...(modeStyles.settingsTorKeepLabel || {})
            }}
          >
            Keep Tor enabled
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
