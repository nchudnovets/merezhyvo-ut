// src/App.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMerezhyvoMode } from './hooks/useMerezhyvoMode';

const DEFAULT_URL = 'https://duckduckgo.com';

const parseStartUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('start');
  if (!raw) return DEFAULT_URL;
  try { return decodeURIComponent(raw); } catch { return raw; }
};

const normalizeAddress = (value) => {
  if (!value || !value.trim()) return DEFAULT_URL;
  const trimmed = value.trim();

  // already has scheme
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed;

  // spaces -> search
  if (trimmed.includes(' ')) {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }

  // single token without dot → search (except localhost)
  if (!trimmed.includes('.') && trimmed.toLowerCase() !== 'localhost') {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }

  // try https:// + token
  try {
    const candidate = new URL(`https://${trimmed}`);
    return candidate.href;
  } catch {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#0f111a',
    color: '#f8fafc'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    padding: '5px 12px',
    gap: '10px',
    backgroundColor: '#121826',
    boxShadow: '0 1px 6px rgba(0, 0, 0, 0.35)',
    zIndex: 10
  },
  navGroup: { display: 'flex', gap: '6px' },
  navButton: {
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
  form: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1 },
  addressField: { position: 'relative', width: '100%' },
  input: {
    flex: 1,
    width: '100%',
    borderRadius: '16px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#0f1729',
    color: '#f8fafc',
    padding: '0 52px 0 14px',
    outline: 'none'
  },
  goButton: {
    borderRadius: '16px',
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#f8fafc',
    fontSize: '16px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  goButtonIcon: { display: 'block' },
  statusIndicator: {
    minWidth: '22px',
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
  webview: { flex: 1, border: 'none', backgroundColor: '#05070f' }
};

const modeStyles = {
  desktop: {
    toolbarBtnRegular: { width: '40px', height: '40px' },
    toolbarBtnIcn: { width: '18px', height: '18px' },
    toolbarBtnDesktopOnly: {},
    searchInput: { fontSize: '14px', height: '30px' },
    makeAppBtn: { height: '26px' },
    statusIcon: { width: '14px', height: '14px' }
  },
  mobile: {
    toolbarBtnRegular: { width: '100px', height: '100px' },
    toolbarBtnIcn: { width: '50px', height: '50px' },
    toolbarBtnDesktopOnly: { display: 'none' },
    searchInput: { fontSize: '50px', height: '80px', paddingRight: '60px' },
    makeAppBtn: { height: '60px', width: '60px' },
    statusIcon: { width: '32px', height: '32px' }
  }
};

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.1;

const App = () => {
  const initialUrl = useMemo(() => normalizeAddress(parseStartUrl()), []);
  const webviewRef = useRef(null);

  const [inputValue, setInputValue] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [isEditing, setIsEditing] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [status, setStatus] = useState('loading');
  const isEditingRef = useRef(false);

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const mode = useMerezhyvoMode();

  // Локальне значення зуму (без читання з webview, щоб не ловити "could not be cloned")
  const zoomRef = useRef(mode === 'mobile' ? 1.20 : 1.00);
  useEffect(() => {
    zoomRef.current = mode === 'mobile' ? 1.20 : 1.00;
  }, [mode]);

  // ---- ЗУМ + PINCH всередині webview (без getZoomFactor) ----
  const setZoomClamped = useCallback((val) => {
    const wv = webviewRef.current;
    if (!wv) return;
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +val.toFixed(2)));
    try {
      if (typeof wv.setZoomFactor === 'function') {
        wv.setZoomFactor(next);
      } else {
        // fallback у guest-контексті
        wv.executeJavaScript(`require('electron').webFrame.setZoomFactor(${next})`).catch(() => {});
      }
      zoomRef.current = next;
    } catch {}
  }, []);

  const applyZoomPolicy = useCallback(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    try {
      if (typeof wv.setVisualZoomLevelLimits === 'function') {
        wv.setVisualZoomLevelLimits(1, 3); // pinch 100–300%
      }
      setZoomClamped(zoomRef.current);     // початковий/поточний масштаб
    } catch {}
  }, [setZoomClamped]);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const onReady = () => applyZoomPolicy();
    const onNav   = () => applyZoomPolicy();

    wv.addEventListener('dom-ready', onReady);
    wv.addEventListener('did-frame-finish-load', onReady);
    wv.addEventListener('did-navigate', onNav);
    wv.addEventListener('did-navigate-in-page', onNav);

    if (wv.isLoading && !wv.isLoading()) applyZoomPolicy();

    return () => {
      wv.removeEventListener('dom-ready', onReady);
      wv.removeEventListener('did-frame-finish-load', onReady);
      wv.removeEventListener('did-navigate', onNav);
      wv.removeEventListener('did-navigate-in-page', onNav);
    };
  }, [applyZoomPolicy]);

  // Кнопки A- / A+
  const zoomOut = useCallback(() => setZoomClamped(zoomRef.current - ZOOM_STEP), [setZoomClamped]);
  const zoomIn  = useCallback(() => setZoomClamped(zoomRef.current + ZOOM_STEP), [setZoomClamped]);

  // ---- Кастомні скролбари всередині webview ----
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

    const apply = () => { wv.insertCSS(css).catch(() => {}); };

    wv.addEventListener('dom-ready', apply);
    wv.addEventListener('did-navigate', apply);
    wv.addEventListener('did-navigate-in-page', apply);

    if (wv.isLoading && !wv.isLoading()) apply();

    return () => {
      wv.removeEventListener('dom-ready', apply);
      wv.removeEventListener('did-navigate', apply);
      wv.removeEventListener('did-navigate-in-page', apply);
    };
  }, []);

  // ---- Статус/навігація, синхронізація адреси ----
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

  // ---- Дії тулбара ----
  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    const view = webviewRef.current;
    if (!view) return;
    const target = normalizeAddress(inputValue);
    setCurrentUrl(target);
    setInputValue(target);
    setStatus('loading');
    view.loadURL(target);
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
  }, []);

  const handleInputBlur = useCallback(() => {
    isEditingRef.current = false;
    setIsEditing(false);
    setInputValue(currentUrl);
  }, [currentUrl]);

  // ---- Ярлик-додаток ----
  const openShortcutModal = () => {
    const viewUrl = (() => {
      try { return webviewRef.current?.getURL?.() || null; } catch { return null; }
    })();
    setTitle(viewUrl ? new URL(viewUrl).hostname.replace(/^www\./, '') : 'Merezhyvo');
    setShowModal(true);
  };

  const createShortcut = async () => {
    const viewUrl = (() => {
      try { return webviewRef.current?.getURL?.() || null; } catch { return null; }
    })();
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

  const statusLabelMap = {
    loading: 'Loading',
    ready: 'Ready',
    error: 'Failed to load'
  };

  return (
    <div style={styles.container} className={`app app--${mode}`}>
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
            <svg viewBox="0 0 16 16"
                 style={{ ...styles.navIcon, ...modeStyles[mode].toolbarBtnIcn }}
                 xmlns="http://www.w3.org/2000/svg">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M13 8H5M8.5 4.5L5 8l3.5 3.5"/>
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
            <svg viewBox="0 0 16 16"
                 style={{ ...styles.navIcon, ...modeStyles[mode].toolbarBtnIcn }}
                 xmlns="http://www.w3.org/2000/svg">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M3 8h8M7.5 4.5L11 8l-3.5 3.5"/>
            </svg>
          </button>

          <button
            type="button"
            aria-label="Reload"
            onClick={handleReload}
            style={{ ...styles.navButton, ...modeStyles[mode].toolbarBtnRegular }}
            className="btn-regular"
          >
            <svg viewBox="0 0 16 16"
                 style={{ ...styles.navIcon, ...modeStyles[mode].toolbarBtnIcn }}
                 xmlns="http://www.w3.org/2000/svg">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M12.5 5.5A4.5 4.5 0 1 0 13 9.5"/>
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M12.5 5.5H9.5M12.5 5.5V8.5"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.addressField}>
            <input
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
              style={modeStyles[mode].makeAppBtn}
              onClick={openShortcutModal}
              title="Create app shortcut from this site"
              aria-label="Create app shortcut from this site"
            >
              <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                      d="M8 2v6m0 0-2.5-2.5M8 8l2.5-2.5"/>
                <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                      d="M4 9.5h8V13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5"/>
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
            <svg viewBox="0 0 16 16"
                 style={{ ...styles.goButtonIcon, ...modeStyles[mode].toolbarBtnIcn }}
                 xmlns="http://www.w3.org/2000/svg">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M3 8h10M9.5 4.5 13 8l-3.5 3.5"/>
            </svg>
          </button>
        </form>

        {/* Zoom controls */}
        <div style={styles.navGroup}>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={zoomOut}
            style={{ ...styles.navButton, ...modeStyles[mode].toolbarBtnRegular }}
            className="btn-regular"
            title="Zoom out"
          >
            A−
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={zoomIn}
            style={{ ...styles.navButton, ...modeStyles[mode].toolbarBtnRegular }}
            className="btn-regular"
            title="Zoom in"
          >
            A+
          </button>
        </div>

        <div style={styles.statusIndicator} role="status" aria-label={statusLabelMap[status]}>
          {status === 'loading' && <span style={styles.spinner} aria-hidden="true" />}
          {status === 'ready' && (
            <svg viewBox="0 0 16 16"
                 style={{ ...styles.statusSvg, ...styles.statusIconReady, ...modeStyles[mode].statusIcon }}
                 xmlns="http://www.w3.org/2000/svg">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M3.5 8.5 6.5 11.5 12.5 5.5"/>
            </svg>
          )}
          {status === 'error' && (
            <svg viewBox="0 0 16 16"
                 style={{ ...styles.statusSvg, ...styles.statusIconError }}
                 xmlns="http://www.w3.org/2000/svg">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"/>
            </svg>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Create app shortcut</h3>
            <p style={{ opacity: 0.8, marginTop: -6 }}>
              The icon will be fetched automatically from the site (favicon). If it fails,
              a default Merezhyvo icon will be used.
            </p>
            <label style={{ display: 'block', marginBottom: 12 }}>
              Name
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="YouTube Music"
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
            {msg && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, opacity: 0.9 }}>{msg}</pre>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setShowModal(false)} disabled={busy}>Cancel</button>
              <button onClick={createShortcut} disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      <webview
        ref={webviewRef}
        style={styles.webview}
        allowpopups="true"
      />
    </div>
  );
};

export default App;
