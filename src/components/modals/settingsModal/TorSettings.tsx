import React, {
  type RefObject,
  type PointerEvent as ReactPointerEvent,
  type FocusEvent as ReactFocusEvent
} from 'react';

import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import { styles as baseStyles } from '../../../styles/styles';
import type { Mode } from '../../../types/models';

type TorSettingsProps = {
  mode: Mode;
  torEnabled: boolean;
  torCurrentIp: string;
  torIpLoading: boolean;
  torContainerValue: string;
  torSavedContainerId: string;
  torContainerSaving: boolean;
  torContainerMessage: string;
  torKeepEnabledDraft: boolean;
  torInputRef: RefObject<HTMLInputElement | null>;
  onTorInputPointerDown: (event: ReactPointerEvent<HTMLInputElement>) => void;
  onTorInputFocus: (event: ReactFocusEvent<HTMLInputElement>) => void;
  onTorInputBlur: (event: ReactFocusEvent<HTMLInputElement>) => void;
  onTorContainerChange: (value: string) => void;
  onSaveTorContainer: () => void;
  onTorKeepChange: (value: boolean) => void;
};

const TorSettings: React.FC<TorSettingsProps> = ({
  mode,
  torEnabled,
  torCurrentIp,
  torIpLoading,
  torContainerValue,
  torSavedContainerId,
  torContainerSaving,
  torContainerMessage,
  torKeepEnabledDraft,
  torInputRef,
  onTorInputPointerDown,
  onTorInputFocus,
  onTorInputBlur,
  onTorContainerChange,
  onSaveTorContainer,
  onTorKeepChange
}) => {
  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
  const torStatusText = torEnabled ? 'Tor enabled' : 'Tor disabled';
  const torStatusStyle = torEnabled ? styles.torInfoValueEnabled : styles.torInfoValueDisabled;
  const torIpText = torIpLoading ? 'Loading…' : torCurrentIp || 'Unavailable';
  const torContainerInputId = 'settings-tor-container-id';
  const trimmedTorValue = (torContainerValue || '').trim();
  const savedTorValue = (torSavedContainerId || '').trim();
  const keepCheckboxDisabled = trimmedTorValue.length === 0;
  const containerDirty = trimmedTorValue !== savedTorValue;
  const torSaveDisabled = torContainerSaving || !containerDirty;

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
          htmlFor={torContainerInputId}
          style={{
            ...styles.torInputLabel,
            ...(modeStyles.settingsTorInputLabel || {})
          }}
        >
          Tor Libertine container identifier
        </label>
        <div style={styles.torInputRow}>
          <input
            id={torContainerInputId}
            type="text"
            value={torContainerValue ?? ''}
            onChange={(event) => onTorContainerChange(event.target.value)}
            onPointerDown={onTorInputPointerDown}
            onFocus={onTorInputFocus}
            onBlur={onTorInputBlur}
            ref={torInputRef}
            style={{
              ...styles.torInput,
              ...(modeStyles.settingsTorInput || {})
            }}
            placeholder="e.g. main"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onSaveTorContainer}
            disabled={torSaveDisabled}
            style={{
              ...styles.torSaveButton,
              ...(modeStyles.settingsTorSaveButton || {}),
              ...(torSaveDisabled ? baseStyles.modalButtonDisabled : null)
            }}
          >
            {torContainerSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p
          style={{
            ...styles.torInputHint,
            ...(modeStyles.settingsTorInputHint || {})
          }}
        >
          Set the Libertine container ID where Tor is installed.
        </p>
        <label
          style={{
            ...styles.torKeepRow,
            ...(modeStyles.settingsTorKeepRow || {})
          }}
          title={keepCheckboxDisabled ? 'Set the Libertine container identifier first' : undefined}
        >
          <input
            type="checkbox"
            checked={torKeepEnabledDraft}
            disabled={keepCheckboxDisabled}
            onChange={(event) => onTorKeepChange(event.target.checked)}
            style={{
              ...styles.torKeepCheckbox,
              ...(modeStyles.settingsTorKeepCheckbox || {}),
              ...(keepCheckboxDisabled ? { cursor: 'not-allowed' } : {})
            }}
          />
          <span
            style={{
              ...styles.torKeepLabel,
              ...(keepCheckboxDisabled ? styles.torKeepLabelDisabled : {}),
              ...(modeStyles.settingsTorKeepLabel || {})
            }}
          >
            Keep Tor enabled
          </span>
        </label>
        {torContainerMessage && (
          <p
            style={{
              ...styles.torMessage,
              ...(modeStyles.settingsTorMessage || {})
            }}
            aria-live="polite"
          >
            {torContainerMessage}
          </p>
        )}
      </div>
    </>
  );
};

export default TorSettings;
