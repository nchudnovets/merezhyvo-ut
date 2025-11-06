import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ipc, type PermissionType } from '../../../services/ipc/ipc';

type PromptReq = {
  id: string;
  origin: string;
  types: PermissionType[];
};

function humanSite(origin: string): string {
  try {
    const u = new URL(origin);
    return u.host || origin;
  } catch {
    return origin;
  }
}

function typeLabel(t: PermissionType): string {
  switch (t) {
    case 'camera':
      return 'Camera';
    case 'microphone':
      return 'Microphone';
    case 'geolocation':
      return 'Geolocation';
    case 'notifications':
      return 'Notifications';
  }
}

export const PermissionPrompt: React.FC = () => {
  const [queue, setQueue] = useState<PromptReq[]>([]);
  const [remember, setRemember] = useState<boolean>(true);
  const [selected, setSelected] = useState<Record<PermissionType, boolean>>({
    camera: true,
    microphone: true,
    geolocation: true,
    notifications: true
  });

  useEffect(() => {
    const off = ipc.permissions.onPrompt((req) => {
      // initialize selection for requested types only
      const init: Record<PermissionType, boolean> = {
        camera: true,
        microphone: true,
        geolocation: true,
        notifications: true
      };
      for (const k of Object.keys(init) as PermissionType[]) {
        init[k] = req.types.includes(k);
      }
      setSelected(init);
      setQueue((q) => [...q, req]);
    });
    return off;
  }, []);

  const current = queue.length > 0 ? queue[0] : null;

  const labels = useMemo(() => {
    if (!current) return '';
    return current.types.map(typeLabel).join(', ');
  }, [current]);

  const toggle = useCallback((t: PermissionType) => {
    setSelected((s) => ({ ...s, [t]: !s[t] }));
  }, []);

  const decide = useCallback(
    (allowAll: boolean) => {
      if (!current) return;

      // Build per-type persist map from the current selection.
      // For "Deny", we store deny for all requested types.
      // For "Allow", we store allow for checked types, deny for unchecked (to honor user intent later).
      const persist = current.types.reduce<Partial<Record<PermissionType, 'allow' | 'deny'>>>((acc, t) => {
        if (allowAll) {
          acc[t] = selected[t] ? 'allow' : 'deny';
        } else {
          acc[t] = 'deny';
        }
        return acc;
      }, {});

      // Electron's permission callback is boolean for the *entire* request.
      // If the site requested multiple types (e.g., camera+microphone),
      // partial grant isn't possible in this single callback.
      // We only return allow=true if ALL requested types are checked.
      const allChecked = current.types.every((t) => selected[t] === true);
      const allowForThisRequest = allowAll && allChecked;

      ipc.permissions.decide({
        id: current.id,
        allow: allowForThisRequest,
        remember,
        persist
      });

      setQueue((q) => q.slice(1));
      setRemember(true);
    },
    [current, remember, selected]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        decide(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        decide(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, decide]);

  if (!current) return null;

  const multi = current.types.length > 1;
  const anyUnchecked = multi && current.types.some((t) => selected[t] === false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        style={{
          width: 'min(560px, 96vw)',
          backgroundColor: '#111317',
          color: '#e5e7eb',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Allow access?</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
            <span style={{ opacity: 0.8 }}>Site</span>{' '}
            <span style={{ fontWeight: 600 }}>{humanSite(current.origin)}</span> requests:{' '}
            <span style={{ fontStyle: 'italic' }}>{labels}</span>
          </div>
          {multi ? (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
              Unchecking any item will deny this particular request (partial grant isn’t supported by Chromium), but your
              choices will be remembered per type for future requests.
            </div>
          ) : null}
        </div>

        <div style={{ padding: '16px 20px' }}>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 14 }}>
            {current.types.map((t) => (
              <li key={t} style={{ textTransform: 'none', display: 'flex', gap: 8, alignItems: 'center' }}>
                {t === 'camera' || t === 'microphone' ? (
                  <>
                    <input
                      type="checkbox"
                      checked={selected[t]}
                      onChange={() => toggle(t)}
                      style={{ transform: 'translateY(1px)' }}
                    />
                    <span>{typeLabel(t)}</span>
                  </>
                ) : (
                  <span>{typeLabel(t)}</span>
                )}
              </li>
            ))}
          </ul>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ transform: 'translateY(1px)' }}
            />
            Remember for this site
          </label>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            padding: '14px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <button
            onClick={() => decide(false)}
            style={{
              padding: '8px 14px',
              fontSize: 14,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: '#e5e7eb',
              cursor: 'pointer'
            }}
          >
            Deny
          </button>
          <button
            onClick={() => decide(true)}
            style={{
              padding: '8px 14px',
              fontSize: 14,
              borderRadius: 8,
              border: anyUnchecked ? '1px solid #a78bfa' : '1px solid #3b82f6',
              background: anyUnchecked ? '#6d28d9' : '#2563eb',
              color: 'white',
              cursor: 'pointer'
            }}
            title={anyUnchecked ? 'Some items are unchecked. The current request will still be denied.' : undefined}
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
};
