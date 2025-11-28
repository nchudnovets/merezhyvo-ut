// for future, not implemented yet

import React, { useEffect, useMemo, useState } from 'react';
import { toastCenterStyles, toastCenterMobStyles } from './ToastCenterStyles';
import { useI18n } from '../../i18n/I18nProvider';

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
  const { t } = useI18n();

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
        addToast();
        return;
    }

    try {
        if (typeof window.Notification === 'function') {
        new window.Notification(detail.title, {
            body: detail.options.body || '',
            icon: detail.options.icon || undefined
        });
        return; 
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
    <div style={toastCenterStyles.container}>
      {visible.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent('mzr-focus-tab', {
                detail: { tabId: t.source?.tabId, url: t.source?.url }
              })
            );
            setItems((prev) => prev.filter((x) => x.id !== t.id));
          }}
          style={{...toastCenterStyles.toast, ...toastCenterMobStyles.toast}}
        >
          {/* Icon */}
          <div style={toastCenterStyles.icon}>
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
          <div style={toastCenterStyles.content}>
            <div style={{...toastCenterStyles.title, ...toastCenterMobStyles.title}}>{t.title}</div>
            {t.options.body ? (
              <div style={{...toastCenterStyles.body, ...toastCenterMobStyles.body}}>{t.options.body}</div>
            ) : null}

            <button
              onClick={(ev) => {
                ev.stopPropagation();
                setItems((prev) => prev.filter((x) => x.id !== t.id));
              }}
              style={toastCenterStyles.dismiss}
            >
              {t('toast.dismiss')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
