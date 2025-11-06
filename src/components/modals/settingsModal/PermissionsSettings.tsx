import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  startTransition,
  type CSSProperties
} from 'react';
import { ipc, type PermissionType } from '../../../services/ipc/ipc';
import type { Mode } from '../../../types/models';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';

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

type PermissionsSettingsProps = {
  mode: Mode;
};

export const PermissionsSettings: React.FC<PermissionsSettingsProps> = ({ mode }) => {
  const [state, setState] = useState<PermState | null>(null);
  const [query, setQuery] = useState<string>('');
  const [expanded, setExpanded] = useState<boolean>(false);

  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
  const isMobile = mode === 'mobile';

  const compose = <K extends keyof typeof styles>(key: K): CSSProperties => ({
    ...styles[key],
    ...(modeStyles[key] || {})
  });

  const optionStyle = (tone: 'neutral' | 'primary' | 'destructive', active: boolean): CSSProperties => {
    const toneKey =
      tone === 'primary'
        ? 'permissionsOptionPrimary'
        : tone === 'destructive'
        ? 'permissionsOptionDestructive'
        : 'permissionsOptionNeutral';
    return {
      ...compose('permissionsOptionBase'),
      ...compose(toneKey as keyof typeof styles),
      ...(active ? compose('permissionsOptionActive') : {})
    };
  };

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

  return (
    <section
      style={{
        ...styles.block,
        ...(modeStyles.settingsBlock || {})
      }}
    >
      <div style={styles.blockHeader}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h3
            style={{
              ...styles.blockTitle,
              ...(modeStyles.settingsBlockTitle || {})
            }}
          >
            Permissions
          </h3>
          <span style={compose('permissionsBadge')}>Site &amp; device access</span>
        </div>
        <div style={compose('permissionsHeaderActions')}>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? 'Collapse permissions settings' : 'Expand permissions settings'}
            aria-expanded={expanded}
            style={compose('permissionsToggleButton')}
          >
            {expanded ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                <path
                  fill="#ffffff"
                  d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z"
                />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                <path
                  fill="#ffffff"
                  d="M297.4 470.6C309.9 483.1 330.2 483.1 342.7 470.6L534.7 278.6C547.2 266.1 547.2 245.8 534.7 233.3C522.2 220.8 501.9 220.8 489.4 233.3L320 402.7L150.6 233.4C138.1 220.9 117.8 220.9 105.3 233.4C92.8 245.9 92.8 266.2 105.3 278.7L297.3 470.7z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div
          style={{ ...styles.blockBody, ...(modeStyles.settingsBlockBody || {}), ...compose('permissionsBody') }}
        >
          <div style={compose('permissionsDefaultsCard')}>
            <div style={compose('permissionsDefaultsHeader')}>
              <div>
                <span style={compose('permissionsDefaultsTitle')}>Global defaults: </span>
                <span style={compose('permissionsDefaultsDescription')}>
                  Decide what happens when a site asks for access and no site-specific rule exists.
                </span>
              </div>
              <button
                onClick={resetDefaultsToPrompt}
                style={compose('permissionsResetButton')}
                title="Set all to Prompt"
              >
                Reset to Prompt
              </button>
            </div>

            {isMobile ? (
              <div style={compose('permissionsDefaultsMobileList')}>
                {PERM_TYPES.map((t) => {
                  const cur: PermDefault = state?.defaults?.[t] ?? 'prompt';
                  return (
                    <div key={t} style={compose('permissionsDefaultsMobileRow')}>
                      <span style={compose('permissionsDefaultsLabel')}>{labelFor(t)}</span>
                      <div style={compose('permissionsDefaultsMobileButtons')}>
                        <button
                          style={optionStyle('neutral', cur === 'prompt')}
                          onClick={() => setDefault(t, 'prompt')}
                        >
                          Prompt
                        </button>
                        <button
                          style={optionStyle('primary', cur === 'allow')}
                          onClick={() => setDefault(t, 'allow')}
                        >
                          Allow
                        </button>
                        <button
                          style={optionStyle('destructive', cur === 'deny')}
                          onClick={() => setDefault(t, 'deny')}
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={compose('permissionsDefaultsOptions')}>
                <div style={compose('permissionsDefaultsHeaderTitle')}>Permission</div>
                <div style={compose('permissionsDefaultsHeaderLabel')}>Prompt</div>
                <div style={compose('permissionsDefaultsHeaderLabel')}>Allow</div>
                <div style={compose('permissionsDefaultsHeaderLabel')}>Deny</div>

                {PERM_TYPES.map((t) => {
                  const cur: PermDefault = state?.defaults?.[t] ?? 'prompt';
                  return (
                    <React.Fragment key={t}>
                      <div style={compose('permissionsDefaultsLabel')}>{labelFor(t)}</div>
                      <div style={compose('permissionsDefaultsButtonGroup')}>
                        <button
                          style={optionStyle('neutral', cur === 'prompt')}
                          onClick={() => setDefault(t, 'prompt')}
                        >
                          Prompt
                        </button>
                      </div>
                      <div style={compose('permissionsDefaultsButtonGroup')}>
                        <button
                          style={optionStyle('primary', cur === 'allow')}
                          onClick={() => setDefault(t, 'allow')}
                        >
                          Allow
                        </button>
                      </div>
                      <div style={compose('permissionsDefaultsButtonGroup')}>
                        <button
                          style={optionStyle('destructive', cur === 'deny')}
                          onClick={() => setDefault(t, 'deny')}
                        >
                          Deny
                        </button>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          <div style={compose('permissionsSearchRow')}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sites…"
              style={compose('permissionsSearchInput')}
            />
            <button onClick={resetAll} style={compose('permissionsResetButton')}>
              Reset all
            </button>
          </div>

          <div style={compose('permissionsSiteContainer')}>
            {sites.length === 0 ? (
              <div style={compose('permissionsSiteEmpty')}>No sites yet.</div>
            ) : (
              sites.map(([origin, rec], index) => {
                const cardBase = compose('permissionsSiteCard');
                const cardStyle = {
                  ...cardBase,
                  borderTop: index === 0 ? 'none' : cardBase.borderTop
                };

                return (
                  <div key={origin} style={cardStyle}>
                    <div style={compose('permissionsSiteCardHeader')}>
                      <div style={compose('permissionsSiteCardOrigin')} title={origin}>
                        {origin}
                      </div>
                      <button onClick={() => resetSite(origin)} style={compose('permissionsSiteResetButton')}>
                        Reset
                      </button>
                    </div>
                    <div style={compose('permissionsSiteCardPermissions')}>
                      {PERM_TYPES.map((t) => {
                        const val = rec[t];
                        return (
                          <div key={t} style={compose('permissionsSiteCardPermissionRow')}>
                            <span style={compose('permissionsSiteCardPermissionLabel')}>{labelFor(t)}</span>
                            <div style={compose('permissionsSiteButtons')}>
                              <button
                                onClick={() => updateSite(origin, { [t]: 'allow' })}
                                style={optionStyle('primary', val === 'allow')}
                              >
                                Allow
                              </button>
                              <button
                                onClick={() => updateSite(origin, { [t]: 'deny' })}
                                style={optionStyle('destructive', val === 'deny')}
                              >
                                Deny
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
};
