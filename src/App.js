import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import SoftKeyboard from './components/SoftKeyboard';
import { useMerezhyvoMode } from './hooks/useMerezhyvoMode';

const DEFAULT_URL = 'https://duckduckgo.com';
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
  goButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '36px',
    borderRadius: '16px',
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#f8fafc',
    fontSize: '16px',
    fontWeight: 600
  },
  goButtonIcon: { display: 'block' },
  statusIndicator: {
    minWidth: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  statusSvg: { display: 'block' },
  statusIconReady: { color: '#22c55e' },
  statusIconError: { color: '#ef4444' },
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
    height: 'min(100vh, 600px)',
    minHeight: '50vh',
    borderRadius: '28px 28px 0 0',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    boxShadow: '0 -12px 50px rgba(2, 6, 23, 0.65)',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    padding: 'calc(3vh) calc(4vw)',
    gap: 'calc(2vh)',
    boxSizing: 'border-box'
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
    width: 'clamp(72px, 10.5vw, 96px)',
    height: 'clamp(72px, 10.5vw, 96px)',
    borderRadius: '18px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'transparent',
    color: '#cbd5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'clamp(42px, 6vw, 54px)',
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
    zoomValue: { minWidth: '48px', textAlign: 'right' }
  },
  mobile: {
    toolbarBtnRegular: { width: '80px', height: '80px' },
    toolbarBtnIcn: { width: '44px', height: '44px' },
    toolbarBtnDesktopOnly: { display: 'none' },
    searchInput: { fontSize: '40px', height: '72px', paddingRight: '120px' },
    makeAppBtn: { width: '64px', height: '64px' },
    makeAppBtnIcn: { width: '40px', height: '40px' },
    statusIcon: { width: '28px', height: '28px' },
    zoomSlider: { height: '22px' },
    zoomValue: { minWidth: '90px', textAlign: 'right', fontSize: '24px' }
  }
};

const parseStartUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('start');
  if (!raw) return DEFAULT_URL;
  try { return decodeURIComponent(raw); } catch { return raw; }
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
  const initialUrl = useMemo(() => normalizeAddress(parseStartUrl()), []);
  const webviewRef = useRef(null);
  const inputRef = useRef(null);
  const modalInputRef = useRef(null);
  const activeInputRef = useRef(null);

  const [inputValue, setInputValue] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [isEditing, setIsEditing] = useState(false);
  const isEditingRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [status, setStatus] = useState('loading');

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

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
  }, []);

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

  // --- Inject custom scrollbars into the webview ---
  useEffect(() => {
    const css = `
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

    const updateNavigationState = () => {
      setCanGoBack(view.canGoBack());
      setCanGoForward(view.canGoForward());
    };

    const syncUrl = (nextUrl) => {
      if (!nextUrl) return;
      setCurrentUrl(nextUrl);
      if (!isEditingRef.current) setInputValue(nextUrl);
    };

    const handleNavigate = (event) => {
      if (event.url) syncUrl(event.url);
      setStatus('ready');
      updateNavigationState();
    };

    const handleStart = () => setStatus('loading');
    const handleStop = () => {
      setStatus('ready');
      try { syncUrl(view.getURL()); } catch {}
      updateNavigationState();
    };
    const handleFail = () => setStatus('error');
    const handleDomReady = () => { updateNavigationState(); try { view.focus(); } catch {} };

    view.addEventListener('did-navigate', handleNavigate);
    view.addEventListener('did-navigate-in-page', handleNavigate);
    view.addEventListener('did-start-loading', handleStart);
    view.addEventListener('did-stop-loading', handleStop);
    view.addEventListener('did-fail-load', handleFail);
    view.addEventListener('dom-ready', handleDomReady);

    if (!view.getAttribute('src')) {
      view.setAttribute('src', initialUrl);
    }

    return () => {
      view.removeEventListener('did-navigate', handleNavigate);
      view.removeEventListener('did-navigate-in-page', handleNavigate);
      view.removeEventListener('did-start-loading', handleStart);
      view.removeEventListener('did-stop-loading', handleStop);
      view.removeEventListener('did-fail-load', handleFail);
      view.removeEventListener('dom-ready', handleDomReady);
    };
  }, [initialUrl]);

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

          fireKeyEvent('keydown');
          if (key !== 'Unidentified') {
            fireKeyEvent('keypress');
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
            }
          } else {
            const start = el.selectionStart ?? el.value.length;
            const end   = el.selectionEnd   ?? el.value.length;
            const before = el.value.slice(0, start);
            const after  = el.value.slice(end);
            el.value = before + text + after;
            const pos = before.length + text.length;
            if (typeof el.setSelectionRange === 'function') {
              el.setSelectionRange(pos, pos);
            } else {
              el.selectionStart = el.selectionEnd = pos;
            }
            const inputEvt = new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true });
            el.dispatchEvent(inputEvt);
            success = true;
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

          fire('keydown');

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
              const inputEvt = new InputEvent('deleteContentBackward', { bubbles: true });
              el.dispatchEvent(inputEvt);
              document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
              success = true;
            }
          } else {
            const start = el.selectionStart ?? el.value.length;
            const end   = el.selectionEnd   ?? el.value.length;
            if (!(start === 0 && end === 0)) {
              const deleteStart = start === end ? Math.max(0, start - 1) : Math.min(start, end);
              const deleteEnd = Math.max(start, end);
              const before = el.value.slice(0, deleteStart);
              const after  = el.value.slice(deleteEnd);
              el.value = before + after;
              const pos = before.length;
              if (typeof el.setSelectionRange === 'function') {
                el.setSelectionRange(pos, pos);
              } else {
                el.selectionStart = el.selectionEnd = pos;
              }
              const inputEvt = new InputEvent('deleteContentBackward', { bubbles: true });
              el.dispatchEvent(inputEvt);
              document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
            }
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
    setCurrentUrl(target);
    setInputValue(target);
    setStatus('loading');
    view.loadURL(target);
    setKbVisible(false);
  }, [inputValue]);

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
    if (view) { setStatus('loading'); view.reload(); }
  }, []);

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
      base.alignItems = 'flex-end';
      base.paddingBottom = 24;
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
    try { return webviewRef.current?.getURL?.() || null; } catch { return null; }
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
            style={{ ...styles.navButton, ...modeStyles[mode].toolbarBtnRegular }}
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
            type="submit"
            style={{
              ...styles.goButton,
              ...modeStyles[mode].toolbarBtnRegular,
              ...modeStyles[mode].toolbarBtnDesktopOnly
            }}
            className="btn-regular"
            aria-label="Go"
          >
            <svg
              viewBox="0 0 16 16"
              style={{ ...styles.goButtonIcon, ...modeStyles[mode].toolbarBtnIcn }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M3 8h10M9.5 4.5 13 8l-3.5 3.5"
              />
            </svg>
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
