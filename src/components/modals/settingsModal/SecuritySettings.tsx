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
          <input
            type="radio"
            name="https-mode"
            checked={httpsMode === 'strict'}
            onChange={() => onChange('strict')}
            style={{ marginTop: mode === 'mobile' ? 8 : 4, width: mode === 'mobile' ? 50 : 16, height: mode === 'mobile' ? 50 : 16 }}
          />
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
          <input
            type="radio"
            name="https-mode"
            checked={httpsMode === 'preferred'}
            onChange={() => onChange('preferred')}
            style={{ marginTop: mode === 'mobile' ? 8 : 4, width: mode === 'mobile' ? 50 : 16, height: mode === 'mobile' ? 50 : 16 }}
          />
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
          <input
            type="radio"
            name="webrtc-mode"
            checked={webrtcMode === 'always_on'}
            onChange={() => onWebrtcChange('always_on')}
            style={{ marginTop: mode === 'mobile' ? 8 : 4, width: mode === 'mobile' ? 50 : 16, height: mode === 'mobile' ? 50 : 16 }}
          />
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
          <input
            type="radio"
            name="webrtc-mode"
            checked={webrtcMode === 'always_off'}
            onChange={() => onWebrtcChange('always_off')}
            style={{ marginTop: mode === 'mobile' ? 8 : 4, width: mode === 'mobile' ? 50 : 16, height: mode === 'mobile' ? 50 : 16 }}
          />
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
          <input
            type="radio"
            name="webrtc-mode"
            checked={webrtcMode === 'off_with_tor'}
            onChange={() => onWebrtcChange('off_with_tor')}
            style={{ marginTop: mode === 'mobile' ? 8 : 4, width: mode === 'mobile' ? 50 : 16, height: mode === 'mobile' ? 50 : 16 }}
          />
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
