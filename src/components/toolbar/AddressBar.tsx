import React from 'react';
import type {
  CSSProperties,
  RefObject,
  ChangeEvent,
  PointerEvent,
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
  showTabsButton = true
}) => {
  const { t } = useI18n();
  const showIndicator = downloadIndicatorState !== 'hidden';
  const indicatorSize = mode === 'mobile' ? 55 : 16;
  const paddingRight = showIndicator ? indicatorSize + (mode === 'mobile' ? 30 : 15) : 0;
  const inputStyle: CSSProperties = {
    ...toolbarStyles.input,
    ...(toolbarModeStyles[mode].searchInput ?? {}),
    ...(paddingRight ? { paddingRight } : {})
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
      <div style={toolbarStyles.addressField}>
          <input
            ref={inputRef}
            type="text"
            value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          onPointerDown={onPointerDown}
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
