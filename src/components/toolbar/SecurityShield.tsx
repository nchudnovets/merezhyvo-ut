import React from 'react';
import type { CSSProperties } from 'react';
import type { Mode, TrackerStatus } from '../../types/models';
import { useI18n } from '../../i18n/I18nProvider';

type SecurityView = 'root' | 'connection' | 'cookies' | 'trackers';

type Props = {
  translate?: (key: string, vars?: Record<string, string | number>) => string;
  mode: Mode;
  securityState: 'ok' | 'warn' | 'notice';
  securityInfo: {
    state: string;
    url?: string | null;
    host?: string | null;
    error?: string | null;
    issuer?: string | null;
    subject?: string | null;
    validFrom?: number | null;
    validTo?: number | null;
    fingerprint?: string | null;
  } | null;
  securityOpen: boolean;
  onToggleSecurity?: () => void;
  certExceptionAllowed: boolean;
  onToggleCertException?: (next: boolean) => void;
  cookiePolicy?: {
    blockThirdParty: boolean;
    exceptionAllowed: boolean;
    host: string | null;
    blockedTotal?: number;
  };
  onToggleCookieException?: (next: boolean) => void;
  onOpenSiteData?: (host?: string | null) => void;
  onOpenPrivacyInfo?: () => void;
  onOpenSecurityExceptions?: () => void;
  trackerStatus?: TrackerStatus;
  onToggleTrackerException?: (next: boolean) => void;
  onToggleAdsException?: (next: boolean) => void;
  onOpenTrackersExceptions?: () => void;
  renderAnchor?: (params: { securityColor: string; toggle: () => void; mode: Mode }) => React.ReactNode;
  popupStyle?: CSSProperties;
};

export const SecurityShield: React.FC<Props> = ({
  mode,
  securityState,
  securityInfo,
  securityOpen,
  onToggleSecurity,
  certExceptionAllowed,
  onToggleCertException,
  cookiePolicy,
  onToggleCookieException,
  onOpenSiteData,
  onOpenPrivacyInfo,
  onOpenSecurityExceptions,
  trackerStatus,
  onToggleTrackerException,
  onToggleAdsException,
  onOpenTrackersExceptions,
  translate,
  renderAnchor,
  popupStyle
}) => {
  const { t: tContext } = useI18n();
  const t = translate ?? tContext;
  const [securityView, setSecurityView] = React.useState<SecurityView>('root');

  React.useEffect(() => {
    if (!securityOpen) {
      setSecurityView('root');
    }
  }, [securityOpen]);

  const securityColor =
    securityState === 'warn'
      ? 'var(--mzr-danger)'
      : securityState === 'notice'
      ? 'var(--mzr-warning)'
      : 'var(--mzr-text-primary)';
  const mergedPopupStyle = React.useMemo(
    () =>
      ({
        position: 'absolute',
        top: mode === 'mobile' ? '110%' : '105%',
        left: mode === 'mobile' ? '0' : '0',
        right: mode === 'mobile' ? '-40%' : '50%',
        maxWidth: mode === 'mobile' ? '700px' : '460px',
        minWidth: '360px',
        padding: mode === 'mobile' ? '18px 18px 14px' : '12px 12px 10px',
        borderRadius: '12px',
        background: 'var(--mzr-surface)',
        border: '1px solid var(--mzr-border)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        color: 'var(--mzr-text-secondary)',
        zIndex: 60,
        fontSize: mode === 'mobile' ? '36px' : '15px',
        overflow: 'auto',
        ...popupStyle
      }) satisfies CSSProperties,
    [mode, popupStyle]
  );

  const linkStyle: React.CSSProperties = {
    alignSelf: 'flex-start',
    padding: 0,
    background: 'transparent',
    color: 'var(--mzr-focus-ring)',
    border: 'none',
    fontSize: mode === 'mobile' ? '37px' : '14px',
    cursor: 'pointer',
    textDecoration: 'underline'
  };

  const anchor = renderAnchor ? (
    renderAnchor({ securityColor, toggle: () => onToggleSecurity?.(), mode })
  ) : (
    <button
      type="button"
      onClick={() => onToggleSecurity?.()}
      style={{
        position: 'absolute',
        left: mode === 'mobile' ? '14px' : '10px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: securityColor,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer'
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={mode === 'mobile' ? 60 : 18}
        height={mode === 'mobile' ? 60 : 18}
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 11 4.16-.26 8-5.45 8-11V5l-8-3Zm0 2.18 6 2.25v4.71c0 4.18-2.88 8.16-6 8.39-3.12-.23-6-4.21-6-8.39V6.43l6-2.25Zm0 3.07-2.4 2.4a3 3 0 0 0 4.8 0L12 7.25Z" />
      </svg>
    </button>
  );

  return (
    <>
      {anchor}
      {securityOpen && (
        <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 59 }} onClick={() => onToggleSecurity?.()} />
        <div
          className="service-scroll"
          style={mergedPopupStyle}
        >
          {securityView === 'root' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: mode === 'mobile' ? 12 : 8 }}>
                <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '40px' : '16px' }}>
                  {t('security.popup.title')}
                </div>
              <button
                type="button"
                onClick={() => setSecurityView('connection')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: mode === 'mobile' ? '18px 16px' : '12px 10px',
                  borderRadius: 10,
                  border: `1px solid ${securityState === 'warn' ? 'var(--mzr-danger)' : 'var(--mzr-border)'}`,
                  background: 'var(--mzr-surface-transparent)',
                  color: securityState === 'warn' ? 'var(--mzr-danger)' : 'var(--mzr-text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg
                    viewBox="0 0 24 24"
                    width={mode === 'mobile' ? 44 : 18}
                    height={mode === 'mobile' ? 44 : 18}
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 11 4.16-.26 8-5.45 8-11V5l-8-3Zm0 2.18 6 2.25v4.71c0 4.18-2.88 8.16-6 8.39-3.12-.23-6-4.21-6-8.39V6.43l6-2.25Zm0 3.07-2.4 2.4a3 3 0 0 0 4.8 0L12 7.25Z" />
                  </svg>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '36px' : '14px' }}>{t('security.popup.connection')}</div>
                    <div
                      style={{
                        opacity: 0.9,
                        fontSize: mode === 'mobile' ? '36px' : '14px',
                        color: securityState === 'warn' ? 'var(--mzr-danger)' : '#22c55e'
                      }}
                    >
                      {securityState === 'warn' ? t('cert.info.status.problem') : t('cert.info.status.ok')}
                    </div>
                  </div>
                </div>
                <svg viewBox="0 0 16 16" width={mode === 'mobile' ? 28 : 14} height={mode === 'mobile' ? 28 : 14} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5.5 3 10 8l-4.5 5" />
                </svg>
              </button>
                <button
                  type="button"
                  onClick={() => setSecurityView('cookies')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: mode === 'mobile' ? '18px 16px' : '12px 10px',
                    borderRadius: 10,
                    border:
                      cookiePolicy?.exceptionAllowed
                        ? '1px solid var(--mzr-warning)'
                        : '1px solid var(--mzr-border)',
                    background: 'var(--mzr-surface-transparent)',
                    color: cookiePolicy?.exceptionAllowed ? 'var(--mzr-warning)' : 'var(--mzr-text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg viewBox="0 0 24 24" width={mode === 'mobile' ? 44 : 18} height={mode === 'mobile' ? 44 : 18} fill="currentColor" aria-hidden="true">
                    <path d="M20.95 11.05a7.048 7.048 0 0 1-4-4 4 4 0 1 1-4.949-4.949 10 10 0 1 0 9.414 9.414c-.308-.161-.324.134-.465.135Z" />
                  </svg>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '36px' : '14px' }}>{t('security.popup.cookies')}</div>
                    <div style={{ opacity: 0.8, fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                      {cookiePolicy?.exceptionAllowed
                        ? t('security.cookies.status.allowedException')
                        : cookiePolicy?.blockThirdParty
                        ? t('security.cookies.status.blocked')
                        : t('security.cookies.status.allowedGlobal')}
                    </div>
                    {cookiePolicy?.blockThirdParty && !cookiePolicy?.exceptionAllowed && (
                      <div style={{ opacity: 0.8, fontSize: mode === 'mobile' ? '36px' : '14px', marginTop: mode === 'mobile' ? 4 : 2 }}>
                        {t('security.cookies.blockedTotal', { count: cookiePolicy?.blockedTotal ?? 0 })}
                      </div>
                    )}
                  </div>
                </div>
                <svg viewBox="0 0 16 16" width={mode === 'mobile' ? 28 : 14} height={mode === 'mobile' ? 28 : 14} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5.5 3 10 8l-4.5 5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setSecurityView('trackers')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: mode === 'mobile' ? '18px 16px' : '12px 10px',
                  borderRadius: 10,
                  border:
                    ((trackerStatus?.trackersEnabledGlobal && trackerStatus?.trackersAllowedForSite) ||
                      (trackerStatus?.adsEnabledGlobal && trackerStatus?.adsAllowedForSite))
                      ? '1px solid var(--mzr-warning)'
                      : '1px solid var(--mzr-border)',
                  background: 'var(--mzr-surface-transparent)',
                  color:
                    ((trackerStatus?.trackersEnabledGlobal && trackerStatus?.trackersAllowedForSite) ||
                      (trackerStatus?.adsEnabledGlobal && trackerStatus?.adsAllowedForSite))
                      ? 'var(--mzr-warning)'
                      : 'var(--mzr-text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg viewBox="0 0 24 24" width={mode === 'mobile' ? 48 : 18} height={mode === 'mobile' ? 48 : 18} fill="currentColor" aria-hidden="true">
                    <path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h10v2H4z" />
                  </svg>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '36px' : '14px' }}>{t('security.trackers.menuTitle')}</div>
                    <div
                      style={{
                        opacity: 0.9,
                        fontSize: mode === 'mobile' ? '36px' : '14px',
                        color:
                          ((trackerStatus?.trackersEnabledGlobal && trackerStatus?.trackersAllowedForSite) ||
                            (trackerStatus?.adsEnabledGlobal && trackerStatus?.adsAllowedForSite))
                            ? '#fbbf24'
                            : undefined
                      }}
                    >
                      {(() => {
                        const trackersAllowed =
                          trackerStatus?.trackersEnabledGlobal && trackerStatus?.trackersAllowedForSite;
                        const adsAllowed =
                          trackerStatus?.adsEnabledGlobal && trackerStatus?.adsAllowedForSite;
                        if (!trackerStatus?.trackersEnabledGlobal && !trackerStatus?.adsEnabledGlobal) {
                          return t('security.trackers.statusDisabled');
                        }
                        if (trackersAllowed && adsAllowed) {
                          return t('security.trackers.statusAllowedBoth');
                        }
                        if (trackersAllowed) {
                          return t('security.trackers.statusAllowedTrackers');
                        }
                        if (adsAllowed) {
                          return t('security.trackers.statusAllowedAds');
                        }
                        return t('security.trackers.statusBlocked', { count: trackerStatus?.blockedTotal ?? 0 });
                      })()}
                    </div>
                  </div>
                </div>
                <svg viewBox="0 0 16 16" width={mode === 'mobile' ? 28 : 14} height={mode === 'mobile' ? 28 : 14} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5.5 3 10 8l-4.5 5" />
                </svg>
              </button>
                <button type="button" onClick={() => onOpenPrivacyInfo?.()} style={{ ...linkStyle, marginTop: mode === 'mobile' ? 4 : 2 }}>
                  {t('security.popup.learnMore')}
                </button>
              </div>
            )}

          {securityView === 'connection' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={() => setSecurityView('root')}
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  gap: 6,
                  alignItems: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--mzr-text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <svg
                  viewBox="0 0 16 16"
                  width={mode === 'mobile' ? 40 : 16}
                  height={mode === 'mobile' ? 40 : 16}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m10 13-5-5 5-5" />
                </svg>
                <span style={{ fontSize: mode === 'mobile' ? '40px' : undefined }}>{t('common.back')}</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg viewBox="0 0 24 24" width={mode === 'mobile' ? 44 : 18} height={mode === 'mobile' ? 44 : 18} fill="currentColor" aria-hidden="true">
                  <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 11 4.16-.26 8-5.45 8-11V5l-8-3Zm0 2.18 6 2.25v4.71c0 4.18-2.88 8.16-6 8.39-3.12-.23-6-4.21-6-8.39V6.43l6-2.25Zm0 3.07-2.4 2.4a3 3 0 0 0 4.8 0L12 7.25Z" />
                </svg>
                <div>
                  <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '36px' : '14px' }}>{t('security.popup.connection')}</div>
                  <div
                    style={{
                      opacity: 0.9,
                      fontSize: mode === 'mobile' ? '36px' : '14px',
                      color: securityState === 'warn' ? 'var(--mzr-danger)' : '#22c55e'
                    }}
                  >
                    {securityState === 'warn' ? t('cert.info.status.problem') : t('cert.info.status.ok')}
                  </div>
                </div>
              </div>
              {securityInfo?.host && (
                <div style={{ fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                  <div style={{ fontWeight: 700 }}>{t('security.popup.host')}</div>
                  <div>{securityInfo.host}</div>
                </div>
              )}
              {securityInfo?.issuer && (
                <div style={{ fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                  <div style={{ fontWeight: 700 }}>{t('cert.details.issuer')}</div>
                  <div>{securityInfo.issuer}</div>
                </div>
              )}
              {securityInfo?.validTo && (
                <div style={{ fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                  <div style={{ fontWeight: 700 }}>{t('cert.details.validTo')}</div>
                  <div>{securityInfo.validTo ? new Date(securityInfo.validTo).toLocaleString() : '—'}</div>
                </div>
              )}
              {securityInfo?.error && (
                <div style={{ fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                  <div style={{ fontWeight: 700 }}>{t('cert.details.error')}</div>
                  <div>{securityInfo.error}</div>
                </div>
              )}
              {securityInfo?.subject && (
                <div style={{ fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                  <div style={{ fontWeight: 700 }}>{t('cert.details.subject')}</div>
                  <div>{securityInfo.subject}</div>
                </div>
              )}
              {securityInfo?.fingerprint && (
                <div style={{ fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                  <div style={{ fontWeight: 700 }}>{t('cert.details.fingerprint')}</div>
                  <div>{securityInfo.fingerprint}</div>
                </div>
              )}
              {securityState === 'warn' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: mode === 'mobile' ? 8 : 6 }}>
                  <input
                    id="cert-exception"
                    type="checkbox"
                    checked={certExceptionAllowed}
                    onChange={(e) => onToggleCertException?.(e.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  <label htmlFor="cert-exception" style={{ cursor: 'pointer', fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                    {t('security.popup.allowException')}
                  </label>
                </div>
              )}
              <button
                type="button"
                onClick={() => onOpenSecurityExceptions?.()}
                style={{ ...linkStyle, marginTop: mode === 'mobile' ? 4 : 2 }}
              >
                {t('security.popup.manageSecurityExceptions')}
              </button>
            </div>
          )}

          {securityView === 'cookies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => setSecurityView('root')}
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  gap: 6,
                  alignItems: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--mzr-text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <svg viewBox="0 0 16 16" width={mode === 'mobile' ? 40 : 16}
                  height={mode === 'mobile' ? 40 : 16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m10 13-5-5 5-5" />
                </svg>
                <span style={{ fontSize: mode === 'mobile' ? '40px' : undefined }}>{t('common.back')}</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg viewBox="0 0 24 24" width={mode === 'mobile' ? 44 : 18} height={mode === 'mobile' ? 44 : 18} fill="currentColor" aria-hidden="true">
                  <path d="M20.95 11.05a7.048 7.048 0 0 1-4-4 4 4 0 1 1-4.949-4.949 10 10 0 1 0 9.414 9.414c-.308-.161-.324.134-.465.135Z" />
                </svg>
                <div>
                  <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '36px' : '14px' }}>{t('security.popup.cookies')}</div>
                  <div style={{ opacity: 0.8, fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                    {cookiePolicy?.exceptionAllowed
                      ? t('security.cookies.status.allowedException')
                      : cookiePolicy?.blockThirdParty
                      ? t('security.cookies.status.blocked')
                      : t('security.cookies.status.allowedGlobal')}
                  </div>
                </div>
              </div>
              <label
                htmlFor="cookie-exception"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  marginTop: mode === 'mobile' ? 6 : 4
                }}
              >
                <span
                  style={{
                    position: 'relative',
                    width: mode === 'mobile' ? 92 : 38,
                    height: mode === 'mobile' ? 52 : 20,
                    borderRadius: 999,
                    background: cookiePolicy?.exceptionAllowed ? 'var(--mzr-focus-ring)' : 'var(--mzr-border)',
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
                    transition: 'background 160ms ease'
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: mode === 'mobile' ? 6 : 2,
                      left: cookiePolicy?.exceptionAllowed ? (mode === 'mobile' ? 44 : 22) : (mode === 'mobile' ? 4 : 2),
                      width: mode === 'mobile' ? 40 : 18,
                      height: mode === 'mobile' ? 40 : 18,
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                      transition: 'left 160ms ease'
                    }}
                  />
                </span>
                <input
                  id="cookie-exception"
                  type="checkbox"
                  checked={!!cookiePolicy?.exceptionAllowed}
                  onChange={(e) => onToggleCookieException?.(e.target.checked)}
                  style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
                />
                <span style={{ fontWeight: 600, fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                  {t('security.cookies.toggle')}
                </span>
              </label>
              <div style={{ opacity: 0.78, fontSize: mode === 'mobile' ? '36px' : '14px', lineHeight: 1.35, marginTop: 6 }}>
                {t('security.cookies.hint')}
              </div>
              <button type="button" onClick={() => onOpenSiteData?.(cookiePolicy?.host)} style={{ ...linkStyle, marginTop: mode === 'mobile' ? 4 : 2 }}>
                {t('security.popup.manageSiteData')}
              </button>
            </div>
          )}

          {securityView === 'trackers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => setSecurityView('root')}
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  gap: 6,
                  alignItems: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--mzr-text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <svg viewBox="0 0 16 16" width={mode === 'mobile' ? 40 : 16}
                  height={mode === 'mobile' ? 40 : 16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m10 13-5-5 5-5" />
                </svg>
                <span style={{ fontSize: mode === 'mobile' ? '40px' : undefined }}>{t('common.back')}</span>
              </button>
              {!trackerStatus?.trackersEnabledGlobal && !trackerStatus?.adsEnabledGlobal && (
                <div style={{ fontSize: mode === 'mobile' ? '40px' : '14px', color: 'var(--mzr-warning)', marginTop: mode === 'mobile' ? 2 : 0 }}>
                  {t('security.trackers.disabledBanner')}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg viewBox="0 0 24 24" width={mode === 'mobile' ? 44 : 18} height={mode === 'mobile' ? 44 : 18} fill="currentColor" aria-hidden="true">
                  <path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h10v2H4z" />
                </svg>
                <div>
                  <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '36px' : '14px' }}>{t('security.trackers.menuTitle')}</div>
                  <div style={{ opacity: 0.8, fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                    {trackerStatus?.siteHost ? t('security.trackers.site', { host: trackerStatus.siteHost }) : '—'}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                <div style={{ fontWeight: 700 }}>{t('security.trackers.mode', { mode: '' })}</div>
                <div>
                  {trackerStatus?.blockingMode === 'strict'
                    ? t('security.trackers.mode.strict')
                    : trackerStatus?.blockingMode === 'basic'
                    ? t('security.trackers.mode.basic')
                    : t('security.trackers.mode.off')}
                </div>
              </div>
              <div style={{ fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                <div style={{ fontWeight: 700 }}>{t('security.trackers.blockedTotal', { count: '' })}</div>
                <div>{t('security.trackers.blockedTotal', { count: trackerStatus?.blockedTotal ?? 0 })}</div>
                <div>{t('security.trackers.blockedAds', { count: trackerStatus?.blockedAds ?? 0 })}</div>
                <div>{t('security.trackers.blockedTrackers', { count: trackerStatus?.blockedTrackers ?? 0 })}</div>
              </div>
              <label
                htmlFor="trackers-exception"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: trackerStatus?.trackersEnabledGlobal ? 'pointer' : 'not-allowed' }}
              >
                <span
                  style={{
                    position: 'relative',
                    width: mode === 'mobile' ? 92 : 38,
                    height: mode === 'mobile' ? 52 : 20,
                    borderRadius: 999,
                    background:
                      trackerStatus?.trackersAllowedForSite && trackerStatus?.trackersEnabledGlobal
                        ? 'var(--mzr-focus-ring)'
                        : 'var(--mzr-border)',
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
                    transition: 'background 160ms ease'
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: mode === 'mobile' ? 6 : 1,
                      left:
                        trackerStatus?.trackersAllowedForSite && trackerStatus?.trackersEnabledGlobal
                          ? mode === 'mobile' ? 44 : 18
                          : mode === 'mobile' ? 4 : 1,
                      width: mode === 'mobile' ? 40 : 18,
                      height: mode === 'mobile' ? 40 : 18,
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                      transition: 'left 160ms ease'
                    }}
                  />
                </span>
                <input
                  id="trackers-exception"
                  type="checkbox"
                  checked={!!trackerStatus?.trackersAllowedForSite}
                  onChange={(e) => onToggleTrackerException?.(e.target.checked)}
                  style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
                  disabled={!trackerStatus?.trackersEnabledGlobal}
                />
                <span style={{ fontWeight: 600, fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                  {t('security.trackers.allowToggle')}
                </span>
              </label>
              <label
                htmlFor="ads-exception"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: trackerStatus?.adsEnabledGlobal ? 'pointer' : 'not-allowed' }}
              >
                <span
                  style={{
                    position: 'relative',
                    width: mode === 'mobile' ? 92 : 38,
                    height: mode === 'mobile' ? 52 : 20,
                    borderRadius: 999,
                    background:
                      trackerStatus?.adsAllowedForSite && trackerStatus?.adsEnabledGlobal
                        ? 'var(--mzr-focus-ring)'
                        : 'var(--mzr-border)',
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
                    transition: 'background 160ms ease'
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: mode === 'mobile' ? 6 : 1,
                      left:
                        trackerStatus?.adsAllowedForSite && trackerStatus?.adsEnabledGlobal
                          ? mode === 'mobile' ? 44 : 18
                          : mode === 'mobile' ? 4 : 1,
                      width: mode === 'mobile' ? 40 : 18,
                      height: mode === 'mobile' ? 40 : 18,
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                      transition: 'left 160ms ease'
                    }}
                  />
                </span>
                <input
                  id="ads-exception"
                  type="checkbox"
                  checked={!!trackerStatus?.adsAllowedForSite}
                  onChange={(e) => onToggleAdsException?.(e.target.checked)}
                  style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
                  disabled={!trackerStatus?.adsEnabledGlobal}
                />
                <span style={{ fontWeight: 600, fontSize: mode === 'mobile' ? '36px' : '14px' }}>
                  {t('security.trackers.allowAdsToggle')}
                </span>
              </label>
              <div style={{ opacity: 0.78, fontSize: mode === 'mobile' ? '36px' : '14px', lineHeight: 1.35, marginTop: 6 }}>
                {t('security.trackers.enableToManage')}
              </div>
              <button
                type="button"
                onClick={() => onOpenTrackersExceptions?.()}
                style={{ ...linkStyle, marginTop: mode === 'mobile' ? 4 : 2 }}
              >
                {t('security.trackers.manageLink')}
              </button>
            </div>
          )}
        </div>
        </>
      )}
    </>
  );
};
