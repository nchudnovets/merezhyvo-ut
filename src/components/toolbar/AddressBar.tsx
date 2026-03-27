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
import { useI18n } from '../../i18n/I18nProvider';
import { toolbarStyles, toolbarModeStyles } from './toolbarStyles';
import { SecurityShield } from './SecurityShield';
import type { DownloadIndicatorModel } from '../../hooks/useDownloadIndicators';

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
  downloadIndicator: DownloadIndicatorModel;
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
  downloadIndicator,
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
  const showIndicator = downloadIndicator.state !== 'hidden';
  const indicatorWidth = mode === 'mobile' ? 220 : 120;
  const indicatorHeight = mode === 'mobile' ? 44 : 22;
  const copyButtonVisible = inputFocused;
  const copyButtonSize = mode === 'mobile' ? 64 : 22;
  const actionGap = mode === 'mobile' ? 16 : 8;
  const paddingRight =
    (copyButtonVisible ? copyButtonSize + actionGap : 0) +
    (showIndicator ? indicatorWidth + actionGap : 0);
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
  const secondaryFontSize = mode === 'mobile' ? '28px' : '14px';

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
    downloadIndicator.state === 'completed'
      ? t('address.downloads.complete')
      : downloadIndicator.state === 'error'
      ? t('address.downloads.error')
      : t('address.downloads.inProgress');
  const indicatorColor =
    downloadIndicator.state === 'completed'
      ? '#22c55e'
      : downloadIndicator.state === 'error'
      ? '#f97316'
      : 'var(--mzr-accent-strong)';
  const progressTrackStyle: CSSProperties = {
    width: mode === 'mobile' ? 96 : 56,
    height: mode === 'mobile' ? 8 : 6,
    borderRadius: 999,
    background: 'rgba(148,163,184,0.28)',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0
  };
  const progressFillStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width:
      downloadIndicator.state === 'active' && !downloadIndicator.indeterminate
        ? `${downloadIndicator.percent ?? 0}%`
        : downloadIndicator.state === 'completed'
        ? '100%'
        : downloadIndicator.state === 'error'
        ? '100%'
        : '40%',
    borderRadius: 'inherit',
    background:
      downloadIndicator.state === 'active' && downloadIndicator.indeterminate
        ? `linear-gradient(90deg, transparent, ${indicatorColor}, transparent)`
        : indicatorColor
  };
  const indicatorText =
    downloadIndicator.state === 'active' && !downloadIndicator.indeterminate
      ? `${downloadIndicator.percent ?? 0}%`
      : downloadIndicator.state === 'active'
      ? '...'
      : downloadIndicator.state === 'error'
      ? `!${downloadIndicator.failedCount > 1 ? ` ${downloadIndicator.failedCount}` : ''}`
      : '100%';
  const buttonStyle: CSSProperties = {
    ...toolbarStyles.downloadIndicator,
    width: indicatorWidth,
    height: indicatorHeight,
    right: copyButtonVisible
      ? `${(mode === 'mobile' ? 16 : 8) + copyButtonSize + actionGap}px`
      : mode === 'mobile'
        ? '20px'
        : '8px',
    border: `1px solid ${downloadIndicator.state === 'error' ? '#f97316' : 'var(--mzr-input-border)'}`,
    borderRadius: 999,
    padding: mode === 'mobile' ? '0 12px' : '0 8px',
    background: 'var(--mzr-surface)',
    color: 'var(--mzr-text-primary)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
    gap: mode === 'mobile' ? 10 : 7,
    justifyContent: 'flex-start'
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
          <button
            type="button"
            aria-label={indicatorLabel}
            title={indicatorLabel}
            onClick={onDownloadIndicatorClick}
            style={buttonStyle}
          >
            <span
              aria-hidden="true"
              style={{
                width: mode === 'mobile' ? 12 : 9,
                height: mode === 'mobile' ? 12 : 9,
                borderRadius: '50%',
                background: indicatorColor,
                boxShadow: `0 0 0 2px ${downloadIndicator.state === 'error' ? 'rgba(249,115,22,0.2)' : 'rgba(59,130,246,0.18)'}`
              }}
            />
            <span style={progressTrackStyle} aria-hidden="true">
              <span style={progressFillStyle} />
            </span>
            <span
              aria-hidden="true"
              style={{
                fontSize: mode === 'mobile' ? 21 : 11,
                fontWeight: 700,
                lineHeight: 1,
                color: downloadIndicator.state === 'error' ? '#f97316' : 'var(--mzr-text-secondary)',
                minWidth: mode === 'mobile' ? 50 : 36,
                textAlign: 'right'
              }}
            >
              {indicatorText}
              {downloadIndicator.state === 'active' && downloadIndicator.activeCount > 1
                ? ` · ${downloadIndicator.activeCount}`
                : ''}
            </span>
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
