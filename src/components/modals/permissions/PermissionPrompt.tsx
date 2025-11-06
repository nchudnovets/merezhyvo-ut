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
      return 'camera';
    case 'microphone':
      return 'microphone';
    case 'geolocation':
      return 'geolocation';
    case 'notifications':
      return 'notifications';
  }
}

export const PermissionPrompt: React.FC = () => {
  const [queue, setQueue] = useState<PromptReq[]>([]);
  const [remember, setRemember] = useState<boolean>(true);

  useEffect(() => {
    // Subscribe to permission prompts from main process
    const off = ipc.permissions.onPrompt((req) => {
      setQueue((q) => [...q, req]);
    });
    return off;
  }, []);

  const current = queue.length > 0 ? queue[0] : null;

  const labels = useMemo(() => {
    if (!current) return '';
    return current.types.map(typeLabel).join(', ');
  }, [current]);

  const decide = useCallback(
    (allow: boolean) => {
      if (!current) return;
      const persist = current.types.reduce<Partial<Record<PermissionType, 'allow' | 'deny'>>>((acc, t) => {
        acc[t] = allow ? 'allow' : 'deny';
        return acc;
      }, {});
      ipc.permissions.decide({
        id: current.id,
        allow,
        remember,
        persist
      });
      setQueue((q) => q.slice(1));
      setRemember(true);
    },
    [current, remember]
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

  // Simple overlay modal; scoped styles only here
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
          <div style={{ fontSize: 16, fontWeight: 600 }}>Allow?</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
            <span style={{ opacity: 0.8 }}>Page</span>{' '}
            <span style={{ fontWeight: 600 }}>{humanSite(current.origin)}</span> asks permissions for:{' '}
            <span style={{ fontStyle: 'italic' }}>{labels}</span>
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 14 }}>
            {current.types.map((t) => (
              <li key={t} style={{ textTransform: 'capitalize' }}>
                {typeLabel(t)}
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
            Remember for this page
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
              border: '1px solid #3b82f6',
              background: '#2563eb',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
};
