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
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.1;
const KB_HEIGHT = 260;

const styles = {
  container: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
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
    padding: '6px 28px',
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

  const mode = useMerezhyvoMode();

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

  // --- Zoom management inside the webview ---
  const zoomRef = useRef(mode === 'mobile' ? 1.2 : 1.0);
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
    const base = mode === 'mobile' ? 1.2 : 1.0;
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
      (function(txt){
        try {
          const el = document.activeElement;
          if (!el) return false;
          const isEditable = el.isContentEditable || (typeof el.value === 'string');
          if (!isEditable) return false;

          if (el.isContentEditable) {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return false;
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(txt));
            range.collapse(false);
            const evt = new InputEvent('input', {inputType:'insertText', data: txt, bubbles:true});
            el.dispatchEvent(evt);
            return true;
          } else {
            const start = el.selectionStart ?? el.value.length;
            const end   = el.selectionEnd   ?? el.value.length;
            const before = el.value.slice(0, start);
            const after  = el.value.slice(end);
            el.value = before + txt + after;
            const pos = before.length + txt.length;
            el.selectionStart = el.selectionEnd = pos;
            const evt = new InputEvent('input', {inputType:'insertText', data: txt, bubbles:true});
            el.dispatchEvent(evt);
            return true;
          }
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

          if (el.isContentEditable) {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return false;
            const range = sel.getRangeAt(0);
            if (!range.collapsed) {
              range.deleteContents();
            } else {
              range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
              range.deleteContents();
            }
            const evt = new InputEvent('deleteContentBackward', {bubbles:true});
            el.dispatchEvent(evt);
            return true;
          } else {
            const start = el.selectionStart ?? el.value.length;
            const end   = el.selectionEnd   ?? el.value.length;
            if (start === 0 && end === 0) return true;
            const before = el.value.slice(0, Math.max(0, start - (start === end ? 1 : 0)));
            const after  = el.value.slice(end);
            el.value = before + after;
            const pos = before.length;
            el.selectionStart = el.selectionEnd = pos;
            const evt = new InputEvent('deleteContentBackward', {bubbles:true});
            el.dispatchEvent(evt);
            return true;
          }
        } catch(e) { return false; }
      })();
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

  const handleInputFocus = useCallback((event) => {
    isEditingRef.current = true;
    setIsEditing(true);
    event.target.select();
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleInputBlur = useCallback(() => {
    isEditingRef.current = false;
    setIsEditing(false);
    setInputValue(currentUrl);
  }, [currentUrl]);

  // --- Shortcut modal helpers ---
  const getCurrentViewUrl = () => {
    try { return webviewRef.current?.getURL?.() || null; } catch { return null; }
  };

  const openShortcutModal = () => {
    const viewUrl = getCurrentViewUrl();
    setTitle(viewUrl ? new URL(viewUrl).hostname.replace(/^www\./, '') : 'Merezhyvo');
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
        setShowModal(false);
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
    if (isEditingRef.current && inputRef.current) {
      if (key === 'Backspace') {
        setInputValue((value) => value.slice(0, -1));
      } else if (key === 'Enter') {
        const fake = { preventDefault: () => {} };
        handleSubmit(fake);
      } else {
        setInputValue((value) => value + key);
      }
      if (kbShift && !kbCaps) setKbShift(false);
      return;
    }

    if (key === 'Backspace') {
      await injectBackspaceToWeb();
    } else if (key === 'Enter') {
      await injectTextToWeb('\n');
    } else {
      await injectTextToWeb(key);
    }
    if (kbShift && !kbCaps) setKbShift(false);
  }, [handleSubmit, injectBackspaceToWeb, injectTextToWeb, kbShift, kbCaps]);

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
  const keyboardPadding = mode === 'mobile' && kbVisible ? KB_HEIGHT + 8 : 0;

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

  // --- Toggle keyboard visibility when interacting with the webview ---
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) {
      return undefined;
    }

    const handleFocus = () => {
      if (mode === 'mobile') setKbVisible(true);
    };
    const handleBlur = () => {
      if (mode === 'mobile') setKbVisible(false);
    };
    const handlePointerDown = () => {
      if (mode === 'mobile') setKbVisible(true);
    };

    wv.addEventListener('focus', handleFocus);
    wv.addEventListener('blur', handleBlur);
    wv.addEventListener('pointerdown', handlePointerDown);

    return () => {
      wv.removeEventListener('focus', handleFocus);
      wv.removeEventListener('blur', handleBlur);
      wv.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [mode]);

  return (
    <div
      style={{
        ...styles.container,
        paddingBottom: keyboardPadding
      }}
      className={`app app--${mode}`}
    >
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

      <SoftKeyboard
        visible={mode === 'mobile' && kbVisible}
        height={KB_HEIGHT}
        layoutId={kbLayout}
        shift={kbShift}
        caps={kbCaps}
        onKey={sendKeyToWeb}
        onClose={() => setKbVisible(false)}
        onToggleShift={toggleShift}
        onToggleCaps={toggleCaps}
        onToggleSymbols={toggleSymbols}
        onNextLayout={nextLayout}
      />
    </div>
  );
};

export default App;
