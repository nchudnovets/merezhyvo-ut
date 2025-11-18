import React from 'react';
import type { CSSProperties } from 'react';
import type { Mode, PasswordCaptureAction, PasswordPromptPayload } from '../../types/models';

type Props = {
  open: boolean;
  mode: Mode;
  payload?: PasswordPromptPayload | null;
  busy?: boolean;
  onAction: (action: PasswordCaptureAction) => void;
  onClose: () => void;
};

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2200,
  padding: '24px'
};

const cardBaseStyle: CSSProperties = {
  width: '100%',
  maxWidth: '480px',
  borderRadius: '24px',
  backgroundColor: '#101010',
  color: '#fff',
  boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
  padding: '32px',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px'
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontWeight: 600
};

const messageStyle: CSSProperties = {
  margin: 0,
  maxWidth: '100%',
  lineHeight: 1.3
};

const buttonContainerStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  justifyContent: 'flex-end'
};

const buttonStyle: CSSProperties = {
  flex: '1 1 auto',
  minWidth: '120px',
  padding: '12px 16px',
  borderRadius: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  transition: 'opacity 120ms ease'
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#2d9cdb',
  color: '#fff'
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: 'transparent',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.4)'
};

const ghostButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: 'rgba(255,255,255,0.08)',
  color: '#fff'
};

const promptCardDimensions = (mode: Mode): CSSProperties => {
  if (mode === 'mobile') {
    return {
      width: '90vw',
      maxWidth: '90vw',
      padding: '32px',
    };
  }
  return {};
};

const labelFontSizes = (mode: Mode) => ({
  title: mode === 'mobile' ? '38px' : '26px',
  message: mode === 'mobile' ? '32px' : '18px',
  button: mode === 'mobile' ? '32px' : '16px'
});

const PasswordCapturePrompt: React.FC<Props> = ({ open, mode, payload, busy, onAction, onClose }) => {
  if (!open || !payload) return null;
  const sizes = labelFontSizes(mode);
  const computedCardStyle: CSSProperties = {
    ...cardBaseStyle,
    ...promptCardDimensions(mode)
  };
  const titleText = payload.isUpdate ? 'Update saved password?' : `Save password for ${payload.siteName}?`;
  const subtitle = payload.isUpdate
    ? `An existing password for ${payload.username || 'this account'} on ${payload.siteName} was found.`
    : `Username: ${payload.username || '(none)'}`;
  const primaryLabel = payload.isUpdate ? 'Update' : 'Save';
  const tertiaryLabel = payload.isUpdate ? 'Cancel' : 'Not now';
  const tertiaryAction = () => onClose();
  const secondaryLabel = payload.isUpdate ? 'Keep both' : 'Never for this site';
  const secondaryAction: PasswordCaptureAction = payload.isUpdate ? 'keep-both' : 'never';

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="password-prompt-title">
      <div style={computedCardStyle}>
        <h2 id="password-prompt-title" style={{ ...titleStyle, fontSize: sizes.title }}>
          {titleText}
        </h2>
        <p style={{ ...messageStyle, fontSize: sizes.message }}>{subtitle}</p>
        <div style={buttonContainerStyle}>
          <button
            type="button"
            style={{ ...primaryButtonStyle, fontSize: sizes.button }}
            disabled={busy}
            onClick={() => onAction(payload.isUpdate ? 'update' : 'save')}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            style={{ ...secondaryButtonStyle, fontSize: sizes.button }}
            disabled={busy}
            onClick={() => onAction(secondaryAction)}
          >
            {secondaryLabel}
          </button>
          <button
            type="button"
            style={{ ...ghostButtonStyle, fontSize: sizes.button }}
            disabled={busy}
            onClick={tertiaryAction}
          >
            {tertiaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordCapturePrompt;
