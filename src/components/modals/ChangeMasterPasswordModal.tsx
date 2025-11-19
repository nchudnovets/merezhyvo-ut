"use strict";

import React, { useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { Mode, PasswordChangeMasterResult } from '../../types/models';

type Props = {
  open: boolean;
  mode: Mode;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (current: string, next: string) => Promise<PasswordChangeMasterResult>;
  variant?: 'change' | 'create';
};

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(2, 6, 23, 0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 101
};

const sheetBaseStyle: CSSProperties = {
  borderRadius: '18px',
  border: '1px solid rgba(148, 163, 184, 0.45)',
  background: '#0f1729',
  padding: '30px',
  boxShadow: '0 30px 60px rgba(0,0,0,.65)',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  width: 'min(520px, 92vw)'
};

const labelStyle: CSSProperties = {
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#cbd5f5'
};

const inputBaseStyle: CSSProperties = {
  width: '95%',
  borderRadius: '14px',
  border: '1px solid rgba(148, 163, 184, 0.4)',
  background: '#0b1220',
  color: '#f8fafc',
  padding: '14px 12px'
};

const buttonBaseStyle: CSSProperties = {
  borderRadius: '12px',
  border: 'none',
  padding: '12px 20px',
  fontWeight: 600,
  cursor: 'pointer'
};

const strengthLevels = [
  { label: 'Very weak', color: '#f87171' },
  { label: 'Weak', color: '#fb923c' },
  { label: 'Fair', color: '#facc15' },
  { label: 'Good', color: '#22c55e' },
  { label: 'Strong', color: '#16a34a' }
];

const computeStrength = (value: string) => {
  const fallback = strengthLevels[0] ?? { label: 'Very weak', color: '#f87171' };
  if (!value) {
    return { score: 0, label: fallback.label, color: fallback.color };
  }
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  const capped = Math.min(strengthLevels.length - 1, score);
  const level = strengthLevels[capped] ?? strengthLevels[strengthLevels.length - 1] ?? fallback;
  return { score: capped, label: level.label, color: level.color };
};

const ChangeMasterPasswordModal: React.FC<Props> = ({
  open,
  mode,
  submitting,
  error,
  onClose,
  onSubmit,
  variant = 'change'
}) => {
  const isMobile = mode === 'mobile';
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNext, setShowNext] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const isCreate = variant === 'create';

  useEffect(() => {
    if (open) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setShowCurrent(false);
      setShowNext(false);
      setShowConfirm(false);
      setValidationError(null);
    }
  }, [open]);

  if (!open) return null;

  const strength = computeStrength(next);
  const headingText = isCreate ? 'Create master password' : 'Change master password';
  const descriptionText = isCreate
    ? 'Create a master password to secure your vault.'
    : 'Update the password that unlocks your vault.';

  const handleSubmit = async () => {
    setValidationError(null);
    if (!isCreate && !current.trim()) {
      setValidationError('Current password is required');
      return;
    }
    if (!next) {
      setValidationError('New password is required');
      return;
    }
    if (next !== confirm) {
      setValidationError('Passwords do not match');
      return;
    }
    try {
      await onSubmit(current.trim(), next);
    } catch {
      // parent handles error messaging
    }
  };

  const sheetStyle = {
    ...sheetBaseStyle,
    ...(isMobile ? { width: '90vw', padding: '36px 28px', gap: '18px' } : {})
  };

  const labelFontSize = isMobile ? '38px' : '12px';
  const inputFontSize = isMobile ? '38px' : '18px';
  const toggleFontSize = isMobile ? '38px' : '12px';

  const inputStyle: CSSProperties = {
    ...inputBaseStyle,
    fontSize: inputFontSize
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
    fontSize: toggleFontSize
  };

  const footerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: isMobile ? '12px' : '8px',
    marginTop: '12px'
  };

  const strengthBarStyle: CSSProperties = {
    height: '6px',
    borderRadius: '4px',
    background: 'rgba(148, 163, 184, 0.4)',
    overflow: 'hidden',
    marginTop: '6px'
  };

  const progressPercent =
    strengthLevels.length > 1 ? (strength.score / (strengthLevels.length - 1)) * 100 : 0;
  const strengthInnerStyle: CSSProperties = {
    width: `${progressPercent}%`,
    minWidth: '16%',
    height: '100%',
    borderRadius: 'inherit',
    background: strength.color,
    transition: 'width 0.2s ease'
  };
  const primaryLabel = isCreate ? 'Create master password' : 'Change master password';
  const submittingLabel = isCreate ? 'Creating…' : 'Changing…';

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div style={sheetStyle}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? '38px' : '22px' }}>{headingText}</h2>
          <p style={{ margin: '6px 0 0', color: '#cbd5f5', fontSize: isMobile ? '38px' : '14px' }}>
            {descriptionText}
          </p>
        </div>
        {error && (
          <div style={{ color: '#f87171', fontSize: isMobile ? '38px' : '14px' }}>{error}</div>
        )}
        {!isCreate && (
          <div>
            <label style={{ ...labelStyle, fontSize: labelFontSize }}>Current master password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                style={inputStyle}
              />
              <button type="button" onClick={() => setShowCurrent((prev) => !prev)} style={toggleButtonStyle}>
                {showCurrent ? 'Hide' : 'Reveal'}
              </button>
            </div>
          </div>
        )}
        <div>
          <label style={{ ...labelStyle, fontSize: labelFontSize }}>
            {isCreate ? 'Master password' : 'New master password'}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showNext ? 'text' : 'password'}
              value={next}
              onChange={(event) => setNext(event.target.value)}
              style={inputStyle}
            />
            <button type="button" onClick={() => setShowNext((prev) => !prev)} style={toggleButtonStyle}>
              {showNext ? 'Hide' : 'Reveal'}
            </button>
          </div>
          <div style={{ marginTop: '6px', color: '#cbd5f5', fontSize: isMobile ? '38px' : '12px' }}>
            Strength: {strength.label}
          </div>
          <div style={strengthBarStyle}>
            <div style={strengthInnerStyle} />
          </div>
        </div>
        <div>
          <label style={{ ...labelStyle, fontSize: labelFontSize }}>Confirm password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              style={inputStyle}
            />
            <button type="button" onClick={() => setShowConfirm((prev) => !prev)} style={toggleButtonStyle}>
              {showConfirm ? 'Hide' : 'Reveal'}
            </button>
          </div>
        </div>
        {validationError && (
          <div style={{ color: '#f87171', fontSize: isMobile ? '38px' : '14px' }}>{validationError}</div>
        )}
        <div style={footerStyle}>
          <button
            type="button"
            onClick={onClose}
            style={{
              ...buttonBaseStyle,
              background: 'transparent',
              border: '1px solid rgba(148, 163, 184, 0.4)',
              color: '#cbd5f5',
              fontSize: isMobile ? '38px' : '14px'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              ...buttonBaseStyle,
              background: '#2563eb',
              color: '#fff',
              fontSize: isMobile ? '38px' : '14px'
            }}
            disabled={submitting}
          >
            {submitting ? submittingLabel : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangeMasterPasswordModal;
