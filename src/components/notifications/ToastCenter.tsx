import React, { useEffect, useMemo, useState } from 'react';

type ToastPayload = {
  title: string;
  options: { body: string; icon: string; data: unknown; tag: string };
  source?: { tabId?: string; url?: string };
};

type ToastItem = ToastPayload & {
  id: string;
  createdAt: number;
  ttlMs: number;
};

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const ToastCenter: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const maxOnScreen = 3;
  const defaultTtl = 5000;

  // Add toasts from window event fired by WebViewHost (mzr:webview:notification mirror)
  useEffect(() => {
    const handler = (e: Event) => {
    const detail = (e as CustomEvent<ToastPayload>).detail;
    if (!detail || !detail.title) return;

    const addToast = () => {
        const t: ToastItem = {
        ...detail,
        id: uid(),
        createdAt: Date.now(),
        ttlMs: defaultTtl
        };
        setItems((prev) => {
        const next = [...prev, t];
        return next.slice(-8);
        });
    };

    const isFocused = document.hasFocus();

    if (isFocused) {
        // Foreground: show in-app toast only (no system duplicate).
        addToast();
        return;
    }

    // Background: prefer system notification; fallback to in-app toast on failure.
    try {
        if (typeof window.Notification === 'function') {
        new window.Notification(detail.title, {
            body: detail.options.body || '',
            icon: detail.options.icon || undefined
        });
        return; // do not add toast when system notification is shown
        }
    } catch {
        // ignore and fallback below
    }

    addToast();
    };
    window.addEventListener('mzr-notification' as unknown as keyof WindowEventMap, handler as EventListener);
    return () =>
      window.removeEventListener('mzr-notification' as unknown as keyof WindowEventMap, handler as EventListener);
  }, []);

  // Auto-remove by TTL
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      setItems((prev) => prev.filter((it) => now - it.createdAt < it.ttlMs));
    }, 250);
    return () => clearInterval(tick);
  }, []);

  const visible = useMemo(() => items.slice(-maxOnScreen), [items, maxOnScreen]);

  if (visible.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 10001,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none' // let clicks pass through except on cards
      }}
    >
      {visible.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          onClick={() => {
            // Ask App to focus the source tab (or match by URL)
            window.dispatchEvent(
              new CustomEvent('mzr-focus-tab', {
                detail: { tabId: t.source?.tabId, url: t.source?.url }
              })
            );
            setItems((prev) => prev.filter((x) => x.id !== t.id));
          }}
          style={{
            width: 'min(380px, 92vw)',
            display: 'grid',
            gridTemplateColumns: '40px 1fr',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(17,19,23,0.96)',
            boxShadow: '0 10px 22px rgba(0,0,0,0.4)',
            color: '#e5e7eb',
            pointerEvents: 'auto',
            transition: 'transform 120ms ease, opacity 120ms ease'
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            {t.options.icon ? (
              <img
                src={t.options.icon}
                alt=""
                style={{ width: 24, height: 24, objectFit: 'cover', filter: 'saturate(0.9) brightness(1.1)' }}
              />
            ) : (
              <span style={{ fontSize: 18, opacity: 0.8 }}>🔔</span>
            )}
          </div>

          {/* Text */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t.title}
            </div>
            {t.options.body ? (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  lineHeight: 1.35,
                  opacity: 0.9,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}
              >
                {t.options.body}
              </div>
            ) : null}

            {/* Close button */}
            <div style={{ marginTop: 8 }}>
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  setItems((prev) => prev.filter((x) => x.id !== t.id));
                }}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent',
                  color: '#e5e7eb',
                  cursor: 'pointer'
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
