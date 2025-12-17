import React from 'react';
import type { CertificateInfo, Mode } from '../../types/models';
import { styles } from '../../styles/styles';

type CertOverlayProps = {
  mode: Mode;
  cert: CertificateInfo;
  rememberChecked: boolean;
  onRememberChange: (checked: boolean) => void;
  onCancel: () => void;
  onProceed: () => void;
  title: string;
  description: string;
  rememberLabel: string;
  cancelLabel: string;
  proceedLabel: string;
  issuerLabel: string;
  subjectLabel: string;
  serialLabel: string;
  validFromLabel: string;
  validToLabel: string;
  fingerprintLabel: string;
};

export const CertOverlay: React.FC<CertOverlayProps> = ({
  mode,
  cert,
  rememberChecked,
  onRememberChange,
  onCancel,
  onProceed,
  title,
  description,
  rememberLabel,
  cancelLabel,
  proceedLabel,
  issuerLabel,
  subjectLabel,
  serialLabel,
  validFromLabel,
  validToLabel,
  fingerprintLabel
}) => {
  const formatDate = (value?: number | null) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '';
    return new Date(value).toLocaleString();
  };

  return (
    <div
      style={{
        ...styles.webviewErrorOverlay,
        ...(mode === 'mobile' ? styles.webviewErrorOverlayMobile : null),
        pointerEvents: 'auto'
      }}
      role="alert"
      aria-live="assertive"
    >
      <div
        style={{
          ...styles.webviewErrorTitle,
          ...(mode === 'mobile' ? styles.webviewErrorTitleMobile : null)
        }}
      >
        {title}
      </div>
      <div
        style={{
          ...styles.webviewErrorSubtitle,
          ...(mode === 'mobile' ? styles.webviewErrorSubtitleMobile : null)
        }}
      >
        {description}
      </div>
      {cert.url && (
        <div
          style={{
            marginTop: '10px',
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'rgba(148,163,184,0.08)',
            color: '#e2e8f0',
            maxWidth: mode === 'mobile' ? '92vw' : '520px',
            fontSize: mode === 'mobile' ? '36px' : '16px',
            wordBreak: 'break-all'
          }}
        >
          {cert.url}
        </div>
      )}
      {cert.certificate && (
        <div
          className="service-scroll"
          style={{
            marginTop: '10px',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid rgba(148,163,184,0.35)',
            background: 'rgba(15,23,42,0.6)',
            textAlign: 'left',
            maxWidth: mode === 'mobile' ? '92vw' : '520px',
            fontSize: mode === 'mobile' ? '38px' : '16px',
            lineHeight: 1.5,
            overflow: 'auto'
          }}
        >
          <div><strong>{issuerLabel} </strong>{cert.certificate.issuerName || '—'}</div>
          <div><strong>{subjectLabel} </strong>{cert.certificate.subjectName || '—'}</div>
          <div><strong>{serialLabel} </strong>{cert.certificate.serialNumber || '—'}</div>
          <div><strong>{validFromLabel} </strong>{formatDate(cert.certificate.validStart)}</div>
          <div><strong>{validToLabel} </strong>{formatDate(cert.certificate.validExpiry)}</div>
          <div><strong>{fingerprintLabel} </strong>{cert.certificate.fingerprint || '—'}</div>
        </div>
      )}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: mode === 'mobile' ? '16px' : '8px',
          marginTop: '14px',
          fontSize: mode === 'mobile' ? '35px' : '15px',
          color: '#e2e8f0'
        }}
      >
        <input
          type="checkbox"
          checked={rememberChecked}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onRememberChange(e.target.checked)}
          style={{ width: mode === 'mobile' ? 30 : 16, height: mode === 'mobile' ? 30 : 16 }}
        />
        <span>{rememberLabel}</span>
      </label>
      <div style={{ display: 'flex', gap: '12px', marginTop: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            ...styles.webviewErrorButton,
            ...(mode === 'mobile' ? styles.webviewErrorButtonMobile : null),
            borderColor: '#259cebff',
            backgroundColor: 'rgba(37,156,235,0.12)'
          }}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onProceed}
          style={{
            ...styles.webviewErrorButton,
            ...(mode === 'mobile' ? styles.webviewErrorButtonMobile : null),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.15)'
          }}
        >
          {proceedLabel}
        </button>
      </div>
    </div>
  );
};
