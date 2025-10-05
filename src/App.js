import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_URL = 'https://duckduckgo.com';

const parseStartUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('start');
  if (!raw) {
    return DEFAULT_URL;
  }

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const normalizeAddress = (value) => {
  if (!value) {
    return DEFAULT_URL;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_URL;
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.includes(' ')) {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }

  try {
    const candidate = new URL(trimmed);
    return candidate.href;
  } catch {
    return `https://${trimmed}`;
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
  navGroup: {
    display: 'flex',
    gap: '6px'
  },
  navButton: {
    width: '40px',
    height: '40px',
    borderRadius: '14px',
    border: 'none',
    backgroundColor: '#1c2333',
    color: '#f8fafc',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  navButtonDisabled: {
    opacity: 0.35
  },
  form: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1
  },
  input: {
    flex: 1,
    height: '30px',
    borderRadius: '16px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#0f1729',
    color: '#f8fafc',
    fontSize: '14px',
    padding: '0 14px',
    outline: 'none'
  },
  goButton: {
    height: '35px',
    padding: '0 18px',
    borderRadius: '16px',
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#f8fafc',
    fontSize: '14px',
    fontWeight: 600
  },
  status: {
    minWidth: '70px',
    textAlign: 'right',
    fontSize: '13px',
    color: '#94a3b8'
  },
  webview: {
    flex: 1,
    border: 'none',
    backgroundColor: '#05070f'
  }
};

const App = () => {
  const initialUrl = useMemo(() => normalizeAddress(parseStartUrl()), []);
  const webviewRef = useRef(null);
  const [inputValue, setInputValue] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Loading…');
  const isEditingRef = useRef(false);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    const view = webviewRef.current;
    if (!view) {
      return;
    }

    const updateNavigationState = () => {
      setCanGoBack(view.canGoBack());
      setCanGoForward(view.canGoForward());
    };

    const syncUrl = (nextUrl) => {
      if (!nextUrl) {
        return;
      }
      setCurrentUrl(nextUrl);
      if (!isEditingRef.current) {
        setInputValue(nextUrl);
      }
    };

    const handleNavigate = (event) => {
      if (event.url) {
        syncUrl(event.url);
      }
      setStatusMessage('Ready');
      updateNavigationState();
    };

    const handleStart = () => {
      setIsLoading(true);
      setStatusMessage('Loading…');
    };

    const handleStop = () => {
      setIsLoading(false);
      setStatusMessage('Ready');
      syncUrl(view.getURL());
      updateNavigationState();
    };

    const handleFail = () => {
      setIsLoading(false);
      setStatusMessage('Failed to load');
    };

    const handleDomReady = () => {
      updateNavigationState();
      view.focus();
    };

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

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      const view = webviewRef.current;
      if (!view) {
        return;
      }

      const target = normalizeAddress(inputValue);
      setCurrentUrl(target);
      setInputValue(target);
      setIsLoading(true);
      setStatusMessage('Loading…');
      view.loadURL(target);
    },
    [inputValue]
  );

  const handleBack = useCallback(() => {
    const view = webviewRef.current;
    if (view && view.canGoBack()) {
      view.goBack();
    }
  }, []);

  const handleForward = useCallback(() => {
    const view = webviewRef.current;
    if (view && view.canGoForward()) {
      view.goForward();
    }
  }, []);

  const handleReload = useCallback(() => {
    const view = webviewRef.current;
    if (view) {
      setIsLoading(true);
      setStatusMessage('Loading…');
      view.reload();
    }
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

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div style={styles.navGroup}>
          <button
            type="button"
            aria-label="Back"
            disabled={!canGoBack}
            onClick={handleBack}
            style={{
              ...styles.navButton,
              ...(canGoBack ? null : styles.navButtonDisabled)
            }}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Forward"
            disabled={!canGoForward}
            onClick={handleForward}
            style={{
              ...styles.navButton,
              ...(canGoForward ? null : styles.navButtonDisabled)
            }}
          >
            →
          </button>
          <button
            type="button"
            aria-label="Reload"
            onClick={handleReload}
            style={styles.navButton}
          >
            ⟳
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            placeholder="Enter a URL or search"
            style={styles.input}
          />
          <button type="submit" style={styles.goButton}>
            Go
          </button>
        </form>

        <div style={styles.status}>{statusMessage}</div>
      </div>

      <webview ref={webviewRef} style={styles.webview} allowpopups="true" />
    </div>
  );
};

export default App;
