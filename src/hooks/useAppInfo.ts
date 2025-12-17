import { useEffect, useMemo, useState } from 'react';
import type { MerezhyvoAboutInfo } from '../types/preload';

export type AppInfo = {
  name: string;
  version: string;
  description: string;
  chromium: string;
  electron: string;
  node: string;
  torVersion?: string | null;
};

const FALLBACK_APP_INFO: AppInfo = {
  name: 'Merezhyvo',
  version: '0.0.0',
  description: '',
  chromium: '',
  electron: '',
  node: '',
  torVersion: null
};

export const useAppInfo = (): AppInfo => {
  const [aboutInfoFromMain, setAboutInfoFromMain] = useState<MerezhyvoAboutInfo | null>(null);

  useEffect(() => {
    let canceled = false;
    const fetchAboutInfo = async () => {
      try {
        const info = await window.merezhyvo?.about.getInfo();
        if (!canceled && info) {
          setAboutInfoFromMain(info);
        }
      } catch {
        if (!canceled) {
          setAboutInfoFromMain(null);
        }
      }
    };
    fetchAboutInfo();
    return () => {
      canceled = true;
    };
  }, []);

  return useMemo<AppInfo>(() => {
    if (typeof window === 'undefined') return FALLBACK_APP_INFO;
    const info = window.merezhyvo?.appInfo as Partial<AppInfo> | undefined;
    const version = info?.version ?? FALLBACK_APP_INFO.version;
    const chromium =
      aboutInfoFromMain?.chromiumVersion ?? info?.chromium ?? FALLBACK_APP_INFO.chromium;
    const torVersion =
      aboutInfoFromMain?.torVersion ?? info?.torVersion ?? FALLBACK_APP_INFO.torVersion;
    return {
      name: info?.name ?? FALLBACK_APP_INFO.name,
      version,
      description: info?.description ?? FALLBACK_APP_INFO.description,
      chromium,
      electron: info?.electron ?? FALLBACK_APP_INFO.electron,
      node: info?.node ?? FALLBACK_APP_INFO.node,
      torVersion
    };
  }, [aboutInfoFromMain]);
};
