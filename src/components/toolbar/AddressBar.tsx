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
import type { Mode, TrackerStatus } from '../../types/models';
import type { DownloadIndicatorProgress } from '../../hooks/useDownloadIndicators';
import { useI18n } from '../../i18n/I18nProvider';
import { toolbarStyles, toolbarModeStyles } from './toolbarStyles';
import { SecurityShield } from './SecurityShield';

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
  downloadIndicatorProgress: DownloadIndicatorProgress;
  onDownloadIndicatorClick: () => void;
  showTabsButton?: boolean;
  inputFocused?: boolean;
  suggestions?: { url: string; title?: string | null; source: 'history' | 'bookmark' }[];
  onSelectSuggestion?: (url: string) => void;
  onCopyUrl?: (value: string) => void;
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
    blockedTotal?: number;
  };
  onToggleCookieException?: (next: boolean) => void;
  onOpenSiteData?: (host?: string | null) => void;
  onOpenSecurityExceptions?: () => void;
  onOpenPrivacyInfo?: () => void;
  trackerStatus?: TrackerStatus;
  onToggleTrackerException?: (next: boolean) => void;
  onToggleAdsException?: (next: boolean) => void;
  onOpenTrackersExceptions?: () => void;
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
  downloadIndicatorProgress,
  onDownloadIndicatorClick,
  showTabsButton = true,
  inputFocused = false,
  suggestions = [],
  onSelectSuggestion,
  onCopyUrl,
  securityState = 'ok',
  securityInfo = null,
  securityOpen = false,
  onToggleSecurity,
  certExceptionAllowed = false,
  onToggleCertException,
  cookiePolicy,
  onToggleCookieException,
  onOpenSiteData,
  onOpenPrivacyInfo,
  onOpenSecurityExceptions,
  trackerStatus,
  onToggleTrackerException,
  onToggleAdsException,
  onOpenTrackersExceptions
}) => {
  const { t } = useI18n();
  const pointerDownTsRef = React.useRef<number>(0);
  const showIndicator = downloadIndicatorState !== 'hidden';
  const indicatorButtonWidth = mode === 'mobile' ? 132 : 64;
  const copyButtonVisible = inputFocused;
  const copyButtonSize = mode === 'mobile' ? 64 : 22;
  const actionGap = mode === 'mobile' ? 16 : 8;
  const paddingRight =
    (copyButtonVisible ? copyButtonSize + actionGap : 0) +
    (showIndicator ? indicatorButtonWidth + actionGap : 0);
  const inputStyle: CSSProperties = {
    ...toolbarStyles.input,
    ...(toolbarModeStyles[mode].searchInput ?? {}),
    ...(paddingRight ? { paddingRight: 26 + paddingRight } : {}),
    ...(mode === 'mobile' ? { paddingLeft: 80 } : { paddingLeft: 34 }),
    ...{ WebkitTouchCallout: 'none' }
  };
  const baseInputFont =
    (toolbarModeStyles[mode].searchInput?.fontSize as string | number | undefined) ??
    (mode === 'mobile' ? '36px' : '15px');
  const baseFontSize = typeof baseInputFont === 'number' ? `${baseInputFont}px` : baseInputFont;
  const secondaryFontSize = mode === 'mobile' ? '36px' : '14px';

  const suggestionsStyle: CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    width: '100%',
    backgroundColor: 'var(--mzr-surface)',
    border: '1px solid var(--mzr-input-border)',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
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
  const barColor =
    downloadIndicatorState === 'completed'
      ? '#22c55e'
      : downloadIndicatorState === 'error'
      ? '#f97316'
      : 'var(--mzr-accent-strong)';
  const progressWidth =
    downloadIndicatorState === 'completed'
      ? 100
      : downloadIndicatorProgress.percent ?? 40;
  const progressLineTrackStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: mode === 'mobile' ? 4 : 2,
    borderRadius: 999,
    background: 'var(--mzr-divider)',
    overflow: 'hidden',
    pointerEvents: 'none'
  };
  const progressLineFillStyle: CSSProperties = {
    display: 'block',
    height: '100%',
    width: `${progressWidth}%`,
    borderRadius: 999,
    background: barColor,
    transition: 'width 0.2s ease',
    ...(downloadIndicatorState === 'active' && downloadIndicatorProgress.indeterminate ? { width: '55%' } : {})
  };
  const progressTextStyle: CSSProperties = {
    minWidth: mode === 'mobile' ? 84 : 36,
    textAlign: 'right',
    color: 'var(--mzr-text-primary)',
    fontWeight: 700,
    fontSize: mode === 'mobile' ? baseFontSize : 11,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums'
  };
  const progressText =
    downloadIndicatorState === 'completed'
      ? '100%'
      : downloadIndicatorState === 'error'
      ? 'ERR'
      : downloadIndicatorProgress.percent != null
      ? `${downloadIndicatorProgress.percent}%`
      : `...`;
  const buttonStyle: CSSProperties = {
    ...toolbarStyles.downloadIndicator,
    width: indicatorButtonWidth,
    height: mode === 'mobile' ? 66 : 26,
    right: copyButtonVisible
      ? `${(mode === 'mobile' ? 16 : 8) + copyButtonSize + actionGap}px`
      : mode === 'mobile'
        ? '20px'
        : '10px',
    border: '1px solid var(--mzr-border-strong)',
    borderRadius: 999,
    background: 'var(--mzr-surface)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
    padding: mode === 'mobile' ? '0 16px' : '0 8px',
    gap: mode === 'mobile' ? 0 : 6
  };
  const copyButtonStyle: CSSProperties = {
    ...toolbarStyles.downloadIndicator,
    width: copyButtonSize,
    height: copyButtonSize,
    right: mode === 'mobile' ? '16px' : '8px',
    color: 'var(--mzr-text-primary)',
    border: '1px solid var(--mzr-border-strong)',
    borderRadius: '999px',
    background: 'var(--mzr-surface)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
  };
  const openTabsLabel = t('address.openTabs', { count: tabCount });
  const handleCopyClick = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (inputRef.current) {
      try {
        inputRef.current.focus({ preventScroll: true });
      } catch {
        // noop
      }
      try {
        inputRef.current.select();
      } catch {
        // noop
      }
    }
    onCopyUrl?.(value);
  };
  return (
    <form onSubmit={onSubmit} style={toolbarStyles.form}>
      <div style={{ ...toolbarStyles.addressField, position: 'relative' }}>
        <SecurityShield
          translate={t}
          mode={mode}
          securityState={securityState}
          securityInfo={securityInfo}
          securityOpen={securityOpen}
          onToggleSecurity={onToggleSecurity}
          certExceptionAllowed={certExceptionAllowed}
          onToggleCertException={onToggleCertException}
          cookiePolicy={cookiePolicy}
          onToggleCookieException={onToggleCookieException}
          onOpenSiteData={onOpenSiteData}
          onOpenPrivacyInfo={onOpenPrivacyInfo}
          onOpenSecurityExceptions={onOpenSecurityExceptions}
          trackerStatus={trackerStatus}
          onToggleTrackerException={onToggleTrackerException}
          onToggleAdsException={onToggleAdsException}
          onOpenTrackersExceptions={onOpenTrackersExceptions}
        />

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
          onFocus={onFocus}
          onBlur={onBlur}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          placeholder={t('address.placeholder')}
          style={inputStyle}
        />
        {copyButtonVisible && (
          <button
            type="button"
            aria-label={t('address.copyUrl')}
            title={t('address.copyUrl')}
            onPointerDown={handleCopyClick}
            onClick={(event) => event.preventDefault()}
            style={copyButtonStyle}
          >
            <svg
              width={mode === 'mobile' ? 55 : 20}
              height={mode === 'mobile' ? 55 : 20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="6.5" y="6.5" width="9" height="13" rx="1.5" />
              <path d="M8.5 6C8.5 5.17157 9.17157 4.5 10 4.5H16C16.8284 4.5 17.5 5.17157 17.5 6V16C17.5 16.8284 16.8284 17.5 16 17.5" />
            </svg>
          </button>
        )}
        {showIndicator && (
          <span style={progressLineTrackStyle} aria-hidden="true">
            <span style={progressLineFillStyle} />
          </span>
        )}
        {showIndicator && (
          <button
            type="button"
            aria-label={`${indicatorLabel}${downloadIndicatorProgress.percent != null ? ` ${downloadIndicatorProgress.percent}%` : ''}`}
            onClick={onDownloadIndicatorClick}
            style={buttonStyle}
          >
            <span style={progressTextStyle}>{progressText}</span>
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
                        color: 'var(--mzr-text-secondary)'
                      }}
                    >
                      {item.title}
                    </span>
                    <span
                      style={{
                        fontSize: secondaryFontSize,
                        color: 'var(--mzr-text-muted)',
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
                      color: 'var(--mzr-text-secondary)',
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
