import { useCallback, useEffect, useRef, useState } from 'react';
import { torService } from '../services/tor/tor';
import { ipc } from '../services/ipc/ipc';
import { bannedCountries } from '../config/bannedCountries';

type UseTorSettingsParams = {
  showGlobalToast: (message: string) => void;
};

export const useTorSettings = ({ showGlobalToast }: UseTorSettingsParams) => {
  const [torEnabled, setTorEnabled] = useState<boolean>(false);
  const [torKeepEnabled, setTorKeepEnabled] = useState<boolean>(false);
  const [torKeepEnabledDraft, setTorKeepEnabledDraft] = useState<boolean>(false);
  const [torConfigSaving, setTorConfigSaving] = useState<boolean>(false);
  const [torConfigFeedback, setTorConfigFeedback] = useState<string>('');
  const [torIp, setTorIp] = useState<string>('');
  const [torIpLoading, setTorIpLoading] = useState<boolean>(false);
  const [accessBlocked, setAccessBlocked] = useState<boolean>(false);
  const torIpRequestRef = useRef<number>(0);
  const torAutoStartGuardRef = useRef<boolean>(false);

  const evaluateAccessRestriction = useCallback(async (ip?: string) => {
    try {
      const endpoint = ip && ip.trim().length ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) {
        setAccessBlocked(false);
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { country_code?: string };
      const country = typeof data.country_code === 'string' ? data.country_code.trim().toUpperCase() : '';
      setAccessBlocked(country ? bannedCountries.includes(country) : false);
    } catch {
      setAccessBlocked(false);
    }
  }, []);

  const refreshTorIp = useCallback(async (): Promise<void> => {
    const requestId = Date.now();
    torIpRequestRef.current = requestId;
    setTorIpLoading(true);
    try {
      const response = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch IP');
      const data = (await response.json().catch(() => ({}))) as { ip?: string };
      if (torIpRequestRef.current === requestId) {
        const ip = typeof data.ip === 'string' ? data.ip : '';
        setTorIp(ip);
        evaluateAccessRestriction(ip);
      }
    } catch {
      if (torIpRequestRef.current === requestId) {
        setTorIp('');
        evaluateAccessRestriction();
      }
    } finally {
      if (torIpRequestRef.current === requestId) {
        setTorIpLoading(false);
      }
    }
  }, [evaluateAccessRestriction]);

  const handleTorKeepChange = useCallback(
    (next: boolean) => {
      if (torConfigSaving) return;
      const previousKeep = torKeepEnabled;
      setTorKeepEnabledDraft(next);
      setTorConfigSaving(true);
      setTorConfigFeedback('');

      void (async () => {
        try {
          const result = await ipc.settings.setTorKeepEnabled(next);
          if (result?.ok) {
            const keep = Boolean(result.keepEnabled);
            setTorKeepEnabled(keep);
            setTorKeepEnabledDraft(keep);
            setTorConfigFeedback('Saved');
          } else {
            setTorKeepEnabled(previousKeep);
            setTorKeepEnabledDraft(previousKeep);
            setTorConfigFeedback(result?.error || 'Failed to update Tor preference.');
          }
        } catch (err) {
          setTorKeepEnabled(previousKeep);
          setTorKeepEnabledDraft(previousKeep);
          setTorConfigFeedback(String(err));
        } finally {
          setTorConfigSaving(false);
        }
      })();
    },
    [torKeepEnabled, torConfigSaving]
  );

  const handleToggleTor = useCallback(async () => {
    try {
      const state = await torService.toggle();
      if (!torEnabled && (!state || !state.enabled)) {
        const reason = state?.reason?.trim() || 'Tor failed to start.';
        showGlobalToast(reason);
      }
    } catch (err) {
      console.error('[Merezhyvo] tor toggle failed', err);
      showGlobalToast('Tor toggle failed.');
    }
  }, [torEnabled, showGlobalToast]);

  useEffect(() => {
    const off = torService.subscribe((enabled) => {
      setTorEnabled(!!enabled);
    });
    torService
      .getState()
      .then((state) => {
        if (state) {
          setTorEnabled(!!state.enabled);
        }
      })
      .catch(() => {});
    return () => {
      if (typeof off === 'function') {
        off();
      }
    };
  }, []);

  useEffect(() => {
    if (!torKeepEnabled || torEnabled) {
      torAutoStartGuardRef.current = false;
      return;
    }
    if (torAutoStartGuardRef.current) return;
    torAutoStartGuardRef.current = true;
    void (async () => {
      try {
        await torService.toggle();
      } catch (err) {
        console.error('[Merezhyvo] tor auto-start failed', err);
      } finally {
        torAutoStartGuardRef.current = false;
      }
    })();
  }, [torKeepEnabled, torEnabled]);

  useEffect(() => {
    refreshTorIp();
  }, [torEnabled, refreshTorIp]);

  return {
    accessBlocked,
    torEnabled,
    torKeepEnabled,
    torKeepEnabledDraft,
    torConfigSaving,
    torConfigFeedback,
    torIp,
    torIpLoading,
    setTorKeepEnabled,
    setTorKeepEnabledDraft,
    setTorConfigFeedback,
    refreshTorIp,
    handleTorKeepChange,
    handleToggleTor
  };
};
