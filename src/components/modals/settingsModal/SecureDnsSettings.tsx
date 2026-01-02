import React, { type CSSProperties } from 'react';

import { useI18n } from '../../../i18n/I18nProvider';
import type { Mode, SecureDnsMode, SecureDnsProvider } from '../../../types/models';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';

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
  const modeStyles = settingsModalModeStyles[mode] || {};
  const { t } = useI18n();
  const isMobile = mode === 'mobile';
  const controlDisabled = torEnabled || !enabled;
  const radioSize = isMobile ? 42 : 18;

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

  const inputStyle: CSSProperties = {
    ...styles.torInput,
    height: isMobile ? '64px' : '38px',
    fontSize: isMobile ? '38px' : '14px',
    opacity: controlDisabled ? 0.6 : 1
  };

  const sectionDisabledStyle: CSSProperties = torEnabled
    ? { opacity: 0.6, pointerEvents: 'none' }
    : {};

  const optionRowStyle: CSSProperties = {
    ...styles.keyboardLayoutRow,
    ...(modeStyles.settingsKeyboardLayoutRow || {}),
    gridTemplateColumns: 'auto 1fr',
    opacity: controlDisabled ? 0.6 : 1,
    cursor: controlDisabled ? 'not-allowed' : 'pointer'
  };

  const optionListStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? 16 : 10
  };

  const renderOption = (
    groupName: string,
    value: string,
    checked: boolean,
    label: string,
    onChange: (value: string) => void
  ): React.ReactElement => (
    <label style={optionRowStyle}>
      <span style={{ position: 'relative', width: radioSize, height: radioSize, flexShrink: 0 }}>
        <input
          type="radio"
          name={groupName}
          value={value}
          checked={checked}
          disabled={controlDisabled}
          onChange={() => onChange(value)}
          style={{
            position: 'absolute',
            inset: 0,
            margin: 0,
            opacity: 0,
            cursor: controlDisabled ? 'not-allowed' : 'pointer'
          }}
        />
        {checked && (
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
              strokeWidth={isMobile ? 4 : 3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8.5 6.5 12 13 4" />
            </svg>
          </span>
        )}
      </span>
      <span>{label}</span>
    </label>
  );

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
          <div style={optionListStyle}>
            {renderOption(
              'secure-dns-mode',
              'automatic',
              dnsMode === 'automatic',
              t('settings.network.secureDns.mode.automatic'),
              (value) => onModeChange(value as SecureDnsMode)
            )}
            {renderOption(
              'secure-dns-mode',
              'secure',
              dnsMode === 'secure',
              t('settings.network.secureDns.mode.secure'),
              (value) => onModeChange(value as SecureDnsMode)
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 28 : 10 }}>
          <span style={labelStyle}>{t('settings.network.secureDns.provider.label')}</span>
          <div style={optionListStyle}>
            {renderOption(
              'secure-dns-provider',
              'auto',
              provider === 'auto',
              t('settings.network.secureDns.provider.auto'),
              (value) => onProviderChange(value as SecureDnsProvider)
            )}
            {renderOption(
              'secure-dns-provider',
              'cloudflare',
              provider === 'cloudflare',
              t('settings.network.secureDns.provider.cloudflare'),
              (value) => onProviderChange(value as SecureDnsProvider)
            )}
            {renderOption(
              'secure-dns-provider',
              'quad9',
              provider === 'quad9',
              t('settings.network.secureDns.provider.quad9'),
              (value) => onProviderChange(value as SecureDnsProvider)
            )}
            {renderOption(
              'secure-dns-provider',
              'google',
              provider === 'google',
              t('settings.network.secureDns.provider.google'),
              (value) => onProviderChange(value as SecureDnsProvider)
            )}
            {renderOption(
              'secure-dns-provider',
              'mullvad',
              provider === 'mullvad',
              t('settings.network.secureDns.provider.mullvad'),
              (value) => onProviderChange(value as SecureDnsProvider)
            )}
            {renderOption(
              'secure-dns-provider',
              'nextdns',
              provider === 'nextdns',
              t('settings.network.secureDns.provider.nextdns'),
              (value) => onProviderChange(value as SecureDnsProvider)
            )}
            {renderOption(
              'secure-dns-provider',
              'custom',
              provider === 'custom',
              t('settings.network.secureDns.provider.custom'),
              (value) => onProviderChange(value as SecureDnsProvider)
            )}
          </div>
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
