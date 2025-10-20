import React from 'react';
import type { Mode } from '../../types/models';
import { toolbarStyles, toolbarModeStyles } from './toolbarStyles';

interface NavButtonsProps {
  mode: Mode;
  canGoBack: boolean;
  canGoForward: boolean;
  webviewReady: boolean;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
}

const NavButtons: React.FC<NavButtonsProps> = ({
  mode,
  canGoBack,
  canGoForward,
  webviewReady,
  onBack,
  onForward,
  onReload
}) => {
  const modeStyles = toolbarModeStyles[mode];
  return (
    <div style={toolbarStyles.navGroup}>
      <button
        type="button"
        aria-label="Back"
        disabled={!canGoBack}
        onClick={onBack}
      style={{
        ...toolbarStyles.navButton,
        ...(modeStyles.toolbarBtnRegular ?? {}),
        ...(canGoBack ? {} : toolbarStyles.navButtonDisabled)
      }}
      className="btn-regular"
    >
      <svg
        viewBox="0 0 16 16"
        style={{ ...toolbarStyles.navIcon, ...(modeStyles.toolbarBtnIcn ?? {}) }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M13 8H5M8.5 4.5L5 8l3.5 3.5"
        />
      </svg>
    </button>

    <button
      type="button"
      aria-label="Forward"
      disabled={!canGoForward}
      onClick={onForward}
      style={{
        ...toolbarStyles.navButton,
        ...(modeStyles.toolbarBtnRegular ?? {}),
        ...(modeStyles.toolbarBtnDesktopOnly ?? {}),
        ...(canGoForward ? {} : toolbarStyles.navButtonDisabled)
      }}
      className="btn-regular"
    >
      <svg
        viewBox="0 0 16 16"
        style={{ ...toolbarStyles.navIcon, ...(modeStyles.toolbarBtnIcn ?? {}) }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M3 8h8M7.5 4.5L11 8l-3.5 3.5"
        />
      </svg>
    </button>

    <button
      type="button"
      aria-label="Reload"
      onClick={onReload}
      disabled={!webviewReady}
      style={{
        ...toolbarStyles.navButton,
        ...(modeStyles.toolbarBtnRegular ?? {}),
        ...(webviewReady ? {} : toolbarStyles.navButtonDisabled)
      }}
      className="btn-regular"
    >
      <svg
        viewBox="0 0 16 16"
        style={{ ...toolbarStyles.navIcon, ...(modeStyles.toolbarBtnIcn ?? {}) }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M12.5 5.5A4.5 4.5 0 1 0 13 9.5"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M12.5 5.5H9.5M12.5 5.5V8.5"
        />
      </svg>
    </button>
    </div>
  );
};

export default NavButtons;
