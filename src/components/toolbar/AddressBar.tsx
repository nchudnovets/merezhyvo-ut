import React from 'react';
import type { RefObject, ChangeEvent, PointerEvent, FocusEvent, FormEvent } from 'react';
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
  onOpenTabsPanel
}) => (
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
        style={{ ...toolbarStyles.input, ...(toolbarModeStyles[mode].searchInput ?? {}) }}
      />
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

export default AddressBar;
