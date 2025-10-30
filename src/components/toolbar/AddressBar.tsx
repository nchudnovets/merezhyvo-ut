import React, { RefObject, ChangeEvent, PointerEvent, FocusEvent, FormEvent } from 'react';
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
  onShortcutPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onOpenShortcutModal: () => void;
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
  onShortcutPointerDown,
  onOpenShortcutModal,
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
      <button
        type="button"
        className="btn btn--makeapp"
        style={{ ...toolbarStyles.makeAppBtn, ...(toolbarModeStyles[mode].makeAppBtn ?? {}) }}
        onPointerDown={onShortcutPointerDown}
        onClick={onOpenShortcutModal}
        title="Create app shortcut from this site"
        aria-label="Create app shortcut from this site"
      >
        <svg
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
          style={toolbarModeStyles[mode].makeAppBtnIcn}
        >
          <path
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M8 2v6m0 0-2.5-2.5M8 8l2.5-2.5"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M4 9.5h8V13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5"
          />
        </svg>
      </button>
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
