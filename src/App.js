import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import SoftKeyboard from './components/SoftKeyboard';
import { useMerezhyvoMode } from './hooks/useMerezhyvoMode';
import { useTabsStore, tabsActions, defaultTabUrl } from './store/tabs';

const DEFAULT_URL = defaultTabUrl;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.5;
const ZOOM_STEP = 0.1;
const KB_HEIGHT = 650;
const FOCUS_CONSOLE_ACTIVE = '__MZR_FOCUS_ACTIVE__';
const FOCUS_CONSOLE_INACTIVE = '__MZR_FOCUS_INACTIVE__';
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'range',
  'color',
  'file',
  'image',
  'hidden'
]);

const WEBVIEW_BASE_CSS = `
  :root, html { color-scheme: dark; }
  @media (prefers-color-scheme: light) {
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: #111827; }
  ::-webkit-scrollbar-thumb {
    background: #2563eb;
    border-radius: 999px;
    border: 2px solid #111827;
  }
  ::-webkit-scrollbar-thumb:hover { background: #1d4ed8; }
  input, textarea, [contenteditable='true'] {
    caret-color: #60a5fa !important;
  }
  :root {
    --mzr-caret-accent: #22d3ee;
    --mzr-focus-ring:   #60a5fa;
    --mzr-sel-bg:       rgba(34,211,238,.28);
    --mzr-sel-fg:       #0b1020;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --mzr-caret-accent: #7dd3fc;
      --mzr-sel-bg:       rgba(125,211,252,.3);
      --mzr-sel-fg:       #0a0f1f;
      --mzr-focus-ring:   #93c5fd;
    }
  }
  @media (prefers-color-scheme: light) {
    :root {
      --mzr-caret-accent: #0ea5e9;
      --mzr-sel-bg:       rgba(14,165,233,.25);
      --mzr-sel-fg:       #0b1020;
      --mzr-focus-ring:   #3b82f6;
    }
  }
  input[type="text"],
  input[type="search"],
  input[type="url"],
  input[type="email"],
  input[type="tel"],
  input[type="password"],
  textarea,
  [contenteditable=""],
  [contenteditable="true"] {
    caret-color: var(--mzr-caret-accent) !important;
  }

  ::selection {
    background: var(--mzr-sel-bg) !important;
    color: var(--mzr-sel-fg) !important;
  }
  ::-moz-selection {
    background: var(--mzr-sel-bg) !important;
    color: var(--mzr-sel-fg) !important;
  }

  input[type="text"]:focus-visible,
  input[type="search"]:focus-visible,
  input[type="url"]:focus-visible,
  input[type="email"]:focus-visible,
  input[type="tel"]:focus-visible,
  input[type="password"]:focus-visible,
  textarea:focus-visible,
  [contenteditable=""]:focus-visible,
  [contenteditable="true"]:focus-visible {
    outline: 2px solid var(--mzr-focus-ring) !important;
    outline-offset: 2px !important;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--mzr-focus-ring) 35%, transparent) !important;
  }
`;

const styles = {
  container: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    boxSizing: 'border-box',
    minHeight: 0,
    backgroundColor: '#0f111a',
    color: '#f8fafc',
    overflow: 'hidden'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 16px',
    backgroundColor: '#121826',
    boxShadow: '0 1px 6px rgba(0, 0, 0, 0.35)',
    position: 'relative',
    zIndex: 10
  },
  navGroup: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  navButton: {
    width: '42px',
    height: '42px',
    borderRadius: '14px',
    border: 'none',
    backgroundColor: '#1c2333',
    color: '#f8fafc',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  navIcon: { display: 'block' },
  navButtonDisabled: { opacity: 0.35 },
  form: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
    margin: 0
  },
  addressField: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flex: 1
  },
  input: {
    flex: 1,
    width: '100%',
    height: '36px',
    borderRadius: '16px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#0f1729',
    color: '#f8fafc',
    padding: '0 56px 0 14px',
    outline: 'none'
  },
  makeAppBtn: {
    position: 'absolute',
    top: '50%',
    right: '12px',
    transform: 'translateY(-50%)',
    width: '36px',
    height: '26px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    background: 'transparent',
    border: '1px solid rgba(37, 99, 235, 0.7)',
    borderRadius: '12px',
    color: '#93c5fd',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
    boxShadow: '0 0 0 rgba(37, 99, 235, 0.1)'
  },
  statusIndicator: {
    minWidth: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  statusSvg: { display: 'block' },
  statusIconReady: { color: '#22c55e' },
  statusIconError: { color: '#ef4444' },
  tabsButton: {
    position: 'relative',
    width: '42px',
    height: '42px',
    borderRadius: '14px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#1c2333',
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
  },
  tabsButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed'
  },
  tabsButtonSquare: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '8px',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    color: '#f8fafc',
    boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.18)',
    flexShrink: 0
  },
  tabsButtonCount: {
    fontSize: '12px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    textAlign: 'center'
  },
  settingsButton: {
    height: '42px',
    width: '42px',
    borderRadius: '14px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#1c2333',
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
  },
  settingsButtonIcon: {
    width: '18px',
    height: '18px',
    display: 'block'
  },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    border: 0
  },
  spinner: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid rgba(148, 163, 184, 0.45)',
    borderTopColor: '#2563eb',
    animation: 'app-spin 0.75s linear infinite'
  },
  webview: {
    display: 'block',
    width: '100%',
    height: '100%',
    flex: 1,
    minHeight: 0,
    border: 'none',
    backgroundColor: '#05070f',
    touchAction: 'pan-x pan-y pinch-zoom'
  },
  webviewMount: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden'
  },
  backgroundShelf: {
    position: 'absolute',
    width: 1,
    height: 1,
    left: -10000,
    top: -10000,
    overflow: 'hidden',
    pointerEvents: 'none'
  },
  bottomToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '6px 50px',
    backgroundColor: '#121826',
    borderTop: '1px solid rgba(148, 163, 184, 0.18)',
    position: 'relative',
    zIndex: 5,
    flexShrink: 0
  },
  zoomLabel: {
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: '#94a3b8'
  },
  zoomSliderContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center'
  },
  zoomSlider: {
    flex: 1,
    minWidth: 0,
    touchAction: 'none'
  },
  zoomValue: {
    color: '#f8fafc',
    fontVariantNumeric: 'tabular-nums'
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(5, 7, 15, 0.76)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 200
  },
  tabsPanelBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(4, 7, 17, 0.82)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 160
  },
  tabsPanel: {
    width: 'min(480px, 94vw)',
    maxHeight: 'min(560px, 86vh)',
    borderRadius: '24px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    boxShadow: '0 24px 60px rgba(2, 6, 23, 0.55)',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '16px',
    overflow: 'hidden'
  },
  tabsPanelMobile: {
    width: '100%',
    height: '100vh',
    minHeight: '100vh',
    borderRadius: 0,
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    boxShadow: '0 -12px 50px rgba(2, 6, 23, 0.65)',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    padding: 'calc(2vh) calc(4vw)',
    gap: 'calc(2vh)',
    boxSizing: 'border-box'
  },
  tabsPanelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px'
  },
  tabsPanelTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600
  },
  tabsPanelBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
    paddingRight: '4px'
  },
  tabsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  tabsSectionTitle: {
    margin: 0,
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#94a3b8'
  },
  tabsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  tabRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    borderRadius: '14px',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
  },
  tabRowActive: {
    borderColor: 'rgba(59, 130, 246, 0.65)',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.25)'
  },
  tabInfo: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0
  },
  tabFaviconWrap: {
    width: '20px',
    height: '20px',
    borderRadius: '6px',
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0
  },
  tabFavicon: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  tabFaviconFallback: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: 600
  },
  tabTexts: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0
  },
  tabTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f8fafc',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  tabSubtitle: {
    fontSize: '12px',
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  tabActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  tabIconButton: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(15, 23, 42, 0.65)',
    color: '#cbd5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  tabIconButtonActive: {
    borderColor: 'rgba(59, 130, 246, 0.7)',
    background: 'rgba(37, 99, 235, 0.22)',
    color: '#e0f2fe'
  },
  tabIcon: {
    width: '16px',
    height: '16px'
  },
  newTabButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    height: '38px',
    borderRadius: '14px',
    border: '1px solid rgba(59, 130, 246, 0.45)',
    background: 'rgba(37, 99, 235, 0.15)',
    color: '#f8fafc',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  newTabButtonMobile: {
    height: 'clamp(105px, 13.5vh, 144px)',
    borderRadius: '24px',
    border: '1px solid rgba(59, 130, 246, 0.45)',
    background: 'rgba(37, 99, 235, 0.22)',
    color: '#f8fafc',
    fontSize: 'clamp(39px, 5.7vw, 51px)',
    fontWeight: 600,
    cursor: 'pointer'
  },
  modal: {
    width: 'min(420px, 92vw)',
    borderRadius: '20px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    boxShadow: '0 24px 60px rgba(2, 6, 23, 0.55)',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '20px'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px'
  },
  modalTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600
  },
  modalBody: {
    fontSize: '16px',
    color: '#cbd5f5',
    lineHeight: 1.5,
    margin: '8px 0'
  },
  modalClose: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'transparent',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  modalField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  modalLabel: {
    fontSize: '14px',
    color: '#cbd5f5'
  },
  modalInput: {
    height: '44px',
    borderRadius: '14px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#0f1729',
    color: '#f8fafc',
    padding: '0 14px',
    fontSize: '16px',
    outline: 'none'
  },
  modalMsg: {
    fontSize: '13px',
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
    borderRadius: '14px',
    border: '1px solid rgba(59, 130, 246, 0.45)',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    color: '#bfdbfe',
    padding: '12px 14px'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  modalButton: {
    minWidth: '120px',
    height: '42px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(15, 23, 42, 0.65)',
    color: '#e2e8f0',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  modalButtonPrimary: {
    border: 'none',
    background: 'rgba(37, 99, 235, 0.92)',
    color: '#f8fafc'
  },
  modalButtonDisabled: {
    opacity: 0.6,
    cursor: 'wait'
  },
  modalMobile: {
    width: '100%',
    height: 'min(92vh, 700px)',
    minHeight: '45vh',
    borderRadius: '28px 28px 0 0',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    boxShadow: '0 -12px 50px rgba(2, 6, 23, 0.65)',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    padding: 'calc(2vh) calc(4vw)',
    gap: 'calc(1vh)',
    boxSizing: 'border-box',
    marginTop: 'clamp(14px, 4vh, 28px)'
  },
  modalHeaderMobile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'calc(3vw)'
  },
  modalBodyMobile: {
    fontSize: 'clamp(33px, 5.1vw, 48px)',
    color: '#dbeafe',
    lineHeight: 1.2,
    margin: 'clamp(10px, 2vh, 24px) 0'
  },
  modalTitleMobile: {
    margin: 0,
    fontSize: 'clamp(42px, 6.75vw, 66px)',
    fontWeight: 600
  },
  modalCloseMobile: {
    width: 'clamp(56px, 8vw, 80px)',
    height: 'clamp(56px, 8vw, 80px)',
    borderRadius: '16px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'transparent',
    color: '#cbd5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'clamp(33px, 5vw, 44px)',
    cursor: 'pointer'
  },
  modalFormMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(24px, 4.5vh, 60px)'
  },
  modalFieldMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(18px, 3vh, 36px)'
  },
  modalLabelMobile: {
    fontSize: 'clamp(36px, 5.4vw, 51px)',
    color: '#e2e8f0'
  },
  modalInputMobile: {
    // height: 'clamp(105px, 13.5vh, 144px)',
    borderRadius: '24px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(9, 12, 22, 0.92)',
    color: '#f8fafc',
    padding: '10 clamp(27px, 6vw, 48px)',
    fontSize: 'clamp(42px, 6vw, 54px)',
    outline: 'none'
  },
  modalMsgMobile: {
    fontSize: 'clamp(33px, 4.95vw, 45px)',
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
    borderRadius: '24px',
    border: '1px solid rgba(59, 130, 246, 0.45)',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    color: '#bfdbfe',
    padding: 'clamp(24px, 4.8vw, 42px) clamp(30px, 6vw, 54px)'
  },
  modalActionsMobile: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 'clamp(24px, 6vw, 54px)'
  },
  modalButtonMobile: {
    minWidth: 'clamp(210px, 37.5vw, 330px)',
    height: 'clamp(105px, 13.5vh, 144px)',
    borderRadius: '24px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(15, 23, 42, 0.75)',
    color: '#e2e8f0',
    fontSize: 'clamp(39px, 5.7vw, 51px)',
    fontWeight: 600,
    cursor: 'pointer'
  },
  modalButtonPrimaryMobile: {
    border: 'none',
    background: 'rgba(37, 99, 235, 0.92)',
    color: '#f8fafc'
  },
  modalButtonDisabledMobile: {
    opacity: 0.6,
    cursor: 'wait'
  },
  settingsModal: {
    width: 'min(520px, 96vw)',
    height: '100vh',
    borderRadius: '24px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    boxShadow: '0 24px 60px rgba(2, 6, 23, 0.55)',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '24px'
  },
  settingsModalMobile: {
    width: '100%',
    height: '100vh',
    borderRadius: 0,
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    boxShadow: '0 -12px 50px rgba(2, 6, 23, 0.65)',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    padding: 'clamp(36px, 5vw, 48px)',
    gap: 'clamp(30px, 4vw, 42px)'
  },
  settingsModalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px'
  },
  settingsModalTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600
  },
  settingsSections: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    flex: 1
  },
  settingsBlock: {
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: '18px',
    backgroundColor: 'rgba(17, 24, 39, 0.62)',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  settingsBlockHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px'
  },
  settingsBlockTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#94a3b8'
  },
  settingsLoading: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  settingsBlockBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  settingsAppList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  settingsAppRow: {
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: '14px',
    backgroundColor: 'rgba(9, 12, 22, 0.9)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  settingsAppHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px'
  },
  settingsAppInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0
  },
  settingsAppTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#f8fafc',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  settingsAppUrl: {
    fontSize: '13px',
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  settingsAppActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  settingsIconButton: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    border: '1px solid rgba(248, 113, 113, 0.35)',
    background: 'rgba(248, 113, 113, 0.12)',
    color: '#f87171',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0
  },
  settingsIcon: {
    width: '16px',
    height: '16px'
  },
  settingsEmpty: {
    margin: 0,
    fontSize: '13px',
    color: '#94a3b8'
  },
  settingsMessage: {
    borderRadius: '14px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    color: '#bfdbfe',
    padding: '12px 16px',
    fontSize: '13px'
  },
  settingsConfirm: {
    borderTop: '1px solid rgba(148, 163, 184, 0.18)',
    paddingTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  settingsConfirmText: {
    margin: 0,
    fontSize: '13px',
    color: '#e2e8f0',
    lineHeight: 1.45
  },
  settingsConfirmActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end'
  },
  settingsConfirmButton: {
    minWidth: '92px',
    height: '34px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(15, 23, 42, 0.75)',
    color: '#e2e8f0',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  settingsConfirmButtonPrimary: {
    border: 'none',
    background: 'rgba(248, 113, 113, 0.92)',
    color: '#fef2f2'
  }
};

const modeStyles = {
  desktop: {
    toolbarBtnRegular: { width: '40px', height: '40px' },
    toolbarBtnIcn: { width: '18px', height: '18px' },
    toolbarBtnDesktopOnly: {},
    searchInput: { fontSize: '14px', height: '36px', paddingRight: '56px' },
    makeAppBtn: { width: '36px', height: '26px' },
    makeAppBtnIcn: { width: '16px', height: '16px' },
    statusIcon: { width: '14px', height: '14px' },
    zoomLabel: { fontSize: '12px' },
    zoomSlider: { height: '4px' },
    zoomValue: { fontSize: '12px', minWidth: '48px', textAlign: 'right' },
    tabsButton: {},
    tabsButtonSquare: {},
    tabsButtonCount: {},
    tabRow: {},
    tabTitle: {},
    tabSubtitle: {},
    tabFaviconWrap: {},
    tabFaviconFallback: {},
    tabIconButton: {},
    tabIcon: {},
    tabActions: {},
    newTabButton: {},
    settingsButton: {},
    settingsButtonIcon: {},
    settingsModalTitle: {},
    settingsBlock: {},
    settingsBlockTitle: {},
    settingsAppRow: {},
    settingsAppHeader: {},
    settingsAppActions: {},
    settingsAppTitle: {},
    settingsAppUrl: {},
    settingsMessage: {},
    settingsConfirmText: {},
    settingsConfirmButton: {},
    settingsIconButton: {},
    settingsIcon: {},
    settingsLoading: {}
  },
  mobile: {
    toolbarBtnRegular: {
      width: 'clamp(72px, 10vw, 96px)',
      height: 'clamp(72px, 10vw, 96px)'
    },
    toolbarBtnIcn: {
      width: 'clamp(36px, 5vw, 48px)',
      height: 'clamp(36px, 5vw, 48px)'
    },
    toolbarBtnDesktopOnly: { display: 'none' },
    searchInput: {
      fontSize: '36px',
      height: 'clamp(72px, 10vw, 96px)',
      paddingRight: 'clamp(120px, 16vw, 144px)'
    },
    makeAppBtn: {
      width: 'clamp(60px, 9vw, 84px)',
      height: 'clamp(60px, 9vw, 84px)'
    },
    makeAppBtnIcn: {
      width: 'clamp(32px, 5vw, 42px)',
      height: 'clamp(32px, 5vw, 42px)'
    },
    statusIcon: {
      width: 'clamp(22px, 3.5vw, 28px)',
      height: 'clamp(22px, 3.5vw, 28px)'
    },
    zoomLabel: { fontSize: 'clamp(24px, 3.3vw, 28px)' },
    zoomSlider: { height: 'clamp(14px, 2.2vw, 20px)' },
    zoomValue: {
      minWidth: 'clamp(80px, 12vw, 108px)',
      textAlign: 'right',
      fontSize: 'clamp(24px, 3.3vw, 28px)'
    },
    tabsButton: {
      width: 'clamp(72px, 10vw, 96px)',
      height: 'clamp(72px, 10vw, 96px)',
      borderRadius: '24px'
    },
    tabsButtonSquare: {
      width: 'clamp(44px, 6.5vw, 60px)',
      height: 'clamp(44px, 6.5vw, 60px)',
      borderRadius: '16px',
      border: '2px solid rgba(148, 163, 184, 0.55)'
    },
    tabsButtonCount: {
      fontSize: 'clamp(30px, 4.8vw, 38px)'
    },
    settingsButton: {
      height: 'clamp(72px, 10vw, 96px)',
      width: 'clamp(72px, 10vw, 96px)',
      borderRadius: '24px',
      fontSize: 'clamp(30px, 4.8vw, 38px)'
    },
    settingsButtonIcon: {
      width: 'clamp(36px, 5vw, 48px)',
      height: 'clamp(36px, 5vw, 48px)'
    },
    settingsModalTitle: {
      fontSize: 'clamp(54px, 7vw, 66px)'
    },
    settingsBlock: {
      borderRadius: '30px',
      padding: 'clamp(36px, 5vw, 48px)',
      gap: 'clamp(30px, 4.8vw, 36px)'
    },
    settingsBlockTitle: {
      fontSize: 'clamp(30px, 4.5vw, 36px)',
      letterSpacing: '0.12em'
    },
    settingsAppRow: {
      gap: 'clamp(30px, 4.5vw, 42px)',
      padding: 'clamp(42px, 5.5vw, 54px)',
      borderRadius: '32px'
    },
    settingsAppHeader: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 'clamp(30px, 4.5vw, 42px)'
    },
    settingsAppActions: {
      justifyContent: 'flex-end'
    },
    settingsLoading: {
      fontSize: 'clamp(27px, 4vw, 33px)'
    },
    settingsAppTitle: {
      fontSize: 'clamp(39px, 5.7vw, 51px)'
    },
    settingsAppUrl: {
      fontSize: 'clamp(30px, 4.8vw, 36px)'
    },
    settingsIconButton: {
      width: 'clamp(72px, 10vw, 96px)',
      height: 'clamp(72px, 10vw, 96px)',
      borderRadius: '24px'
    },
    settingsIcon: {
      width: 'clamp(36px, 5vw, 48px)',
      height: 'clamp(36px, 5vw, 48px)'
    },
    settingsMessage: {
      fontSize: 'clamp(30px, 4.8vw, 36px)',
      padding: 'clamp(30px, 4.5vw, 42px)',
      borderRadius: '30px'
    },
    settingsConfirmText: {
      fontSize: 'clamp(33px, 5vw, 45px)'
    },
    settingsConfirmButton: {
      minWidth: 'clamp(210px, 34vw, 280px)',
      height: 'clamp(72px, 10vw, 96px)',
      borderRadius: '24px',
      fontSize: 'clamp(30px, 4.8vw, 36px)'
    },
    tabsPanelTitle: {
      fontSize: 'clamp(54px, 7vw, 66px)'
    },
    tabsPanelBody: {
      gap: 'clamp(24px, 4vh, 36px)'
    },
    tabsSectionTitle: {
      fontSize: 'clamp(30px, 4.5vw, 39px)'
    },
    tabRow: {
      padding: 'clamp(30px, 5vw, 48px)',
      borderRadius: '28px'
    },
    tabFaviconWrap: {
      width: 'clamp(66px, 10vw, 84px)',
      height: 'clamp(66px, 10vw, 84px)',
      borderRadius: '20px'
    },
    tabFaviconFallback: {
      fontSize: 'clamp(27px, 4vw, 36px)'
    },
    tabTitle: {
      fontSize: 'clamp(42px, 6vw, 54px)'
    },
    tabSubtitle: {
      fontSize: 'clamp(30px, 4.8vw, 42px)'
    },
    tabIconButton: {
      width: 'clamp(96px, 14vw, 120px)',
      height: 'clamp(96px, 14vw, 120px)',
      borderRadius: '24px'
    },
    tabIcon: {
      width: 'clamp(42px, 6vw, 54px)',
      height: 'clamp(42px, 6vw, 54px)'
    },
    tabActions: {
      gap: 'clamp(30px, 5vw, 45px)'
    },
    newTabButton: {
      height: 'clamp(120px, 14vh, 168px)',
      borderRadius: '32px',
      fontSize: 'clamp(42px, 6vw, 54px)'
    }
  }
};

const parseStartUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('start');
    const singleParam = params.get('single');

    let url = DEFAULT_URL;
    let hasStartParam = false;
    if (raw) {
      try {
        url = decodeURIComponent(raw);
      } catch {
        url = raw;
      }
      hasStartParam = true;
    }

    const single = typeof singleParam === 'string'
      ? singleParam === '' || singleParam === '1' || singleParam.toLowerCase() === 'true'
      : false;

    return { url, hasStartParam, single };
  } catch {
    return { url: DEFAULT_URL, hasStartParam: false, single: false };
  }
};

const normalizeAddress = (value) => {
  if (!value || !value.trim()) return DEFAULT_URL;
  const trimmed = value.trim();

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed; // already includes a scheme
  if (trimmed.includes(' ')) return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  if (!trimmed.includes('.') && trimmed.toLowerCase() !== 'localhost') {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
  try {
    const candidate = new URL(`https://${trimmed}`);
    return candidate.href;
  } catch {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
};

const normalizeShortcutUrl = (value) => {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return null;
    }
    const lowerHref = parsed.href.toLowerCase();
    if (lowerHref === 'https://mail.google.com' || lowerHref.startsWith('https://mail.google.com/')) {
      return 'https://mail.google.com';
    }
    return parsed.href;
  } catch {
    return null;
  }
};

const App = () => {
  const { url: parsedStartUrl, hasStartParam, single: isSingleWindow } = useMemo(() => parseStartUrl(), []);
  const initialUrl = useMemo(() => normalizeAddress(parsedStartUrl), [parsedStartUrl]);
  const mode = useMerezhyvoMode();

  if (isSingleWindow) {
    return (
      <SingleWindowApp initialUrl={initialUrl} mode={mode} />
    );
  }

  const webviewRef = useRef(null);
  const inputRef = useRef(null);
  const modalTitleInputRef = useRef(null);
  const modalUrlInputRef = useRef(null);
  const activeInputRef = useRef(null);
  const webviewReadyRef = useRef(false);

  const { ready: tabsReady, tabs, activeId, activeTab } = useTabsStore();
  const tabCount = tabs.length;

  const [inputValue, setInputValue] = useState(initialUrl);
  const [isEditing, setIsEditing] = useState(false);
  const isEditingRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [status, setStatus] = useState('loading');
  const [webviewReady, setWebviewReady] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [shortcutUrl, setShortcutUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showTabsPanel, setShowTabsPanel] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [installedApps, setInstalledApps] = useState([]);
  const [installedAppsLoading, setInstalledAppsLoading] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [shortcutCompleted, setShortcutCompleted] = useState(false);
  const [shortcutSuccessMsg, setShortcutSuccessMsg] = useState('');

  // --- Soft keyboard state ---
  const [kbVisible, setKbVisible] = useState(false);
  const [kbLayout, setKbLayout] = useState(() => {
    try { return localStorage.getItem('mzr.kbLayout') || 'en'; } catch { return 'en'; }
  });
  const [kbShift, setKbShift] = useState(false);
  const [kbCaps, setKbCaps] = useState(false);

  const loadInstalledApps = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) {
      setSettingsMsg('');
      setPendingRemoval(null);
    }
    setInstalledAppsLoading(true);
    try {
      const result = await window.merezhyvo?.settings?.installedApps?.list?.();
      if (result?.ok && Array.isArray(result.installedApps)) {
        setInstalledApps(result.installedApps);
      } else if (!quiet) {
        setSettingsMsg(result?.error || 'Failed to load installed apps.');
      }
      return result;
    } catch (err) {
      if (!quiet) {
        setSettingsMsg(String(err));
      }
      return null;
    } finally {
      setInstalledAppsLoading(false);
    }
  }, []);

  const installedAppsList = useMemo(() => {
    const list = Array.isArray(installedApps) ? [...installedApps] : [];
    list.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
    return list;
  }, [installedApps]);

  const tabsReadyRef = useRef(tabsReady);
  const tabsRef = useRef(tabs);
  const previousActiveTabRef = useRef(activeTab);
  const webviewHostRef = useRef(null);
  const backgroundHostRef = useRef(null);
  const tabViewsRef = useRef(new Map());
  const backgroundTabRef = useRef(null);
  const [isHtmlFullscreen, setIsHtmlFullscreen] = useState(false);
  const fullscreenTabRef = useRef(null);
  const powerBlockerIdRef = useRef(null);
  const playingTabsRef = useRef(new Set());

  const startUrlAppliedRef = useRef(false);
  const activeIdRef = useRef(activeId);
  const activeTabRef = useRef(activeTab);
  const lastLoadedRef = useRef({ id: null, url: null });

  const pinnedTabs = useMemo(() => tabs.filter((tab) => tab.pinned), [tabs]);
  const regularTabs = useMemo(() => tabs.filter((tab) => !tab.pinned), [tabs]);
  const activeUrl = (activeTab?.url && activeTab.url.trim()) ? activeTab.url : DEFAULT_URL;

  const {
    newTab: newTabAction,
    closeTab: closeTabAction,
    activateTab: activateTabAction,
    pinTab: pinTabAction,
    navigateActive: navigateActiveAction,
    reloadActive: reloadActiveAction,
    updateMeta: updateMetaAction
  } = tabsActions;

  useEffect(() => {
    try { window.merezhyvo?.notifyTabsReady?.(); } catch {}
  }, []);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { tabsReadyRef.current = tabsReady; }, [tabsReady]);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  useEffect(() => { previousActiveTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => {
    if (fullscreenTabRef.current && fullscreenTabRef.current !== activeId) {
      fullscreenTabRef.current = null;
      setIsHtmlFullscreen(false);
    }
  }, [activeId]);
  useEffect(() => {
    loadInstalledApps({ quiet: true });
  }, [loadInstalledApps]);
  useEffect(() => {
    const styleId = 'mzr-modal-scroll-style';
    if (document.getElementById(styleId)) return undefined;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .tabs-modal-body::-webkit-scrollbar { width: 8px; height: 8px; }
      .tabs-modal-body::-webkit-scrollbar-track { background: #111827; }
      .tabs-modal-body::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(59,130,246,0.85), rgba(79,70,229,0.8));
        border-radius: 6px;
        border: 1px solid rgba(15, 23, 42, 0.6);
      }
      .tabs-modal-body::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,0.95); }
      .tabs-modal-body { scrollbar-color: rgba(59,130,246,0.85) #111827; scrollbar-width: thin; }
    `;
    document.head.appendChild(style);
    return () => {
      try {
        if (style.parentNode) style.parentNode.removeChild(style);
      } catch {}
    };
  }, []);

  const [torEnabled, setTorEnabled] = useState(false);
  const [torReason, setTorReason] = useState(null);

  const getActiveWebview = useCallback(() => webviewRef.current, []);

  const startPowerBlocker = useCallback(async () => {
    if (powerBlockerIdRef.current != null) return powerBlockerIdRef.current;
    try {
      const startFn = window.merezhyvo?.power?.start;
      if (!startFn) return null;
      const id = await startFn();
      if (typeof id === 'number') {
        powerBlockerIdRef.current = id;
        return id;
      }
    } catch (err) {
      console.error('[Merezhyvo] power blocker start failed', err);
    }
    return null;
  }, []);

  const stopPowerBlocker = useCallback(async () => {
    const id = powerBlockerIdRef.current;
    if (id == null) return;
    try {
      const stopFn = window.merezhyvo?.power?.stop;
      if (stopFn) {
        await stopFn(id);
      }
    } catch (err) {
      console.error('[Merezhyvo] power blocker stop failed', err);
    }
    powerBlockerIdRef.current = null;
  }, []);

  const findTabById = useCallback((id) => {
    if (!id) return null;
    return tabsRef.current.find((tab) => tab.id === id) || null;
  }, []);

  const mountInActiveHost = useCallback((view) => {
    const host = webviewHostRef.current;
    if (!host || !view) return;
    for (const child of Array.from(host.children)) {
      if (child !== view) {
        try { host.removeChild(child); } catch {}
      }
    }
    if (view.parentElement !== host) {
      try { host.appendChild(view); } catch {}
    }
  }, []);

  const mountInBackgroundHost = useCallback((view) => {
    const host = backgroundHostRef.current;
    if (!host || !view) return;
    for (const child of Array.from(host.children)) {
      if (child !== view) {
        try { host.removeChild(child); } catch {}
      }
    }
    if (view.parentElement !== host) {
      try { host.appendChild(view); } catch {}
    }
  }, []);

  const applyActiveStyles = useCallback((view) => {
    if (!view) return;
    mountInActiveHost(view);
    Object.assign(view.style, {
      display: 'block',
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      opacity: '1',
      pointerEvents: 'auto'
    });
  }, [mountInActiveHost]);

  const updatePowerBlocker = useCallback(() => {
    if (playingTabsRef.current.size > 0) {
      void startPowerBlocker();
    } else {
      void stopPowerBlocker();
    }
  }, [startPowerBlocker, stopPowerBlocker]);

  const destroyTabView = useCallback((tabId, { keepMeta = false } = {}) => {
    const entry = tabViewsRef.current.get(tabId);
    if (!entry) return;
    try {
      entry.cleanup?.();
    } catch {}
    try {
      entry.view?.remove?.();
    } catch {}
    if (webviewRef.current === entry.view) {
      webviewRef.current = null;
    }
    tabViewsRef.current.delete(tabId);
    playingTabsRef.current.delete(tabId);
    updatePowerBlocker();
    if (!keepMeta) {
      updateMetaAction(tabId, { isPlaying: false, discarded: true });
    }
    if (backgroundTabRef.current === tabId) {
      backgroundTabRef.current = null;
    }
    if (fullscreenTabRef.current === tabId) {
      fullscreenTabRef.current = null;
      setIsHtmlFullscreen(false);
    }
  }, [updateMetaAction, updatePowerBlocker]);

  const installShadowStyles = useCallback((view) => {
    if (!view) return () => {};

    const applyShadowStyles = () => {
      try {
        const root = view.shadowRoot;
        if (!root) return;
        if (!root.querySelector('#mzr-webview-host-style')) {
          const style = document.createElement('style');
          style.id = 'mzr-webview-host-style';
          style.textContent = `
            :host { display: flex !important; height: 100% !important; }
            iframe { flex: 1 1 auto !important; width: 100% !important; height: 100% !important; min-height: 100% !important; }
          `;
          root.appendChild(style);
        }
      } catch {}
    };

    applyShadowStyles();
    view.addEventListener('dom-ready', applyShadowStyles);

    const observer = new MutationObserver(applyShadowStyles);
    if (view.shadowRoot) {
      try {
        observer.observe(view.shadowRoot, { childList: true, subtree: true });
      } catch {}
    }

    return () => {
      view.removeEventListener('dom-ready', applyShadowStyles);
      observer.disconnect();
    };
  }, []);

  const refreshNavigationState = useCallback(() => {
    const view = webviewRef.current;
    if (!view) {
      setCanGoBack(false);
      setCanGoForward(false);
      return;
    }
    try {
      setCanGoBack(view.canGoBack());
      setCanGoForward(view.canGoForward());
    } catch {
      setCanGoBack(false);
      setCanGoForward(false);
    }
  }, []);

  const attachWebviewListeners = useCallback((view, tabId) => {
    const injectBaseCss = () => {
      try {
        const maybe = view.insertCSS(WEBVIEW_BASE_CSS);
        if (maybe && typeof maybe.catch === 'function') {
          maybe.catch(() => {});
        }
      } catch {}
    };

    const applyUrlUpdate = (nextUrl) => {
      if (!nextUrl) return;
      const cleanUrl = nextUrl.trim();
      updateMetaAction(tabId, {
        url: cleanUrl,
        discarded: false,
        lastUsedAt: Date.now()
      });
      if (activeIdRef.current === tabId && !isEditingRef.current) {
        setInputValue(cleanUrl);
        lastLoadedRef.current = { id: tabId, url: cleanUrl };
      }
    };

    const handleNavigate = (event) => {
      if (event?.url) applyUrlUpdate(event.url);
      if (activeIdRef.current === tabId) {
        setStatus('ready');
        refreshNavigationState();
      }
    };

    const handleStart = () => {
      if (activeIdRef.current === tabId) {
        webviewReadyRef.current = false;
        setWebviewReady(false);
        setStatus('loading');
      }
    };

    const handleStop = () => {
      if (activeIdRef.current === tabId) {
        setStatus('ready');
        refreshNavigationState();
        if (!webviewReadyRef.current) {
          webviewReadyRef.current = true;
          setWebviewReady(true);
        }
      }
      try { applyUrlUpdate(view.getURL()); } catch {}
    };

    const handleFail = () => {
      if (activeIdRef.current === tabId) {
        webviewReadyRef.current = false;
        setWebviewReady(false);
        setStatus('error');
      }
    };

    const handleDomReady = () => {
      if (activeIdRef.current === tabId) {
        webviewReadyRef.current = true;
        setWebviewReady(true);
        refreshNavigationState();
        try { view.focus(); } catch {}
      }
    };

    const handleTitle = (event) => {
      const titleValue = typeof event?.title === 'string' ? event.title : '';
      if (titleValue) {
        updateMetaAction(tabId, { title: titleValue, lastUsedAt: Date.now() });
      }
    };

    const handleFavicon = (event) => {
      const favicons = Array.isArray(event?.favicons) ? event.favicons : [];
      const favicon = favicons.find((href) => typeof href === 'string' && href.trim());
      if (favicon) {
        updateMetaAction(tabId, { favicon: favicon.trim() });
      }
    };

    const handleMediaStarted = () => {
      playingTabsRef.current.add(tabId);
      updatePowerBlocker();
      updateMetaAction(tabId, { isPlaying: true, discarded: false });
    };

    const handleMediaPaused = () => {
      playingTabsRef.current.delete(tabId);
      updatePowerBlocker();
      updateMetaAction(tabId, { isPlaying: false });
      if (backgroundTabRef.current === tabId) {
        destroyTabView(tabId, { keepMeta: true });
      }
    };

    const handleEnterFullscreen = () => {
      fullscreenTabRef.current = tabId;
      setIsHtmlFullscreen(true);
      setKbVisible(false);
    };

    const handleLeaveFullscreen = () => {
      if (fullscreenTabRef.current === tabId) {
        fullscreenTabRef.current = null;
        setIsHtmlFullscreen(false);
      }
    };

    injectBaseCss();
    view.addEventListener('dom-ready', injectBaseCss);
    view.addEventListener('did-navigate', injectBaseCss);
    view.addEventListener('did-navigate-in-page', injectBaseCss);

    view.addEventListener('did-navigate', handleNavigate);
    view.addEventListener('did-navigate-in-page', handleNavigate);
    view.addEventListener('did-start-loading', handleStart);
    view.addEventListener('did-stop-loading', handleStop);
    view.addEventListener('did-fail-load', handleFail);
    view.addEventListener('dom-ready', handleDomReady);
    view.addEventListener('page-title-updated', handleTitle);
    view.addEventListener('page-favicon-updated', handleFavicon);
    view.addEventListener('media-started-playing', handleMediaStarted);
    view.addEventListener('media-paused', handleMediaPaused);
    view.addEventListener('enter-html-full-screen', handleEnterFullscreen);
    view.addEventListener('leave-html-full-screen', handleLeaveFullscreen);

    return () => {
      view.removeEventListener('did-navigate', handleNavigate);
      view.removeEventListener('did-navigate-in-page', handleNavigate);
      view.removeEventListener('did-start-loading', handleStart);
      view.removeEventListener('did-stop-loading', handleStop);
      view.removeEventListener('did-fail-load', handleFail);
      view.removeEventListener('dom-ready', handleDomReady);
      view.removeEventListener('page-title-updated', handleTitle);
      view.removeEventListener('page-favicon-updated', handleFavicon);
      view.removeEventListener('media-started-playing', handleMediaStarted);
      view.removeEventListener('media-paused', handleMediaPaused);
      view.removeEventListener('enter-html-full-screen', handleEnterFullscreen);
      view.removeEventListener('leave-html-full-screen', handleLeaveFullscreen);
      view.removeEventListener('dom-ready', injectBaseCss);
      view.removeEventListener('did-navigate', injectBaseCss);
      view.removeEventListener('did-navigate-in-page', injectBaseCss);
    };
  }, [destroyTabView, refreshNavigationState, updateMetaAction, updatePowerBlocker]);

  const ensureHostReady = useCallback(() => {
    if (webviewHostRef.current) return true;
    return false;
  }, []);

  const createWebviewForTab = useCallback((tab) => {
    if (!ensureHostReady()) return null;
    const view = document.createElement('webview');
    view.setAttribute('allowpopups', 'true');
    view.setAttribute('tabindex', '-1');
    view.style.position = 'absolute';
    view.style.inset = '0';
    view.style.width = '100%';
    view.style.height = '100%';
    view.style.border = 'none';
    view.style.backgroundColor = '#05070f';
    try {
      webviewHostRef.current.appendChild(view);
    } catch {}
    const listenersCleanup = attachWebviewListeners(view, tab.id);
    const shadowCleanup = installShadowStyles(view);
    const cleanup = () => {
      try { listenersCleanup?.(); } catch {}
      try { shadowCleanup?.(); } catch {}
    };
    tabViewsRef.current.set(tab.id, {
      view,
      cleanup,
      isBackground: false
    });
    return view;
  }, [attachWebviewListeners, ensureHostReady, installShadowStyles]);

  const loadUrlIntoView = useCallback((tab, view) => {
    const targetUrl = (tab.url && tab.url.trim()) ? tab.url.trim() : DEFAULT_URL;
    const last = lastLoadedRef.current;
    if (last.id === tab.id && last.url === targetUrl) return;
    lastLoadedRef.current = { id: tab.id, url: targetUrl };
    webviewReadyRef.current = false;
    setWebviewReady(false);
    setStatus('loading');
    try {
      const result = view.loadURL(targetUrl);
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
    } catch {
      try { view.setAttribute('src', targetUrl); } catch {}
    }
  }, []);

  const activateTabView = useCallback((tab) => {
    if (!tab) return;
    updateMetaAction(tab.id, { discarded: false });
    let entry = tabViewsRef.current.get(tab.id);
    if (!entry) {
      const created = createWebviewForTab(tab);
      if (!created) {
        requestAnimationFrame(() => activateTabView(tab));
        return;
      }
      entry = tabViewsRef.current.get(tab.id);
      webviewRef.current = created;
      applyActiveStyles(created);
      loadUrlIntoView(tab, created);
      return;
    }

    entry.isBackground = false;
    if (backgroundTabRef.current === tab.id) {
      backgroundTabRef.current = null;
    }
    const view = entry.view;
    if (!view) return;
    if (view.parentElement !== webviewHostRef.current) {
      try { webviewHostRef.current.appendChild(view); } catch {}
    }
    applyActiveStyles(view);
    webviewRef.current = view;

    const current = (() => {
      try { return view.getURL(); } catch { return ''; }
    })();
    const target = (tab.url && tab.url.trim()) ? tab.url.trim() : DEFAULT_URL;
    if (!current || current !== target) {
      loadUrlIntoView(tab, view);
    } else {
      setStatus('ready');
      webviewReadyRef.current = true;
      setWebviewReady(true);
    }
    refreshNavigationState();
  }, [applyActiveStyles, createWebviewForTab, loadUrlIntoView, refreshNavigationState, updateMetaAction]);

  const demoteTabView = useCallback((tab) => {
    if (!tab) return;
    const entry = tabViewsRef.current.get(tab.id);
    if (!entry) return;
    if (tab.isYouTube && tab.isPlaying) {
      if (backgroundTabRef.current && backgroundTabRef.current !== tab.id) {
        const previousId = backgroundTabRef.current;
        updateMetaAction(previousId, { isPlaying: false });
        destroyTabView(previousId, { keepMeta: true });
      }
      backgroundTabRef.current = tab.id;
      entry.isBackground = true;
      if (entry.view) {
        mountInBackgroundHost(entry.view);
        entry.view.style.pointerEvents = 'none';
        entry.view.style.opacity = '0';
      }
    } else {
      destroyTabView(tab.id);
    }
  }, [destroyTabView, mountInBackgroundHost, updateMetaAction]);

  useEffect(() => {
    const off = window.merezhyvo?.onOpenUrl?.((arg) => {
      const { url, activate = true } =
        typeof arg === 'string' ? { url: arg, activate: true } : (arg || {});
      if (!url) return;
      newTabAction(String(url));
    });
    return () => { try { off && off(); } catch {} };
  }, [newTabAction]);

  useEffect(() => {
    const validIds = new Set(tabs.map((tab) => tab.id));
    for (const tabId of Array.from(tabViewsRef.current.keys())) {
      if (!validIds.has(tabId)) {
        destroyTabView(tabId, { keepMeta: true });
      }
    }
  }, [destroyTabView, tabs]);

  useEffect(() => {
    if (!tabsReady) return;
    if (isEditingRef.current) return;
    setInputValue(activeUrl);
  }, [tabsReady, activeUrl]);

  useEffect(() => {
    if (!tabsReady || !hasStartParam) return;
    if (startUrlAppliedRef.current) return;
    startUrlAppliedRef.current = true;
    const trimmed = (initialUrl || '').trim();
    if (!trimmed) return;
    navigateActiveAction(trimmed);
  }, [tabsReady, hasStartParam, initialUrl, navigateActiveAction]);

  useEffect(() => {
    if (!tabsReady) return;
    const next = tabsRef.current.find((tab) => tab.id === activeIdRef.current) || activeTab;
    if (!next) return;

    const prev = previousActiveTabRef.current;
    if (prev && prev.id !== next.id) {
      demoteTabView(prev);
    }

    activateTabView(next);
    previousActiveTabRef.current = next;
  }, [activateTabView, activeTab, demoteTabView, tabsReady]);

  useEffect(() => () => {
    for (const tabId of Array.from(tabViewsRef.current.keys())) {
      destroyTabView(tabId, { keepMeta: true });
    }
  }, [destroyTabView]);

  useEffect(() => {
  const wv = webviewRef.current;
  if (!wv) return;

  let pressTimer = null;
  let startX = 0, startY = 0;
  let moved = false;

  const openAt = (clientX, clientY) => {
    const dpr = window.devicePixelRatio || 1;
    window.merezhyvo?.openContextMenuAt?.(clientX, clientY, dpr);
  };

  const onContextMenu = (ev) => {
    ev.preventDefault();
    openAt(ev.clientX, ev.clientY);
  };

  const onTouchStart = (ev) => {
    if (!ev.touches || ev.touches.length !== 1) return;
    moved = false;
    const t = ev.touches[0];
    startX = t.clientX;
    startY = t.clientY;

    pressTimer = setTimeout(() => {
      pressTimer = null;
      ev.preventDefault();
      openAt(startX, startY);
    }, 500);
  };

  const onTouchMove = (ev) => {
    if (!pressTimer) return;
    const t = ev.touches && ev.touches[0];
    if (!t) return;
    const dx = Math.abs(t.clientX - startX);
    const dy = Math.abs(t.clientY - startY);
    if (dx > 10 || dy > 10) {
      moved = true;
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  const cancel = () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  };

  wv.addEventListener('contextmenu', onContextMenu);
  wv.addEventListener('touchstart', onTouchStart, { passive: false });
  wv.addEventListener('touchmove', onTouchMove, { passive: false });
  wv.addEventListener('touchend', cancel);
  wv.addEventListener('touchcancel', cancel);

  return () => {
    wv.removeEventListener('contextmenu', onContextMenu);
    wv.removeEventListener('touchstart', onTouchStart);
    wv.removeEventListener('touchmove', onTouchMove);
    wv.removeEventListener('touchend', cancel);
    wv.removeEventListener('touchcancel', cancel);
  };
}, [webviewRef]);

  const hostnameFromUrl = useCallback((value) => {
    if (!value) return '';
    try {
      return new URL(value).hostname.replace(/^www\./, '');
    } catch {
      return String(value || '');
    }
  }, []);

  const displayTitleForTab = useCallback((tab) => {
    if (!tab) return 'New Tab';
    const title = (tab.title || '').trim();
    if (title) return title;
    const host = hostnameFromUrl(tab.url);
    return host || 'New Tab';
  }, [hostnameFromUrl]);

  const displaySubtitleForTab = useCallback((tab) => {
    if (!tab) return '';
    const host = hostnameFromUrl(tab.url);
    if (host) return host;
    const url = (tab.url || '').trim();
    return url && url !== DEFAULT_URL ? url : '';
  }, [hostnameFromUrl]);

  const fallbackInitialForTab = useCallback((tab) => {
    const label = displayTitleForTab(tab);
    const first = label.trim().charAt(0);
    return first ? first.toUpperCase() : '•';
  }, [displayTitleForTab]);

  const isEditableElement = useCallback((element) => {
    if (!element) return false;
    if (element === inputRef.current) return true;
    if (typeof element.isContentEditable === 'boolean' && element.isContentEditable) {
      return true;
    }
    const tag = (element.tagName || '').toLowerCase();
    if (tag === 'textarea') {
      return !element.disabled && !element.readOnly;
    }
    if (tag === 'input') {
      const type = (element.getAttribute('type') || '').toLowerCase();
      if (NON_TEXT_INPUT_TYPES.has(type)) {
        return false;
      }
      return !element.disabled && !element.readOnly;
    }
    return false;
  }, [inputRef]);

  const blurActiveInWebview = useCallback(() => {
    const wv = getActiveWebview();
    if (!wv) return;
    const js = `
      (function(){
        try {
          const el = document.activeElement;
          if (el && typeof el.blur === 'function') el.blur();
        } catch {}
      })();
    `;
    try {
      const result = wv.executeJavaScript(js, false);
      if (result && typeof result.then === 'function') {
        result.catch(() => {});
      }
    } catch {}
  }, [getActiveWebview]);
  const closeShortcutModal = useCallback(() => {
    setShowModal(false);
    setBusy(false);
    setMsg('');
    setTitle('');
    setShortcutUrl('');
    setShortcutCompleted(false);
    setShortcutSuccessMsg('');
    activeInputRef.current = null;
    blurActiveInWebview();
    if (mode === 'mobile') setKbVisible(false);
  }, [mode, blurActiveInWebview, setKbVisible]);

  const openSettingsModal = useCallback(() => {
    activeInputRef.current = null;
    setShowSettingsModal(true);
    setSettingsMsg('');
    setPendingRemoval(null);
    setSettingsBusy(false);
    blurActiveInWebview();
    if (mode === 'mobile') setKbVisible(false);
  }, [mode, blurActiveInWebview]);

  const closeSettingsModal = useCallback(() => {
    setShowSettingsModal(false);
    setPendingRemoval(null);
    setSettingsMsg('');
    setSettingsBusy(false);
    if (mode === 'mobile') setKbVisible(false);
  }, [mode, setKbVisible]);

  const askRemoveApp = useCallback((app) => {
    if (!app) return;
    setPendingRemoval(app);
    setSettingsMsg('');
  }, [setPendingRemoval, setSettingsMsg]);

  const cancelRemoveApp = useCallback(() => {
    setPendingRemoval(null);
  }, [setPendingRemoval]);

  const confirmRemoveApp = useCallback(async () => {
    if (!pendingRemoval) return;
    setSettingsBusy(true);
    setSettingsMsg('');
    try {
      const res = await window.merezhyvo?.settings?.installedApps?.remove?.({
        id: pendingRemoval.id,
        desktopFilePath: pendingRemoval.desktopFilePath
      });
      if (res?.ok) {
        if (Array.isArray(res.installedApps)) {
          setInstalledApps(res.installedApps);
        } else {
          setInstalledApps((apps) => apps.filter((app) => app.id !== pendingRemoval.id));
        }
        setPendingRemoval(null);
        void loadInstalledApps({ quiet: true });
      } else {
        setSettingsMsg(res?.error || 'Failed to remove shortcut.');
      }
    } catch (err) {
      setSettingsMsg(String(err));
    } finally {
      setSettingsBusy(false);
    }
  }, [loadInstalledApps, pendingRemoval, setInstalledApps, setPendingRemoval, setSettingsBusy, setSettingsMsg]);

  useEffect(() => {
    try { localStorage.setItem('mzr.kbLayout', kbLayout); } catch {}
  }, [kbLayout]);

  useEffect(() => {
    if (!showModal) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      if (modalTitleInputRef.current) {
        modalTitleInputRef.current.focus();
        modalTitleInputRef.current.select();
      }
    });
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeShortcutModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(frame);
    };
  }, [showModal, closeShortcutModal]);

  useEffect(() => {
    if (!showSettingsModal) {
      return undefined;
    }
    loadInstalledApps();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSettingsModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSettingsModal, loadInstalledApps, closeSettingsModal]);

  // --- Zoom management inside the webview ---
  const zoomRef = useRef(mode === 'mobile' ? 1.8 : 1.0);
  const [zoomLevel, setZoomLevel] = useState(zoomRef.current);

  const setZoomClamped = useCallback((val) => {
    const numeric = Number(val);
    if (!Number.isFinite(numeric)) return;
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, numeric));
    const rounded = Math.round(clamped * 100) / 100;
    const wv = getActiveWebview();
    if (wv) {
      try {
        if (typeof wv.setZoomFactor === 'function') {
          wv.setZoomFactor(rounded);
        } else {
          wv.executeJavaScript(`require('electron').webFrame.setZoomFactor(${rounded})`).catch(() => {});
        }
      } catch {}
    }
    zoomRef.current = rounded;
    setZoomLevel(rounded);
  }, [getActiveWebview]);

  useEffect(() => {
    const base = mode === 'mobile' ? 2.0 : 1.0;
    zoomRef.current = base;
    setZoomLevel(base);
    setZoomClamped(base);
  }, [mode, setZoomClamped]);

  const applyZoomPolicy = useCallback(() => {
    const wv = getActiveWebview();
    if (!wv) return;
    try {
      if (typeof wv.setVisualZoomLevelLimits === 'function') {
        wv.setVisualZoomLevelLimits(1, 3);
      }
      setZoomClamped(zoomRef.current);
    } catch {}
  }, [getActiveWebview, setZoomClamped]);

  useEffect(() => {
    const wv = getActiveWebview();
    if (!wv) return;

    const isLoading = () => {
      try {
        return typeof wv.isLoading === 'function' ? wv.isLoading() : false;
      } catch {
        return false;
      }
    };

    const onReady = () => applyZoomPolicy();
    const onNav = () => applyZoomPolicy();
    const onZoomChanged = (event) => {
      const raw = typeof event?.newZoomFactor === 'number' ? event.newZoomFactor : wv.getZoomFactor?.();
      if (typeof raw !== 'number' || Number.isNaN(raw)) return;
      const normalized = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, raw)) * 100) / 100;
      zoomRef.current = normalized;
      setZoomLevel(normalized);
    };

    wv.addEventListener('dom-ready', onReady);
    wv.addEventListener('did-frame-finish-load', onReady);
    wv.addEventListener('did-navigate', onNav);
    wv.addEventListener('did-navigate-in-page', onNav);
    wv.addEventListener('zoom-changed', onZoomChanged);

    if (!isLoading()) applyZoomPolicy();

    return () => {
      wv.removeEventListener('dom-ready', onReady);
      wv.removeEventListener('did-frame-finish-load', onReady);
      wv.removeEventListener('did-navigate', onNav);
      wv.removeEventListener('did-navigate-in-page', onNav);
      wv.removeEventListener('zoom-changed', onZoomChanged);
    };
  }, [applyZoomPolicy, getActiveWebview]);

  const handleZoomSliderChange = useCallback((event) => {
    const { valueAsNumber, value } = event.target;
    const candidate = Number.isFinite(valueAsNumber) ? valueAsNumber : Number(value);
    setZoomClamped(candidate);
  }, [setZoomClamped]);

  const handleToggleTor = useCallback(async () => {
    try {
      await window.merezhyvo?.tor?.toggle?.();
    } catch {}
  }, []);

  useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);

  useEffect(() => {
    let off = () => {};
    if (window.merezhyvo?.tor?.onState) {
      off = window.merezhyvo.tor.onState((enabled, reason) => {
        setTorEnabled(!!enabled);
        setTorReason(reason || null);
      });
    }
    window.merezhyvo?.tor?.getState?.().then(s => {
      if (s) { setTorEnabled(!!s.enabled); setTorReason(s.reason || null); }
    }).catch(() => {});
    return () => off && off();
  }, []);

  useEffect(() => {
    refreshNavigationState();
  }, [activeId, refreshNavigationState, tabsReady]);

  useEffect(() => {
    if (!isEditingRef.current) return;
    const node = inputRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      try {
        const end = typeof node.selectionEnd === 'number' ? node.selectionEnd : node.value.length;
        const start = typeof node.selectionStart === 'number' ? node.selectionStart : end;
        if (start === end) {
          node.scrollLeft = node.scrollWidth;
        }
      } catch {}
    });
  }, [inputValue]);

  useEffect(() => {
    const node = modalTitleInputRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      try {
        const end = typeof node.selectionEnd === 'number' ? node.selectionEnd : node.value.length;
        const start = typeof node.selectionStart === 'number' ? node.selectionStart : end;
        if (start === end) {
          node.scrollLeft = node.scrollWidth;
        }
      } catch {}
    });
  }, [title]);

  useEffect(() => {
    const node = modalUrlInputRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      try {
        const end = typeof node.selectionEnd === 'number' ? node.selectionEnd : node.value.length;
        const start = typeof node.selectionStart === 'number' ? node.selectionStart : end;
        if (start === end) {
          node.scrollLeft = node.scrollWidth;
        }
      } catch {}
    });
  }, [shortcutUrl]);

  // --- Text injection helpers (used by the soft keyboard) ---
  const injectTextToWeb = useCallback(async (text) => {
    const wv = getActiveWebview();
    if (!wv) return;
    const js = `
      (function(rawText){
        try {
          const el = document.activeElement;
          if (!el) return false;
          const isEditable = el.isContentEditable || (typeof el.value === 'string');
          if (!isEditable) return false;
          const text = String(rawText ?? '');
          if (!text) return false;

          const isEnter = text === '\\n';
          const key = isEnter ? 'Enter' : text;
          const firstCodePoint = text.codePointAt ? text.codePointAt(0) || 0 : (text.length ? text.charCodeAt(0) : 0);
          const keyCode = isEnter ? 13 : (firstCodePoint > 0xffff ? 0 : firstCodePoint);
          const code = (() => {
            if (isEnter) return 'Enter';
            if (text.length === 1) {
              const ch = text;
              if (ch === ' ') return 'Space';
              if (/[0-9]/.test(ch)) return 'Digit' + ch;
              if (/[a-zA-Z]/.test(ch)) return 'Key' + ch.toUpperCase();
              if (ch === '.') return 'Period';
              if (ch === ',') return 'Comma';
              if (ch === '-') return 'Minus';
              if (ch === '+') return 'Equal';
              if (ch === '/') return 'Slash';
              if (ch === '*') return 'NumpadMultiply';
            }
            return key.length === 1 ? 'Key' + key.toUpperCase() : key || 'Unidentified';
          })();

          const fireKeyEvent = (type) => {
            const event = new KeyboardEvent(type, {
              key,
              code,
              location: 0,
              bubbles: true,
              cancelable: type !== 'keyup',
              composed: true
            });
            try {
              Object.defineProperty(event, 'keyCode', { get: () => keyCode });
              Object.defineProperty(event, 'which', { get: () => keyCode });
              Object.defineProperty(event, 'charCode', { get: () => type === 'keypress' ? keyCode : 0 });
            } catch {}
            el.dispatchEvent(event);
          };

          const initialValue = el.isContentEditable ? null : (typeof el.value === 'string' ? String(el.value) : '');
          const initialStart = el.isContentEditable ? null : (typeof el.selectionStart === 'number' ? el.selectionStart : (initialValue ? initialValue.length : 0));
          const initialEnd = el.isContentEditable ? null : (typeof el.selectionEnd === 'number' ? el.selectionEnd : initialStart);

          fireKeyEvent('keydown');
          if (key !== 'Unidentified') {
            fireKeyEvent('keypress');
          }

          if (!el.isContentEditable) {
            const currentValue = typeof el.value === 'string' ? String(el.value) : '';
            const currentStart = typeof el.selectionStart === 'number' ? el.selectionStart : currentValue.length;
            const currentEnd = typeof el.selectionEnd === 'number' ? el.selectionEnd : currentStart;
            const handledByPage = currentValue !== initialValue || currentStart !== initialStart || currentEnd !== initialEnd;
            if (handledByPage) {
              fireKeyEvent('keyup');
              return true;
            }
          }

          const beforeInputEvt = new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, cancelable: true });
          if (!el.dispatchEvent(beforeInputEvt)) {
            fireKeyEvent('keyup');
            return true;
          }

          let success = false;
          if (el.isContentEditable) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              range.deleteContents();
              range.insertNode(document.createTextNode(text));
              range.collapse(false);
              const inputEvt = new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true });
              el.dispatchEvent(inputEvt);
              success = true;
              document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
            }
          } else {
            if (typeof el.setRangeText === 'function') {
              el.setRangeText(text, initialStart, initialEnd, 'end');
            } else {
              const before = initialValue.slice(0, initialStart);
              const after  = initialValue.slice(initialEnd);
              el.value = before + text + after;
              const posFallback = before.length + text.length;
              if (typeof el.setSelectionRange === 'function') {
                el.setSelectionRange(posFallback, posFallback);
              } else {
                el.selectionStart = el.selectionEnd = posFallback;
              }
            }
            const inputEvt = new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true });
            el.dispatchEvent(inputEvt);
            success = true;
            document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
          }

          fireKeyEvent('keyup');
          return success;
        } catch(e) { return false; }
      })(${JSON.stringify(text)});
    `;
    try { await wv.executeJavaScript(js); } catch {}
  }, [getActiveWebview]);

  const injectBackspaceToWeb = useCallback(async () => {
    const wv = getActiveWebview();
    if (!wv) return;
    const js = `
      (function(){
        try {
          const el = document.activeElement;
          if (!el) return false;
          const isEditable = el.isContentEditable || (typeof el.value === 'string');
          if (!isEditable) return false;

          const fire = (type) => {
            const event = new KeyboardEvent(type, {
              key: 'Backspace',
              code: 'Backspace',
              location: 0,
              bubbles: true,
              cancelable: type !== 'keyup',
              composed: true
            });
            try {
              Object.defineProperty(event, 'keyCode', { get: () => 8 });
              Object.defineProperty(event, 'which', { get: () => 8 });
              Object.defineProperty(event, 'charCode', { get: () => 0 });
            } catch {}
            el.dispatchEvent(event);
          };

          const initialValue = el.isContentEditable ? null : (typeof el.value === 'string' ? String(el.value) : '');
          const initialStart = el.isContentEditable ? null : (typeof el.selectionStart === 'number' ? el.selectionStart : (initialValue ? initialValue.length : 0));
          const initialEnd = el.isContentEditable ? null : (typeof el.selectionEnd === 'number' ? el.selectionEnd : initialStart);

          fire('keydown');

          if (!el.isContentEditable) {
            const currentValue = typeof el.value === 'string' ? String(el.value) : '';
            const currentStart = typeof el.selectionStart === 'number' ? el.selectionStart : currentValue.length;
            const currentEnd = typeof el.selectionEnd === 'number' ? el.selectionEnd : currentStart;
            const handledByPage = currentValue !== initialValue || currentStart !== initialStart || currentEnd !== initialEnd;
            if (handledByPage) {
              fire('keyup');
              return true;
            }
          }

          const beforeInputEvt = new InputEvent('beforeinput', { inputType: 'deleteContentBackward', data: null, bubbles: true, cancelable: true });
          if (!el.dispatchEvent(beforeInputEvt)) {
            fire('keyup');
            return true;
          }

          let success = false;

          if (el.isContentEditable) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              if (!range.collapsed) {
                range.deleteContents();
              } else {
                range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
                range.deleteContents();
              }
              const inputEvt = new InputEvent('input', { inputType: 'deleteContentBackward', data: null, bubbles: true });
              el.dispatchEvent(inputEvt);
              document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
              success = true;
            }
          } else {
            if (initialStart === 0 && initialEnd === 0) {
              fire('keyup');
              return true;
            }
            const deleteStart = initialStart === initialEnd ? Math.max(0, initialStart - 1) : Math.min(initialStart, initialEnd);
            const deleteEnd = Math.max(initialStart, initialEnd);
            if (typeof el.setRangeText === 'function') {
              el.setRangeText('', deleteStart, deleteEnd, 'end');
            } else {
              const before = initialValue.slice(0, deleteStart);
              const after  = initialValue.slice(deleteEnd);
              el.value = before + after;
              const posFallback = before.length;
              if (typeof el.setSelectionRange === 'function') {
                el.setSelectionRange(posFallback, posFallback);
              } else {
                el.selectionStart = el.selectionEnd = posFallback;
              }
            }
            const inputEvt = new InputEvent('input', { inputType: 'deleteContentBackward', data: null, bubbles: true });
            el.dispatchEvent(inputEvt);
            document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
            success = true;
          }

          fire('keyup');
          return success;
        } catch(e) { return false; }
      })();
    `;
    try { await wv.executeJavaScript(js); } catch {}
  }, [getActiveWebview]);

  const injectArrowToWeb = useCallback(async (direction) => {
    const wv = getActiveWebview();
    if (!wv) return;
    const js = `
      (function(dir){
        try {
          const el = document.activeElement;
          if (!el) return false;
          const isEditable = el.isContentEditable || (typeof el.value === 'string');
          if (!isEditable) return false;
          const moveBackward = dir === 'ArrowLeft';
          const key = moveBackward ? 'ArrowLeft' : 'ArrowRight';
          const keyCode = moveBackward ? 37 : 39;

          const fire = (type) => {
            const event = new KeyboardEvent(type, {
              key,
              code: key,
              location: 0,
              bubbles: true,
              cancelable: type !== 'keyup',
              composed: true
            });
            try {
              Object.defineProperty(event, 'keyCode', { get: () => keyCode });
              Object.defineProperty(event, 'which', { get: () => keyCode });
              Object.defineProperty(event, 'charCode', { get: () => 0 });
            } catch {}
            el.dispatchEvent(event);
          };

          fire('keydown');

          let success = false;

          if (el.isContentEditable) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              if (!sel.isCollapsed) {
                moveBackward ? sel.collapseToStart() : sel.collapseToEnd();
              }
              if (typeof sel.modify === 'function') {
                sel.modify('move', moveBackward ? 'backward' : 'forward', 'character');
              } else {
                const range = sel.getRangeAt(0);
                const node = range.startContainer;
                let offset = range.startOffset + (moveBackward ? -1 : 1);
                if (node.nodeType === Node.TEXT_NODE) {
                  const length = node.textContent?.length ?? 0;
                  offset = Math.max(0, Math.min(length, offset));
                  range.setStart(node, offset);
                  range.collapse(true);
                }
              }
              document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
              success = true;
            }
          } else {
            const length = el.value.length;
            const start = el.selectionStart ?? length;
            const end = el.selectionEnd ?? length;
            let pos;
            if (start !== end) {
              pos = moveBackward ? Math.min(start, end) : Math.max(start, end);
            } else {
              pos = moveBackward ? Math.max(0, start - 1) : Math.min(length, start + 1);
            }
            el.selectionStart = el.selectionEnd = pos;
            el.focus();
            document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
            success = true;
          }

          fire('keyup');
          return success;
        } catch (e) { return false; }
      })(${JSON.stringify(direction)});
    `;
    try { await wv.executeJavaScript(js); } catch {}
  }, [getActiveWebview]);

  // --- Toolbar event handlers ---
  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    const view = getActiveWebview();
    if (!view) return;
    const target = normalizeAddress(inputValue);
    setInputValue(target);
    setStatus('loading');
    webviewReadyRef.current = false;
    setWebviewReady(false);
    const activeIdCurrent = activeIdRef.current;
    if (activeIdCurrent) {
      navigateActiveAction(target);
      lastLoadedRef.current = { id: activeIdCurrent, url: target };
    }
    try { view.loadURL(target); } catch {}
    setKbVisible(false);
  }, [getActiveWebview, inputValue, navigateActiveAction]);

  const handleBack = useCallback(() => {
    const view = getActiveWebview();
    if (view && view.canGoBack()) view.goBack();
  }, [getActiveWebview]);
  const handleForward = useCallback(() => {
    const view = getActiveWebview();
    if (view && view.canGoForward()) view.goForward();
  }, [getActiveWebview]);
  const handleReload = useCallback(() => {
    const view = getActiveWebview();
    if (!view) return;
    if ('isConnected' in view && !view.isConnected) return;
    const activeUrlCurrent = (activeTabRef.current?.url || '').trim() || DEFAULT_URL;
    setStatus('loading');
    reloadActiveAction();
    const wasReady = webviewReadyRef.current;
    webviewReadyRef.current = false;
    setWebviewReady(false);
    try {
      if (wasReady) {
        view.reload();
      } else {
        view.loadURL(activeUrlCurrent);
      }
    } catch {
      try {
        view.setAttribute('src', activeUrlCurrent);
      } catch {}
    }
  }, [getActiveWebview, reloadActiveAction]);

  const handleInputPointerDown = useCallback(() => {
    activeInputRef.current = 'url';
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleInputFocus = useCallback((event) => {
    isEditingRef.current = true;
    setIsEditing(true);
    activeInputRef.current = 'url';
    event.target.select();
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleInputBlur = useCallback(() => {
    isEditingRef.current = false;
    setIsEditing(false);
    if (activeInputRef.current === 'url') activeInputRef.current = null;
    if (mode !== 'mobile') return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      const isSoftKey = active && typeof active.closest === 'function' && active.closest('[data-soft-keyboard="true"]');
      if (isSoftKey || isEditableElement(active)) {
        return;
      }
      setKbVisible(false);
    });
  }, [mode, isEditableElement]);


  const handleModalInputPointerDown = useCallback(() => {
    activeInputRef.current = 'modalTitle';
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleModalInputFocus = useCallback(() => {
    activeInputRef.current = 'modalTitle';
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleModalInputBlur = useCallback(() => {
    if (activeInputRef.current === 'modalTitle') activeInputRef.current = null;
    if (mode !== 'mobile') return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      const isSoftKey = active && typeof active.closest === 'function' && active.closest('[data-soft-keyboard="true"]');
      if (isSoftKey || isEditableElement(active)) {
        return;
      }
      setKbVisible(false);
    });
  }, [mode, isEditableElement]);

  const handleModalUrlPointerDown = useCallback(() => {
    activeInputRef.current = 'modalUrl';
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleModalUrlFocus = useCallback(() => {
    activeInputRef.current = 'modalUrl';
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleModalUrlBlur = useCallback(() => {
    if (activeInputRef.current === 'modalUrl') activeInputRef.current = null;
    if (mode !== 'mobile') return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      const isSoftKey = active && typeof active.closest === 'function' && active.closest('[data-soft-keyboard="true"]');
      if (isSoftKey || isEditableElement(active)) {
        return;
      }
      setKbVisible(false);
    });
  }, [mode, isEditableElement]);

  const containerStyle = useMemo(() => {
    if (isHtmlFullscreen) return styles.container;
    if (mode !== 'mobile') return styles.container;
    return {
      ...styles.container,
      paddingBottom: kbVisible ? KB_HEIGHT : 0,
      transition: 'padding-bottom 160ms ease'
    };
  }, [isHtmlFullscreen, kbVisible, mode]);

  const modalBackdropStyle = useMemo(() => {
    const base = { ...styles.modalBackdrop, zIndex: 45 + (kbVisible ? 60 : 0) };
    if (mode === 'mobile') {
      base.alignItems = 'flex-start';
      base.paddingTop = 24;
      base.paddingBottom = 24;
      base.top = 0;
      base.bottom = kbVisible ? KB_HEIGHT : 0;
      base.transition = 'bottom 160ms ease';
    }
    return base;
  }, [mode, kbVisible]);
  const settingsModalStyle = useMemo(
    () => (mode === 'mobile' ? styles.settingsModalMobile : styles.settingsModal),
    [mode]
  );
  const settingsCloseButtonStyle = useMemo(
    () => (mode === 'mobile' ? styles.modalCloseMobile : styles.modalClose),
    [mode]
  );

  const tabsPanelBackdropStyle = useMemo(() => {
    const base = { ...styles.tabsPanelBackdrop, zIndex: 55 + (kbVisible ? 60 : 0) };
    if (mode === 'mobile') {
      base.alignItems = 'flex-start';
      base.paddingTop = 0;
      base.paddingBottom = 0;
      base.top = 0;
      base.bottom = kbVisible ? KB_HEIGHT : 0;
      base.transition = 'bottom 160ms ease';
    }
    return base;
  }, [mode, kbVisible]);



  useEffect(() => {
    const wv = getActiveWebview();
    if (!wv) return undefined;

    const script = `
      (function installMerezhyvoFocusBridge() {
        if (window.__mzrFocusBridgeInstalled) return;
        window.__mzrFocusBridgeInstalled = true;

        const nonTextTypes = new Set(['button','submit','reset','checkbox','radio','range','color','file','image','hidden']);
        const isEditable = (el) => {
          if (!el) return false;
          if (el.isContentEditable) return true;
          const tag = (el.tagName || '').toLowerCase();
          if (tag === 'textarea') return !el.disabled && !el.readOnly;
          if (tag === 'input') {
            const type = (el.getAttribute('type') || '').toLowerCase();
            if (nonTextTypes.has(type)) return false;
            return !el.disabled && !el.readOnly;
          }
          return false;
        };

        const notify = (active) => {
          try {
            console.info(active ? ${JSON.stringify(FOCUS_CONSOLE_ACTIVE)} : ${JSON.stringify(FOCUS_CONSOLE_INACTIVE)});
          } catch {}
        };

        const handleFocusIn = (event) => {
          if (isEditable(event.target)) notify(true);
        };

        const handleFocusOut = (event) => {
          if (!isEditable(event.target)) return;
          setTimeout(() => {
            notify(isEditable(document.activeElement));
          }, 0);
        };

        const handlePointerDown = (event) => {
          const target = event.target;
          if (isEditable(target)) {
            notify(true);
          } else {
            setTimeout(() => {
              notify(isEditable(document.activeElement));
            }, 0);
          }
        };

        const ensureFieldScroll = (el) => {
          if (!el) return;
          const tag = (el.tagName || '').toLowerCase();
          if (tag !== 'input' && tag !== 'textarea') return;
          requestAnimationFrame(() => {
            try {
              if (typeof el.selectionStart !== 'number' || typeof el.selectionEnd !== 'number') return;
              if (el.selectionStart === el.selectionEnd) {
                el.scrollLeft = el.scrollWidth;
              }
            } catch {}
          });
        };

        const handleInput = (event) => {
          ensureFieldScroll(event.target);
        };

        const handleKeyup = (event) => {
          const key = event?.key;
          if (key === 'ArrowRight' || key === 'ArrowLeft' || key === 'End') {
            ensureFieldScroll(event.target);
          }
        };

        document.addEventListener('focusin', handleFocusIn, true);
        document.addEventListener('focusout', handleFocusOut, true);
        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('input', handleInput, true);
        document.addEventListener('keyup', handleKeyup, true);
      })();
    `;

    const install = () => {
      try {
        const result = wv.executeJavaScript(script, false);
        if (result && typeof result.then === 'function') {
          result.catch(() => {});
        }
      } catch {}
    };

    install();
    wv.addEventListener('dom-ready', install);
    wv.addEventListener('did-navigate', install);
    wv.addEventListener('did-navigate-in-page', install);
    wv.addEventListener('did-frame-finish-load', install);

    return () => {
      wv.removeEventListener('dom-ready', install);
      wv.removeEventListener('did-navigate', install);
      wv.removeEventListener('did-navigate-in-page', install);
      wv.removeEventListener('did-frame-finish-load', install);
    };
  }, [activeId, getActiveWebview]);

  useEffect(() => {
    const wv = getActiveWebview();
    if (!wv) return undefined;

    const handler = (event) => {
      if (mode !== 'mobile') return;
      const message = event?.message;
      if (message === FOCUS_CONSOLE_ACTIVE) {
        setKbVisible(true);
        return;
      }
      if (message === FOCUS_CONSOLE_INACTIVE) {
        requestAnimationFrame(() => {
          const active = document.activeElement;
          const isSoftKey = active && typeof active.closest === 'function' && active.closest('[data-soft-keyboard="true"]');
          if (isSoftKey || isEditableElement(active)) {
            return;
          }
          setKbVisible(false);
        });
      }
    };

    wv.addEventListener('console-message', handler);
    return () => {
      wv.removeEventListener('console-message', handler);
    };
  }, [activeId, getActiveWebview, isEditableElement, mode]);



  const closeKeyboard = useCallback(() => {
    setKbVisible(false);
    activeInputRef.current = null;
    if (isEditingRef.current && inputRef.current) {
      try { inputRef.current.blur(); } catch {}
    }
    blurActiveInWebview();
  }, [blurActiveInWebview]);

  // --- Shortcut modal helpers ---
  const getCurrentViewUrl = () => {
    try {
      const direct = getActiveWebview()?.getURL?.();
      if (direct) return direct;
    } catch {}
    return activeTabRef.current?.url || activeUrl || null;
  };

  const openShortcutModal = () => {
    let appTitle;
    const viewUrl = getCurrentViewUrl();
    try{
      const hostname = new URL(viewUrl).hostname.replace(/^www\./, '');
      const firstPart = hostname.split('.')[0] || '';
      if (!firstPart) {
        appTitle = viewUrl;
      } else {
        const chars = Array.from(firstPart);
        const capFirst = chars[0].toUpperCase();
        appTitle = 'm' + capFirst + chars.slice(1).join('');
      }      
    } catch {
      appTitle = '';
    };
    setTitle(appTitle);
    setShortcutUrl(viewUrl || '');
    setMsg('');
    setBusy(false);
    setShortcutCompleted(false);
    setShortcutSuccessMsg('');
    setKbVisible(false);
    setShowModal(true);
  };

  const createShortcut = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { setMsg('Please enter a name.'); return; }
    const normalizedUrl = normalizeShortcutUrl(shortcutUrl || getCurrentViewUrl() || '');
    if (!normalizedUrl) {
      setMsg('Please enter a valid URL (http/https).');
      return;
    }
    setShortcutUrl(normalizedUrl);
    setMsg('');
    setBusy(true);
    try {
      const res = await window.merezhyvo?.createShortcut?.({
        title: trimmedTitle,
        url: normalizedUrl,
        single: true
      });
      if (res?.ok) {
        if (res.installedApp) {
          setInstalledApps((apps) => {
            const list = Array.isArray(apps) ? apps : [];
            const index = list.findIndex((app) => app.id === res.installedApp.id);
            if (index === -1) {
              return [...list, res.installedApp];
            }
            const next = [...list];
            next[index] = res.installedApp;
            return next;
          });
        } else {
          void loadInstalledApps({ quiet: true });
        }
        setShortcutCompleted(true);
        setShortcutSuccessMsg('Shortcut saved successfully. You can now open your new web application from the app launcher.');
        setKbVisible(false);
        activeInputRef.current = null;
        const activeIdCurrent = activeIdRef.current;
        if (activeIdCurrent) {
          closeTabAction(activeIdCurrent);
        }
        return;
      } else {
        setMsg(res?.error || 'Unknown error.');
      }
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  };

  const sendKeyToWeb = useCallback(async (key) => {
    const activeTarget = activeInputRef.current;

    if (activeTarget === 'url' && inputRef.current) {
      const inputEl = inputRef.current;
      const value = inputEl.value ?? '';
      const rawStart = inputEl.selectionStart ?? value.length;
      const rawEnd = inputEl.selectionEnd ?? value.length;
      const selectionStart = Math.min(rawStart, rawEnd);
      const selectionEnd = Math.max(rawStart, rawEnd);
      const setCaret = (pos) => {
        setTimeout(() => {
          inputEl.selectionStart = inputEl.selectionEnd = pos;
        }, 0);
      };

      if (key === 'Backspace') {
        if (selectionStart === 0 && selectionEnd === 0) {
          if (kbShift && !kbCaps) setKbShift(false);
          return;
        }
        const deleteStart = selectionStart === selectionEnd ? Math.max(0, selectionStart - 1) : selectionStart;
        const nextValue = value.slice(0, deleteStart) + value.slice(selectionEnd);
        setInputValue(nextValue);
        setCaret(deleteStart);
      } else if (key === 'Enter') {
        const fake = { preventDefault: () => {} };
        handleSubmit(fake);
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const nextPos = key === 'ArrowLeft'
          ? (selectionStart !== selectionEnd ? selectionStart : Math.max(0, selectionStart - 1))
          : (selectionStart !== selectionEnd ? selectionEnd : Math.min(value.length, selectionEnd + 1));
        setCaret(nextPos);
      } else {
        const nextValue = value.slice(0, selectionStart) + key + value.slice(selectionEnd);
        const nextPos = selectionStart + key.length;
        setInputValue(nextValue);
        setCaret(nextPos);
      }
      if (kbShift && !kbCaps) setKbShift(false);
      return;
    }

    if (activeTarget === 'modalTitle' && modalTitleInputRef.current) {
      const inputEl = modalTitleInputRef.current;
      const value = inputEl.value ?? '';
      const rawStart = inputEl.selectionStart ?? value.length;
      const rawEnd = inputEl.selectionEnd ?? value.length;
      const selectionStart = Math.min(rawStart, rawEnd);
      const selectionEnd = Math.max(rawStart, rawEnd);
      const setCaret = (pos) => {
        setTimeout(() => {
          inputEl.selectionStart = inputEl.selectionEnd = pos;
        }, 0);
      };

      if (key === 'Backspace') {
        if (selectionStart === 0 && selectionEnd === 0) {
          if (kbShift && !kbCaps) setKbShift(false);
          return;
        }
        const deleteStart = selectionStart === selectionEnd ? Math.max(0, selectionStart - 1) : selectionStart;
        const nextValue = value.slice(0, deleteStart) + value.slice(selectionEnd);
        setTitle(nextValue);
        setCaret(deleteStart);
      } else if (key === 'Enter') {
        if (!busy) {
          createShortcut();
        }
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const nextPos = key === 'ArrowLeft'
          ? (selectionStart !== selectionEnd ? selectionStart : Math.max(0, selectionStart - 1))
          : (selectionStart !== selectionEnd ? selectionEnd : Math.min(value.length, selectionEnd + 1));
        setCaret(nextPos);
      } else {
        const nextValue = value.slice(0, selectionStart) + key + value.slice(selectionEnd);
        const nextPos = selectionStart + key.length;
        setTitle(nextValue);
        setCaret(nextPos);
      }
      if (kbShift && !kbCaps) setKbShift(false);
      return;
    }

    if (activeTarget === 'modalUrl' && modalUrlInputRef.current) {
      const inputEl = modalUrlInputRef.current;
      const value = inputEl.value ?? '';
      const rawStart = inputEl.selectionStart ?? value.length;
      const rawEnd = inputEl.selectionEnd ?? value.length;
      const selectionStart = Math.min(rawStart, rawEnd);
      const selectionEnd = Math.max(rawStart, rawEnd);
      const setCaret = (pos) => {
        setTimeout(() => {
          inputEl.selectionStart = inputEl.selectionEnd = pos;
        }, 0);
      };

      if (key === 'Backspace') {
        if (selectionStart === 0 && selectionEnd === 0) {
          if (kbShift && !kbCaps) setKbShift(false);
          return;
        }
        const deleteStart = selectionStart === selectionEnd ? Math.max(0, selectionStart - 1) : selectionStart;
        const nextValue = value.slice(0, deleteStart) + value.slice(selectionEnd);
        setShortcutUrl(nextValue);
        setCaret(deleteStart);
      } else if (key === 'Enter') {
        if (!busy) {
          createShortcut();
        }
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const nextPos = key === 'ArrowLeft'
          ? (selectionStart !== selectionEnd ? selectionStart : Math.max(0, selectionStart - 1))
          : (selectionStart !== selectionEnd ? selectionEnd : Math.min(value.length, selectionEnd + 1));
        setCaret(nextPos);
      } else {
        const nextValue = value.slice(0, selectionStart) + key + value.slice(selectionEnd);
        const nextPos = selectionStart + key.length;
        setShortcutUrl(nextValue);
        setCaret(nextPos);
      }
      if (kbShift && !kbCaps) setKbShift(false);
      return;
    }

    if (key === 'Backspace') {
      await injectBackspaceToWeb();
    } else if (key === 'Enter') {
      await injectTextToWeb('\n');
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      await injectArrowToWeb(key);
    } else {
      await injectTextToWeb(key);
    }
    if (kbShift && !kbCaps) setKbShift(false);
  }, [busy, createShortcut, handleSubmit, injectArrowToWeb, injectBackspaceToWeb, injectTextToWeb, kbShift, kbCaps, setInputValue, setShortcutUrl, setTitle]);

  const handleShortcutPointerDown = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleZoomSliderPointerDown = useCallback((event) => {
    event.stopPropagation();
  }, []);

  // --- Layout helpers for the keyboard ---
  const nextLayout = useCallback(() => {
    const order = ['en', 'uk', 'symbols'];
    const index = order.indexOf(kbLayout);
    setKbLayout(order[(index + 1) % order.length]);
  }, [kbLayout]);

  const toggleSymbols = useCallback(() => {
    setKbLayout((layout) => layout === 'symbols' ? 'en' : 'symbols');
  }, []);

  const toggleShift = useCallback(() => setKbShift((shift) => !shift), []);
  const toggleCaps = useCallback(() => setKbCaps((caps) => !caps), []);

  const openTabsPanel = useCallback(() => {
    if (!tabsReady) return;
    setShowTabsPanel(true);
    activeInputRef.current = null;
    blurActiveInWebview();
    if (mode === 'mobile') setKbVisible(false);
  }, [tabsReady, blurActiveInWebview, mode]);

  const closeTabsPanel = useCallback(() => {
    setShowTabsPanel(false);
    if (mode === 'mobile') setKbVisible(false);
  }, [mode]);

  const handleActivateTab = useCallback((id) => {
    if (!id) return;
    activateTabAction(id);
    setShowTabsPanel(false);
    blurActiveInWebview();
    if (mode === 'mobile') setKbVisible(false);
  }, [activateTabAction, blurActiveInWebview, mode]);

  const handleCloseTab = useCallback((id) => {
    if (!id) return;
    closeTabAction(id);
  }, [closeTabAction]);

  const handleTogglePin = useCallback((id) => {
    if (!id) return;
    pinTabAction(id);
  }, [pinTabAction]);

  const handleNewTab = useCallback(() => {
    newTabAction(DEFAULT_URL);
    setShowTabsPanel(false);
    blurActiveInWebview();
    if (mode === 'mobile') setKbVisible(false);
    requestAnimationFrame(() => {
      try { inputRef.current?.focus?.(); } catch {}
    });
  }, [mode, blurActiveInWebview, newTabAction]);

  useEffect(() => {
    if (!showTabsPanel) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTabsPanel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showTabsPanel, closeTabsPanel]);

  const renderTabItem = useCallback((tab) => {
    const isActive = tab.id === activeId;
    const subtitle = displaySubtitleForTab(tab);
    const tabRowStyle = {
      ...styles.tabRow,
      ...(modeStyles[mode].tabRow || {}),
      ...(isActive ? styles.tabRowActive : null)
    };
    const pinButtonStyle = {
      ...styles.tabIconButton,
      ...(modeStyles[mode].tabIconButton || {}),
      ...(tab.pinned ? styles.tabIconButtonActive : null)
    };
    const closeButtonStyle = {
      ...styles.tabIconButton,
      ...(modeStyles[mode].tabIconButton || {})
    };

    return (
      <div
        key={tab.id}
        role="button"
        tabIndex={0}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => handleActivateTab(tab.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
            handleActivateTab(tab.id);
          }
        }}
        style={tabRowStyle}
      >
        <span style={styles.tabInfo}>
          <span style={{ ...styles.tabFaviconWrap, ...(modeStyles[mode].tabFaviconWrap || {}) }}>
            {tab.favicon ? (
              <img src={tab.favicon} alt="" style={styles.tabFavicon} />
            ) : (
              <span style={{ ...styles.tabFaviconFallback, ...(modeStyles[mode].tabFaviconFallback || {}) }}>
                {fallbackInitialForTab(tab)}
              </span>
            )}
          </span>
          <span style={styles.tabTexts}>
            <span style={{ ...styles.tabTitle, ...(modeStyles[mode].tabTitle || {}) }}>
              {displayTitleForTab(tab)}
            </span>
            {subtitle ? (
              <span style={{ ...styles.tabSubtitle, ...(modeStyles[mode].tabSubtitle || {}) }}>
                {subtitle}
              </span>
            ) : null}
          </span>
        </span>
        <span style={{ ...styles.tabActions, ...(modeStyles[mode].tabActions || {}) }}>
          <button
            type="button"
            aria-label={tab.pinned ? 'Unpin tab' : 'Pin tab'}
            onClick={(event) => {
              event.stopPropagation();
              handleTogglePin(tab.id);
            }}
            style={pinButtonStyle}
          >
            <svg
              viewBox="0 0 16 16"
              style={{ ...styles.tabIcon, ...(modeStyles[mode].tabIcon || {}) }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill={tab.pinned ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.25 2.5h3.5a1 1 0 0 1 1 1v2.586l1.657 1.657a1 1 0 0 1-.707 1.707H10v3.3l-2 1.5-2-1.5V9.45H4.3a1 1 0 0 1-.707-1.707L5.25 6.086V3.5a1 1 0 0 1 1-1z"
              />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Close tab"
            onClick={(event) => {
              event.stopPropagation();
              handleCloseTab(tab.id);
            }}
            style={closeButtonStyle}
          >
            <svg
              viewBox="0 0 16 16"
              style={{ ...styles.tabIcon, ...(modeStyles[mode].tabIcon || {}) }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"
              />
            </svg>
          </button>
        </span>
      </div>
    );
  }, [
    activeId,
    mode,
    displayTitleForTab,
    displaySubtitleForTab,
    fallbackInitialForTab,
    handleActivateTab,
    handleTogglePin,
    handleCloseTab
  ]);

  const statusLabelMap = {
    loading: 'Loading',
    ready: 'Ready',
    error: 'Failed to load'
  };
  const zoomDisplay = `${Math.round(zoomLevel * 100)}%`;

  return (
    <div style={containerStyle} className={`app app--${mode}`}>
      {!isHtmlFullscreen && (
        <div style={styles.toolbar} className="toolbar">
          <div style={styles.navGroup}>
          <button
            type="button"
            aria-label="Back"
            disabled={!canGoBack}
            onClick={handleBack}
            style={{
              ...styles.navButton,
              ...modeStyles[mode].toolbarBtnRegular,
              ...(canGoBack ? null : styles.navButtonDisabled)
            }}
            className="btn-regular"
          >
            <svg
              viewBox="0 0 16 16"
              style={{ ...styles.navIcon, ...modeStyles[mode].toolbarBtnIcn }}
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
            onClick={handleForward}
            style={{
              ...styles.navButton,
              ...modeStyles[mode].toolbarBtnRegular,
              ...modeStyles[mode].toolbarBtnDesktopOnly,
              ...(canGoForward ? null : styles.navButtonDisabled)
            }}
            className="btn-regular"
          >
            <svg
              viewBox="0 0 16 16"
              style={{ ...styles.navIcon, ...modeStyles[mode].toolbarBtnIcn }}
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
            onClick={handleReload}
            disabled={!webviewReady}
            style={{
              ...styles.navButton,
              ...modeStyles[mode].toolbarBtnRegular,
              ...(webviewReady ? null : styles.navButtonDisabled)
            }}
            className="btn-regular"
          >
            <svg
              viewBox="0 0 16 16"
              style={{ ...styles.navIcon, ...modeStyles[mode].toolbarBtnIcn }}
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

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.addressField}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPointerDown={handleInputPointerDown}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              placeholder="Enter a URL or search"
              style={{ ...styles.input, ...modeStyles[mode].searchInput }}
            />
            <button
              type="button"
              className="btn btn--makeapp"
              style={{ ...styles.makeAppBtn, ...modeStyles[mode].makeAppBtn }}
              onPointerDown={handleShortcutPointerDown}
              onClick={openShortcutModal}
              title="Create app shortcut from this site"
              aria-label="Create app shortcut from this site"
            >
              <svg
                viewBox="0 0 16 16"
                xmlns="http://www.w3.org/2000/svg"
                style={modeStyles[mode].makeAppBtnIcn}
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
            onClick={openTabsPanel}
            disabled={!tabsReady}
            style={{
              ...styles.tabsButton,
              ...(modeStyles[mode].tabsButton || {}),
              ...(!tabsReady ? styles.tabsButtonDisabled : null)
            }}
          >
            <span style={styles.visuallyHidden}>
              Open tabs ({tabCount})
            </span>
            <span
              aria-hidden="true"
              style={{
                ...styles.tabsButtonSquare,
                ...(modeStyles[mode].tabsButtonSquare || {})
              }}
            >
              <span
                style={{
                  ...styles.tabsButtonCount,
                  ...(modeStyles[mode].tabsButtonCount || {})
                }}
              >
                {tabCount}
              </span>
            </span>
          </button>
        </form>

        <button
          type="button"
          onClick={handleToggleTor}
          title={torEnabled ? 'Disable Tor' : 'Enable Tor'}
          aria-pressed={torEnabled ? 'true' : 'false'}
          style={{
            ...styles.navButton,
            ...modeStyles[mode].toolbarBtnRegular,
            border: torEnabled ? '1px solid #2563eb' : '1px solid rgba(148,163,184,.35)',
            backgroundColor: torEnabled ? '#11331e' : '#1c2333',
          }}
        >
          <svg fill="#ffffffff"
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M23.438 16.266c-1.016-0.922-2.297-1.667-3.604-2.411-0.594-0.328-2.417-1.755-1.786-3.781l-1.135-0.479c1.786-2.771 4.115-5.51 6.969-8.073-2.292 0.771-4.318 1.964-5.839 4.078 0.896-1.875 2.354-3.724 3.964-5.599-2.203 1.578-4.109 3.365-5.302 5.75l0.833-3.339c-1.193 2.146-2.026 4.323-2.354 6.495l-1.755-0.714-0.297 0.24c1.547 2.771 0.745 4.229-0.031 4.74-1.547 1.042-3.781 2.38-4.917 3.542-2.146 2.208-2.771 4.292-2.563 7.063 0.208 3.547 2.802 6.495 6.229 7.656 1.521 0.51 2.917 0.568 4.469 0.568 2.5 0 5.063-0.656 6.943-2.234 1.995-1.656 3.151-4.109 3.156-6.703 0.010-2.583-1.073-5.052-2.979-6.797zM18.698 28.099c-0.12 0.536-0.505 1.193-0.979 1.786 0.177-0.328 0.328-0.656 0.417-1.016 0.745-2.651 1.073-3.87 0.714-6.792-0.057-0.297-0.177-1.25-0.625-2.292-0.625-1.583-1.578-3.073-1.698-3.401-0.208-0.505-0.505-2.651-0.536-4.109 0.031 1.25 0.12 3.542 0.448 4.438 0.089 0.302 0.953 1.641 1.578 3.276 0.417 1.135 0.505 2.177 0.594 2.474 0.302 1.344-0.057 3.609-0.531 5.75-0.151 0.776-0.568 1.672-1.104 2.354 0.297-0.417 0.536-0.953 0.714-1.578 0.359-1.25 0.505-2.859 0.474-3.875-0.026-0.594-0.297-1.875-0.745-3.036-0.266-0.625-0.656-1.281-0.922-1.729-0.297-0.448-0.297-1.427-0.417-2.563 0.026 1.224-0.089 1.849 0.208 2.714 0.177 0.505 0.833 1.219 1.010 1.906 0.271 0.922 0.536 1.938 0.51 2.563 0 0.714-0.031 2.026-0.359 3.458-0.208 1.068-0.688 1.995-1.458 2.589 0.328-0.417 0.505-0.833 0.594-1.25 0.12-0.625 0.151-1.224 0.208-1.969 0.063-0.766 0.010-1.542-0.146-2.292-0.24-1.073-0.625-2.146-0.807-2.891 0.031 0.833 0.359 1.875 0.51 2.979 0.115 0.807 0.057 1.609 0.026 2.323-0.026 0.833-0.297 2.297-0.656 3.010-0.359-0.151-0.474-0.359-0.714-0.656-0.302-0.385-0.479-0.802-0.656-1.281-0.167-0.396-0.297-0.802-0.391-1.219-0.141-1.047 0.13-2.099 0.745-2.953 0.625-0.896 0.75-0.953 0.953-1.995-0.297 0.922-0.505 1.010-1.161 1.786-0.745 0.865-0.859 2.115-0.859 3.13 0 0.417 0.177 0.896 0.328 1.344 0.177 0.474 0.354 0.948 0.594 1.307 0.177 0.297 0.417 0.505 0.625 0.656-0.776-0.208-1.578-0.505-2.083-0.922-1.25-1.078-2.354-2.891-2.505-4.5-0.12-1.313 1.073-3.219 2.771-4.172 1.432-0.833 1.76-1.76 2.057-3.281-0.417 1.313-0.833 2.448-2.208 3.13-1.964 1.073-2.979 2.802-2.885 4.469 0.146 2.115 0.979 3.578 2.682 4.74 0.385 0.271 0.922 0.536 1.49 0.745-2.12-0.505-2.385-0.802-3.099-1.635 0-0.063-0.182-0.182-0.182-0.208-0.953-1.073-2.141-2.922-2.563-4.62-0.146-0.594-0.297-1.219-0.115-1.818 0.771-2.802 2.469-3.875 4.167-5.031 0.422-0.302 0.839-0.568 1.224-0.865 0.953-0.75 1.193-2.682 1.401-3.786-0.385 1.344-0.807 3.010-1.552 3.547-0.385 0.297-0.865 0.536-1.25 0.802-1.755 1.193-3.516 2.328-4.318 5.214-0.182 0.75-0.063 1.286 0.115 2 0.448 1.755 1.641 3.661 2.656 4.797l0.177 0.177c0.448 0.51 1.016 0.896 1.698 1.161-0.599-0.141-1.177-0.349-1.729-0.625-2.771-1.339-4.615-4.229-4.734-6.583-0.24-4.797 2.057-6.198 4.198-7.958 1.193-0.979 2.865-1.458 3.818-3.214 0.177-0.391 0.297-1.224 0.057-2.12-0.089-0.297-0.536-1.37-0.714-1.609l2.651 1.167c-0.057 1.25-0.089 2.26 0.146 3.188 0.271 1.010 1.583 2.469 2.12 4.172 1.042 3.214 0.776 7.411 0.026 10.693z"/>
          </svg>
        </button>

        <button
          type="button"
          title="Open settings"
          aria-label="Open settings"
          className="btn btn--settings"
          onClick={openSettingsModal}
          style={{
            ...styles.settingsButton,
            ...(modeStyles[mode].settingsButton || {})
          }}
        >
          <svg
            viewBox="0 0 16 16"
            style={{
              ...styles.settingsButtonIcon,
              ...(modeStyles[mode].settingsButtonIcon || {})
            }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M8 3.25V1.75M8 14.25v-1.5M3.6 3.6l1.06 1.06M11.34 11.34l1.06 1.06M1.75 8h1.5M12.75 8h1.5M3.6 12.4l1.06-1.06M11.34 4.66l1.06-1.06M10.25 8a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
            />
          </svg>
        </button>

        <div style={styles.statusIndicator} role="status" aria-label={statusLabelMap[status]}>
          {status === 'loading' && <span style={styles.spinner} aria-hidden="true" />}
          {status === 'ready' && (
            <svg
              viewBox="0 0 16 16"
              style={{ ...styles.statusSvg, ...styles.statusIconReady, ...modeStyles[mode].statusIcon }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M3.5 8.5 6.5 11.5 12.5 5.5"
              />
            </svg>
          )}
          {status === 'error' && (
            <svg
              viewBox="0 0 16 16"
              style={{ ...styles.statusSvg, ...styles.statusIconError }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"
              />
            </svg>
          )}
          </div>
        </div>
      )}

      <div ref={webviewHostRef} style={styles.webviewMount} />
      <div ref={backgroundHostRef} style={styles.backgroundShelf} />

      {!isHtmlFullscreen && (
        <div className="zoom-toolbar" style={styles.bottomToolbar}>
          <span style={styles.zoomLabel}>Zoom</span>
          <div style={styles.zoomSliderContainer}>
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              value={zoomLevel}
              onPointerDown={handleZoomSliderPointerDown}
              onInput={handleZoomSliderChange}
              onChange={handleZoomSliderChange}
              aria-label="Zoom level"
              className="zoom-slider"
              style={{ ...styles.zoomSlider, ...modeStyles[mode].zoomSlider }}
            />
          </div>
          <span style={{ ...styles.zoomValue, ...modeStyles[mode].zoomValue }}>{zoomDisplay}</span>
        </div>
      )}

      {showTabsPanel && (
        <div
          style={tabsPanelBackdropStyle}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeTabsPanel();
            }
          }}
        >
          <div
            style={mode === 'mobile' ? styles.tabsPanelMobile : styles.tabsPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tabs-panel-title"
          >
            <div style={styles.tabsPanelHeader}>
              <h2
                id="tabs-panel-title"
                style={{
                  ...styles.tabsPanelTitle,
                  ...(modeStyles[mode].tabsPanelTitle || {})
                }}
              >
                Tabs
              </h2>
              <button
                type="button"
                aria-label="Close tabs dialog"
                style={mode === 'mobile' ? styles.modalCloseMobile : styles.modalClose}
                onClick={closeTabsPanel}
              >
                ✕
              </button>
            </div>

            <button
              type="button"
              style={{
                ...styles.newTabButton,
                ...(mode === 'mobile' ? styles.newTabButtonMobile : null),
                ...(modeStyles[mode].newTabButton || {})
              }}
              onClick={handleNewTab}
            >
              <svg
                viewBox="0 0 16 16"
                style={{ ...styles.tabIcon, ...(modeStyles[mode].tabIcon || {}) }}
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
              <span>New Tab</span>
            </button>

            <div
              className="tabs-modal-body"
              style={{
                ...styles.tabsPanelBody,
                ...(modeStyles[mode].tabsPanelBody || {})
              }}
            >
              {pinnedTabs.length > 0 && (
                <div style={styles.tabsSection}>
                  <p
                    style={{
                      ...styles.tabsSectionTitle,
                      ...(modeStyles[mode].tabsSectionTitle || {})
                    }}
                  >
                    Pinned
                  </p>
                  <div style={styles.tabsList}>
                    {pinnedTabs.map(renderTabItem)}
                  </div>
                </div>
              )}

              {regularTabs.length > 0 && (
                <div style={styles.tabsSection}>
                  {pinnedTabs.length > 0 && (
                    <p
                      style={{
                        ...styles.tabsSectionTitle,
                        ...(modeStyles[mode].tabsSectionTitle || {})
                      }}
                    >
                      Others
                    </p>
                  )}
                  <div style={styles.tabsList}>
                    {regularTabs.map(renderTabItem)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          style={modalBackdropStyle}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeShortcutModal();
            }
          }}
        >
          <div
            style={mode === 'mobile' ? styles.modalMobile : styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcut-modal-title"
          >
            <div style={mode === 'mobile' ? styles.modalHeaderMobile : styles.modalHeader}>
              <h2 id="shortcut-modal-title" style={mode === 'mobile' ? styles.modalTitleMobile : styles.modalTitle}>
                {shortcutCompleted ? 'Shortcut Saved' : 'Create App Shortcut'}
              </h2>

              <button
                type="button"
                aria-label="Close shortcut dialog"
                style={mode === 'mobile' ? styles.modalCloseMobile : styles.modalClose}
                onClick={closeShortcutModal}
              >
                ✕
              </button>
            </div>
            {shortcutCompleted ? (
              <>
                <p style={mode === 'mobile' ? styles.modalBodyMobile : styles.modalBody}>
                  {shortcutSuccessMsg || 'Shortcut saved successfully. You can now open your new web application from the app launcher.'}
                </p>
                <div style={mode === 'mobile' ? styles.modalActionsMobile : styles.modalActions}>
                  <button
                    type="button"
                    style={{
                      ...(mode === 'mobile' ? styles.modalButtonMobile : styles.modalButton),
                      ...(mode === 'mobile' ? styles.modalButtonPrimaryMobile : styles.modalButtonPrimary)
                    }}
                    onClick={closeShortcutModal}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={mode === 'mobile' ? styles.modalBodyMobile : styles.modalBody}>
                  You are about to save this page as a separate application.
                  <br />
                  Update the save URL for the application as needed.
                </p>
                <form
                  style={mode === 'mobile' ? styles.modalFormMobile : styles.modalForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!busy) {
                      createShortcut();
                    }
                  }}
                >
                  <div style={mode === 'mobile' ? styles.modalFieldMobile : styles.modalField}>
                    <label htmlFor="shortcut-title" style={mode === 'mobile' ? styles.modalLabelMobile : styles.modalLabel}>
                      Title
                    </label>
                    <input
                      id="shortcut-title"
                      ref={modalTitleInputRef}
                      type="text"
                      value={title}
                      onPointerDown={handleModalInputPointerDown}
                      onFocus={handleModalInputFocus}
                      onBlur={handleModalInputBlur}
                      onChange={(event) => setTitle(event.target.value)}
                      style={mode === 'mobile' ? styles.modalInputMobile : styles.modalInput}
                      disabled={true}
                    />
                  </div>
                  <div style={mode === 'mobile' ? styles.modalFieldMobile : styles.modalField}>
                    <label htmlFor="shortcut-url" style={mode === 'mobile' ? styles.modalLabelMobile : styles.modalLabel}>
                      URL
                    </label>
                    <input
                      id="shortcut-url"
                      ref={modalUrlInputRef}
                      type="url"
                      value={shortcutUrl}
                      onPointerDown={handleModalUrlPointerDown}
                      onFocus={handleModalUrlFocus}
                      onBlur={handleModalUrlBlur}
                      onChange={(event) => setShortcutUrl(event.target.value)}
                      style={mode === 'mobile' ? styles.modalInputMobile : styles.modalInput}
                      disabled={busy}
                    />
                  </div>

                  {msg && (
                    <div style={mode === 'mobile' ? styles.modalMsgMobile : styles.modalMsg} role="status">
                      {msg}
                    </div>
                  )}

                  <div style={mode === 'mobile' ? styles.modalActionsMobile : styles.modalActions}>
                    <button
                      type="button"
                      style={mode === 'mobile' ? styles.modalButtonMobile : styles.modalButton}
                      onClick={closeShortcutModal}
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      style={{
                        ...(mode === 'mobile' ? styles.modalButtonMobile : styles.modalButton),
                        ...(mode === 'mobile' ? styles.modalButtonPrimaryMobile : styles.modalButtonPrimary),
                        ...(busy ? (mode === 'mobile' ? styles.modalButtonDisabledMobile : styles.modalButtonDisabled) : null)
                      }}
                      disabled={busy}
                    >
                      {busy ? 'Creating…' : 'Create Shortcut'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div
          style={modalBackdropStyle}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeSettingsModal();
            }
          }}
        >
          <div
            style={settingsModalStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
          >
            <div style={styles.settingsModalHeader}>
              <h2
                id="settings-modal-title"
                style={{
                  ...styles.settingsModalTitle,
                  ...(modeStyles[mode].settingsModalTitle || {})
                }}
              >
                Settings
              </h2>
              <button
                type="button"
                aria-label="Close settings dialog"
                style={settingsCloseButtonStyle}
                onClick={closeSettingsModal}
              >
                ✕
              </button>
            </div>

            <div style={styles.settingsSections}>
              <section
                style={{
                  ...styles.settingsBlock,
                  ...(modeStyles[mode].settingsBlock || {})
                }}
              >
                <div style={styles.settingsBlockHeader}>
                  <h3
                    style={{
                      ...styles.settingsBlockTitle,
                      ...(modeStyles[mode].settingsBlockTitle || {})
                    }}
                  >
                    Installed Apps
                  </h3>
                  {installedAppsLoading && (
                    <span
                      style={{
                        ...styles.settingsLoading,
                        ...(modeStyles[mode].settingsLoading || {})
                      }}
                    >
                      Loading…
                    </span>
                  )}
                </div>

                <div style={styles.settingsBlockBody}>
                  {installedAppsList.length === 0 && !installedAppsLoading ? (
                    <p style={styles.settingsEmpty}>No installed shortcuts yet.</p>
                  ) : (
                    <ul style={styles.settingsAppList}>
                      {installedAppsList.map((app) => {
                        const isPending = pendingRemoval?.id === app.id;
                        return (
                          <li
                            key={app.id}
                            style={{
                              ...styles.settingsAppRow,
                              ...(modeStyles[mode].settingsAppRow || {})
                            }}
                          >
                            <div style={styles.settingsAppHeader}>
                              <div style={styles.settingsAppInfo}>
                                <span
                                  style={{
                                    ...styles.settingsAppTitle,
                                    ...(modeStyles[mode].settingsAppTitle || {})
                                  }}
                                >
                                  {app.title || app.url}
                                </span>
                                <span
                                  style={{
                                    ...styles.settingsAppUrl,
                                    ...(modeStyles[mode].settingsAppUrl || {})
                                  }}
                                >
                                  {app.url}
                                </span>
                              </div>
                              <div style={styles.settingsAppActions}>
                                <button
                                  type="button"
                                  aria-label={`Remove ${app.title || app.url}`}
                                  onClick={() => askRemoveApp(app)}
                                  disabled={settingsBusy && isPending}
                                  style={{
                                    ...styles.settingsIconButton,
                                    ...(modeStyles[mode].settingsIconButton || {}),
                                    ...(settingsBusy && isPending ? styles.modalButtonDisabled : null)
                                  }}
                                >
                                  <svg
                                    viewBox="0 0 16 16"
                                    style={{
                                      ...styles.settingsIcon,
                                      ...(modeStyles[mode].settingsIcon || {})
                                    }}
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M3.5 4.5h9M6.5 4.5V3.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M6 7v5m4-5v5M4.5 4.5 5.2 13a1 1 0 0 0 .998.9h3.604a1 1 0 0 0 .998-.9l.7-8.5"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            {isPending && (
                              <div style={styles.settingsConfirm}>
                                <p
                                  style={{
                                    ...styles.settingsConfirmText,
                                    ...(modeStyles[mode].settingsConfirmText || {})
                                  }}
                                >
                                  {`Are you sure you want to remove ${app.title || app.url}?`}
                                </p>
                                <div style={styles.settingsConfirmActions}>
                                  <button
                                    type="button"
                                    style={{
                                      ...styles.settingsConfirmButton,
                                      ...(modeStyles[mode].settingsConfirmButton || {})
                                    }}
                                    onClick={cancelRemoveApp}
                                    disabled={settingsBusy}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    style={{
                                      ...styles.settingsConfirmButton,
                                      ...styles.settingsConfirmButtonPrimary,
                                      ...(modeStyles[mode].settingsConfirmButton || {})
                                    }}
                                    onClick={confirmRemoveApp}
                                    disabled={settingsBusy}
                                  >
                                    {settingsBusy ? 'Removing…' : 'OK'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>
            </div>

            {settingsMsg && (
              <div
                style={{
                  ...styles.settingsMessage,
                  ...(modeStyles[mode].settingsMessage || {})
                }}
                role="status"
              >
                {settingsMsg}
              </div>
            )}
          </div>
        </div>
      )}

      <SoftKeyboard
        visible={mode === 'mobile' && kbVisible}
        height={KB_HEIGHT}
        layoutId={kbLayout}
        shift={kbShift}
        caps={kbCaps}
        onKey={sendKeyToWeb}
        onClose={closeKeyboard}
        onToggleShift={toggleShift}
        onToggleCaps={toggleCaps}
        onToggleSymbols={toggleSymbols}
        onNextLayout={nextLayout}
      />
    </div>
  );
};

export default App;

const singleStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#000',
    overflow: 'hidden'
  },
  webview: {
    flex: 1,
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: '#000'
  },
  webviewFullscreen: {
    flex: 1,
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: '#000'
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: '6px 12px',
    borderRadius: '999px',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    color: '#f8fafc',
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  statusBadgeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)'
  }
};

const SingleWindowApp = ({ initialUrl, mode }) => {
  const webviewRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const powerBlockerIdRef = useRef(null);
  const zoomRef = useRef(mode === 'mobile' ? 2 : 1);
  const [zoomLevel, setZoomLevel] = useState(zoomRef.current);

  const startPowerBlocker = useCallback(async () => {
    if (powerBlockerIdRef.current != null) return powerBlockerIdRef.current;
    try {
      const startFn = window.merezhyvo?.power?.start;
      if (!startFn) return null;
      const id = await startFn();
      if (typeof id === 'number') {
        powerBlockerIdRef.current = id;
        return id;
      }
    } catch (err) {
      console.error('[Merezhyvo] power blocker start failed (single)', err);
    }
    return null;
  }, []);

  const stopPowerBlocker = useCallback(async () => {
    const id = powerBlockerIdRef.current;
    if (id == null) return;
    try {
      const stopFn = window.merezhyvo?.power?.stop;
      if (stopFn) {
        await stopFn(id);
      }
    } catch (err) {
      console.error('[Merezhyvo] power blocker stop failed (single)', err);
    }
    powerBlockerIdRef.current = null;
  }, []);

  const setZoomClamped = useCallback((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, numeric));
    const rounded = Math.round(clamped * 100) / 100;
    const view = webviewRef.current;
    if (view) {
      try {
        if (typeof view.setZoomFactor === 'function') {
          view.setZoomFactor(rounded);
        }
      } catch {}
    }
    zoomRef.current = rounded;
    setZoomLevel(rounded);
  }, []);

  useEffect(() => {
    const base = mode === 'mobile' ? 2 : 1;
    zoomRef.current = base;
    setZoomLevel(base);
    setZoomClamped(base);
  }, [mode, setZoomClamped]);

  useEffect(() => {
    const view = webviewRef.current;
    if (!view) return undefined;

    const handleStart = () => setStatus('loading');
    const handleStop = () => setStatus('ready');
    const handleFail = () => setStatus('error');
    const handleDomReady = () => {
      setStatus('ready');
      try { view.focus(); } catch {}
    };
    const handleMediaStarted = () => { void startPowerBlocker(); };
    const handleMediaPaused = () => { void stopPowerBlocker(); };
    const handleEnterFullscreen = () => setIsFullscreen(true);
    const handleLeaveFullscreen = () => setIsFullscreen(false);

    view.addEventListener('did-start-loading', handleStart);
    view.addEventListener('did-stop-loading', handleStop);
    const applyZoomPolicy = () => {
      try {
        if (typeof view.setVisualZoomLevelLimits === 'function') {
          view.setVisualZoomLevelLimits(1, 3);
        }
        if (typeof view.setZoomFactor === 'function') {
          view.setZoomFactor(zoomRef.current);
        }
      } catch {}
    };

    const handleZoomChanged = (event) => {
      const raw = typeof event?.newZoomFactor === 'number' ? event.newZoomFactor : view.getZoomFactor?.();
      if (typeof raw !== 'number' || Number.isNaN(raw)) return;
      const normalized = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, raw)) * 100) / 100;
      zoomRef.current = normalized;
      setZoomLevel(normalized);
    };

    const injectBaseCss = () => {
      try {
        const maybe = view.insertCSS(WEBVIEW_BASE_CSS);
        if (maybe && typeof maybe.catch === 'function') {
          maybe.catch(() => {});
        }
      } catch {}
    };

    const installInputScroll = () => {
      const script = `
        (function(){
          try {
            if (window.__mzrSingleInputScrollInstalled) return;
            window.__mzrSingleInputScrollInstalled = true;
            const ensureFieldScroll = (el) => {
              if (!el) return;
              const tag = (el.tagName || '').toLowerCase();
              if (tag !== 'input' && tag !== 'textarea') return;
              requestAnimationFrame(() => {
                try {
                  if (typeof el.selectionStart !== 'number' || typeof el.selectionEnd !== 'number') return;
                  if (el.selectionStart === el.selectionEnd) {
                    el.scrollLeft = el.scrollWidth;
                  }
                } catch {}
              });
            };
            document.addEventListener('input', (event) => ensureFieldScroll(event.target), true);
            document.addEventListener('keyup', (event) => {
              const key = event?.key;
              if (key === 'ArrowRight' || key === 'ArrowLeft' || key === 'End') {
                ensureFieldScroll(event.target);
              }
            }, true);
          } catch {}
        })();
      `;
      try { view.executeJavaScript(script, false).catch?.(() => {}); } catch {}
    };

    injectBaseCss();
    installInputScroll();

    view.addEventListener('did-fail-load', handleFail);
    view.addEventListener('dom-ready', handleDomReady);
    view.addEventListener('media-started-playing', handleMediaStarted);
    view.addEventListener('media-paused', handleMediaPaused);
    view.addEventListener('enter-html-full-screen', handleEnterFullscreen);
    view.addEventListener('leave-html-full-screen', handleLeaveFullscreen);
    view.addEventListener('dom-ready', applyZoomPolicy);
    view.addEventListener('did-frame-finish-load', applyZoomPolicy);
    view.addEventListener('did-navigate', applyZoomPolicy);
    view.addEventListener('did-navigate-in-page', applyZoomPolicy);
    view.addEventListener('zoom-changed', handleZoomChanged);
    view.addEventListener('dom-ready', injectBaseCss);
    view.addEventListener('did-navigate', injectBaseCss);
    view.addEventListener('did-navigate-in-page', injectBaseCss);

    applyZoomPolicy();

    return () => {
      view.removeEventListener('did-start-loading', handleStart);
      view.removeEventListener('did-stop-loading', handleStop);
      view.removeEventListener('did-fail-load', handleFail);
      view.removeEventListener('dom-ready', handleDomReady);
      view.removeEventListener('media-started-playing', handleMediaStarted);
      view.removeEventListener('media-paused', handleMediaPaused);
      view.removeEventListener('enter-html-full-screen', handleEnterFullscreen);
      view.removeEventListener('leave-html-full-screen', handleLeaveFullscreen);
      view.removeEventListener('dom-ready', applyZoomPolicy);
      view.removeEventListener('did-frame-finish-load', applyZoomPolicy);
      view.removeEventListener('did-navigate', applyZoomPolicy);
      view.removeEventListener('did-navigate-in-page', applyZoomPolicy);
      view.removeEventListener('zoom-changed', handleZoomChanged);
      view.removeEventListener('dom-ready', injectBaseCss);
      view.removeEventListener('did-navigate', injectBaseCss);
      view.removeEventListener('did-navigate-in-page', injectBaseCss);
      void stopPowerBlocker();
    };
  }, [setZoomClamped, startPowerBlocker, stopPowerBlocker]);

  useEffect(() => {
    const view = webviewRef.current;
    if (!view) return;
    const target = initialUrl && initialUrl.trim() ? initialUrl.trim() : DEFAULT_URL;
    try {
      const result = view.loadURL(target);
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
    } catch {
      try { view.setAttribute('src', target); } catch {}
    }
  }, [initialUrl]);

  useEffect(() => () => { void stopPowerBlocker(); }, [stopPowerBlocker]);

  const webviewStyle = isFullscreen ? singleStyles.webviewFullscreen : singleStyles.webview;
  const statusStyle = status === 'error'
    ? { ...singleStyles.statusBadge, ...singleStyles.statusBadgeError }
    : singleStyles.statusBadge;
  const zoomDisplay = `${Math.round(zoomLevel * 100)}%`;
  const handleZoomSliderChange = useCallback((event) => {
    const { valueAsNumber, value } = event.target;
    const candidate = Number.isFinite(valueAsNumber) ? valueAsNumber : Number(value);
    setZoomClamped(candidate);
  }, [setZoomClamped]);
  const handleZoomSliderPointerDown = useCallback((event) => {
    event.stopPropagation();
  }, []);

  return (
    <div style={singleStyles.container} className={`single-app single-app--${mode}`}>
      <webview ref={webviewRef} style={webviewStyle} allowpopups="true" />
      {status !== 'ready' && (
        <div style={statusStyle}>
          {status === 'loading' ? 'Loading…' : 'Load failed'}
        </div>
      )}
      {!isFullscreen && (
        <div className="zoom-toolbar" style={styles.bottomToolbar}>
          <span style={styles.zoomLabel}>Zoom</span>
          <div style={styles.zoomSliderContainer}>
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              value={zoomLevel}
              onPointerDown={handleZoomSliderPointerDown}
              onInput={handleZoomSliderChange}
              onChange={handleZoomSliderChange}
              aria-label="Zoom level"
              className="zoom-slider"
              style={{ ...styles.zoomSlider, ...modeStyles[mode].zoomSlider }}
            />
          </div>
          <span style={{ ...styles.zoomValue, ...modeStyles[mode].zoomValue }}>{zoomDisplay}</span>
        </div>
      )}
    </div>
  );
};
