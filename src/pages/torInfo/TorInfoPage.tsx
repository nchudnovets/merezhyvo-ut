import React from 'react';
import type { ServicePageProps } from '../services/types';
import { useI18n } from '../../i18n/I18nProvider';

const cardStyle = {
  background: 'var(--mzr-surface-transparent)',
  border: 'none',
  padding: '16px 16px 18px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 12
};

const TorInfoPage: React.FC<ServicePageProps> = ({ mode, onClose }) => {
  const { t } = useI18n();
  const textSize = mode === 'mobile' ? '40px' : '16px';
  const headingSize = mode === 'mobile' ? '44px' : '18px';
  const subHeadingSize = mode === 'mobile' ? '40px' : '16px';
  const titleSize = mode === 'mobile' ? '46px' : '22px';

  return (
    <div
      className="service-scroll"
      style={{
        width: '100%',
        height: '100%',
        padding: mode === 'mobile' ? '28px 22px 40px' : '22px 26px',
        boxSizing: 'border-box',
        color: 'var(--mzr-text-secondary)',
        background: 'var(--mzr-surface)'
      }}
    >
      <div style={{ maxWidth: mode === 'mobile' ? 'none' : 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: mode === 'mobile' ? 18 : 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: mode === 'mobile' ? 18 : 10, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: mode === 'mobile' ? 18 : 10 }}>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('global.close')}
                style={{
                  width: mode === 'mobile' ? 56 : 36,
                  height: mode === 'mobile' ? 56 : 36,
                  border: 'none',
                  background: 'var(--mzr-surface-weak)',
                  color: 'var(--mzr-text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <svg width={mode === 'mobile' ? 50 : 18} height={mode === 'mobile' ? 50 : 18} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
            <h1 style={{ fontSize: titleSize, fontWeight: 800 }}>{t('torInfo.title')}</h1>
          </div>
        </div>

        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: textSize, lineHeight: 1.5 }}>
            {t('torInfo.body1')}
          </p>
          <p style={{ margin: 0, fontSize: textSize, lineHeight: 1.5 }}>
            {t('torInfo.body2')}
          </p>
          <p style={{ margin: 0, fontSize: textSize, lineHeight: 1.5 }}>
            {t('torInfo.body3')}
          </p>

          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: headingSize, fontWeight: 800, color: 'var(--mzr-text-primary)' }}>
              {t('torInfo.expect.heading')}
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: subHeadingSize, fontWeight: 700, color: 'var(--mzr-text-primary)' }}>
                {t('torInfo.expect.on.heading')}
              </div>
              <ul style={{ margin: '8px 0 0 20px', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li style={{ fontSize: textSize, lineHeight: 1.5 }}>{t('torInfo.expect.on.item1')}</li>
                <li style={{ fontSize: textSize, lineHeight: 1.5 }}>{t('torInfo.expect.on.item2')}</li>
                <li style={{ fontSize: textSize, lineHeight: 1.5 }}>{t('torInfo.expect.on.item3')}</li>
                <li style={{ fontSize: textSize, lineHeight: 1.5 }}>{t('torInfo.expect.on.item4')}</li>
                <li style={{ fontSize: textSize, lineHeight: 1.5 }}>{t('torInfo.expect.on.item5')}</li>
                <li style={{ fontSize: textSize, lineHeight: 1.5 }}>{t('torInfo.expect.on.item6')}</li>
              </ul>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: subHeadingSize, fontWeight: 700, color: 'var(--mzr-text-primary)' }}>
                {t('torInfo.expect.off.heading')}
              </div>
              <ul style={{ margin: '8px 0 0 20px', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li style={{ fontSize: textSize, lineHeight: 1.5 }}>{t('torInfo.expect.off.item1')}</li>
                <li style={{ fontSize: textSize, lineHeight: 1.5 }}>{t('torInfo.expect.off.item2')}</li>
                <li style={{ fontSize: textSize, lineHeight: 1.5 }}>{t('torInfo.expect.off.item3')}</li>
                <li style={{ fontSize: textSize, lineHeight: 1.5 }}>{t('torInfo.expect.off.item4')}</li>
              </ul>
            </div>
          </div>

          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: headingSize, fontWeight: 800, color: 'var(--mzr-text-primary)' }}>
              {t('torInfo.turnOff.heading')}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: textSize, lineHeight: 1.5 }}>
              {t('torInfo.turnOff.body')}
            </p>
            <ul style={{ margin: '8px 0 0 20px', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li style={{ fontSize: textSize, lineHeight: 1.5 }}>{t('torInfo.turnOff.item1')}</li>
              <li style={{ fontSize: textSize, lineHeight: 1.5 }}>
                <div>{t('torInfo.turnOff.item2')}</div>
                <p style={{ margin: '6px 0 0', fontSize: textSize, lineHeight: 1.5 }}>
                  {t('torInfo.turnOff.note')}
                </p>
              </li>
            </ul>
          </div>

          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: headingSize, fontWeight: 800, color: 'var(--mzr-text-primary)' }}>
              {t('torInfo.important.heading')}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: textSize, lineHeight: 1.5 }}>
              {t('torInfo.important.body')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TorInfoPage;
