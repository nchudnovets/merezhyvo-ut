import React from 'react';
import { LANGUAGE_LAYOUT_IDS } from '../components/keyboard/layouts';
import type { LayoutId } from '../components/keyboard/layouts';
import { ipc } from '../services/ipc/ipc';

export const useKeyboardLayouts = () => {
  const [enabledKbLayouts, setEnabledKbLayouts] = React.useState<LayoutId[]>(['en']);
  const [kbLayout, setKbLayout] = React.useState<LayoutId>('en');
  const availableLayouts = React.useMemo(
    () => new Set<LayoutId>(LANGUAGE_LAYOUT_IDS as LayoutId[]),
    []
  );
  const prevAlphaLayoutRef = React.useRef(kbLayout);

  React.useEffect(() => {
    if (kbLayout !== 'symbols1' && kbLayout !== 'symbols2') {
      prevAlphaLayoutRef.current = kbLayout;
    }
  }, [kbLayout]);

  const toLayoutIds = React.useCallback(
    (arr: unknown): LayoutId[] => {
      if (!Array.isArray(arr)) return ['en' as LayoutId];
      const filtered = arr.filter(
        (x): x is LayoutId => typeof x === 'string' && availableLayouts.has(x as LayoutId)
      );
      return filtered.length ? filtered : (['en'] as LayoutId[]);
    },
    [availableLayouts]
  );

  const pickDefault = React.useCallback(
    (def: unknown, enabled: LayoutId[]): LayoutId => {
      if (
        typeof def === 'string' &&
        availableLayouts.has(def as LayoutId) &&
        enabled.includes(def as LayoutId)
      ) {
        return def as LayoutId;
      }
      return (enabled[0] ?? ('en' as LayoutId));
    },
    [availableLayouts]
  );

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const kb = await ipc.settings.keyboard.get();
        if (!alive) return;

        const enabled = toLayoutIds(kb?.enabledLayouts);
        const def = pickDefault(kb?.defaultLayout, enabled);

        setEnabledKbLayouts(enabled);
        setKbLayout(def);
      } catch {
        // keep defaults on failure
      }
    })();
    return () => { alive = false; };
  }, [pickDefault, setEnabledKbLayouts, setKbLayout, toLayoutIds]);

  React.useEffect(() => {
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const enabled = toLayoutIds(detail?.enabledLayouts);
      const def = pickDefault(detail?.defaultLayout, enabled);
      setEnabledKbLayouts(enabled);
      setKbLayout(def);
    };

    window.addEventListener('mzr-osk-settings-changed', onChanged as EventListener);
    return () => window.removeEventListener('mzr-osk-settings-changed', onChanged as EventListener);
  }, [pickDefault, setEnabledKbLayouts, setKbLayout, toLayoutIds]);

  return {
    kbLayout,
    setKbLayout,
    enabledKbLayouts,
    setEnabledKbLayouts,
    prevAlphaLayoutRef
  };
};
