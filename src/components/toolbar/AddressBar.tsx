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
  onDownloadIndicatorClick
}) => {
  const showIndicator = downloadIndicatorState !== 'hidden';
  const indicatorSize = mode === 'mobile' ? 55 : 16;
  const inputStyle: CSSProperties = {
    ...toolbarStyles.input,
    ...(toolbarModeStyles[mode].searchInput ?? {}),
    ...(showIndicator ? { paddingRight: indicatorSize + 26 } : {})
  };
  const indicatorLabel =
    downloadIndicatorState === 'completed'
      ? 'Downloads complete'
      : downloadIndicatorState === 'error'
      ? 'Downloads failed'
      : 'Downloads in progress';
  const arrowColor =
    downloadIndicatorState === 'completed'
      ? '#22c55e'
      : downloadIndicatorState === 'error'
      ? '#f97316'
      : '#ffffff';
  const arrowStyle: CSSProperties = {
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: `7px solid ${arrowColor}`,
    display: 'block',
    ...(downloadIndicatorState === 'active'
      ? { animation: 'download-arrow 0.9s ease-in-out infinite' }
      : {})
  };
  const buttonStyle: CSSProperties = {
    ...toolbarStyles.downloadIndicator,
    width: indicatorSize,
    height: indicatorSize
  };

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
          placeholder="Enter a URL or search"
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
      <button
        type="button"
        title="Open tabs"
        aria-label={`Open tabs (${tabCount})`}
        aria-haspopup="dialog"
        onClick={onOpenTabsPanel}
        disabled={!tabsReady}
        style={{
          ...toolbarStyles.tabsButton,
          ...(toolbarModeStyles[mode].tabsButton || {}),
          ...(!tabsReady ? toolbarStyles.tabsButtonDisabled : {})
        }}
      >
        <span style={toolbarStyles.visuallyHidden}>Open tabs ({tabCount})</span>
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
    </form>
  );
};

export default AddressBar;
