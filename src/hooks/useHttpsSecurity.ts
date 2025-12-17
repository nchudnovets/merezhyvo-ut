import { useCallback, useEffect, useRef, useState } from 'react';
import type { CertificateInfo, HttpsMode, SslException } from '../types/models';
import { deriveErrorType, normalizeHost } from '../utils/security';

export const useHttpsSecurity = () => {
  const [httpsMode, setHttpsMode] = useState<HttpsMode>('strict');
  const [sslExceptions, setSslExceptions] = useState<SslException[]>([]);
  const httpsModeRef = useRef<HttpsMode>('strict');
  const sslExceptionsRef = useRef<SslException[]>([]);

  useEffect(() => {
    httpsModeRef.current = httpsMode;
  }, [httpsMode]);

  useEffect(() => {
    sslExceptionsRef.current = Array.isArray(sslExceptions) ? sslExceptions : [];
  }, [sslExceptions]);

  const refreshHttpsSettings = useCallback(async () => {
    try {
      const next = await window.merezhyvo?.settings?.https?.get?.();
      if (next) {
        setHttpsMode(next.httpsMode === 'preferred' ? 'preferred' : 'strict');
        setSslExceptions(Array.isArray(next.sslExceptions) ? next.sslExceptions : []);
      }
    } catch (err) {
      console.error('[merezhyvo] https settings refresh failed', err);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      void refreshHttpsSettings();
    };
    window.addEventListener('merezhyvo:https:updated', handler);
    return () => {
      window.removeEventListener('merezhyvo:https:updated', handler);
    };
  }, [refreshHttpsSettings]);

  const hasSslException = useCallback(
    (host: string | null | undefined, errorType: string | null | undefined): boolean => {
      if (!host || !errorType) return false;
      const normalizedHost = host.toLowerCase();
      return sslExceptionsRef.current.some(
        (item) => item.host === normalizedHost && item.errorType === errorType
      );
    },
    []
  );

  const shouldBlockCert = useCallback(
    (candidate: CertificateInfo | null): boolean => {
      if (!candidate) return false;
      const errorType = deriveErrorType(candidate);
      const host = candidate.host || normalizeHost(candidate.url);
      const hasException = hasSslException(host, errorType);
      if (candidate.state === 'invalid') {
        return !hasException;
      }
      if (candidate.state === 'missing') {
        if (httpsModeRef.current === 'preferred') return false;
        return !hasException;
      }
      return false;
    },
    [hasSslException]
  );

  return {
    httpsMode,
    setHttpsMode,
    httpsModeRef,
    sslExceptions,
    setSslExceptions,
    sslExceptionsRef,
    refreshHttpsSettings,
    hasSslException,
    shouldBlockCert
  };
};
