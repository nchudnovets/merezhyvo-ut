import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackerStatus } from '../types/models';

const defaultStatus: TrackerStatus = {
  enabledGlobal: true,
  siteHost: null,
  siteAllowed: false,
  blockedCount: 0
};

export const useTrackerBlocking = () => {
  const [status, setStatus] = useState<TrackerStatus>(defaultStatus);
  const statusRef = useRef<TrackerStatus>(defaultStatus);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const refreshStatus = useCallback(async (webContentsId?: number | null) => {
    try {
      const result = await window.merezhyvo?.trackers?.getStatus?.({ webContentsId: webContentsId ?? null });
      if (result) {
        setStatus(result);
      }
    } catch (err) {
      console.error('[merezhyvo] trackers refresh failed', err);
    }
  }, []);

  const setEnabledGlobal = useCallback(async (enabled: boolean) => {
    setStatus((prev) => ({ ...prev, enabledGlobal: enabled }));
    try {
      const next = await window.merezhyvo?.trackers?.setEnabled?.(enabled);
      if (next) {
        setStatus((prev) => ({ ...prev, enabledGlobal: Boolean(next.enabled) }));
      }
      return next ?? null;
    } catch (err) {
      console.error('[merezhyvo] trackers setEnabled failed', err);
      return null;
    }
  }, []);

  const setSiteAllowed = useCallback(async (siteHost: string | null | undefined, allowed: boolean) => {
    const host = (siteHost ?? '').trim().toLowerCase();
    if (!host) return null;
    try {
      const next = await window.merezhyvo?.trackers?.setSiteAllowed?.({ siteHost: host, allowed });
      if (next) {
        setStatus((prev) => ({
          ...prev,
          siteAllowed: allowed
        }));
      }
      return next ?? null;
    } catch (err) {
      console.error('[merezhyvo] trackers setSiteAllowed failed', err);
      return null;
    }
  }, []);

  useEffect(() => {
    const off = window.merezhyvo?.trackers?.onStats?.((payload) => {
      if (!payload) return;
      setStatus(payload);
    });
    return () => {
      try {
        off?.();
      } catch {
        // noop
      }
    };
  }, []);

  return {
    status,
    refreshStatus,
    setEnabledGlobal,
    setSiteAllowed
  };
};
