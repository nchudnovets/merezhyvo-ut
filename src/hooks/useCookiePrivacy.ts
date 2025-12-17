import { useCallback, useEffect, useState } from 'react';
import type { CookiePrivacySettings } from '../types/models';

const DEFAULT_COOKIE_PRIVACY: CookiePrivacySettings = {
  blockThirdParty: false,
  exceptions: { thirdPartyAllow: {} }
};

export const useCookiePrivacy = () => {
  const [cookiePrivacy, setCookiePrivacy] = useState<CookiePrivacySettings>(DEFAULT_COOKIE_PRIVACY);

  const refreshCookiePrivacy = useCallback(async () => {
    try {
      const next = await window.merezhyvo?.settings?.cookies?.get?.();
      if (next) {
        setCookiePrivacy(next as CookiePrivacySettings);
      }
    } catch (err) {
      console.error('[merezhyvo] cookies.get failed', err);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      void refreshCookiePrivacy();
    };
    window.addEventListener('merezhyvo:cookies:updated', handler);
    return () => {
      window.removeEventListener('merezhyvo:cookies:updated', handler);
    };
  }, [refreshCookiePrivacy]);

  const handleCookieBlockChange = useCallback(
    async (block: boolean) => {
      try {
        const next = await window.merezhyvo?.settings?.cookies?.setBlock?.(block);
        if (next) {
          setCookiePrivacy(next as CookiePrivacySettings);
          window.dispatchEvent(new CustomEvent('merezhyvo:cookies:updated', { detail: next }));
        }
      } catch (err) {
        console.error('[merezhyvo] cookie block update failed', err);
      }
    },
    []
  );

  return {
    cookiePrivacy,
    setCookiePrivacy,
    refreshCookiePrivacy,
    handleCookieBlockChange
  };
};
