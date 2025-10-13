import { useMemo } from 'react';
import { useSyncExternalStore } from 'react';

const DEFAULT_URL = 'https://duckduckgo.com';
const SESSION_SCHEMA = 1;
const SAVE_DEBOUNCE_MS = 750;
const YT_HOST_PATTERNS = [/\.youtube\.com$/i, /^youtube\.com$/i, /^music\.youtube\.com$/i];

const listeners = new Set();

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

let state = createInitialState();
let saveTimer = null;
let hasHydrated = false;

function createInitialState() {
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

function isYouTubeLike(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return YT_HOST_PATTERNS.some((regex) => regex.test(hostname));
  } catch {
    return false;
  }
}

function createTab(url = DEFAULT_URL, overrides = {}) {
  const now = Date.now();
  const safeUrl =
    typeof url === 'string' && url.trim().length ? url.trim() : DEFAULT_URL;
  return {
    id: overrides.id || generateTabId(now),
    url: safeUrl,
    title: overrides.title ?? '',
    favicon: overrides.favicon ?? '',
    pinned: !!overrides.pinned,
    muted: !!overrides.muted,
    discarded: overrides.discarded ?? true,
    isYouTube:
      typeof overrides.isYouTube === 'boolean'
        ? overrides.isYouTube
        : isYouTubeLike(safeUrl),
    isPlaying: !!overrides.isPlaying,
    lastUsedAt:
      typeof overrides.lastUsedAt === 'number' && Number.isFinite(overrides.lastUsedAt)
        ? overrides.lastUsedAt
        : now
  };
}

function generateTabId(seed = Date.now()) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `t_${seed}_${rand}`;
}

function emit() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      console.error('[tabsStore] listener error', err);
    }
  }
}

function getSnapshot() {
  return state;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setState(updater, { skipSave = false } = {}) {
  const next = typeof updater === 'function' ? updater(state) : updater;
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

async function saveSessionNow() {
  if (singleWindowMode) return;
  if (!window?.merezhyvo?.session?.save) return;
  const payload = serializeState(state);
  try {
    await window.merezhyvo.session.save(payload);
  } catch (err) {
    console.error('[tabsStore] Failed to save session', err);
  }
}

function scheduleSave() {
  if (singleWindowMode) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveSessionNow();
  }, SAVE_DEBOUNCE_MS);
}

function serializeState(current) {
  return {
    schema: SESSION_SCHEMA,
    activeId: current.activeId,
    tabs: current.tabs.map((tab) => ({
      id: tab.id,
      url: tab.url,
      title: tab.title || '',
      favicon: tab.favicon || '',
      pinned: !!tab.pinned,
      muted: !!tab.muted,
      discarded: !!tab.discarded,
      isYouTube: !!tab.isYouTube,
      isPlaying: !!tab.isPlaying,
      lastUsedAt: typeof tab.lastUsedAt === 'number' ? tab.lastUsedAt : Date.now()
    }))
  };
}

function sanitizeSession(data) {
  const fallback = createInitialState();
  if (!data || typeof data !== 'object' || data.schema !== SESSION_SCHEMA) {
    return {
      ...fallback,
      ready: true
    };
  }

  const tabsInput = Array.isArray(data.tabs) ? data.tabs : [];
  const tabs = [];
  const now = Date.now();

  for (const raw of tabsInput) {
    if (!raw || typeof raw !== 'object') continue;
    const tab = createTab(raw.url, {
      id: raw.id && typeof raw.id === 'string' ? raw.id : undefined,
      title: typeof raw.title === 'string' ? raw.title : '',
      favicon: typeof raw.favicon === 'string' ? raw.favicon : '',
      pinned: !!raw.pinned,
      muted: !!raw.muted,
      discarded: !!raw.discarded,
      isYouTube:
        typeof raw.isYouTube === 'boolean'
          ? raw.isYouTube
          : isYouTubeLike(raw.url),
      isPlaying: !!raw.isPlaying,
      lastUsedAt:
        typeof raw.lastUsedAt === 'number' && Number.isFinite(raw.lastUsedAt)
          ? raw.lastUsedAt
          : now
    });
    tabs.push(tab);
  }

  if (!tabs.length) {
    return {
      ...fallback,
      ready: true
    };
  }

  let activeId =
    typeof data.activeId === 'string' &&
    tabs.some((tab) => tab.id === data.activeId)
      ? data.activeId
      : tabs[0].id;

  const normalizedTabs = setActiveOnTabs(tabs, activeId, now);
  const activeTab = normalizedTabs.find((tab) => tab.id === activeId);
  if (activeTab) {
    if (!activeTab.url || !activeTab.url.trim()) {
      const previous = tabsInput.find((tab) => tab && tab.id === activeId);
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

function setActiveOnTabs(tabs, activeId, timestamp = Date.now()) {
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

function discardAllTabs(tabs) {
  let changed = false;
  const next = tabs.map((tab) => {
    if (tab.discarded) return tab;
    changed = true;
    return { ...tab, discarded: true };
  });
  return changed ? next : tabs.slice();
}

async function hydrateFromSession() {
  if (singleWindowMode) {
    hasHydrated = true;
    setState((prev) => ({ ...prev, ready: true }), { skipSave: true });
    return;
  }
  let rawSession = null;
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
  // Ensure a persisted session exists after first hydration if possible.
  if (window?.merezhyvo?.session?.save) {
    scheduleSave();
  }
}

if (typeof window !== 'undefined') {
  queueMicrotask(() => {
    void hydrateFromSession();
  });
}

function newTab(url, options = {}) {
  const { pinned = false } = options;
  const safeUrl =
    typeof url === 'string' && url.trim().length ? url.trim() : DEFAULT_URL;
  setState((prev) => {
    const now = Date.now();
    const freshTab = createTab(safeUrl, {
      pinned: !!pinned,
      title: options.title ?? '',
      discarded: false,
      lastUsedAt: now
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

function closeTab(id) {
  if (!id) return;
  setState((prev) => {
    const index = prev.tabs.findIndex((tab) => tab.id === id);
    if (index === -1) return prev;

    let remaining = prev.tabs.filter((tab) => tab.id !== id);
    let activeId = prev.activeId;
    const now = Date.now();

    if (!remaining.length) {
      const fallbackTab = createTab(DEFAULT_URL, { discarded: false, lastUsedAt: now });
      remaining = [fallbackTab];
      activeId = fallbackTab.id;
    } else if (id === prev.activeId) {
      const neighbor = remaining[index] || remaining[index - 1] || remaining[0];
      activeId = neighbor.id;
    } else if (!remaining.some((tab) => tab.id === activeId)) {
      activeId = remaining[0].id;
    }

    return {
      ...prev,
      tabs: setActiveOnTabs(remaining, activeId, now),
      activeId
    };
  });
}

function activateTab(id) {
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

function pinTab(id, flag) {
  if (!id) return;
  const nextFlag = typeof flag === 'boolean' ? flag : undefined;
  setState((prev) => {
    const idx = prev.tabs.findIndex((tab) => tab.id === id);
    if (idx === -1) return prev;
    const tab = prev.tabs[idx];
    const pinned = nextFlag === undefined ? !tab.pinned : nextFlag;
    if (pinned === tab.pinned) return prev;
    const tabs = prev.tabs.slice();
    tabs[idx] = { ...tab, pinned };
    return { ...prev, tabs };
  });
}

function updateMeta(id, patch = {}) {
  if (!id || !patch) return;
  setState((prev) => {
    const idx = prev.tabs.findIndex((tab) => tab.id === id);
    if (idx === -1) return prev;
    const original = prev.tabs[idx];
    const next = { ...original };
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
    if (typeof patch.lastUsedAt === 'number' && Number.isFinite(patch.lastUsedAt) && patch.lastUsedAt !== original.lastUsedAt) {
      next.lastUsedAt = patch.lastUsedAt;
      altered = true;
    }

    if (!altered) return prev;
    const tabs = prev.tabs.slice();
    tabs[idx] = next;
    return { ...prev, tabs };
  });
}

function navigateActive(url) {
  if (typeof url !== 'string' || !url.trim()) return;
  const trimmed = url.trim();
  setState((prev) => {
    const idx = prev.tabs.findIndex((tab) => tab.id === prev.activeId);
    if (idx === -1) return prev;
    const now = Date.now();
    const tabs = prev.tabs.slice();
    const current = tabs[idx];
    const nextIsYouTube = isYouTubeLike(trimmed);
    const updated = {
      ...current,
      url: trimmed,
      discarded: false,
      isYouTube: nextIsYouTube,
      isPlaying: current.isYouTube === nextIsYouTube ? current.isPlaying : false,
      lastUsedAt: now
    };
    tabs[idx] = updated;
    return {
      ...prev,
      tabs: setActiveOnTabs(tabs, updated.id, now)
    };
  });
}

function reloadActive() {
  setState((prev) => {
    const idx = prev.tabs.findIndex((tab) => tab.id === prev.activeId);
    if (idx === -1) return prev;
    const now = Date.now();
    const tabs = prev.tabs.slice();
    const current = tabs[idx];
    if (current.lastUsedAt === now) return prev;
    tabs[idx] = { ...current, lastUsedAt: now };
    return { ...prev, tabs };
  });
}

export const tabsActions = Object.freeze({
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

export function getTabsState() {
  return state;
}

export {
  DEFAULT_URL as defaultTabUrl,
  SESSION_SCHEMA as sessionSchema,
  isYouTubeLike
};
