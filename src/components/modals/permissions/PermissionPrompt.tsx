import React, { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ipc, type PermissionType } from '../../../services/ipc/ipc';
import { useMerezhyvoMode } from '../../../hooks/useMerezhyvoMode';
import { permissionPromptStyles, permissionPromptModeStyles } from './permissionPromptStyles';

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

  const mode = useMerezhyvoMode();
  const styles = permissionPromptStyles;
  const modeStyles = permissionPromptModeStyles[mode] || {};

  const compose = <K extends keyof typeof styles>(key: K): CSSProperties => ({
    ...styles[key],
    ...(modeStyles[key] || {})
  });

  const buttonStyle = (...keys: (keyof typeof styles)[]): CSSProperties =>
    keys.reduce(
      (acc, key) => ({
        ...acc,
        ...compose(key)
      }),
      {}
    );

  if (!current) return null;

  const multi = current.types.length > 1;
  const anyUnchecked = multi && current.types.some((t) => selected[t] === false);

  return (
    <div role="dialog" aria-modal="true" style={compose('shell')}>
      <div style={compose('card')}>
        <div style={compose('section')}>
          <div style={compose('badge')}>Permission request</div>
          <div style={compose('title')}>Allow access?</div>
          <div style={compose('metaColumn')}>
            <span style={compose('siteText')}>
              <span style={compose('sitePrefix')}>Site</span>{' '}
              <span style={{ fontWeight: 600 }}>{humanSite(current.origin)}</span> requests{' '}
              <span style={compose('requestList')}>{labels}</span>
            </span>
            {multi ? (
              <span style={compose('multiNote')}>
                Unchecking an item remembers your choice for next time. This specific request is only granted if every
                item stays checked.
              </span>
            ) : null}
          </div>
        </div>

        <div style={compose('divider')} />

        <div
          style={{
            ...compose('section'),
            gap: 14
          }}
        >
          <div style={compose('permissionsList')}>
            {current.types.map((t) => {
              const canToggle = t === 'camera' || t === 'microphone';
              const rowStyle: CSSProperties = {
                ...compose('permissionRow'),
                ...(selected[t] ? compose('permissionRowSelected') : {}),
                cursor: canToggle ? 'pointer' : 'default'
              };
              return (
                <label key={t} style={rowStyle}>
                  <div style={compose('permissionInfo')}>
                    <span style={compose('permissionLabel')}>{typeLabel(t)}</span>
                    <span style={compose('permissionHint')}>
                      {canToggle ? 'Toggle to remember a different default for this site.' : 'Handled automatically.'}
                    </span>
                  </div>
                  {canToggle ? (
                    <input
                      type="checkbox"
                      checked={selected[t]}
                      onChange={() => toggle(t)}
                      style={compose('checkbox')}
                    />
                  ) : null}
                </label>
              );
            })}
          </div>

          <div style={compose('rememberRow')}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={compose('checkbox')}
            />
            <span style={compose('rememberLabel')}>Remember this choice for this site</span>
          </div>
        </div>

        <div style={compose('divider')} />

        <div style={compose('actions')}>
          <button onClick={() => decide(false)} style={buttonStyle('actionButton', 'actionButtonOutline')}>
            Deny
          </button>
          <button
            onClick={() => decide(true)}
            style={buttonStyle(
              'actionButton',
              'actionButtonPrimary',
              ...(anyUnchecked ? (['actionButtonMuted'] as const) : [])
            )}
            title={anyUnchecked ? 'Some permissions are unchecked so this request will still be denied.' : undefined}
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
};
