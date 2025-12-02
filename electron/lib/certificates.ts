/**
 * IMPORTANT LIMITATIONS (Electron / Chromium):
 *
 * - HPKP / pinned keys:
 *   HTTP Public Key Pinning (HPKP) and related pinned-key checks
 *   (e.g. ERR_SSL_PINNED_KEY_NOT_IN_CERT_CHAIN) are not enforced
 *   by Electron in the same way as in Chrome/Brave. In practice
 *   these failures usually do NOT surface as certificate errors
 *   to the JS layer, so this module cannot reliably detect them.
 *
 * - Certificate Transparency (CT):
 *   Electron does not provide full Certificate Transparency
 *   enforcement (SCT / CT log requirements). Sites that would
 *   fail CT policies in Chrome may still be treated as having a
 *   valid certificate here (no certificate-error / did-fail-load).
 *
 * - Revocation checks (CRL / OCSP):
 *   Revoked certificates (e.g. ERR_CERT_REVOKED) are only detected
 *   if the underlying Chromium stack successfully performs and trusts
 *   CRL/OCSP checks. This behaviour is implementation- and platform-
 *   dependent and can differ from Chrome/Brave/Firefox. Some
 *   revoked.badssl.com-style tests may therefore load without
 *   triggering any error in Electron.
 *
 * - badssl.com expectations:
 *   Several badssl.com test hosts exercise HPKP, CT, weak/obsolete
 *   cipher suites, mixed content and other conditions that are NOT
 *   always mapped to hard TLS/certificate errors in Electron.
 *   It is expected that some of these sites will load without
 *   this module marking the certificate as invalid. This is a
 *   limitation of the underlying engine, not a bug in this file.
 *
 * In other words, this module implements a best-effort indicator
 * of certificate validity based on what Electron actually reports
 * (certificate-error / did-fail-load). It is not a complete TLS
 * security auditor and cannot enforce policies that the engine
 * itself does not expose.
 */


'use strict';

import { BrowserWindow, type Certificate, type Event, type WebContents } from 'electron';
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
  if (typeof code === 'number') {
    // Special case for HPKP pinned key violation (if ever surfaced).
    if (code === -150 /* ERR_SSL_PINNED_KEY_NOT_IN_CERT_CHAIN */) {
      return true;
    }

    if (code <= -200 && code >= -299) {
      return true;
    }
  }

  if (typeof description === 'string' && description) {
    const upper = description.toUpperCase();

    // ERR_CERT_*, ERR_SSL_*, ERR_INSECURE_RESPONSE, CT/HPKP
    if (
      upper.includes('CERT') ||
      upper.includes('SSL') ||
      upper.includes('INSECURE_RESPONSE') ||
      upper.includes('CERTIFICATE_TRANSPARENCY') ||
      upper.includes('HPKP') ||
      upper.includes('PINNED_KEY')
    ) {
      return true;
    }
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
    setState(wcId, {
      state,
      url: safeUrl,
      host: parsed.hostname || null,
      error: null,
      certificate: null
    });
  } catch {
    setState(wcId, {
      state: 'unknown',
      url: safeUrl,
      error: null,
      certificate: null
    });
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

  const handleDidStartNavigation = (
    _event: Event,
    url: string,
    _isInPlace: boolean,
    isMainFrame: boolean
  ) => {
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
    event: Event,
    url: string,
    error: string,
    certificate: Certificate,
    callback: (isTrusted: boolean) => void,
    isMainFrame: boolean
  ) => {
    if (!isMainFrame) {
      try {
        callback(false);
      } catch {
        // ignore
      }
      return;
    }

    event.preventDefault();
    pendingCallbacks.set(wcId, callback);

    setState(wcId, {
      state: 'invalid',
      url,
      host: (() => {
        try {
          return new URL(url).hostname;
        } catch {
          return null;
        }
      })(),
      error,
      certificate: serializeCertificate(certificate)
    });
  };

  const handleDidFailLoad = (
    _event: Event,
    errorCode: number,
    errorDescription: string,
    validatedURL: string,
    isMainFrame: boolean,
    _frameProcessId: number,
    _frameRoutingId: number
  ) => {
    if (!isMainFrame) return;
    if (!isLikelyCertError(errorCode, errorDescription)) return;

    const host = (() => {
      try {
        return new URL(validatedURL).hostname;
      } catch {
        return null;
      }
    })();

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

  contents.on('did-start-navigation', handleDidStartNavigation);
  contents.on('did-finish-load', handleDidFinishLoad);
  contents.on('certificate-error', handleCertificateError);
  contents.on('did-fail-load', handleDidFailLoad);
  contents.on('did-fail-provisional-load', handleDidFailLoad);
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
