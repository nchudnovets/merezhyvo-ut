'use strict';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Mode, PasswordSettings, PasswordStatus, PasswordChangeMasterResult } from '../../../types/models';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import ChangeMasterPasswordModal from '../ChangeMasterPasswordModal';

const LOCK_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 60, label: '60 minutes' },
  { value: 0, label: 'On app exit' }
];

type Props = {
  mode: Mode;
  onManagePasswords: () => void;
  onRequestUnlock: (fromSettings?: boolean) => void;
};

const PasswordSettings: React.FC<Props> = ({ mode, onManagePasswords, onRequestUnlock }) => {
  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
  const isMobile = mode === 'mobile';
  const [settings, setSettings] = useState<PasswordSettings | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusInfo, setStatusInfo] = useState<PasswordStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeSubmitting, setChangeSubmitting] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [modalVariant, setModalVariant] = useState<'change' | 'create'>('change');

  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const dispatchPasswordToast = useCallback((message: string) => {
    try {
      window.dispatchEvent(
        new CustomEvent('mzr-notification', {
          detail: {
            title: 'Passwords',
            options: { body: message, icon: '', data: null, tag: 'passwords-master' }
          }
        })
      );
    } catch {
      // noop
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    const api = window.merezhyvo?.passwords;
    if (!api) {
      setStatus('Passwords service unavailable');
      return;
    }
    try {
      setStatus(null);
      const info = await api.status();
      if (!mountedRef.current) return;
      setStatusInfo(info);
      if (info.hasMaster) {
        if (!info.locked) {
          const result = await api.settings.get();
          if (!mountedRef.current) return;
          setSettings(result);
          setStatus(null);
        } else {
          setSettings(null);
          setStatus('Passwords are locked. Unlock to edit settings.');
        }
      } else {
        setSettings(null);
        setStatus('Create a master password to get started');
      }
    } catch {
      setStatus('Unable to load password settings');
      setStatusInfo(null);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const applyPatch = async (patch: Partial<PasswordSettings>) => {
    const api = window.merezhyvo?.passwords;
    if (!api) return;
    setSaving(true);
    try {
      const result = await api.settings.set(patch);
      if ('error' in result) {
        setStatus(result.error);
      } else {
        setSettings(result);
        setStatus('Settings updated');
      }
    } catch (err) {
      setStatus(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (field: keyof PasswordSettings) => {
    if (!settings) return;
    void applyPatch({ [field]: !settings[field] } as Partial<PasswordSettings>);
  };

  const handleAutoLockChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) return;
    void applyPatch({ autoLockMinutes: value });
  };

  const handleLockNow = async () => {
    const api = window.merezhyvo?.passwords;
    if (!api) return;
    await api.lock();
    setStatus('Passwords locked');
  };

  const hasMaster = statusInfo?.hasMaster ?? false;
  const isPasswordsLocked = statusInfo?.locked ?? false;

  const handleChangeMasterPassword = () => {
    setChangeError(null);
    setModalVariant(hasMaster ? 'change' : 'create');
    setChangeModalOpen(true);
  };

  const handleChangeMasterSubmit = async (current: string, next: string): Promise<PasswordChangeMasterResult> => {
    const api = window.merezhyvo?.passwords;
    if (!api) {
      const err = 'Passwords service unavailable';
      setChangeError(err);
      return { error: err };
    }
    setChangeSubmitting(true);
    setChangeError(null);
    try {
      const result =
        modalVariant === 'create'
          ? await api.createMasterPassword(next)
          : await api.changeMasterPassword(current, next);
      if (result.ok) {
        setChangeModalOpen(false);
        await refreshStatus();
        const message = modalVariant === 'create'
          ? 'Master password created'
          : 'Master password updated';
        setStatus(message);
        dispatchPasswordToast(message);
      } else {
        setChangeError(result.error ?? 'Unable to change master password');
      }
      return result;
    } catch (err) {
      const message = String(err);
      setChangeError(message);
      return { error: message };
    } finally {
      setChangeSubmitting(false);
    }
  };

  const toggleRowStyle = isMobile && modeStyles.settingsRow
    ? { ...styles.settingsToggleRow, ...modeStyles.settingsRow }
    : styles.settingsToggleRow;
  const toggleLabelStyle = isMobile && modeStyles.settingsToggleLabel
    ? { ...styles.settingsToggleLabel, ...modeStyles.settingsToggleLabel }
    : styles.settingsToggleLabel;
  const toggleInputStyle = isMobile && modeStyles.settingsToggle
    ? { ...styles.settingsToggle, ...modeStyles.settingsToggle }
    : styles.settingsToggle;
  const rowStyle = isMobile && modeStyles.settingsRow
    ? { ...styles.settingsRow, ...modeStyles.settingsRow }
    : styles.settingsRow;
  const selectStyle = isMobile && modeStyles.settingsSelect
    ? { ...styles.settingsSelect, ...modeStyles.settingsSelect }
    : styles.settingsSelect;
  const buttonStyle = isMobile && modeStyles.settingsButton
    ? { ...styles.settingsButton, ...modeStyles.settingsButton }
    : styles.settingsButton;
  const linkRowStyle = isMobile && modeStyles.settingsLinkRow
    ? { ...styles.settingsLinkRow, ...modeStyles.settingsLinkRow }
    : styles.settingsLinkRow;
  const linkButtonStyle = isMobile && modeStyles.settingsLinkButton
    ? { ...styles.settingsLinkButton, ...modeStyles.settingsLinkButton }
    : styles.settingsLinkButton;
  const changeButtonDisabled = saving || (hasMaster && isPasswordsLocked);
  const lockButtonDisabled = saving || !hasMaster;
  const showLockAction = hasMaster && !isPasswordsLocked;
  const showUnlockAction = hasMaster && isPasswordsLocked;

  return (
    <div style={styles.passwordSettings}>
      <label style={toggleRowStyle}>
        <span style={toggleLabelStyle}>Save and fill passwords (beta)</span>
        <input
          type="checkbox"
          checked={settings?.saveAndFill ?? false}
          disabled={!settings || saving}
          onChange={() => handleToggle('saveAndFill')}
          style={toggleInputStyle}
        />
      </label>
      <label style={toggleRowStyle}>
        <span style={toggleLabelStyle}>Offer to save passwords</span>
        <input
          type="checkbox"
          checked={settings?.offerToSave ?? false}
          disabled={!settings || saving}
          onChange={() => handleToggle('offerToSave')}
          style={toggleInputStyle}
        />
      </label>
      <label style={toggleRowStyle}>
        <span style={toggleLabelStyle}>Never save on HTTP (insecure)</span>
        <input
          type="checkbox"
          checked={settings?.disallowHttp ?? false}
          disabled={!settings || saving}
          onChange={() => handleToggle('disallowHttp')}
          style={toggleInputStyle}
        />
      </label>
      <div style={rowStyle}>
        <span style={toggleLabelStyle}>Auto-lock after</span>
        <select
          value={settings?.autoLockMinutes ?? 15}
          disabled={!settings || saving}
          onChange={handleAutoLockChange}
          style={selectStyle}
        >
          {LOCK_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {(!hasMaster || !isPasswordsLocked) && (
        <div style={rowStyle}>
          <button
            type="button"
            style={buttonStyle}
            onClick={handleChangeMasterPassword}
            disabled={changeButtonDisabled}
          >
            {hasMaster ? 'Change master password…' : 'Create master password…'}
          </button>
        </div>
      )}
      {showLockAction && (
        <div style={rowStyle}>
          <button
            type="button"
            style={buttonStyle}
            onClick={handleLockNow}
            disabled={lockButtonDisabled}
          >
            Lock now
          </button>
        </div>
      )}
      {showUnlockAction && (
        <div style={rowStyle}>
          <button
            type="button"
            style={buttonStyle}
            onClick={() => onRequestUnlock(true)}
            disabled={saving}
          >
            Unlock
          </button>
        </div>
      )}
      <div style={linkRowStyle}>
        <button
          type="button"
          style={{ ...linkButtonStyle, ...(isPasswordsLocked || !hasMaster ? styles.settingsLinkButtonDisabled : {}) }}
          onClick={onManagePasswords}
          disabled={isPasswordsLocked || !hasMaster}
        >
          Manage passwords…
        </button>
      </div>
      {status && (
        <p
          style={{
            ...styles.settingsMessage,
            ...(modeStyles.settingsMessage || {})
          }}
          role="status"
        >
          {status}
        </p>
      )}
      <ChangeMasterPasswordModal
        open={changeModalOpen}
        mode={mode}
        submitting={changeSubmitting}
        error={changeError}
        onClose={() => setChangeModalOpen(false)}
        onSubmit={handleChangeMasterSubmit}
        variant={modalVariant}
      />
    </div>
  );
};

export default PasswordSettings;
