import React, { type CSSProperties } from 'react';
import type { Mode } from '../../types/models';
import { useI18n } from '../../i18n/I18nProvider';

type Props = {
  open: boolean;
  mode: Mode;
  onCancel: () => void;
  onOpenSettings: () => void;
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

const TorKeepEnabledDialog: React.FC<Props> = ({
  open,
  mode,
  onCancel,
  onOpenSettings
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

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div style={sheetStyle}>
        <p style={bodyStyle}>
          {t('tor.keepWarning.message', { keepLabel: t('tor.keep.label') })}
        </p>
        <div style={actionsStyle}>
          <button
            type="button"
            onClick={onOpenSettings}
            style={{ ...buttonBase, ...primaryButton, ...mobileButton }}
          >
            {t('tor.keepWarning.openSettings')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{ ...buttonBase, ...mobileButton }}
          >
            {t('tor.keepWarning.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TorKeepEnabledDialog;
