import type { CertificateInfo } from '../types/models';

export const HTTP_ERROR_TYPE = 'HTTP_NOT_SECURE';

export const isLikelyCertError = (code?: number, description?: string): boolean => {
  if (typeof code === 'number') {
    if (code === -150 /* ERR_SSL_PINNED_KEY_NOT_IN_CERT_CHAIN */) return true;
    if (code <= -200 && code >= -299) return true;
  }
  if (typeof description === 'string' && description) {
    const upper = description.toUpperCase();
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

export const normalizeHost = (url?: string | null): string | null => {
  try {
    const parsed = url ? new URL(url) : null;
    return parsed?.hostname ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
};

export const isSubdomainOrSame = (host: string | null | undefined, root: string | null | undefined): boolean => {
  if (!host || !root) return false;
  if (host === root) return true;
  return host.endsWith(`.${root}`);
};

export const deriveErrorType = (cert: CertificateInfo | null): string | null => {
  if (!cert) return null;
  if (cert.state === 'missing') return HTTP_ERROR_TYPE;
  if (cert.state === 'invalid') return cert.error ?? 'CERT_ERROR';
  return null;
};
