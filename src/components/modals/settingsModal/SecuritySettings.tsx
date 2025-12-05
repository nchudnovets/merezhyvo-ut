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
};

const radioStyle = (mode: Mode): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: mode === 'mobile' ? 16 : 10,
  padding: mode === 'mobile' ? '28px 20px' : '15px 10px',
  background: 'rgba(15,23,42,0.55)',
  cursor: 'pointer'
});

const SecuritySettings: React.FC<SecuritySettingsProps> = ({ mode, httpsMode, onChange, webrtcMode, onWebrtcChange }) => {
  const { t } = useI18n();
  const radioSize = mode === 'mobile' ? 40 : 18;

  const renderRadioControl = (checked: boolean, name: string, onSelect: () => void): JSX.Element => (
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
              stroke="#295EFA"
              strokeWidth={mode === 'mobile' ? 4 : 3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
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
    </div>
  );
};

export default SecuritySettings;
