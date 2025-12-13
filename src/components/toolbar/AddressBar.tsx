import React from 'react';
import type {
  CSSProperties,
  RefObject,
  ChangeEvent,
  PointerEvent,
  MouseEvent,
  FocusEvent,
  FormEvent
} from 'react';
import type { Mode } from '../../types/models';
import { useI18n } from '../../i18n/I18nProvider';
import { toolbarStyles, toolbarModeStyles } from './toolbarStyles';

interface AddressBarProps {
  mode: Mode;
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  tabCount: number;
  tabsReady: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (value: string) => void;
  onPointerDown: (event: PointerEvent<HTMLInputElement>) => void;
  onFocus: (event: FocusEvent<HTMLInputElement>) => void;
  onBlur: (event: FocusEvent<HTMLInputElement>) => void;
  onOpenTabsPanel: () => void;
  onNewTab: () => void;
  downloadIndicatorState: 'hidden' | 'active' | 'completed' | 'error';
  onDownloadIndicatorClick: () => void;
  showTabsButton?: boolean;
  inputFocused?: boolean;
  suggestions?: { url: string; title?: string | null; source: 'history' | 'bookmark' }[];
  onSelectSuggestion?: (url: string) => void;
  securityState?: 'ok' | 'warn' | 'notice';
  securityInfo?: {
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
  securityOpen?: boolean;
  onToggleSecurity?: () => void;
  certExceptionAllowed?: boolean;
  onToggleCertException?: (next: boolean) => void;
  cookiePolicy?: {
    blockThirdParty: boolean;
    exceptionAllowed: boolean;
    host: string | null;
  };
  onToggleCookieException?: (next: boolean) => void;
  onOpenSiteData?: (host?: string | null) => void;
  onOpenPrivacyInfo?: () => void;
}

const AddressBar: React.FC<AddressBarProps> = ({
  mode,
  inputRef,
  value,
  tabCount,
  tabsReady,
  onSubmit,
  onChange,
  onPointerDown,
  onFocus,
  onBlur,
  onOpenTabsPanel,
  onNewTab,
  downloadIndicatorState,
  onDownloadIndicatorClick,
  showTabsButton = true,
  inputFocused = false,
  suggestions = [],
  onSelectSuggestion,
  securityState = 'ok',
  securityInfo = null,
  securityOpen = false,
  onToggleSecurity,
  certExceptionAllowed = false,
  onToggleCertException,
  cookiePolicy,
  onToggleCookieException,
  onOpenSiteData,
  onOpenPrivacyInfo
}) => {
  const { t } = useI18n();
  const pointerDownTsRef = React.useRef<number>(0);
  const showIndicator = downloadIndicatorState !== 'hidden';
  const indicatorSize = mode === 'mobile' ? 55 : 16;
  const paddingRight = showIndicator ? indicatorSize + (mode === 'mobile' ? 30 : 15) : 0;
  const inputStyle: CSSProperties = {
    ...toolbarStyles.input,
    ...(toolbarModeStyles[mode].searchInput ?? {}),
    ...(paddingRight ? { paddingRight } : {}),
    ...(mode === 'mobile' ? { paddingLeft: 80 } : { paddingLeft: 34 }),
    ...{ WebkitTouchCallout: 'none' }
  };
  const baseInputFont =
    (toolbarModeStyles[mode].searchInput?.fontSize as string | number | undefined) ??
    (mode === 'mobile' ? '36px' : '15px');
  const baseFontSize = typeof baseInputFont === 'number' ? `${baseInputFont}px` : baseInputFont;
  const secondaryFontSize = mode === 'mobile' ? '28px' : '14px';

  const suggestionsStyle: CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    width: '100%',
    backgroundColor: '#213e6dff',
    border: '1px solid #3E4D6A',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    padding: 0,
    margin: 0,
    listStyle: 'none',
    overflow: 'hidden',
    zIndex: 50
  };
  const suggestionItemStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: mode === 'mobile' ? 4 : 2,
    padding: '10px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(148,163,184,0.18)',
    background: 'transparent'
  };
  const indicatorLabel =
    downloadIndicatorState === 'completed'
      ? t('address.downloads.complete')
      : downloadIndicatorState === 'error'
      ? t('address.downloads.error')
      : t('address.downloads.inProgress');
  const arrowColor =
    downloadIndicatorState === 'completed'
      ? '#22c55e'
      : downloadIndicatorState === 'error'
      ? '#f97316'
      : '#ffffff';
  const arrowStyle: CSSProperties = {
    width: 0,
    height: 0,
    borderLeft: `${indicatorSize/2}px solid transparent`,
    borderRight: `${indicatorSize/2}px solid transparent`,
    borderTop: `${indicatorSize/2+(mode === 'mobile' ? 10 : 1)}px solid ${arrowColor}`,
    display: 'block',
    ...(downloadIndicatorState === 'active'
      ? { animation: 'download-arrow 0.9s ease-in-out infinite' }
      : {})
  };
  const buttonStyle: CSSProperties = {
    ...toolbarStyles.downloadIndicator,
    width: indicatorSize,
    height: indicatorSize,
    right: mode === 'mobile' ? '20px' : '10px'
  };
  const [securityView, setSecurityView] = React.useState<'root' | 'connection' | 'cookies'>('root');
  React.useEffect(() => {
    if (!securityOpen) {
      setSecurityView('root');
    }
  }, [securityOpen]);
  const securityColor =
    securityState === 'warn'
      ? '#ef4444'
      : securityState === 'notice'
      ? '#fbbf24'
      : '#ffffff';

  const openTabsLabel = t('address.openTabs', { count: tabCount });
  return (
    <form onSubmit={onSubmit} style={toolbarStyles.form}>
      <div style={{ ...toolbarStyles.addressField, position: 'relative' }}>
        <button
          type="button"
          aria-label={t('cert.info.title')}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSecurity?.();
          }}
          style={{
            position: 'absolute',
            left: mode === 'mobile' ? 10 : 12,
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
        {securityOpen && (
          <div
            className="service-scroll"
            style={{
              position: 'absolute',
              top: mode === 'mobile' ? '110%' : '105%',
              left: mode === 'mobile' ? '0' : '0',
              right: mode === 'mobile' ? '-40%' : '50%',
              maxWidth: mode === 'mobile' ? '700px' : '460px',
              minWidth: '360px',
              padding: mode === 'mobile' ? '18px 18px 14px' : '12px 12px 10px',
              borderRadius: '12px',
              background: '#121826',
              border: '1px solid rgba(148,163,184,0.35)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
              color: '#e2e8f0',
              zIndex: 60,
              fontSize: mode === 'mobile' ? '36px' : '14px',
              overflow: 'auto'
            }}
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
                    border: `1px solid ${securityState === 'warn' ? '#ef4444' : 'rgba(148,163,184,0.35)'}`,
                    background: 'rgba(15,23,42,0.6)',
                    color: securityState === 'warn' ? '#ef4444' : '#e2e8f0',
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
                      <div style={{ opacity: 0.8, fontSize: mode === 'mobile' ? '33px' : '13px' }}>
                        {securityState === 'warn' ? t('cert.info.status.problem') : t('cert.info.status.ok')}
                      </div>
                    </div>
                  </div>
                  <svg
                    viewBox="0 0 16 16"
                    width={mode === 'mobile' ? 28 : 14}
                    height={mode === 'mobile' ? 28 : 14}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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
                    border: `1px solid ${cookiePolicy?.exceptionAllowed ? '#fbbf24' : 'rgba(148,163,184,0.35)'}`,
                    background: 'rgba(15,23,42,0.6)',
                    color: cookiePolicy?.exceptionAllowed ? '#fbbf24' : '#e2e8f0',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg
                      viewBox="0 0 24 24"
                      width={mode === 'mobile' ? 48 : 18}
                      height={mode === 'mobile' ? 48 : 18}
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-4-4 4 4 0 0 1-4-4 10 10 0 0 0-2-.06Z" />
                    </svg>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '36px' : '14px' }}>{t('security.popup.cookies')}</div>
                      <div style={{ opacity: 0.8, fontSize: mode === 'mobile' ? '33px' : '13px' }}>
                        {cookiePolicy?.blockThirdParty
                          ? cookiePolicy?.exceptionAllowed
                            ? t('security.cookies.status.allowedException')
                            : t('security.cookies.status.blocked')
                          : t('security.cookies.status.allowedGlobal')}
                      </div>
                    </div>
                  </div>
                  <svg
                    viewBox="0 0 16 16"
                    width={mode === 'mobile' ? 28 : 14}
                    height={mode === 'mobile' ? 28 : 14}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                  <path d="M5.5 3 10 8l-4.5 5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => onOpenPrivacyInfo?.()}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: mode === 'mobile' ? 4 : 2,
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  color: '#93c5fd',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: mode === 'mobile' ? '35px' : '13px'
                }}
              >
                {t('privacyInfo.link')}
              </button>
            </div>
          )}

            {securityView === 'connection' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: mode === 'mobile' ? 18 : 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: mode === 'mobile' ? 20 : 10 }}>
                  <button
                    type="button"
                    onClick={() => setSecurityView('root')}
                    aria-label={t('security.popup.back')}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(148,163,184,0.35)',
                      color: '#e2e8f0',
                      width: mode === 'mobile' ? 52 : 30,
                      height: mode === 'mobile' ? 52 : 30,
                      borderRadius: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      width={mode === 'mobile' ? 24 : 14}
                      height={mode === 'mobile' ? 24 : 14}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10 3.5 5.5 8 10 12.5" />
                    </svg>
                  </button>
                  <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '38px' : '16px' }}>
                    {t('security.popup.connection')}
                  </div>
                </div>
                <div style={{ marginBottom: '4px', color: securityState === 'warn' ? '#fca5a5' : '#a7f3d0' }}>
                  {securityState === 'warn' ? t('cert.info.status.problem') : t('cert.info.status.ok')}
                </div>
                {(securityInfo?.host || securityInfo?.url) && (
                  <div style={{ marginBottom: '6px', lineHeight: 1.3 }}>
                    <div style={{ opacity: 0.8 }}>{t('cert.info.url')}</div>
                    <div style={{ wordBreak: 'break-all' }}>{securityInfo?.url || securityInfo?.host}</div>
                  </div>
                )}
                {securityInfo?.error && (
                  <div style={{ marginBottom: '6px', lineHeight: 1.3 }}>
                    <div style={{ opacity: 0.8 }}>{t('cert.info.error')}</div>
                    <div>{securityInfo.error}</div>
                  </div>
                )}
                {(securityInfo?.issuer || securityInfo?.subject || securityInfo?.fingerprint) && (
                  <div style={{ display: 'grid', rowGap: '4px', lineHeight: 1.4 }}>
                    {securityInfo?.issuer ? (
                      <div><strong>{t('cert.details.issuer')} </strong>{securityInfo.issuer}</div>
                    ) : null}
                    {securityInfo?.subject ? (
                      <div><strong>{t('cert.details.subject')} </strong>{securityInfo.subject}</div>
                    ) : null}
                    {securityInfo?.fingerprint ? (
                      <div><strong>{t('cert.details.fingerprint')} </strong>{securityInfo.fingerprint}</div>
                    ) : null}
                  </div>
                )}
                {securityInfo && securityState === 'warn' ? (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: mode === 'mobile' ? 12 : 8,
                      marginTop: mode === 'mobile' ? 12 : 8,
                      fontSize: mode === 'mobile' ? '30px' : '14px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={certExceptionAllowed}
                      onChange={(e) => onToggleCertException?.(e.target.checked)}
                      style={{ width: mode === 'mobile' ? 28 : 16, height: mode === 'mobile' ? 28 : 16 }}
                    />
                    <span>{t('cert.actions.allowSite')}</span>
                  </label>
                ) : null}
              </div>
            )}

            {securityView === 'cookies' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: mode === 'mobile' ? 18 : 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: mode === 'mobile' ? 20 : 10 }}>
                  <button
                    type="button"
                    onClick={() => setSecurityView('root')}
                    aria-label={t('security.popup.back')}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(148,163,184,0.35)',
                      color: '#e2e8f0',
                      width: mode === 'mobile' ? 52 : 30,
                      height: mode === 'mobile' ? 52 : 30,
                      borderRadius: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      width={mode === 'mobile' ? 24 : 14}
                      height={mode === 'mobile' ? 24 : 14}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10 3.5 5.5 8 10 12.5" />
                    </svg>
                  </button>
                  <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '38px' : '16px' }}>
                    {t('security.popup.cookies')}
                  </div>
                </div>
                <div style={{ marginBottom: '4px' }}>
                  {cookiePolicy?.blockThirdParty
                    ? cookiePolicy.exceptionAllowed
                      ? t('security.cookies.status.allowedException')
                      : t('security.cookies.status.blocked')
                    : t('security.cookies.status.allowedGlobal')}
                </div>
                {cookiePolicy?.blockThirdParty && cookiePolicy?.host ? (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: mode === 'mobile' ? 20 : 10,
                      marginTop: 6
                    }}
                  >
                    <span style={{ position: 'relative', width: mode === 'mobile' ? 74 : 48, height: mode === 'mobile' ? 40 : 22, flexShrink: 0 }}>
                      <input
                        type="checkbox"
                        checked={cookiePolicy.exceptionAllowed}
                        onChange={(e) => onToggleCookieException?.(e.target.checked)}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          margin: 0,
                          opacity: 0,
                          cursor: 'pointer',
                          zIndex: 2
                        }}
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 999,
                          backgroundColor: cookiePolicy.exceptionAllowed ? '#2563ebeb' : 'transparent',
                          border: '1px solid #ACB2B7',
                          transition: 'background-color 160ms ease, border-color 160ms ease'
                        }}
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: mode === 'mobile' ? 4 : 2,
                          left: cookiePolicy.exceptionAllowed ? (mode === 'mobile' ? 36 : 26) : (mode === 'mobile' ? 4 : 2),
                          width: mode === 'mobile' ? 32 : 16,
                          height: mode === 'mobile' ? 32 : 16,
                          borderRadius: '50%',
                          backgroundColor: cookiePolicy.exceptionAllowed ? '#ffffff' : '#ACB2B7',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                          transition: 'left 160ms ease'
                        }}
                      />
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      {t('security.cookies.toggle')}
                    </span>
                  </label>
                ) : null}
                <div style={{ opacity: 0.78, fontSize: mode === 'mobile' ? '32px' : '13px', lineHeight: 1.35 }}>
                  {t('security.cookies.hint')}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenSiteData?.(cookiePolicy?.host ?? null)}
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: mode === 'mobile' ? 10 : 8,
                    padding: 0,
                    background: 'transparent',
                    border: 'none',
                    color: '#93c5fd',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: mode === 'mobile' ? '35px' : '13px'
                  }}
                >
                  {t('siteData.manageLink')}
                </button>
              </div>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          id="address-input"
          type="text"
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          onPointerDown={(event: PointerEvent<HTMLInputElement>) => {
            pointerDownTsRef.current = Date.now();
            onPointerDown(event);
          }}
          onContextMenu={(event: MouseEvent<HTMLInputElement>) => {
            if (mode === 'mobile') {
              const delta = Date.now() - pointerDownTsRef.current;
              if (delta < 500) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
            }
          }}
          onFocus={onFocus}
          onBlur={onBlur}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          placeholder={t('address.placeholder')}
          style={inputStyle}
        />
      {showIndicator && (
          <button
            type="button"
            aria-label={indicatorLabel}
            onClick={onDownloadIndicatorClick}
            style={buttonStyle}
          >
          <span style={arrowStyle} />
        </button>
      )}
        {inputFocused && suggestions.length > 0 && value.trim().length > 0 && (
          <ul style={suggestionsStyle}>
            {suggestions.map((item, idx) => (
              <li
                key={`${item.url}_${idx}`}
                style={{
                  ...suggestionItemStyle,
                  ...(idx === suggestions.length - 1
                    ? { borderBottom: 'none' }
                    : {})
                }}
                onMouseDown={(e: MouseEvent<HTMLLIElement>) => {
                  e.preventDefault();
                  onSelectSuggestion?.(item.url);
                }}
                onPointerDown={(e: PointerEvent<HTMLLIElement>) => {
                  e.preventDefault();
                  onSelectSuggestion?.(item.url);
                }}
              >
                {item.title && item.title.trim().length > 0 ? (
                  <>
                    <span
                      style={{
                        fontSize: baseFontSize,
                        color: '#e2e8f0'
                      }}
                    >
                      {item.title}
                    </span>
                    <span
                      style={{
                        fontSize: secondaryFontSize,
                        color: 'rgba(226,232,240,0.75)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={item.url}
                    >
                      {item.url}
                    </span>
                  </>
                ) : (
                  <span
                    style={{
                      fontSize: baseFontSize,
                      color: '#e2e8f0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={item.url}
                  >
                    {item.url}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {showTabsButton && mode !== 'mobile' && (
        <button
          type="button"
          aria-label={t('tabs.newTab')}
          title={t('tabs.newTab')}
          onClick={onNewTab}
          style={{
            ...toolbarStyles.tabsButton,
            ...(toolbarModeStyles[mode].tabsButton || {}),
            width: 36,
            minWidth: 36,
            height: 36,
            // borderRadius: 12,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            marginRight: 6
          }}
        >
          <svg
            viewBox="0 0 16 16"
            width="68%"
            height="68%"
            aria-hidden="true"
            focusable="false"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 3v10M3 8h10"
            />
          </svg>
        </button>
      )}

      {showTabsButton && (
        <button
          type="button"
          title={openTabsLabel}
          aria-label={openTabsLabel}
          aria-haspopup="dialog"
          onClick={onOpenTabsPanel}
          disabled={!tabsReady}
          style={{
            ...toolbarStyles.tabsButton,
            ...(toolbarModeStyles[mode].tabsButton || {}),
            ...(!tabsReady ? toolbarStyles.tabsButtonDisabled : {})
          }}
        >
          <span style={toolbarStyles.visuallyHidden}>{openTabsLabel}</span>
          <span
            aria-hidden="true"
            style={{
              ...toolbarStyles.tabsButtonSquare,
              ...(toolbarModeStyles[mode].tabsButtonSquare || {})
            }}
          >
            <span
              style={{
                ...toolbarStyles.tabsButtonCount,
                ...(toolbarModeStyles[mode].tabsButtonCount || {})
              }}
            >
              {tabCount}
            </span>
          </span>
        </button>
      )}
    </form>
  );
};

export default AddressBar;
