"use strict";

import React, { type CSSProperties, useEffect } from 'react';
import type { Mode } from '../../types/models';
import { useI18n } from '../../i18n/I18nProvider';

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(2, 6, 23, 0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100
};

const sheetStyle: CSSProperties = {
  width: 'min(480px, 92vw)',
  borderRadius: '18px',
  background: '#0f1729',
  border: '1px solid rgba(148, 163, 184, 0.45)',
  padding: '28px',
  boxShadow: '0 30px 60px rgba(0,0,0,.65)',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px'
};

const labelStyle: CSSProperties = {
  fontSize: '14px',
  color: '#cbd5f5',
  textTransform: 'uppercase',
  letterSpacing: '0.08em'
};

const inputStyle: CSSProperties = {
  width: '95%',
  padding: '12px',
  fontSize: '18px',
  borderRadius: '12px',
  border: '1px solid rgba(149, 156, 235, 0.4)',
  background: '#0b1220',
  color: '#f8fafc'
};

const footerStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  justifyContent: 'flex-end',
  marginTop: '8px'
};

const buttonStyle: CSSProperties = {
  borderRadius: '12px',
  border: 'none',
  padding: '10px 18px',
  fontSize: '16px',
  fontWeight: 600,
  cursor: 'pointer'
};

export type PasswordUnlockPayload = {
  siteName?: string;
  origin?: string;
  username?: string;
};

type Props = {
  open: boolean;
  mode: Mode;
  payload?: PasswordUnlockPayload;
  onClose: () => void;
  onUnlock: (master: string, durationMinutes: number | undefined) => Promise<boolean>;
  error?: string | null;
  submitting?: boolean;
  defaultDuration: number;
};

const keepOptions = [
  { key: 'passwordUnlock.keep.1', value: 1 },
  { key: 'passwordUnlock.keep.5', value: 5 },
  { key: 'passwordUnlock.keep.15', value: 15 },
  { key: 'passwordUnlock.keep.60', value: 60 },
  { key: 'passwordUnlock.keep.untilQuit', value: 0 }
];

const PasswordUnlockModal: React.FC<Props> = ({
  open,
  mode,
  payload,
  onClose,
  onUnlock,
  error,
  submitting,
  defaultDuration
}) => {
  const { t } = useI18n();
  const [master, setMaster] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [duration, setDuration] = React.useState<number>(defaultDuration);
  const isMobile = mode === 'mobile';

  useEffect(() => {
    if (!open) return undefined;
    const handle = requestAnimationFrame(() => {
      setDuration(defaultDuration);
    });
    return () => cancelAnimationFrame(handle);
  }, [open, defaultDuration]);

  const handleUnlock = async () => {
    if (!master.trim()) return;
    const result = await onUnlock(master.trim(), duration === 0 ? undefined : duration);
    if (result) {
      setMaster('');
    }
  };

  if (!open) return null;

  const computedSheetStyle: CSSProperties = {
    ...sheetStyle,
    ...(isMobile ? { width: '90vw', padding: '32px 24px', gap: '20px' } : {})
  };

  const headingStyle = {
    margin: 0,
    fontSize: isMobile ? '38px' : '22px'
  };

  const paragraphStyle = {
    margin: '4px 0 0',
    color: 'rgba(248,250,252,.7)',
    fontSize: isMobile ? '38px' : '14px'
  };

  const computedLabelStyle: CSSProperties = {
    ...labelStyle,
    fontSize: isMobile ? '38px' : labelStyle.fontSize
  };

  const computedInputStyle: CSSProperties = {
    ...inputStyle,
    padding: isMobile ? '16px 18px' : inputStyle.padding,
    fontSize: isMobile ? '38px' : inputStyle.fontSize,
    width: isMobile ? '96%' : inputStyle.width
  };

  const computedButtonStyle: CSSProperties = {
    ...buttonStyle,
    padding: isMobile ? '16px 26px' : buttonStyle.padding,
    fontSize: isMobile ? '38px' : buttonStyle.fontSize
  };

  const errorStyle = {
    color: '#f87171',
    fontSize: isMobile ? '38px' : '14px'
  };

  const footerComputedStyle = {
    ...footerStyle,
    gap: isMobile ? 16 : footerStyle.gap,
    marginTop: isMobile ? 12 : footerStyle.marginTop
  };

  const toggleButtonStyle: CSSProperties = {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent',
    border: 'none',
    color: '#93c5fd',
    cursor: 'pointer',
    fontSize: isMobile ? '38px' : '14px'
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div style={computedSheetStyle}>
        <div>
          <h2 style={headingStyle}>{t('passwordUnlock.heading')}</h2>
          <p style={paragraphStyle}>
            {payload?.siteName ? t('passwordUnlock.desc.site', { site: payload.siteName }) : t('passwordUnlock.desc.default')}
          </p>
        </div>
        <label style={computedLabelStyle}>{t('passwords.current')}</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={master}
            onChange={(event) => setMaster(event.target.value)}
            style={computedInputStyle}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            style={toggleButtonStyle}
          >
            {showPassword ? t('passwords.hide') : t('passwords.show')}
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <label style={computedLabelStyle}>{t('passwordUnlock.label.duration')}</label>
          <select
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
            style={{...computedInputStyle, ...{width: '100%'}}}
          >
            {keepOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.key)}
              </option>
            ))}
          </select>
        </div>
        {error && <div style={errorStyle}>{error}</div>}
        <div style={footerComputedStyle}>
          <button
            type="button"
            style={{ ...computedButtonStyle, background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.4)', color: '#cbd5f5' }}
            onClick={onClose}
          >
            {t('passwords.cancel')}
          </button>
          <button
            type="button"
            style={{ ...computedButtonStyle, background: '#2563eb', color: '#fff' }}
            onClick={handleUnlock}
            disabled={submitting || !master.trim()}
          >
            {submitting ? t('passwordUnlock.button.unlocking') : t('passwordUnlock.button.unlock')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordUnlockModal;
