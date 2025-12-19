import React from 'react';
import type { Mode, HttpsMode, WebrtcMode } from '../../../types/models';
import { settingsModalStyles as styles } from './settingsModalStyles';
import { useI18n } from '../../../i18n/I18nProvider';

type SecuritySettingsProps = {
  mode: Mode;
  httpsMode: HttpsMode;
  onChange: (mode: HttpsMode) => void;
  webrtcMode: WebrtcMode;
  onWebrtcChange: (mode: WebrtcMode) => void;
  cookiesBlockThirdParty: boolean;
  onCookieBlockChange: (block: boolean) => void;
  onOpenSecurityExceptions: () => void;
  onOpenSiteData: () => void;
  onOpenPrivacyInfo: () => void;
  trackersEnabled: boolean;
  onTrackersEnabledChange: (enabled: boolean) => void;
  onOpenTrackersExceptions: () => void;
};

const radioStyle = (mode: Mode): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: mode === 'mobile' ? 16 : 10,
  padding: mode === 'mobile' ? '28px 20px' : '15px 10px',
  background: 'rgba(15,23,42,0.55)',
  cursor: 'pointer'
});

const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  mode,
  httpsMode,
  onChange,
  webrtcMode,
  onWebrtcChange,
  cookiesBlockThirdParty,
  onCookieBlockChange,
  onOpenSecurityExceptions,
  onOpenSiteData,
  onOpenPrivacyInfo,
  trackersEnabled,
  onTrackersEnabledChange,
  onOpenTrackersExceptions
}) => {
  const { t } = useI18n();
  const radioSize = mode === 'mobile' ? 40 : 18;
  const toggleTrackWidth = mode === 'mobile' ? 74 : 48;
  const toggleTrackHeight = mode === 'mobile' ? 40 : 20;
  const toggleThumbSize = mode === 'mobile' ? 32 : 16;

  const renderRadioControl = (checked: boolean, name: string, onSelect: () => void): React.ReactElement => (
    <span style={{ position: 'relative', width: radioSize, height: radioSize, flexShrink: 0 }}>
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          margin: 0,
          cursor: 'pointer'
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
            aria-hidden="true"
            focusable="false"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 8.5 6.5 12 13 4"
              fill="none"
              stroke="#2563ebeb"
              strokeWidth={mode === 'mobile' ? 4 : 3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </span>
  );

  const renderToggle = (checked: boolean, onChangeChecked: (value: boolean) => void): React.ReactElement => (
    <span style={{ position: 'relative', width: toggleTrackWidth, height: toggleTrackHeight, flexShrink: 0, display: 'inline-block' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChangeChecked(event.target.checked)}
        style={{
          position: 'absolute',
          inset: 0,
          margin: 0,
          opacity: 0,
          cursor: 'pointer',
          zIndex: 2
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 999,
          backgroundColor: checked ? '#2563ebeb' : 'transparent',
          border: `1px solid #ACB2B7`,
          transition: 'background-color 160ms ease, border-color 160ms ease'
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: mode === 'mobile' ? 4 : 2,
          left: checked ? (mode === 'mobile' ? 36 : 26) : (mode === 'mobile' ? 4 : 2),
          width: toggleThumbSize,
          height: toggleThumbSize,
          borderRadius: '50%',
          backgroundColor: checked ? '#ffffff' : '#ACB2B7',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          transition: 'left 160ms ease'
        }}
      />
    </span>
  );

  return (
    <div style={{...styles.block, ...{borderTop: 'none'}}}>
      <div style={styles.blockHeader}>
        <div>
          <div style={{ color: 'rgba(226,232,240,0.7)', fontSize: mode === 'mobile' ? '45px' : '16px', marginTop: 4 }}>
            {t('settings.https.label')}
          </div>
        </div>
      </div>
      <div style={styles.blockBody}>
        <label style={radioStyle(mode)}>
          {renderRadioControl(httpsMode === 'strict', 'https-mode', () => onChange('strict'))}
          <div>
            <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '40px' : '15px' }}>
              {t('settings.https.strict')}
            </div>
            <div style={{ color: 'rgba(226,232,240,0.78)', fontSize: mode === 'mobile' ? '38px' : '14px', marginTop: 4 }}>
              {t('settings.https.strictDesc')}
            </div>
          </div>
        </label>
        <label style={radioStyle(mode)}>
          {renderRadioControl(httpsMode === 'preferred', 'https-mode', () => onChange('preferred'))}
          <div>
            <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '40px' : '15px' }}>
              {t('settings.https.preferred')}
            </div>
            <div style={{ color: 'rgba(226,232,240,0.78)', fontSize: mode === 'mobile' ? '38px' : '14px', marginTop: 4 }}>
              {t('settings.https.preferredDesc')}
            </div>
          </div>
        </label>
      </div>
      <div style={{ ...styles.blockBody, marginTop: mode === 'mobile' ? 12 : 8 }}>
        <div style={{ color: 'rgba(226,232,240,0.7)', fontSize: mode === 'mobile' ? '45px' : '16px', marginTop: 4 }}>
          {t('settings.webrtc.label')}
        </div>
        <label style={radioStyle(mode)}>
          {renderRadioControl(webrtcMode === 'always_on', 'webrtc-mode', () => onWebrtcChange('always_on'))}
          <div>
            <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '40px' : '15px' }}>
              {t('settings.webrtc.on')}
            </div>
            <div style={{ color: 'rgba(226,232,240,0.78)', fontSize: mode === 'mobile' ? '38px' : '14px', marginTop: 4 }}>
              {t('settings.webrtc.onDesc')}
            </div>
          </div>
        </label>
        <label style={radioStyle(mode)}>
          {renderRadioControl(webrtcMode === 'always_off', 'webrtc-mode', () => onWebrtcChange('always_off'))}
          <div>
            <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '40px' : '15px' }}>
              {t('settings.webrtc.off')}
            </div>
            <div style={{ color: 'rgba(226,232,240,0.78)', fontSize: mode === 'mobile' ? '38px' : '14px', marginTop: 4 }}>
              {t('settings.webrtc.offDesc')}
            </div>
          </div>
        </label>
        <label style={radioStyle(mode)}>
          {renderRadioControl(webrtcMode === 'off_with_tor', 'webrtc-mode', () => onWebrtcChange('off_with_tor'))}
          <div>
            <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '40px' : '15px' }}>
              {t('settings.webrtc.offWithTor')}
            </div>
            <div style={{ color: 'rgba(226,232,240,0.78)', fontSize: mode === 'mobile' ? '38px' : '14px', marginTop: 4 }}>
              {t('settings.webrtc.offWithTorDesc')}
            </div>
          </div>
        </label>
      </div>
      <div style={{ ...styles.blockBody, marginTop: mode === 'mobile' ? 20 : 10 }}>
        <div style={{ color: 'rgba(226,232,240,0.7)', fontSize: mode === 'mobile' ? '45px' : '16px', marginTop: 4 }}>
          {t('settings.privacy.trackers.title')}
        </div>
        <label
          style={{
            ...radioStyle(mode),
            alignItems: 'center',
            gap: mode === 'mobile' ? 22 : 12
          }}
        >
          {renderToggle(trackersEnabled, onTrackersEnabledChange)}
          <div>
            <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '40px' : '15px' }}>
              {t('settings.privacy.trackers.title')}
            </div>
            <div style={{ color: 'rgba(226,232,240,0.78)', fontSize: mode === 'mobile' ? '38px' : '14px', marginTop: 4 }}>
              {t('settings.privacy.trackers.helper')}
            </div>
            <div style={{ color: '#fbbf24', fontSize: mode === 'mobile' ? '34px' : '13px', marginTop: 6 }}>
              {t('settings.privacy.trackers.warning')}
            </div>
          </div>
        </label>
      </div>
      <div style={{ ...styles.blockBody, marginTop: mode === 'mobile' ? 20 : 8 }}>
        <div style={{ color: 'rgba(226,232,240,0.7)', fontSize: mode === 'mobile' ? '45px' : '16px', marginTop: 4 }}>
          {t('settings.cookies.title')}
        </div>
        <label
          style={{
            ...radioStyle(mode),
            alignItems: 'center',
            gap: mode === 'mobile' ? 22 : 12
          }}
        >
          {renderToggle(cookiesBlockThirdParty, onCookieBlockChange)}
          <div>
            <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '40px' : '15px' }}>
              {t('settings.cookies.blockThirdParty')}
            </div>
            <div style={{ color: 'rgba(226,232,240,0.78)', fontSize: mode === 'mobile' ? '38px' : '14px', marginTop: 4 }}>
              {t('settings.cookies.helper')}
            </div>
            <div style={{ color: '#fbbf24', fontSize: mode === 'mobile' ? '36px' : '13px', marginTop: mode === 'mobile' ? 6 : 4 }}>
              {t('settings.cookies.warning')}
            </div>
          </div>
        </label>
        <button
          type="button"
          onClick={onOpenSecurityExceptions}
          style={{
            marginTop: mode === 'mobile' ? 20 : 12,
            alignSelf: 'flex-start',
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: '#93c5fd',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontSize: mode === 'mobile' ? '35px' : '14px'
          }}
        >
          {t('settings.cookies.manageLink')}
        </button>
        <button
          type="button"
        onClick={onOpenSiteData}
        style={{
          marginTop: mode === 'mobile' ? 20 : 10,
          alignSelf: 'flex-start',
          padding: 0,
          background: 'transparent',
          border: 'none',
          color: '#93c5fd',
          cursor: 'pointer',
          textDecoration: 'underline',
          fontSize: mode === 'mobile' ? '35px' : '14px'
        }}
      >
        {t('settings.cookies.manageSiteDataList')}
      </button>
      <button
        type="button"
        onClick={onOpenPrivacyInfo}
        style={{
          marginTop: mode === 'mobile' ? 12 : 8,
          alignSelf: 'flex-start',
          padding: 0,
          background: 'transparent',
          border: 'none',
          color: '#93c5fd',
          cursor: 'pointer',
          textDecoration: 'underline',
          fontSize: mode === 'mobile' ? '35px' : '14px'
        }}
      >
        {t('privacyInfo.link')}
      </button>
    </div>
  </div>
);
};

export default SecuritySettings;
