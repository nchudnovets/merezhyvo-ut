import React, { useState } from 'react';
import type { ServicePageProps } from '../services/types';
import { useI18n } from '../../i18n/I18nProvider';

type Section = {
  key: string;
  heading: string;
  body: string[];
};

const cardStyle = {
  background: 'rgba(15,23,42,0.55)',
  padding: '14px 14px 12px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 10
};

const PrivacyInfoPage: React.FC<ServicePageProps> = ({ mode, onClose }) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sections: Section[] = [
    {
      key: 'https',
      heading: t('privacyInfo.https.heading'),
      body: [
        t('privacyInfo.https.body1'),
        t('privacyInfo.https.body2'),
        t('privacyInfo.https.body3'),
        t('privacyInfo.https.body4')
      ]
    },
    {
      key: 'certs',
      heading: t('privacyInfo.certs.heading'),
      body: [
        t('privacyInfo.certs.body1'),
        t('privacyInfo.certs.body2'),
        t('privacyInfo.certs.body3'),
        t('privacyInfo.certs.body4'),
        t('privacyInfo.certs.body5'),
        t('privacyInfo.certs.body6'),
        t('privacyInfo.certs.body7'),
        t('privacyInfo.certs.body8'),
        t('privacyInfo.certs.body9'),
        t('privacyInfo.certs.body10'),
        t('privacyInfo.certs.body11'),
        t('privacyInfo.certs.body12')
      ]
    },
    {
      key: 'webrtc',
      heading: t('privacyInfo.webrtc.heading'),
      body: [
        t('privacyInfo.webrtc.body1'),
        t('privacyInfo.webrtc.body2'),
        t('privacyInfo.webrtc.body3'),
        t('privacyInfo.webrtc.body4'),
        t('privacyInfo.webrtc.body5'),
        t('privacyInfo.webrtc.body6'),
        t('privacyInfo.webrtc.body7')
      ]
    },
    {
      key: 'cookies',
      heading: t('privacyInfo.cookies.heading'),
      body: [
        t('privacyInfo.cookies.body1'),
        t('privacyInfo.cookies.body2'),
        t('privacyInfo.cookies.body3'),
        t('privacyInfo.cookies.body4'),
        t('privacyInfo.cookies.body5'),
        t('privacyInfo.cookies.body6')
      ]
    },
    {
      key: 'trackers',
      heading: t('privacyInfo.trackers.heading'),
      body: [
        t('privacyInfo.trackers.body1'),
        t('privacyInfo.trackers.body2'),
        t('privacyInfo.trackers.body3'),
        t('privacyInfo.trackers.body4'),
        t('privacyInfo.trackers.body5'),
        t('privacyInfo.trackers.body6'),
        t('privacyInfo.trackers.body7'),
        t('privacyInfo.trackers.body8'),
        t('privacyInfo.trackers.body9'),
        t('privacyInfo.trackers.body10'),
        t('privacyInfo.trackers.body11')
      ]
    },
    {
      key: 'siteData',
      heading: t('privacyInfo.siteData.heading'),
      body: [
        t('privacyInfo.siteData.body1'),
        t('privacyInfo.siteData.body2'),
        t('privacyInfo.siteData.body3')
      ]
    },
    {
      key: 'tor',
      heading: t('privacyInfo.tor.heading'),
      body: [
        t('privacyInfo.tor.body1'),
        t('privacyInfo.tor.body2'),
        t('privacyInfo.tor.body3')
      ]
    },
    {
      key: 'platform',
      heading: t('privacyInfo.platform.heading'),
      body: [
        t('privacyInfo.platform.body1'),
        t('privacyInfo.platform.body2'),
        t('privacyInfo.platform.body3')
      ]
    }
  ];

  const textSize = mode === 'mobile' ? '38px' : '14px';
  const headingSize = mode === 'mobile' ? '42px' : '18px';

  return (
    <div
      className="service-scroll"
      style={{
        width: '100%',
        height: '100%',
        padding: mode === 'mobile' ? '28px 22px 40px' : '22px 26px',
        boxSizing: 'border-box',
        color: '#e2e8f0'
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
                  background: 'rgba(15,23,42,0.6)',
                  color: '#e2e8f0',
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
            <h1 style={{ fontSize: mode === 'mobile' ? '46px' : '22px', fontWeight: 800 }}>{t('privacyInfo.title')}</h1>
          </div>
        </div>

        {sections.map((section) => {
          const isOpen = expanded[section.key] ?? true;
          return (
            <div key={section.key} style={cardStyle}>
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [section.key]: !(prev[section.key] ?? true) }))}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <span style={{ fontSize: headingSize, fontWeight: 800 }}>{section.heading}</span>
                <svg
                  viewBox="0 0 16 16"
                  width={mode === 'mobile' ? 30 : 16}
                  height={mode === 'mobile' ? 30 : 16}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }}
                >
                  <path d="m6 3 5 5-5 5" />
                </svg>
              </button>
              {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                  {section.body.map((line, idx) => (
                    <p key={idx} style={{ margin: 0, fontSize: textSize, lineHeight: 1.45, color: 'rgba(226,232,240,0.9)' }}>
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PrivacyInfoPage;
