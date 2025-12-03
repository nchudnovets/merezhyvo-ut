import React from 'react';
import type { Mode, HttpsMode } from '../../../types/models';
import { settingsModalStyles as styles } from './settingsModalStyles';
import { useI18n } from '../../../i18n/I18nProvider';

type SecuritySettingsProps = {
  mode: Mode;
  httpsMode: HttpsMode;
  onChange: (mode: HttpsMode) => void;
};

const radioStyle = (mode: Mode): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: mode === 'mobile' ? 16 : 10,
  padding: mode === 'mobile' ? '14px 12px' : '10px 10px',
  borderRadius: 12,
  border: '1px solid rgba(148,163,184,0.35)',
  background: 'rgba(15,23,42,0.55)',
  cursor: 'pointer'
});

const SecuritySettings: React.FC<SecuritySettingsProps> = ({ mode, httpsMode, onChange }) => {
  const { t } = useI18n();

  return (
    <div style={styles.block}>
      <div style={styles.blockHeader}>
        <div>
          {/* <div style={styles.blockTitle}>{t('settings.section.privacy')}</div> */}
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
    </div>
  );
};

export default SecuritySettings;
