import { useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import type { Tab, TabKind } from '../types/models';

const DEFAULT_URL = 'https://duckduckgo.com';
const SESSION_SCHEMA = 1;
const SAVE_DEBOUNCE_MS = 750;
const YT_HOST_PATTERNS = [/\.youtube\.com$/i, /^youtube\.com$/i, /^music\.youtube\.com$/i];

type TabsListener = () => void;

type TabsState = {
  ready: boolean;
  tabs: Tab[];
  activeId: string;
};

type SetStateOptions = {
  skipSave?: boolean;
};

type TabsStateInput = TabsState | ((prev: TabsState) => TabsState);

type TabOverrides = Partial<Omit<Tab, 'url' | 'id'>> & {
  url?: string;
  id?: string;
};

type PersistedTab = Partial<Tab> & {
  id?: unknown;
  url?: unknown;
};

type PersistedSession = {
  schema?: unknown;
  activeId?: unknown;
  tabs?: unknown;
};

type NewTabOptions = {
  pinned?: boolean;
  title?: string;
  kind?: TabKind;
};

type UpdateMetaPatch = Partial<
  Pick<
    Tab,
    'title' | 'favicon' | 'url' | 'muted' | 'pinned' | 'discarded' | 'isYouTube' | 'isPlaying' | 'isLoading' | 'lastUsedAt'
  >
>;

const listeners = new Set<TabsListener>();

const singleWindowMode = (() => {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search || '');
    const raw = params.get('single');
    return raw === '1' || raw === '' || (raw || '').toLowerCase() === 'true';
  } catch {
    return false;
  }
})();

let state: TabsState = createInitialState();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let hasHydrated = false;

function createInitialState(): TabsState {
  const initialTab = createTab(DEFAULT_URL, {
    title: 'DuckDuckGo',
    discarded: false
  });
  return {
    ready: false,
    tabs: [initialTab],
    activeId: initialTab.id
  };
}

function isYouTubeLike(url: unknown): boolean {
  if (typeof url !== 'string' || !url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return YT_HOST_PATTERNS.some((regex) => regex.test(hostname));
  } catch {
    return false;
  }
}

function createTab(url: string = DEFAULT_URL, overrides: TabOverrides = {}): Tab {
  const now = Date.now();
  const safeUrl = typeof url === 'string' && url.trim().length ? url.trim() : DEFAULT_URL;
  const next: Tab = {
    id: overrides.id ?? generateTabId(now),
    url: safeUrl,
    title: overrides.title ?? '',
    favicon: overrides.favicon ?? '',
    isLoading: overrides.isLoading ?? false,
    pinned: Boolean(overrides.pinned),
    muted: Boolean(overrides.muted),
    discarded: overrides.discarded ?? true,
    isYouTube:
      typeof overrides.isYouTube === 'boolean'
        ? overrides.isYouTube
        : isYouTubeLike(safeUrl),
    isPlaying: Boolean(overrides.isPlaying),
    lastUsedAt:
      typeof overrides.lastUsedAt === 'number' && Number.isFinite(overrides.lastUsedAt)
        ? overrides.lastUsedAt
        : now,
    kind: overrides.kind === 'messenger' ? 'messenger' : 'browser'
  };
  return next;
}

function generateTabId(seed = Date.now()): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `t_${seed}_${rand}`;
}

function emit(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      console.error('[tabsStore] listener error', err);
    }
  }
}

function getSnapshot(): TabsState {
  return state;
}

function subscribe(listener: TabsListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setState(updater: TabsStateInput, { skipSave = false }: SetStateOptions = {}): TabsState {
  const next = typeof updater === 'function' ? (updater as (prev: TabsState) => TabsState)(state) : updater;
  if (!next || next === state) {
    return state;
  }
  state = next;
  emit();
  if (!skipSave && hasHydrated) {
    scheduleSave();
  }
  return state;
}

async function saveSessionNow(): Promise<void> {
  if (singleWindowMode) return;
  if (!window?.merezhyvo?.session?.save) return;
  const payload = serializeState(state);
  try {
    await window.merezhyvo.session.save(payload);
  } catch (err) {
    console.error('[tabsStore] Failed to save session', err);
  }
}

function scheduleSave(): void {
  if (singleWindowMode) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveSessionNow();
  }, SAVE_DEBOUNCE_MS);
}

function serializeState(current: TabsState) {
  const persistentTabs = current.tabs.filter((tab) => tab.kind !== 'messenger' && !isServiceUrl(tab.url));
  const activeId = persistentTabs.some((tab) => tab.id === current.activeId)
    ? current.activeId
    : persistentTabs[0]?.id ?? current.activeId;
  return {
    schema: SESSION_SCHEMA,
    activeId,
    tabs: persistentTabs.map((tab) => ({
      id: tab.id,
      url: tab.url,
      title: tab.title || '',
      favicon: tab.favicon || '',
      isLoading: Boolean(tab.isLoading),
      pinned: Boolean(tab.pinned),
      muted: Boolean(tab.muted),
      discarded: Boolean(tab.discarded),
      isYouTube: Boolean(tab.isYouTube),
      isPlaying: Boolean(tab.isPlaying),
      lastUsedAt: typeof tab.lastUsedAt === 'number' ? tab.lastUsedAt : Date.now(),
      kind: tab.kind === 'messenger' ? 'messenger' : 'browser'
    }))
  };
}

function sanitizeSession(data: unknown): TabsState {
  const fallback = createInitialState();
  const input = data as PersistedSession | null | undefined;
  if (!input || typeof input !== 'object' || input.schema !== SESSION_SCHEMA) {
    return {
      ...fallback,
      ready: true
    };
  }

  const tabsInput = Array.isArray(input.tabs) ? (input.tabs as PersistedTab[]) : [];
  const tabs: Tab[] = [];
  const now = Date.now();

  for (const raw of tabsInput) {
    if (!raw || typeof raw !== 'object') continue;
    const persistedKind = typeof (raw as { kind?: unknown })?.kind === 'string'
      && (raw as { kind?: string }).kind === 'messenger'
      ? 'messenger'
      : 'browser';
    const tab = createTab(typeof raw.url === 'string' ? raw.url : DEFAULT_URL, {
      id: typeof raw.id === 'string' ? raw.id : undefined,
      title: typeof raw.title === 'string' ? raw.title : '',
      favicon: typeof raw.favicon === 'string' ? raw.favicon : '',
      isLoading: Boolean(raw.isLoading),
      pinned: Boolean(raw.pinned),
      muted: Boolean(raw.muted),
      discarded: Boolean(raw.discarded),
      isYouTube:
        typeof raw.isYouTube === 'boolean'
          ? raw.isYouTube
          : isYouTubeLike(raw.url),
      isPlaying: Boolean(raw.isPlaying),
      lastUsedAt:
        typeof raw.lastUsedAt === 'number' && Number.isFinite(raw.lastUsedAt)
          ? raw.lastUsedAt
          : now,
      kind: persistedKind
    });
    tabs.push(tab);
  }

  if (!tabs.length) {
    return {
      ...fallback,
      ready: true
    };
  }

  const maybeActiveId = typeof input.activeId === 'string' ? input.activeId : null;
  const firstTab = tabs[0]!;
  const activeId = maybeActiveId && tabs.some((tab) => tab.id === maybeActiveId)
    ? maybeActiveId
    : firstTab.id;

  const normalizedTabs = setActiveOnTabs(tabs, activeId, now);
  const activeTab = normalizedTabs.find((tab) => tab.id === activeId);
  if (activeTab) {
    if (!activeTab.url || !activeTab.url.trim()) {
      const previous =
        tabsInput.find((tab) => tab && typeof tab === 'object' && tab.id === activeId) || null;
      const sanitizedUrl =
        previous && typeof previous.url === 'string' && previous.url.trim().length
          ? previous.url.trim()
          : DEFAULT_URL;
      activeTab.url = sanitizedUrl;
      activeTab.discarded = false;
    }
    activeTab.isYouTube = isYouTubeLike(activeTab.url);
    activeTab.isPlaying = false;
  }

  return {
    ready: true,
    tabs: normalizedTabs,
    activeId
  };
}

function setActiveOnTabs(tabs: Tab[], activeId: string, timestamp = Date.now()): Tab[] {
  let changed = false;
  const next = tabs.map((tab) => {
    if (tab.id === activeId) {
      const lastUsed = tab.lastUsedAt > timestamp ? tab.lastUsedAt : timestamp;
      if (!tab.discarded && tab.lastUsedAt === lastUsed) return tab;
      changed = true;
      return {
        ...tab,
        discarded: false,
        isPlaying: tab.isPlaying ?? false,
        lastUsedAt: lastUsed
      };
    }
    if (tab.discarded) return tab;
    changed = true;
    return { ...tab, discarded: true, isPlaying: false };
  });
  return changed ? next : tabs;
}

function discardAllTabs(tabs: Tab[]): Tab[] {
  let changed = false;
  const next = tabs.map((tab) => {
    if (tab.discarded) return tab;
    changed = true;
    return { ...tab, discarded: true };
  });
  return changed ? next : tabs.slice();
}

async function hydrateFromSession(): Promise<void> {
  if (singleWindowMode) {
    hasHydrated = true;
    setState((prev) => ({ ...prev, ready: true }), { skipSave: true });
    return;
  }
  let rawSession: unknown = null;
  if (window?.merezhyvo?.session?.load) {
    try {
      rawSession = await window.merezhyvo.session.load();
    } catch (err) {
      console.error('[tabsStore] Failed to load session', err);
    }
  }

  hasHydrated = true;
  const next = sanitizeSession(rawSession);
  setState(() => next, { skipSave: true });
  if (window?.merezhyvo?.session?.save) {
    scheduleSave();
  }
}

if (typeof window !== 'undefined') {
  queueMicrotask(() => {
    void hydrateFromSession();
  });
}

function newTab(url: string, options: NewTabOptions = {}): void {
  const { pinned = false, title = '', kind = 'browser' } = options;
  const safeUrl = typeof url === 'string' && url.trim().length ? url.trim() : DEFAULT_URL;
  setState((prev) => {
    const now = Date.now();
    const freshTab = createTab(safeUrl, {
      pinned: Boolean(pinned),
      title,
      discarded: false,
      lastUsedAt: now,
      isLoading: true,
      kind
    });
    const demoted = discardAllTabs(prev.tabs);
    const tabs = demoted.slice();
    tabs.push(freshTab);
    return {
      ...prev,
      tabs: setActiveOnTabs(tabs, freshTab.id, now),
      activeId: freshTab.id
    };
  });
}

function closeTab(id: string): void {
  if (!id) return;
  setState((prev) => {
    const index = prev.tabs.findIndex((tab) => tab.id === id);
    if (index === -1) return prev;

    let remaining = prev.tabs.filter((tab) => tab.id !== id);
    let activeId = prev.activeId;
    const now = Date.now();

    if (!remaining.length) {
      const fallbackTab = createTab(DEFAULT_URL, { discarded: false, lastUsedAt: now, kind: 'browser' });
      remaining = [fallbackTab];
      activeId = fallbackTab.id;
    } else if (id === prev.activeId) {
      const neighbor = remaining[index] ?? remaining[index - 1] ?? remaining[0];
      if (!neighbor) return prev;
      activeId = neighbor.id;
    } else if (!remaining.some((tab) => tab.id === activeId)) {
      const fallback = remaining[0];
      if (!fallback) return prev;
      activeId = fallback.id;
    }

    return {
      ...prev,
      tabs: setActiveOnTabs(remaining, activeId, now),
      activeId
    };
  });
}

function activateTab(id: string): void {
  if (!id) return;
  setState((prev) => {
    if (prev.activeId === id) {
      const current = prev.tabs.find((tab) => tab.id === id);
      if (current && !current.discarded) {
        return prev;
      }
    }
    if (!prev.tabs.some((tab) => tab.id === id)) return prev;
    const now = Date.now();
    return {
      ...prev,
      tabs: setActiveOnTabs(prev.tabs, id, now),
      activeId: id
    };
  });
}

function pinTab(id: string, flag?: boolean): void {
  if (!id) return;
  const nextFlag = typeof flag === 'boolean' ? flag : undefined;
  setState((prev) => {
    const idx = prev.tabs.findIndex((tab) => tab.id === id);
    if (idx === -1) return prev;
    const tab = prev.tabs[idx]!;
    const pinned = nextFlag === undefined ? !tab.pinned : nextFlag;
    if (pinned === tab.pinned) return prev;
    const tabs = prev.tabs.slice();
    tabs[idx] = { ...tab, pinned };
    return { ...prev, tabs };
  });
}

function updateMeta(id: string, patch: UpdateMetaPatch = {}): void {
  if (!id || !patch) return;
  setState((prev) => {
    const idx = prev.tabs.findIndex((tab) => tab.id === id);
    if (idx === -1) return prev;
    const original = prev.tabs[idx]!;
    const next: Tab = { ...original };
    let altered = false;

    if (typeof patch.title === 'string' && patch.title !== original.title) {
      next.title = patch.title;
      altered = true;
    }
    if (typeof patch.favicon === 'string' && patch.favicon !== original.favicon) {
      next.favicon = patch.favicon;
      altered = true;
    }
    if (typeof patch.url === 'string' && patch.url.trim() && patch.url !== original.url) {
      next.url = patch.url.trim();
      const nextIsYouTube = isYouTubeLike(next.url);
      if (next.isYouTube !== nextIsYouTube) {
        next.isYouTube = nextIsYouTube;
        if (!nextIsYouTube) {
          next.isPlaying = false;
        }
        altered = true;
      }
      altered = true;
    }
    if (typeof patch.muted === 'boolean' && patch.muted !== original.muted) {
      next.muted = patch.muted;
      altered = true;
    }
    if (typeof patch.pinned === 'boolean' && patch.pinned !== original.pinned) {
      next.pinned = patch.pinned;
      altered = true;
    }
    if (typeof patch.discarded === 'boolean' && patch.discarded !== original.discarded) {
      next.discarded = patch.discarded;
      altered = true;
    }
    if (typeof patch.isYouTube === 'boolean' && patch.isYouTube !== original.isYouTube) {
      next.isYouTube = patch.isYouTube;
      if (!patch.isYouTube) {
        next.isPlaying = false;
      }
      altered = true;
    }
    if (typeof patch.isPlaying === 'boolean' && patch.isPlaying !== original.isPlaying) {
      next.isPlaying = patch.isPlaying;
      altered = true;
    }
    if (typeof patch.isLoading === 'boolean' && patch.isLoading !== original.isLoading) {
      next.isLoading = patch.isLoading;
      altered = true;
    }
    if (
      typeof patch.lastUsedAt === 'number' &&
      Number.isFinite(patch.lastUsedAt) &&
      patch.lastUsedAt !== original.lastUsedAt
    ) {
      next.lastUsedAt = patch.lastUsedAt;
      altered = true;
    }

    if (!altered) return prev;
    const tabs = prev.tabs.slice();
    tabs[idx] = next;
    return { ...prev, tabs };
  });
}

function navigateActive(url: string): void {
  if (typeof url !== 'string' || !url.trim()) return;
  const trimmed = url.trim();
  setState((prev) => {
    const idx = prev.tabs.findIndex((tab) => tab.id === prev.activeId);
    if (idx === -1) return prev;
    const now = Date.now();
    const tabs = prev.tabs.slice();
    const current = tabs[idx]!;
    const nextIsYouTube = isYouTubeLike(trimmed);
    const updated: Tab = {
      ...current,
      url: trimmed,
      discarded: false,
      isYouTube: nextIsYouTube,
      isPlaying: current.isYouTube === nextIsYouTube ? current.isPlaying : false,
      lastUsedAt: now,
      isLoading: true
    };
    tabs[idx] = updated;
    return {
      ...prev,
      tabs: setActiveOnTabs(tabs, updated.id, now)
    };
  });
}

function reloadActive(): void {
  setState((prev) => {
    const idx = prev.tabs.findIndex((tab) => tab.id === prev.activeId);
    if (idx === -1) return prev;
    const now = Date.now();
    const tabs = prev.tabs.slice();
    const current = tabs[idx]!;
    if (current.lastUsedAt === now) return prev;
    tabs[idx] = { ...current, lastUsedAt: now, isLoading: true };
    return { ...prev, tabs };
  });
}

const tabsActions = Object.freeze({
  newTab,
  closeTab,
  activateTab,
  pinTab,
  updateMeta,
  navigateActive,
  reloadActive
});

export function useTabsStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const activeTab =
    snapshot.tabs.find((tab) => tab.id === snapshot.activeId) || null;

  return useMemo(
    () => ({
      ready: snapshot.ready,
      tabs: snapshot.tabs,
      activeId: snapshot.activeId,
      activeTab,
      actions: tabsActions
    }),
    [snapshot.ready, snapshot.tabs, snapshot.activeId, activeTab]
  );
}

export function getTabsState(): TabsState {
  return state;
}

export {
  DEFAULT_URL as defaultTabUrl,
  SESSION_SCHEMA as sessionSchema,
  isYouTubeLike,
  tabsActions
};

function isServiceUrl(url: string | undefined): boolean {
  return typeof url === 'string' && url.trim().toLowerCase().startsWith('mzr://');
}
