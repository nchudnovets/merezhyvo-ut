import React, { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import { ipc, type PermissionType } from '../../../services/ipc/ipc';

type PermDecision = 'allow' | 'deny';
type PermDefault = 'allow' | 'deny' | 'prompt';

type PermState = {
  schema: 1;
  defaults: Record<PermissionType, PermDefault>;
  sites: Record<string, Partial<Record<PermissionType, PermDecision>>>;
};

const PERM_TYPES: PermissionType[] = ['camera', 'microphone', 'geolocation', 'notifications'];

function labelFor(p: PermissionType): string {
  switch (p) {
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

export const PermissionsSettings: React.FC = () => {
  const [state, setState] = useState<PermState | null>(null);
  const [query, setQuery] = useState<string>('');

  const refresh = useCallback(async () => {
    const st = await ipc.permissions.store.get();
    startTransition(() => {
        setState(st as PermState);
    });
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void refresh();
    });
    return () => cancelAnimationFrame(id);
  }, [refresh]);

  const sites = useMemo(() => {
    const entries = state ? Object.entries(state.sites) : [];
    const filtered = query.trim()
      ? entries.filter(([origin]) => origin.toLowerCase().includes(query.trim().toLowerCase()))
      : entries;
    return filtered.sort(([a], [b]) => a.localeCompare(b));
  }, [state, query]);

  const updateSite = useCallback(
    async (origin: string, patch: Partial<Record<PermissionType, PermDecision>>) => {
      await ipc.permissions.store.updateSite(origin, patch);
      await refresh();
    },
    [refresh]
  );

  const resetSite = useCallback(
    async (origin: string) => {
      await ipc.permissions.store.resetSite(origin);
      await refresh();
    },
    [refresh]
  );

  const resetAll = useCallback(async () => {
    if (!confirm('Reset all site-specific permissions?')) return;
    await ipc.permissions.store.resetAll();
    await refresh();
  }, [refresh]);

  const setDefault = useCallback(
    async (perm: PermissionType, next: PermDefault) => {
      await ipc.permissions.store.updateDefaults({ [perm]: next });
      await refresh();
    },
    [refresh]
  );

  const resetDefaultsToPrompt = useCallback(async () => {
    await ipc.permissions.store.updateDefaults({
      camera: 'prompt',
      microphone: 'prompt',
      geolocation: 'prompt',
      notifications: 'prompt'
    });
    await refresh();
  }, [refresh]);

  function segStyle(active: boolean, tone: 'blue' | 'gray' | 'red'): React.CSSProperties {
    const border =
      tone === 'blue' ? 'rgba(59,130,246,0.5)' : tone === 'red' ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)';
    const bg = active ? (tone === 'blue' ? '#2563eb' : tone === 'red' ? '#ef4444' : 'rgba(255,255,255,0.08)') : 'transparent';
    const color = active ? '#fff' : 'inherit';
    return {
      padding: '6px 10px',
      borderRadius: 8,
      border: `1px solid ${border}`,
      background: bg,
      color,
      cursor: 'pointer',
      fontSize: 12,
      minWidth: 76
    };
  }

  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 8 }}>Permissions</h3>

      <div
        style={{
          padding: '10px 12px',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.03)',
          marginBottom: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>Global defaults</div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>
              Choose what to do when a site requests permission and no site-specific rule exists.
            </div>
          </div>
          <button
            onClick={resetDefaultsToPrompt}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 12,
              whiteSpace: 'nowrap'
            }}
            title="Set all to Prompt"
          >
            Reset to Prompt
          </button>
        </div>

        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '200px repeat(3, 120px)', gap: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Permission</div>
          <div style={{ fontSize: 12, textAlign: 'center' }}>Prompt</div>
          <div style={{ fontSize: 12, textAlign: 'center' }}>Allow</div>
          <div style={{ fontSize: 12, textAlign: 'center' }}>Deny</div>

          {PERM_TYPES.map((t) => {
            const cur: PermDefault = state?.defaults?.[t] ?? 'prompt';
            return (
              <React.Fragment key={t}>
                <div style={{ fontSize: 13 }}>{labelFor(t)}</div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    style={segStyle(cur === 'prompt', 'gray')}
                    onClick={() => setDefault(t, 'prompt')}
                  >
                    Prompt
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    style={segStyle(cur === 'allow', 'blue')}
                    onClick={() => setDefault(t, 'allow')}
                  >
                    Allow
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    style={segStyle(cur === 'deny', 'red')}
                    onClick={() => setDefault(t, 'deny')}
                  >
                    Deny
                  </button>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sites…"
          style={{
            flex: '1 1 auto',
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent',
            color: 'inherit',
            outline: 'none'
          }}
        />
        <button
          onClick={resetAll}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer'
          }}
        >
          Reset all
        </button>
      </div>

      {/* Table */}
      <div
        style={{
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1fr) repeat(4, 120px) 110px',
            gap: 0,
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.03)',
            fontSize: 12,
            fontWeight: 700
          }}
        >
          <div>Site</div>
          {PERM_TYPES.map((t) => (
            <div key={t} style={{ textAlign: 'center' }}>
              {labelFor(t)}
            </div>
          ))}
          <div style={{ textAlign: 'right' }}>Actions</div>
        </div>

        {sites.length === 0 ? (
          <div style={{ padding: '14px 12px', fontSize: 13, opacity: 0.8 }}>No sites yet.</div>
        ) : (
          sites.map(([origin, rec]) => (
            <div
              key={origin}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 1fr) repeat(4, 120px) 110px',
                gap: 0,
                padding: '10px 12px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                alignItems: 'center',
                fontSize: 13
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={origin}>
                {origin}
              </div>

              {PERM_TYPES.map((t) => {
                const val = rec[t]; // 'allow' | 'deny' | undefined
                return (
                  <div key={t} style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                    <button
                      onClick={() => updateSite(origin, { [t]: 'allow' })}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 7,
                        border: '1px solid rgba(59,130,246,0.5)',
                        background: val === 'allow' ? '#2563eb' : 'transparent',
                        color: val === 'allow' ? '#fff' : 'inherit',
                        cursor: 'pointer',
                        fontSize: 12,
                        minWidth: 64
                      }}
                    >
                      Allow
                    </button>
                    <button
                      onClick={() => updateSite(origin, { [t]: 'deny' })}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 7,
                        border: '1px solid rgba(239,68,68,0.5)',
                        background: val === 'deny' ? '#ef4444' : 'transparent',
                        color: val === 'deny' ? '#fff' : 'inherit',
                        cursor: 'pointer',
                        fontSize: 12,
                        minWidth: 64
                      }}
                    >
                      Deny
                    </button>
                  </div>
                );
              })}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => resetSite(origin)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 7,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};