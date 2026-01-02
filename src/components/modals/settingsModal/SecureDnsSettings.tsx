import React, { type CSSProperties } from 'react';

import { useI18n } from '../../../i18n/I18nProvider';
import type { Mode, SecureDnsMode, SecureDnsProvider } from '../../../types/models';
import { settingsModalStyles } from './settingsModalStyles';

type SecureDnsSettingsProps = {
  mode: Mode;
  torEnabled: boolean;
  enabled: boolean;
  dnsMode: SecureDnsMode;
  provider: SecureDnsProvider;
  nextdnsId: string;
  customUrl: string;
  error: string;
  onEnabledChange: (value: boolean) => void;
  onModeChange: (value: SecureDnsMode) => void;
  onProviderChange: (value: SecureDnsProvider) => void;
  onNextdnsIdChange: (value: string) => void;
  onNextdnsIdCommit: () => void;
  onCustomUrlChange: (value: string) => void;
  onCustomUrlCommit: () => void;
};

const SecureDnsSettings: React.FC<SecureDnsSettingsProps> = ({
  mode,
  torEnabled,
  enabled,
  dnsMode,
  provider,
  nextdnsId,
  customUrl,
  error,
  onEnabledChange,
  onModeChange,
  onProviderChange,
  onNextdnsIdChange,
  onNextdnsIdCommit,
  onCustomUrlChange,
  onCustomUrlCommit
}) => {
  const styles = settingsModalStyles;
  const { t } = useI18n();
  const isMobile = mode === 'mobile';
  const controlDisabled = torEnabled || !enabled;

  const toggleTrackWidth = isMobile ? 90 : 48;
  const toggleTrackHeight = isMobile ? 48 : 24;
  const toggleThumbSize = isMobile ? 40 : 18;

  const renderToggle = (checked: boolean, onChangeChecked: (value: boolean) => void): React.ReactElement => (
    <span style={{ position: 'relative', width: toggleTrackWidth, height: toggleTrackHeight, flexShrink: 0, display: 'inline-block' }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={torEnabled}
        onChange={(event) => onChangeChecked(event.target.checked)}
        style={{
          position: 'absolute',
          opacity: 0,
          width: '100%',
          height: '100%',
          cursor: torEnabled ? 'not-allowed' : 'pointer'
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 999,
          background: checked ? 'var(--mzr-accent)' : 'var(--mzr-surface-muted)',
          transition: 'background 0.2s ease',
          boxShadow: checked ? '0 0 0 1px rgba(59,130,246,0.3)' : 'inset 0 0 0 1px var(--mzr-border)'
        }}
      />
      <span
        style={{
          position: 'absolute',
          top: (toggleTrackHeight - toggleThumbSize) / 2,
          left: checked ? toggleTrackWidth - toggleThumbSize - 4 : 4,
          width: toggleThumbSize,
          height: toggleThumbSize,
          borderRadius: '50%',
          background: checked ? '#ffffff' : 'var(--mzr-border-strong)',
          transition: 'left 0.2s ease'
        }}
      />
    </span>
  );

  const labelStyle: CSSProperties = {
    fontSize: isMobile ? '36px' : '14px',
    fontWeight: 600,
    color: 'var(--mzr-text-primary)'
  };

  const helperStyle: CSSProperties = {
    fontSize: isMobile ? '36px' : '14px',
    color: 'var(--mzr-text-secondary)',
    marginTop: 4
  };

  const selectStyle: CSSProperties = {
    ...styles.torInput,
    height: isMobile ? '64px' : '38px',
    fontSize: isMobile ? '38px' : '14px',
    cursor: controlDisabled ? 'not-allowed' : 'pointer',
    opacity: controlDisabled ? 0.6 : 1
  };

  const inputStyle: CSSProperties = {
    ...styles.torInput,
    height: isMobile ? '64px' : '38px',
    fontSize: isMobile ? '38px' : '14px',
    opacity: controlDisabled ? 0.6 : 1
  };

  const sectionDisabledStyle: CSSProperties = torEnabled
    ? { opacity: 0.6, pointerEvents: 'none' }
    : {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 22 : 12 }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 22 : 12
        }}
      >
        {renderToggle(enabled, onEnabledChange)}
        <div>
          <div style={{ fontWeight: 700, fontSize: isMobile ? '38px' : '15px' }}>
            {t('settings.network.secureDns.toggle')}
          </div>
        </div>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 28 : 10, ...sectionDisabledStyle }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 28 : 10 }}>
          <span style={labelStyle}>{t('settings.network.secureDns.mode.label')}</span>
          <select
            value={dnsMode}
            onChange={(event) => onModeChange(event.target.value as SecureDnsMode)}
            disabled={controlDisabled}
            style={selectStyle}
          >
            <option value="automatic">{t('settings.network.secureDns.mode.automatic')}</option>
            <option value="secure">{t('settings.network.secureDns.mode.secure')}</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 28 : 10 }}>
          <span style={labelStyle}>{t('settings.network.secureDns.provider.label')}</span>
          <select
            value={provider}
            onChange={(event) => onProviderChange(event.target.value as SecureDnsProvider)}
            disabled={controlDisabled}
            style={selectStyle}
          >
            <option value="auto">{t('settings.network.secureDns.provider.auto')}</option>
            <option value="cloudflare">{t('settings.network.secureDns.provider.cloudflare')}</option>
            <option value="quad9">{t('settings.network.secureDns.provider.quad9')}</option>
            <option value="google">{t('settings.network.secureDns.provider.google')}</option>
            <option value="mullvad">{t('settings.network.secureDns.provider.mullvad')}</option>
            <option value="nextdns">{t('settings.network.secureDns.provider.nextdns')}</option>
            <option value="custom">{t('settings.network.secureDns.provider.custom')}</option>
          </select>
        </div>

        {provider === 'nextdns' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 28 : 10 }}>
            <span style={labelStyle}>{t('settings.network.secureDns.nextdnsId')}</span>
            <input
              type="text"
              value={nextdnsId}
              disabled={controlDisabled}
              onChange={(event) => onNextdnsIdChange(event.target.value)}
              onBlur={onNextdnsIdCommit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onNextdnsIdCommit();
                }
              }}
              style={inputStyle}
            />
          </div>
        )}

        {provider === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 28 : 10 }}>
            <span style={labelStyle}>{t('settings.network.secureDns.customUrl')}</span>
            <input
              type="text"
              value={customUrl}
              disabled={controlDisabled}
              placeholder={t('settings.network.secureDns.customPlaceholder')}
              onChange={(event) => onCustomUrlChange(event.target.value)}
              onBlur={onCustomUrlCommit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onCustomUrlCommit();
                }
              }}
              style={inputStyle}
            />
          </div>
        )}
      </div>

      {torEnabled && (
        <div style={{ ...styles.torMessage, fontSize: isMobile ? '36px' : '14px' }}>
          {t('settings.network.secureDns.disabledWhileTor')}
        </div>
      )}

      {error && (
        <div style={{ color: '#f87171', fontSize: isMobile ? '36px' : '14px' }}>
          {error}
        </div>
      )}

      <div style={helperStyle}>{t('settings.network.secureDns.note1')}</div>
      <div style={helperStyle}>{t('settings.network.secureDns.note2')}</div>
    </div>
  );
};

export default SecureDnsSettings;
