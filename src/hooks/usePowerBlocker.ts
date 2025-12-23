import { useCallback, useRef } from 'react';

export const usePowerBlocker = (playingTabsRef: React.MutableRefObject<Set<string>>) => {
  const powerBlockerIdRef = useRef<number | null>(null);

  const startPowerBlocker = useCallback(async (): Promise<number | null> => {
    if (powerBlockerIdRef.current != null) return powerBlockerIdRef.current;
    try {
      const id = await window.merezhyvo?.power?.start?.();
      if (typeof id === 'number') {
        powerBlockerIdRef.current = id;
        return id;
      }
    } catch (err) {
      console.error('[Merezhyvo] power blocker start failed', err);
    }
    return null;
  }, []);

  const stopPowerBlocker = useCallback(async (): Promise<void> => {
    const id = powerBlockerIdRef.current;
    if (id == null) return;
    try {
      await window.merezhyvo?.power?.stop?.(id);
    } catch (err) {
      console.error('[Merezhyvo] power blocker stop failed', err);
    }
    powerBlockerIdRef.current = null;
  }, []);

  const updatePowerBlocker = useCallback(() => {
    if (playingTabsRef.current.size > 0) {
      void startPowerBlocker();
    } else {
      void stopPowerBlocker();
    }
  }, [playingTabsRef, startPowerBlocker, stopPowerBlocker]);

  return { powerBlockerIdRef, startPowerBlocker, stopPowerBlocker, updatePowerBlocker };
};
