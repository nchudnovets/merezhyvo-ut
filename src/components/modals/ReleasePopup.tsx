import React, { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { getThemeVars } from '../../styles/theme';
import type { ThemeName, Mode } from '../../types/models';

type ReleasePopupProps = {
  mode: Mode;
  theme: ThemeName;
  onClose: () => void;
  t: (key: string) => string;
};

const ReleasePopup: React.FC<ReleasePopupProps> = ({ mode, theme, onClose, t }) => {
  const themeVars = useMemo(() => getThemeVars(theme), [theme]);

  const backdropStyle = useMemo<CSSProperties>(() => ({
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    display: 'flex',
    alignItems: mode === 'mobile' ? 'stretch' : 'center',
    justifyContent: 'center',
    background: themeVars['overlay'],
    padding: mode === 'mobile' ? '16px' : '0'
  }), [mode, themeVars]);

  const cardStyle = useMemo<CSSProperties>(() => ({
    width: mode === 'mobile' ? '100%' : 'min(760px, 90vw)',
    height: mode === 'mobile' ? '100%' : 'auto',
    maxHeight: mode === 'mobile' ? '100%' : '90vh',
    background: themeVars['surface'],
    color: themeVars['text-primary'],
    border: mode === 'mobile' ? 'none' : `1px solid ${themeVars['border']}`,
    borderRadius: mode === 'mobile' ? '16px' : '18px',
    padding: 0,
    overflow: 'hidden',
    boxShadow: mode === 'mobile' ? 'none' : '0 20px 60px rgba(0, 0, 0, 0.35)',
    fontSize: mode === 'mobile' ? '42px' : '16px',
    lineHeight: mode === 'mobile' ? '1.3' : '1.6',
    display: 'flex',
    flexDirection: 'column'
  }), [mode, themeVars]);

  const contentStyle = useMemo<CSSProperties>(() => ({
    padding: mode === 'mobile' ? '32px' : '24px',
    overflowY: 'auto',
    flex: 1
  }), [mode]);

  const titleStyle = useMemo<CSSProperties>(() => ({
    fontWeight: 700,
    fontSize: mode === 'mobile' ? '48px' : '22px',
    marginBottom: mode === 'mobile' ? '24px' : '16px'
  }), [mode]);

  const sectionTitleStyle = useMemo<CSSProperties>(() => ({
    fontWeight: 700,
    fontSize: mode === 'mobile' ? '44px' : '18px',
    margin: mode === 'mobile' ? '32px 0 16px' : '20px 0 10px'
  }), [mode]);

  const paragraphStyle = useMemo<CSSProperties>(() => ({
    margin: mode === 'mobile' ? '18px 0' : '10px 0',
    color: themeVars['text-secondary']
  }), [mode, themeVars]);

  const listStyle = useMemo<CSSProperties>(() => ({
    margin: mode === 'mobile' ? '18px 0 18px 40px' : '8px 0 8px 20px',
    padding: 0,
    color: themeVars['text-secondary']
  }), [mode, themeVars]);

  const footerStyle = useMemo<CSSProperties>(() => ({
    marginTop: mode === 'mobile' ? '28px' : '16px',
    color: themeVars['text-muted']
  }), [mode, themeVars]);

  const actionsStyle = useMemo<CSSProperties>(() => ({
    display: 'flex',
    justifyContent: 'flex-end',
    padding: mode === 'mobile' ? '0 32px 32px' : '0 24px 24px'
  }), [mode]);

  const okButtonStyle = useMemo<CSSProperties>(() => ({
    border: `1px solid ${themeVars['accent-strong']}`,
    background: themeVars['accent'],
    color: '#fff',
    borderRadius: mode === 'mobile' ? '18px' : '10px',
    padding: mode === 'mobile' ? '18px 28px' : '10px 18px',
    fontSize: mode === 'mobile' ? '42px' : '16px',
    fontWeight: 600,
    cursor: 'pointer'
  }), [mode, themeVars]);

  return (
    <div style={backdropStyle} role="dialog" aria-modal="true">
      <div style={cardStyle}>
        <div style={contentStyle} className="service-scroll">
          <div style={titleStyle}>{t('release.popup.title')}</div>
          <div style={sectionTitleStyle}>{t('release.popup.section1.title')}</div>
          <p style={paragraphStyle}>{t('release.popup.section1.body1')}</p>
          <p style={paragraphStyle}>{t('release.popup.section1.body2')}</p>
          <ul style={listStyle}>
            <li>{t('release.popup.section1.step1')}</li>
            <li>{t('release.popup.section1.step2')}</li>
            <li>{t('release.popup.section1.step3')}</li>
            <li>{t('release.popup.section1.step4')}</li>
            <li>{t('release.popup.section1.step5')}</li>
          </ul>
          <p style={paragraphStyle}>{t('release.popup.section1.body3')}</p>
          <div style={sectionTitleStyle}>{t('release.popup.section2.title')}</div>
          <p style={paragraphStyle}>{t('release.popup.section2.body1')}</p>
          <div style={sectionTitleStyle}>{t('release.popup.section3.title')}</div>
          <p style={paragraphStyle}>{t('release.popup.section3.body1')}</p>
          <p style={footerStyle}>{t('release.popup.footer')}</p>
        </div>
        <div style={actionsStyle}>
          <button type="button" style={okButtonStyle} onClick={onClose}>
            {t('jsDialog.ok')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReleasePopup;
