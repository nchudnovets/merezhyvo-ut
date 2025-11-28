'use strict';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Mode, PasswordSettings, PasswordStatus, PasswordChangeMasterResult } from '../../../types/models';
import { useI18n } from '../../../i18n/I18nProvider';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import ChangeMasterPasswordModal from '../ChangeMasterPasswordModal';

const LOCK_OPTIONS: Array<{ value: number; key: string }> = [
  { value: 1, key: 'passwordUnlock.keep.1' },
  { value: 5, key: 'passwordUnlock.keep.5' },
  { value: 15, key: 'passwordUnlock.keep.15' },
  { value: 60, key: 'passwordUnlock.keep.60' },
  { value: 0, key: 'passwordUnlock.keep.untilQuit' }
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
  const { t } = useI18n();
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
      setStatus(t('passwordSettings.status.unavailable'));
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
          setStatus(t('passwordSettings.status.locked'));
        }
      } else {
        setSettings(null);
        setStatus(t('passwordSettings.status.createMaster'));
      }
    } catch {
      setStatus(t('passwordSettings.status.loadError'));
      setStatusInfo(null);
    }
  }, [t]);

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
        setStatus(t('passwordSettings.status.updated'));
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
        setStatus(t('passwordSettings.status.locked'));
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
      const err = t('passwordSettings.status.unavailable');
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
          ? t('passwordSettings.toast.created')
          : t('passwordSettings.toast.updated');
        setStatus(message);
        dispatchPasswordToast(message);
      } else {
        setChangeError(result.error ?? t('passwordSettings.error.change'));
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
        <span style={toggleLabelStyle}>{t('passwordSettings.toggle.saveAndFill')}</span>
        <input
          type="checkbox"
          checked={settings?.saveAndFill ?? false}
          disabled={!settings || saving}
          onChange={() => handleToggle('saveAndFill')}
          style={toggleInputStyle}
        />
      </label>
      <label style={toggleRowStyle}>
        <span style={toggleLabelStyle}>{t('passwordSettings.toggle.offerToSave')}</span>
        <input
          type="checkbox"
          checked={settings?.offerToSave ?? false}
          disabled={!settings || saving}
          onChange={() => handleToggle('offerToSave')}
          style={toggleInputStyle}
        />
      </label>
      <label style={toggleRowStyle}>
        <span style={toggleLabelStyle}>{t('passwordSettings.toggle.disallowHttp')}</span>
        <input
          type="checkbox"
          checked={settings?.disallowHttp ?? false}
          disabled={!settings || saving}
          onChange={() => handleToggle('disallowHttp')}
          style={toggleInputStyle}
        />
      </label>
      <div style={rowStyle}>
        <span style={toggleLabelStyle}>{t('passwordSettings.label.autoLock')}</span>
        <select
          value={settings?.autoLockMinutes ?? 15}
          disabled={!settings || saving}
          onChange={handleAutoLockChange}
          style={selectStyle}
        >
          {LOCK_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
            {t(option.key)}
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
            {hasMaster ? t('passwordSettings.button.changeMaster') : t('passwordSettings.button.createMaster')}
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
            {t('passwordSettings.button.lockNow')}
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
            {t('passwordSettings.button.unlock')}
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
            {t('passwordSettings.button.manage')}
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
