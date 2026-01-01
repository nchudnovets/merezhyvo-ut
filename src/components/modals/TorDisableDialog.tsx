import React, { type CSSProperties } from 'react';
import type { Mode } from '../../types/models';
import { useI18n } from '../../i18n/I18nProvider';

type Props = {
  open: boolean;
  mode: Mode;
  busy?: boolean;
  onCloseAll: () => void;
  onKeepTabs: () => void;
  onCancel: () => void;
};

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(2, 6, 23, 0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100
};

const buttonBase: CSSProperties = {
  borderRadius: '12px',
  border: '1px solid var(--mzr-border-strong)',
  padding: '12px 18px',
  fontSize: '16px',
  fontWeight: 600,
  cursor: 'pointer',
  background: 'var(--mzr-surface)',
  color: 'var(--mzr-text-primary)',
  textAlign: 'center'
};

const TorDisableDialog: React.FC<Props> = ({
  open,
  mode,
  busy,
  onCloseAll,
  onKeepTabs,
  onCancel
}) => {
  const { t } = useI18n();
  if (!open) return null;
  const isMobile = mode === 'mobile';


  const sheetStyle: CSSProperties = {
    width: isMobile ? '90%' : 'min(520px, 92vw)',
    borderRadius: '18px',
    background: 'var(--mzr-surface-elevated)',
    border: '1px solid var(--mzr-border-strong)',
    padding: '28px',
    boxShadow: '0 30px 60px rgba(0,0,0,.65)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  };

  const headingStyle: CSSProperties = {
    margin: 0,
    fontSize: isMobile ? '42px' : '22px'
  };

  const bodyStyle: CSSProperties = {
    margin: 0,
    color: 'var(--mzr-text-secondary)',
    fontSize: isMobile ? '40px' : '15px',
    lineHeight: 1.5
  };

  const actionsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? 20 : 12
  };

  const mobileButton: CSSProperties = isMobile
    ? { padding: '18px 22px', fontSize: '40px' }
    : {};

  const primaryButton: CSSProperties = {
    background: 'var(--mzr-accent)',
    borderColor: 'var(--mzr-accent)',
    color: '#f8fafc'
  };

  const dangerButton: CSSProperties = {
    borderColor: 'var(--mzr-danger)',
    color: 'var(--mzr-danger)'
  };

  const disabledStyle: CSSProperties = busy
    ? { opacity: 0.6, cursor: 'not-allowed' }
    : {};

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div style={sheetStyle}>
        <h2 style={headingStyle}>{t('tor.disable.heading')}</h2>
        <p style={bodyStyle}>{t('tor.disable.message')}</p>
        <div style={actionsStyle}>
          <button
            type="button"
            onClick={onKeepTabs}
            disabled={busy}
            style={{ ...buttonBase, ...primaryButton, ...mobileButton, ...disabledStyle }}
          >
            {t('tor.disable.keepTabs')}
          </button>
          <button
            type="button"
            onClick={onCloseAll}
            disabled={busy}
            style={{ ...buttonBase, ...dangerButton, ...mobileButton, ...disabledStyle }}
          >
            {t('tor.disable.closeAll')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{ ...buttonBase, ...mobileButton, ...disabledStyle }}
          >
            {t('global.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TorDisableDialog;
