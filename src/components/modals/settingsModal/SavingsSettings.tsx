import React from 'react';

import { useI18n } from '../../../i18n/I18nProvider';
import type { Mode } from '../../../types/models';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import CountrySelect from '../../coupons/CountrySelect';

type SavingsSettingsProps = {
  mode: Mode;
  enabled: boolean;
  countrySaved: string | null;
  onEnabledChange: (value: boolean) => void;
  onCountryChange: (value: string | null) => void;
  onOpenCouponsInfo: () => void;
};

const SavingsSettings: React.FC<SavingsSettingsProps> = ({
  mode,
  enabled,
  countrySaved,
  onEnabledChange,
  onCountryChange,
  onOpenCouponsInfo
}) => {
  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
  const { t } = useI18n();
  const isMobile = mode === 'mobile';
  const toggleTrackWidth = isMobile ? 90 : 48;
  const toggleTrackHeight = isMobile ? 48 : 24;
  const toggleThumbSize = isMobile ? 40 : 18;
  const selectStyle = isMobile && modeStyles.settingsSelect
    ? { ...styles.settingsSelect, ...modeStyles.settingsSelect }
    : styles.settingsSelect;

  const renderToggle = (checked: boolean, onChangeChecked: (value: boolean) => void): React.ReactElement => (
    <span style={{ position: 'relative', width: toggleTrackWidth, height: toggleTrackHeight, flexShrink: 0, display: 'inline-block' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChangeChecked(event.target.checked)}
        style={{
          position: 'absolute',
          opacity: 0,
          width: '100%',
          height: '100%',
          cursor: 'pointer'
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 18 : 10 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 22 : 12 }}>
        {renderToggle(enabled, onEnabledChange)}
        <div style={{ fontWeight: 700, fontSize: isMobile ? '38px' : '15px' }}>
          {t('settings.savings.toggle')}
        </div>
      </label>

      <div
        style={{
          ...styles.settingsRow, ...(modeStyles.settingsRow || {}),
          ...{
            flexDirection: 'column',
            alignItems: 'start',
            marginTop: mode === 'mobile' ? 30 : 15,
            gap: mode === 'mobile' ? 30 : 10
          }
        }}>
        <span style={{ fontSize: isMobile ? '36px' : '14px', fontWeight: 600 }}>
          {t('settings.savings.country.label')}
        </span>
        <CountrySelect
          value={countrySaved}
          onChange={onCountryChange}
          includeAuto
          autoLabel={t('settings.savings.country.auto')}
          selectStyle={{...selectStyle, ...{width: '100%'}}}
        />
      </div>

      <p
        style={{
          ...styles.settingsMessage,
          ...(modeStyles.settingsMessage || {}),
          color: 'var(--mzr-text-secondary)',
          marginBottom: mode === 'mobile' ? 20 : 10
        }}
      >
        {t('settings.savings.country.helper')}
      </p>
      <button
        type="button"
        onClick={onOpenCouponsInfo}
        style={{
          marginTop: isMobile ? 6 : 4,
          alignSelf: 'flex-start',
          padding: 0,
          background: 'transparent',
          border: 'none',
          color: 'var(--mzr-focus-ring)',
          cursor: 'pointer',
          textDecoration: 'underline',
          fontSize: isMobile ? '35px' : '14px'
        }}
      >
        {t('coupons.info.link')}
      </button>
    </div>
  );
};

export default SavingsSettings;
