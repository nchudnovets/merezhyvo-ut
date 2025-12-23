import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackerStatus } from '../types/models';

const defaultStatus: TrackerStatus = {
  trackersEnabledGlobal: false,
  adsEnabledGlobal: false,
  blockingMode: 'basic',
  blockingActive: false,
  siteHost: null,
  trackersAllowedForSite: false,
  adsAllowedForSite: false,
  blockedTotal: 0,
  blockedAds: 0,
  blockedTrackers: 0
};

export const useTrackerBlocking = () => {
  const [status, setStatus] = useState<TrackerStatus>(defaultStatus);
  const statusRef = useRef<TrackerStatus>(defaultStatus);
  const normalizeStatus = useCallback(
    (payload: TrackerStatus): TrackerStatus => ({
      ...payload,
      blockingActive: Boolean(payload.blockingActive ?? (payload.trackersEnabledGlobal || payload.adsEnabledGlobal))
    }),
    []
  );

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const refreshStatus = useCallback(async (webContentsId?: number | null) => {
    try {
      const result = await window.merezhyvo?.trackers?.getStatus?.({ webContentsId: webContentsId ?? null });
      if (result) {
        setStatus(normalizeStatus(result as TrackerStatus));
      }
    } catch (err) {
      console.error('[merezhyvo] trackers refresh failed', err);
    }
  }, [normalizeStatus]);

  const setTrackersEnabledGlobal = useCallback(async (enabled: boolean) => {
    setStatus((prev) => ({ ...prev, trackersEnabledGlobal: enabled, blockingActive: Boolean(enabled || prev.adsEnabledGlobal) }));
    try {
      const next = await window.merezhyvo?.trackers?.setEnabled?.(enabled);
      if (next) {
        setStatus((prev) => ({
          ...prev,
          trackersEnabledGlobal: Boolean(next.enabled),
          blockingActive: Boolean(Boolean(next.enabled) || prev.adsEnabledGlobal)
        }));
      }
      return next ?? null;
    } catch (err) {
      console.error('[merezhyvo] trackers setEnabled failed', err);
      return null;
    }
  }, []);

  const setAdsEnabledGlobal = useCallback(async (enabled: boolean) => {
    setStatus((prev) => ({ ...prev, adsEnabledGlobal: enabled, blockingActive: Boolean(prev.trackersEnabledGlobal || enabled) }));
    try {
      const next = await window.merezhyvo?.trackers?.setAdsEnabled?.(enabled);
      if (next) {
        setStatus((prev) => ({
          ...prev,
          adsEnabledGlobal: Boolean(next.enabled),
          blockingActive: Boolean(prev.trackersEnabledGlobal || Boolean(next.enabled))
        }));
      }
      return next ?? null;
    } catch (err) {
      console.error('[merezhyvo] trackers setAdsEnabled failed', err);
      return null;
    }
  }, []);

  const setTrackersSiteAllowed = useCallback(async (siteHost: string | null | undefined, allowed: boolean) => {
    const host = (siteHost ?? '').trim().toLowerCase();
    if (!host) return null;
    try {
      const next = await window.merezhyvo?.trackers?.setSiteAllowed?.({ siteHost: host, allowed });
      if (next) {
        setStatus(normalizeStatus(next as TrackerStatus));
      }
      return next ?? null;
    } catch (err) {
      console.error('[merezhyvo] trackers setSiteAllowed failed', err);
      return null;
    }
  }, []);

  const setAdsSiteAllowed = useCallback(async (siteHost: string | null | undefined, allowed: boolean) => {
    const host = (siteHost ?? '').trim().toLowerCase();
    if (!host) return null;
    try {
      const next = await window.merezhyvo?.trackers?.setAdsAllowed?.({ siteHost: host, allowed });
      if (next) {
        setStatus(normalizeStatus(next as TrackerStatus));
      }
      return next ?? null;
    } catch (err) {
      console.error('[merezhyvo] trackers setAdsAllowed failed', err);
      return null;
    }
  }, []);

  useEffect(() => {
    const off = window.merezhyvo?.trackers?.onStats?.((payload) => {
      if (!payload) return;
      setStatus(normalizeStatus(payload as TrackerStatus));
    });
    return () => {
      try {
        off?.();
      } catch {
        // noop
      }
    };
  }, [normalizeStatus]);

  return {
    status,
    refreshStatus,
    setTrackersEnabledGlobal,
    setAdsEnabledGlobal,
    setTrackersSiteAllowed,
    setAdsSiteAllowed,
    setBlockingMode: async (mode: 'basic' | 'strict') => {
      try {
        const next = await window.merezhyvo?.trackers?.setBlockingMode?.(mode);
        if (next) {
          setStatus(normalizeStatus(next as TrackerStatus));
        }
        return next ?? null;
      } catch (err) {
        console.error('[merezhyvo] trackers setBlockingMode failed', err);
        return null;
      }
    }
  };
};
