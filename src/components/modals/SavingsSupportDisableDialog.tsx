import React, { type CSSProperties } from 'react';

import { useI18n } from '../../i18n/I18nProvider';
import type { Mode } from '../../types/models';

type SavingsSupportDisableKind = 'coupons' | 'affiliates';

type Props = {
  open: boolean;
  mode: Mode;
  kind: SavingsSupportDisableKind;
  onKeep: () => void;
  onDisable: () => void;
};

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(2, 6, 23, 0.68)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 250,
  padding: '20px',
  boxSizing: 'border-box'
};

const buttonBase: CSSProperties = {
  borderRadius: '12px',
  border: '1px solid var(--mzr-border-strong)',
  padding: '12px 18px',
  fontSize: '16px',
  fontWeight: 700,
  cursor: 'pointer',
  background: 'var(--mzr-surface)',
  color: 'var(--mzr-text-primary)',
  textAlign: 'center'
};

const SavingsSupportDisableDialog: React.FC<Props> = ({
  open,
  mode,
  kind,
  onKeep,
  onDisable
}) => {
  const { t } = useI18n();
  if (!open) return null;

  const isMobile = mode === 'mobile';
  const sheetStyle: CSSProperties = {
    width: isMobile ? 'min(680px, 94vw)' : 'min(520px, 92vw)',
    borderRadius: isMobile ? '22px' : '18px',
    background: 'var(--mzr-surface-elevated)',
    border: '1px solid var(--mzr-border-strong)',
    padding: isMobile ? '30px' : '24px',
    boxShadow: '0 30px 60px rgba(0,0,0,.55)',
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? '22px' : '16px'
  };

  const titleStyle: CSSProperties = {
    margin: 0,
    color: 'var(--mzr-text-primary)',
    fontSize: isMobile ? '43px' : '21px',
    lineHeight: 1.18
  };

  const bodyStyle: CSSProperties = {
    margin: 0,
    color: 'var(--mzr-text-secondary)',
    fontSize: isMobile ? '41px' : '15px',
    lineHeight: 1.5
  };

  const actionsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: isMobile ? '16px' : '12px',
    justifyContent: 'flex-end'
  };

  const mobileButton: CSSProperties = isMobile
    ? { padding: '18px 22px', fontSize: '41px' }
    : {};

  const keepButtonStyle: CSSProperties = {
    background: 'var(--mzr-accent)',
    borderColor: 'var(--mzr-accent)',
    color: '#f8fafc'
  };

  const disableButtonStyle: CSSProperties = {
    color: 'var(--mzr-danger)',
    borderColor: 'var(--mzr-danger)'
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="savings-support-disable-title">
      <div style={sheetStyle}>
        <h2 id="savings-support-disable-title" style={titleStyle}>
          {t('savings.disableConfirm.title')}
        </h2>
        <p style={bodyStyle}>{t('savings.disableConfirm.lead')}</p>
        <p style={bodyStyle}>
          {t('savings.disableConfirm.support', {
            feature: t(kind === 'coupons'
              ? 'savings.disableConfirm.feature.coupons'
              : 'savings.disableConfirm.feature.affiliates')
          })}
        </p>
        {kind === 'coupons' && (
          <p style={bodyStyle}>{t('savings.disableConfirm.couponsNote')}</p>
        )}
        <div style={actionsStyle}>
          <button
            type="button"
            onClick={onKeep}
            style={{ ...buttonBase, ...keepButtonStyle, ...mobileButton }}
          >
            {t('savings.disableConfirm.keep')}
          </button>
          <button
            type="button"
            onClick={onDisable}
            style={{ ...buttonBase, ...disableButtonStyle, ...mobileButton }}
          >
            {t('savings.disableConfirm.disable')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavingsSupportDisableDialog;
