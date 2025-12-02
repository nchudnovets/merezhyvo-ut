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
  downloadIndicatorState: 'hidden' | 'active' | 'completed' | 'error';
  onDownloadIndicatorClick: () => void;
  showTabsButton?: boolean;
  inputFocused?: boolean;
  suggestions?: { url: string; title?: string | null; source: 'history' | 'bookmark' }[];
  onSelectSuggestion?: (url: string) => void;
  securityState?: 'ok' | 'warn';
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
  downloadIndicatorState,
  onDownloadIndicatorClick,
  showTabsButton = true,
  inputFocused = false,
  suggestions = [],
  onSelectSuggestion,
  securityState = 'ok'
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
    ...(mode === 'mobile' ? { paddingLeft: 60 } : { paddingLeft: 34 }),
    ...{ WebkitTouchCallout: 'none' }
  };
  const baseInputFont =
    (toolbarModeStyles[mode].searchInput?.fontSize as string | number | undefined) ??
    (mode === 'mobile' ? '36px' : '14px');
  const baseFontSize = typeof baseInputFont === 'number' ? `${baseInputFont}px` : baseInputFont;
  const secondaryFontSize = mode === 'mobile' ? '28px' : '12px';

  const suggestionsStyle: CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    width: '100%',
    backgroundColor: '#0f1729',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    borderRadius: '12px',
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

  const openTabsLabel = t('address.openTabs', { count: tabCount });
  return (
    <form onSubmit={onSubmit} style={toolbarStyles.form}>
      <div style={{ ...toolbarStyles.addressField, position: 'relative' }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: mode === 'mobile' ? 18 : 12,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: securityState === 'ok' ? '#ffffff' : '#ef4444'
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={mode === 'mobile' ? 32 : 18}
            height={mode === 'mobile' ? 32 : 18}
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 11 4.16-.26 8-5.45 8-11V5l-8-3Zm0 2.18 6 2.25v4.71c0 4.18-2.88 8.16-6 8.39-3.12-.23-6-4.21-6-8.39V6.43l6-2.25Zm0 3.07-2.4 2.4a3 3 0 0 0 4.8 0L12 7.25Z" />
          </svg>
        </span>
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
