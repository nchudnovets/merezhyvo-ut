import React from 'react';
import type { Mode } from '../../types/models';
import { useI18n } from '../../i18n/I18nProvider';
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
  const { t } = useI18n();
  const isMobile = mode === 'mobile';
  return (
    <div style={toolbarStyles.navGroup}>
      {!isMobile && (
        <button
          type="button"
          aria-label={t('nav.back')}
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
      )}

        <button
          type="button"
          aria-label={t('nav.forward')}
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
      {!isMobile && (
        <button
          type="button"
          aria-label={t('nav.reload')}
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
            style={{ ...toolbarStyles.navIcon, ...(modeStyles.toolbarBtnIcn ?? {}), ...{ width: '18px', height: '18px' } }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M234.666667,149.333333 L234.666667,106.666667 L314.564847,106.664112 C287.579138,67.9778918 242.745446,42.6666667 192,42.6666667 C109.525477,42.6666667 42.6666667,109.525477 42.6666667,192 C42.6666667,274.474523 109.525477,341.333333 192,341.333333 C268.201293,341.333333 331.072074,284.258623 340.195444,210.526102 L382.537159,215.817985 C370.807686,310.617565 289.973536,384 192,384 C85.961328,384 0,298.038672 0,192 C0,85.961328 85.961328,0 192,0 C252.316171,0 306.136355,27.8126321 341.335366,71.3127128 L341.333333,0 L384,0 L384,149.333333 L234.666667,149.333333 Z"
              fill="currentColor"
              transform="scale(0.0416667)"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default NavButtons;
