'use strict';

import { BrowserWindow, type Certificate, type WebContents } from 'electron';
import { DEFAULT_URL } from './windows';

export type CertState = 'unknown' | 'ok' | 'missing' | 'invalid';

export type CertDetails = {
  state: CertState;
  url?: string | null;
  host?: string | null;
  error?: string | null;
  certificate?: {
    subjectName?: string;
    issuerName?: string;
    serialNumber?: string;
    validStart?: number;
    validExpiry?: number;
    fingerprint?: string;
  } | null;
  updatedAt: number;
};

type Listener = (payload: { wcId: number; info: CertDetails }) => void;

const certMap = new Map<number, CertDetails>();
const listeners = new Set<Listener>();
const pendingCallbacks = new Map<number, (trust: boolean) => void>();

const isLikelyCertError = (code?: number, description?: string): boolean => {
  const specificCodes = new Set([
    -21,  // ERR_CERT_REVOKED
    -150, // ERR_SSL_PINNED_KEY_NOT_IN_CERT_CHAIN
    -151, // ERR_SSL_PINNED_KEY_IN_CERT_CHAIN
    -152, // other pinning
    -153, // cert common name invalid
    -194, // CT required
    -214, // ERR_CERTIFICATE_TRANSPARENCY_REQUIRED
    -202, // authority invalid
    -201, // contains errors
    -200, // weak signature
    -207, // date invalid
    -204, // revoked
    -120, // revoked (alt code)
    -177, // cert weak key
  ]);
  if (Number.isFinite(code)) {
    if (specificCodes.has(code!)) return true;
    if (code <= -200 && code >= -299) return true;
  }
  if (typeof description === 'string') {
    const upper = description.toUpperCase();
    if (upper.includes('CERT') || upper.includes('SSL')) return true;
  }
  return false;
};

const serializeCertificate = (cert: Certificate | undefined | null): CertDetails['certificate'] => {
  if (!cert) return null;
  return {
    subjectName: cert.subjectName,
    issuerName: cert.issuerName,
    serialNumber: cert.serialNumber,
    validStart: cert.validStart,
    validExpiry: cert.validExpiry,
    fingerprint: cert.fingerprint
  };
};

const emit = (wcId: number): void => {
  const info = certMap.get(wcId) ?? { state: 'unknown', updatedAt: Date.now() };
  for (const fn of listeners) {
    try {
      fn({ wcId, info });
    } catch {
      // ignore listener errors
    }
  }
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win || win.isDestroyed()) continue;
      win.webContents.send('merezhyvo:certs:update', { wcId, info });
    }
  } catch {
    // ignore broadcast errors
  }
};

const setState = (wcId: number, patch: Partial<CertDetails>): void => {
  if (!Number.isFinite(wcId)) return;
  const prev = certMap.get(wcId) ?? { state: 'unknown', updatedAt: Date.now() };
  const next: CertDetails = {
    ...prev,
    ...patch,
    updatedAt: Date.now()
  };
  certMap.set(wcId, next);
  emit(wcId);
};

const resetForUrl = (wcId: number, url: string | null | undefined): void => {
  const safeUrl = typeof url === 'string' && url.trim().length ? url : DEFAULT_URL;
  let state: CertState = 'unknown';
  try {
    const parsed = new URL(safeUrl);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === 'http:') state = 'missing';
    if (protocol !== 'https:' && protocol !== 'http:') state = 'unknown';
    setState(wcId, { state, url: safeUrl, host: parsed.hostname || null, error: null, certificate: null });
  } catch {
    setState(wcId, { state: 'unknown', url: safeUrl, error: null, certificate: null });
  }
};

export const allowCertificate = (wcId: number): boolean => {
  const cb = pendingCallbacks.get(wcId);
  if (!cb) return false;
  try {
    cb(true);
    setState(wcId, { state: 'ok' });
    return true;
  } catch {
    return false;
  } finally {
    pendingCallbacks.delete(wcId);
  }
};

export const rejectCertificate = (wcId: number): boolean => {
  const cb = pendingCallbacks.get(wcId);
  if (!cb) return false;
  try {
    cb(false);
    return true;
  } catch {
    return false;
  } finally {
    pendingCallbacks.delete(wcId);
  }
};

export const attachCertificateTracking = (contents: WebContents): void => {
  const wcId = contents.id;
  resetForUrl(wcId, contents.getURL());

  const handleDidStartNavigation = (_event: unknown, url: string, _isInPlace: boolean, isMainFrame: boolean) => {
    if (!isMainFrame) return;
    resetForUrl(wcId, url);
  };

  const handleDidFinishLoad = () => {
    let currentUrl = '';
    try {
      currentUrl = contents.getURL();
    } catch {
      currentUrl = '';
    }
    try {
      const parsed = currentUrl ? new URL(currentUrl) : null;
      if (parsed && parsed.protocol.toLowerCase() === 'https:') {
        const info = certMap.get(wcId);
        if (info?.state !== 'invalid') {
          setState(wcId, { state: 'ok', url: currentUrl, host: parsed.hostname });
        }
      }
    } catch {
      // ignore
    }
  };

  const handleCertificateError = (
    event: Electron.Event,
    url: string,
    error: string,
    certificate: Certificate,
    callback: (isTrusted: boolean) => void,
    isMainFrame: boolean
  ) => {
    if (!isMainFrame) {
      try { callback(false); } catch { /* ignore */ }
      return;
    }
    event.preventDefault();
    pendingCallbacks.set(wcId, callback);
    setState(wcId, {
      state: 'invalid',
      url,
      host: (() => { try { return new URL(url).hostname; } catch { return null; } })(),
      error,
      certificate: serializeCertificate(certificate)
    });
  };

  const handleDidFailLoad = (
    _event: Electron.Event,
    errorCode: number,
    errorDescription: string,
    validatedURL: string,
    isMainFrame: boolean
  ) => {
    if (!isMainFrame) return;
    if (!isLikelyCertError(errorCode, errorDescription)) return;
    const host = (() => { try { return new URL(validatedURL).hostname; } catch { return null; } })();
    setState(wcId, {
      state: 'invalid',
      url: validatedURL || null,
      host,
      error: errorDescription || String(errorCode),
      certificate: null
    });
  };

  const handleDestroyed = () => {
    certMap.delete(wcId);
    pendingCallbacks.delete(wcId);
  };

  contents.on('did-start-navigation', handleDidStartNavigation as any);
  contents.on('did-finish-load', handleDidFinishLoad);
  contents.on('certificate-error', handleCertificateError as any);
  contents.on('did-fail-load', handleDidFailLoad as any);
  contents.on('did-fail-provisional-load', handleDidFailLoad as any);
  contents.on('destroyed', handleDestroyed);
};

export const getCertificateInfo = (wcId: number): CertDetails => {
  const info = certMap.get(wcId);
  return info ?? { state: 'unknown', updatedAt: Date.now() };
};

export const subscribeCerts = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
