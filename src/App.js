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
    justifyContent: 'center'
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
    fontSize: '12px',
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
    fontSize: '12px',
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
    height: 'min(92vh, 600px)',
    minHeight: '45vh',
    borderRadius: '28px 28px 0 0',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    boxShadow: '0 -12px 50px rgba(2, 6, 23, 0.65)',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    padding: 'calc(2vh) calc(4vw)',
    gap: 'calc(2vh)',
    boxSizing: 'border-box',
    marginTop: 'clamp(24px, 4vh, 48px)'
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
    lineHeight: 1.6,
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
    height: 'clamp(105px, 13.5vh, 144px)',
    borderRadius: '24px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(9, 12, 22, 0.92)',
    color: '#f8fafc',
    padding: '0 clamp(27px, 6vw, 48px)',
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
    zoomSlider: { height: '4px' },
    zoomValue: { minWidth: '48px', textAlign: 'right' },
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
    newTabButton: {}
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
    zoomSlider: { height: 'clamp(14px, 2.2vw, 20px)' },
    zoomValue: {
      minWidth: 'clamp(80px, 12vw, 108px)',
      textAlign: 'right',
      fontSize: 'clamp(22px, 3.3vw, 26px)'
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
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('start');
  if (!raw) {
    return { url: DEFAULT_URL, hasStartParam: false };
  }
  try {
    return { url: decodeURIComponent(raw), hasStartParam: true };
  } catch {
    return { url: raw, hasStartParam: true };
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

const App = () => {
  const { url: parsedStartUrl, hasStartParam } = useMemo(() => parseStartUrl(), []);
  const initialUrl = useMemo(() => normalizeAddress(parsedStartUrl), [parsedStartUrl]);
  const webviewRef = useRef(null);
  const inputRef = useRef(null);
  const modalInputRef = useRef(null);
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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showTabsPanel, setShowTabsPanel] = useState(false);

  const tabsReadyRef = useRef(tabsReady);

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

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { tabsReadyRef.current = tabsReady; }, [tabsReady]);

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

  const getActiveWebview = () => webviewRef.current;

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

  const mode = useMerezhyvoMode();

  const blurActiveInWebview = useCallback(() => {
    const wv = webviewRef.current;
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
  }, []);
  const closeShortcutModal = useCallback(() => {
    setShowModal(false);
    setBusy(false);
    activeInputRef.current = null;
    blurActiveInWebview();
    if (mode === 'mobile') setKbVisible(false);
  }, [mode, blurActiveInWebview]);

  // --- Soft keyboard state ---
  const [kbVisible, setKbVisible] = useState(false);
  const [kbLayout, setKbLayout] = useState(() => {
    try { return localStorage.getItem('mzr.kbLayout') || 'en'; } catch { return 'en'; }
  });
  const [kbShift, setKbShift] = useState(false);
  const [kbCaps, setKbCaps] = useState(false);
  useEffect(() => {
    try { localStorage.setItem('mzr.kbLayout', kbLayout); } catch {}
  }, [kbLayout]);

  useEffect(() => {
    if (!showModal) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      if (modalInputRef.current) {
        modalInputRef.current.focus();
        modalInputRef.current.select();
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

  // --- Zoom management inside the webview ---
  const zoomRef = useRef(mode === 'mobile' ? 1.8 : 1.0);
  const [zoomLevel, setZoomLevel] = useState(zoomRef.current);

  const setZoomClamped = useCallback((val) => {
    const numeric = Number(val);
    if (!Number.isFinite(numeric)) return;
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, numeric));
    const rounded = Math.round(clamped * 100) / 100;
    const wv = webviewRef.current;
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
  }, [updateMetaAction]);

  useEffect(() => {
    const base = mode === 'mobile' ? 2.0 : 1.0;
    zoomRef.current = base;
    setZoomLevel(base);
    setZoomClamped(base);
  }, [mode, setZoomClamped]);

  const applyZoomPolicy = useCallback(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    try {
      if (typeof wv.setVisualZoomLevelLimits === 'function') {
        wv.setVisualZoomLevelLimits(1, 3);
      }
      setZoomClamped(zoomRef.current);
    } catch {}
  }, [setZoomClamped]);

  useEffect(() => {
    const wv = webviewRef.current;
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
  }, [applyZoomPolicy]);

  const handleZoomSliderChange = useCallback((event) => {
    const { valueAsNumber, value } = event.target;
    const candidate = Number.isFinite(valueAsNumber) ? valueAsNumber : Number(value);
    setZoomClamped(candidate);
  }, [setZoomClamped]);

  // --- Inject custom css into the webview ---
  useEffect(() => {
    const css = `
      :root, html { color-scheme: dark; }
      @media (prefers-color-scheme: light) {
        /* no-op: we still prefer dark by nativeTheme, but keep CSS minimal */
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
        /* мʼяка тінь як підсвітка, не змінює розмір елемента */
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--mzr-focus-ring) 35%, transparent) !important;
      }
    `;
    const wv = webviewRef.current;
    if (!wv) return;

    const apply = () => {
      try {
        const maybePromise = wv.insertCSS(css);
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch(() => {});
        }
      } catch {}
    };

    wv.addEventListener('dom-ready', apply);
    wv.addEventListener('did-navigate', apply);
    wv.addEventListener('did-navigate-in-page', apply);

    const isLoading = () => {
      try {
        return typeof wv.isLoading === 'function' ? wv.isLoading() : false;
      } catch {
        return false;
      }
    };

    if (!isLoading()) apply();

    return () => {
      wv.removeEventListener('dom-ready', apply);
      wv.removeEventListener('did-navigate', apply);
      wv.removeEventListener('did-navigate-in-page', apply);
    };
  }, []);

  // --- Status, navigation and address synchronisation ---
  useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);

  useEffect(() => {
    const view = webviewRef.current;
    if (!view) return;
    if ('isConnected' in view && !view.isConnected) return;

    webviewReadyRef.current = false;
    setWebviewReady(false);

    const updateNavigationState = () => {
      try {
        setCanGoBack(view.canGoBack());
        setCanGoForward(view.canGoForward());
      } catch {
        setCanGoBack(false);
        setCanGoForward(false);
      }
    };

    const applyUrlUpdate = (nextUrl) => {
      if (!nextUrl) return;
      const activeIdCurrent = activeIdRef.current;
      if (!activeIdCurrent) return;
      const cleanUrl = nextUrl.trim();
      if (tabsReadyRef.current) {
        updateMetaAction(activeIdCurrent, {
          url: cleanUrl,
          discarded: false,
          lastUsedAt: Date.now()
        });
        lastLoadedRef.current = { id: activeIdCurrent, url: cleanUrl };
        if (!isEditingRef.current) setInputValue(cleanUrl);
      }
    };

    const handleNavigate = (event) => {
      if (event?.url) applyUrlUpdate(event.url);
      setStatus('ready');
      updateNavigationState();
    };

    const handleStart = () => {
      webviewReadyRef.current = false;
      setWebviewReady(false);
      setStatus('loading');
    };

    const handleStop = () => {
      setStatus('ready');
      try { applyUrlUpdate(view.getURL()); } catch {}
      updateNavigationState();
      if (!webviewReadyRef.current) {
        webviewReadyRef.current = true;
        setWebviewReady(true);
      }
    };

    const handleFail = () => {
      webviewReadyRef.current = false;
      setWebviewReady(false);
      setStatus('error');
    };

    const handleDomReady = () => {
      webviewReadyRef.current = true;
      setWebviewReady(true);
      updateNavigationState();
      try { view.focus(); } catch {}
    };

    const handleTitle = (event) => {
      const id = activeIdRef.current;
      if (!id) return;
      const title = typeof event?.title === 'string' ? event.title : '';
      if (title && tabsReadyRef.current) {
        updateMetaAction(id, { title, lastUsedAt: Date.now() });
      }
    };

    const handleFavicon = (event) => {
      const id = activeIdRef.current;
      if (!id) return;
      const favicons = Array.isArray(event?.favicons) ? event.favicons : [];
      const favicon = favicons.find((href) => typeof href === 'string' && href.trim());
      if (favicon && tabsReadyRef.current) {
        updateMetaAction(id, { favicon: favicon.trim() });
      }
    };

    const handleMediaState = () => {
      const id = activeIdRef.current;
      if (!id) return;
      try {
        const muted = typeof view.isAudioMuted === 'function' ? view.isAudioMuted() : false;
        if (tabsReadyRef.current) {
          updateMetaAction(id, { muted });
        }
      } catch {}
    };

    view.addEventListener('did-navigate', handleNavigate);
    view.addEventListener('did-navigate-in-page', handleNavigate);
    view.addEventListener('did-start-loading', handleStart);
    view.addEventListener('did-stop-loading', handleStop);
    view.addEventListener('did-fail-load', handleFail);
    view.addEventListener('dom-ready', handleDomReady);
    view.addEventListener('page-title-updated', handleTitle);
    view.addEventListener('page-favicon-updated', handleFavicon);
    view.addEventListener('media-started-playing', handleMediaState);
    view.addEventListener('media-paused', handleMediaState);

    try {
      if (typeof view.isLoading === 'function' && !view.isLoading()) {
        webviewReadyRef.current = true;
        setWebviewReady(true);
      }
    } catch {}

    return () => {
      view.removeEventListener('did-navigate', handleNavigate);
      view.removeEventListener('did-navigate-in-page', handleNavigate);
      view.removeEventListener('did-start-loading', handleStart);
      view.removeEventListener('did-stop-loading', handleStop);
      view.removeEventListener('did-fail-load', handleFail);
      view.removeEventListener('dom-ready', handleDomReady);
      view.removeEventListener('page-title-updated', handleTitle);
      view.removeEventListener('page-favicon-updated', handleFavicon);
      view.removeEventListener('media-started-playing', handleMediaState);
      view.removeEventListener('media-paused', handleMediaState);
    };
  }, []);

  useEffect(() => {
    const view = webviewRef.current;
    if (!view || !tabsReady || !activeTab) return;
    if ('isConnected' in view && !view.isConnected) return;
    const targetUrl = (activeTab.url && activeTab.url.trim()) ? activeTab.url : DEFAULT_URL;
    const { id: loadedId, url: loadedUrl } = lastLoadedRef.current;
    if (loadedId === activeTab.id && loadedUrl === targetUrl) {
      return;
    }
    lastLoadedRef.current = { id: activeTab.id, url: targetUrl };
    webviewReadyRef.current = false;
    setWebviewReady(false);
    setStatus('loading');
    try {
      view.loadURL(targetUrl);
    } catch {
      try {
        view.setAttribute('src', targetUrl);
      } catch {}
    }
  }, [tabsReady, activeTab]);

  // --- Text injection helpers (used by the soft keyboard) ---
  const injectTextToWeb = useCallback(async (text) => {
    const wv = webviewRef.current;
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
  }, []);

  const injectBackspaceToWeb = useCallback(async () => {
    const wv = webviewRef.current;
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
  }, []);

  const injectArrowToWeb = useCallback(async (direction) => {
    const wv = webviewRef.current;
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
  }, []);

  // --- Toolbar event handlers ---
  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    const view = webviewRef.current;
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
  }, [inputValue, navigateActiveAction]);

  const handleBack = useCallback(() => {
    const view = webviewRef.current;
    if (view && view.canGoBack()) view.goBack();
  }, []);
  const handleForward = useCallback(() => {
    const view = webviewRef.current;
    if (view && view.canGoForward()) view.goForward();
  }, []);
  const handleReload = useCallback(() => {
    const view = webviewRef.current;
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
  }, [reloadActiveAction]);

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
    activeInputRef.current = 'modal';
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleModalInputFocus = useCallback(() => {
    activeInputRef.current = 'modal';
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleModalInputBlur = useCallback(() => {
    if (activeInputRef.current === 'modal') activeInputRef.current = null;
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
    if (mode !== 'mobile') return styles.container;
    return {
      ...styles.container,
      paddingBottom: kbVisible ? KB_HEIGHT : 0,
      transition: 'padding-bottom 160ms ease'
    };
  }, [mode, kbVisible]);

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
    const wv = webviewRef.current;
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

        document.addEventListener('focusin', handleFocusIn, true);
        document.addEventListener('focusout', handleFocusOut, true);
        document.addEventListener('pointerdown', handlePointerDown, true);
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
  }, []);

  useEffect(() => {
    const wv = webviewRef.current;
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
  }, [mode, isEditableElement]);



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
      const direct = webviewRef.current?.getURL?.();
      if (direct) return direct;
    } catch {}
    return activeTabRef.current?.url || activeUrl || null;
  };

  const openShortcutModal = () => {
    const viewUrl = getCurrentViewUrl();
    setTitle(viewUrl ? new URL(viewUrl).hostname.replace(/^www\./, '') : 'Merezhyvo');
    setMsg('');
    setBusy(false);
    setKbVisible(false);
    setShowModal(true);
  };

  const createShortcut = async () => {
    const viewUrl = getCurrentViewUrl();
    if (!viewUrl) { setMsg('Cannot detect current URL.'); return; }
    if (!title.trim()) { setMsg('Please enter a name.'); return; }

    setBusy(true); setMsg('');
    try {
      const res = await window.merezhyvo?.createShortcut?.({
        title: title.trim(),
        url: viewUrl,
        single: true
      });
      if (res?.ok) {
        setMsg(`Shortcut created:\n${res.desktopFilePath}`);
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

    if (activeTarget === 'modal' && modalInputRef.current) {
      const inputEl = modalInputRef.current;
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
  }, [busy, createShortcut, handleSubmit, injectArrowToWeb, injectBackspaceToWeb, injectTextToWeb, kbShift, kbCaps, setInputValue, setTitle]);

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

  // --- Ensure the internal <iframe> created by <webview> fills the host ---
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) {
      return undefined;
    }

    const applyShadowStyles = () => {
      try {
        const root = wv.shadowRoot;
        if (!root) {
          return;
        }
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
    wv.addEventListener('dom-ready', applyShadowStyles);

    const observer = new MutationObserver(applyShadowStyles);
    if (wv.shadowRoot) {
      try {
        observer.observe(wv.shadowRoot, { childList: true, subtree: true });
      } catch {}
    }

    return () => {
      wv.removeEventListener('dom-ready', applyShadowStyles);
      observer.disconnect();
    };
  }, []);

  return (
    <div style={containerStyle} className={`app app--${mode}`}>
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

      <webview
        ref={webviewRef}
        style={styles.webview}
        allowpopups="true"
      />

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
                Create App Shortcut
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
            <p style={mode === 'mobile' ? styles.modalBodyMobile : styles.modalBody}>
              You are about to save this page as a separate application. Please give it a name.
              <br />
              After saving, you may need to refresh the application launcher or restart your device.
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
                  ref={modalInputRef}
                  type="text"
                  value={title}
                  onPointerDown={handleModalInputPointerDown}
                  onFocus={handleModalInputFocus}
                  onBlur={handleModalInputBlur}
                  onChange={(event) => setTitle(event.target.value)}
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
