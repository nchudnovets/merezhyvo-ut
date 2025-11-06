import { readSettingsState, writeSettingsState } from './shortcuts';

export type PermissionType = 'camera' | 'microphone' | 'geolocation' | 'notifications';
export type Decision = 'allow' | 'deny' | 'prompt';

export type PermissionsState = {
  schema: 1;
  defaults: Record<PermissionType, Decision>;
  sites: Record<string, Partial<Record<PermissionType, Exclude<Decision, 'prompt'>>>>;
};

export function defaultPermissionsState(): PermissionsState {
  return {
    schema: 1,
    defaults: {
      camera: 'prompt',
      microphone: 'prompt',
      geolocation: 'prompt',
      notifications: 'prompt'
    },
    sites: {}
  };
}

export function isPermissionsState(val: unknown): val is PermissionsState {
  if (!val || typeof val !== 'object') return false;
  const obj = val as PermissionsState;
  if (obj.schema !== 1) return false;
  if (!obj.defaults || !obj.sites) return false;
  const keys: PermissionType[] = ['camera', 'microphone', 'geolocation', 'notifications'];
  for (const k of keys) {
    const d = (obj.defaults as Record<string, unknown>)[k];
    if (d !== 'allow' && d !== 'deny' && d !== 'prompt') return false;
  }
  if (typeof obj.sites !== 'object') return false;
  return true;
}

type SettingsRoot = Record<string, unknown> & {
  permissions?: PermissionsState;
};

export async function getPermissionsState(): Promise<PermissionsState> {
  const settings = (await readSettingsState()) as SettingsRoot;
  const st = settings.permissions;
  if (!isPermissionsState(st)) return defaultPermissionsState();
  // Defensive cleaning
  const clean = defaultPermissionsState();
  clean.defaults = { ...clean.defaults, ...st.defaults };
  clean.sites = { ...st.sites };
  return clean;
}

export async function setPermissionsState(next: PermissionsState): Promise<void> {
  const settings = (await readSettingsState()) as SettingsRoot;
  settings.permissions = next;
  await writeSettingsState(settings);
}

export async function updatePermissionsState(
  origin: string,
  patch: Partial<Record<PermissionType, Exclude<Decision, 'prompt'>>>
): Promise<void> {
  const state = await getPermissionsState();
  const current = state.sites[origin] ?? {};
  state.sites[origin] = { ...current, ...patch };
  await setPermissionsState(state);
}

export async function resetSite(origin: string): Promise<void> {
  const state = await getPermissionsState();
  delete state.sites[origin];
  await setPermissionsState(state);
}

export async function resetAllPermissions(): Promise<void> {
  const state = await getPermissionsState();
  state.sites = {};
  await setPermissionsState(state);
}

export async function updateDefaultPermissions(
  patch: Partial<Record<PermissionType, Decision>>
): Promise<void> {
  const state = await getPermissionsState();
  state.defaults = { ...state.defaults, ...patch };
  await setPermissionsState(state);
}