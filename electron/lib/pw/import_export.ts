'use strict';

import crypto from 'crypto';
import psl from 'psl';
import {
  addOrUpdateEntry,
  clearEntries,
  deriveKeyFromPassword,
  decryptWithMasterKey,
  encryptWithMasterKey,
  getAllEntries,
  kdfParameters
} from './vault';

const MAX_CSV_SIZE = 20 * 1024 * 1024;
const MAX_MZRPASS_SIZE = 50 * 1024 * 1024;

const CSV_HEADER_ALIASES = {
  name: ['name', 'title', 'note'],
  url: ['url', 'site', 'origin'],
  username: ['username', 'user', 'login', 'email'],
  password: ['password', 'pass']
} as const;

type CsvHeader = keyof typeof CSV_HEADER_ALIASES;

type HeaderMap = Record<CsvHeader, number | null>;

interface NormalizedCsvRow {
  name?: string;
  username: string;
  password: string;
  url: string;
  origin: string;
  signonRealm: string;
}

export type CsvPreviewRow = {
  name?: string;
  url: string;
  username: string;
};

export type CsvPreviewResult = {
  total: number;
  valid: number;
  invalid: number;
  sample: CsvPreviewRow | null;
};

export type DetectFormat = 'csv' | 'mzrpass' | 'unknown';

type MzrpassKdf = {
  name: 'scrypt' | 'master';
  salt?: string;
  N: number;
  r: number;
  p: number;
  bits: number;
};

type MzrpassFile = {
  format: 'mzrpass';
  version: number;
  kdf: MzrpassKdf;
  nonce: string;
  tag: string;
  ciphertext: string;
  createdAt: number;
  exportedAt: number;
};

const ensureBuffer = (input: Buffer | string): Buffer =>
  Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');

const removeBom = (text: string): string => text.replace(/^\uFEFF/, '');

const parseCsvRows = (text: string, maxRows: number): string[][] => {
  const rows: string[][] = [];
  let currentCell = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      const next = text[i + 1];
      if (inQuotes && next === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      rows.push(currentRow);
      currentRow = [];
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      if (rows.length >= maxRows) {
        break;
      }
      continue;
    }

    currentCell += char;
  }

  if (currentRow.length > 0 || currentCell.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
};

const buildHeaderMap = (headers: string[]): HeaderMap => {
  const normalizedHeaders = headers.map((value) => value.trim().toLowerCase());
  const map: HeaderMap = { name: null, url: null, username: null, password: null };
  (Object.keys(CSV_HEADER_ALIASES) as CsvHeader[]).forEach((key) => {
    const aliases = CSV_HEADER_ALIASES[key];
    for (const alias of aliases) {
      const idx = normalizedHeaders.findIndex((value) => value === alias);
      if (idx !== -1) {
        map[key] = idx;
        break;
      }
    }
  });
  return map;
};

const getColumnValue = (row: string[], index: number | null): string => {
  if (index === null) return '';
  const value = row[index];
  return typeof value === 'string' ? value.trim() : '';
};

const tryNormalizeUrl = (value: string): { url: string; origin: string; signonRealm: string } | null => {
  if (!value) return null;
  const trimValue = value.trim();
  if (!trimValue) return null;

  const normalizeCandidate = (input: string): URL | null => {
    try {
      const parsed = new URL(input);
      parsed.hash = '';
      return parsed;
    } catch {
      return null;
    }
  };

  let parsed = normalizeCandidate(trimValue);
  if (!parsed && !/^[a-z]+:\/\//i.test(trimValue)) {
    parsed = normalizeCandidate(`https://${trimValue}`);
  }
  if (!parsed) return null;

  const hostname = parsed.hostname;
  const eTld = psl.get(hostname) ?? hostname;
  if (!eTld) return null;
  const origin = parsed.origin;
  const signonRealm = `${parsed.protocol}//${eTld}`;
  return { url: parsed.toString(), origin, signonRealm };
};

const normalizeCsvRows = (text: string): { normalized: NormalizedCsvRow[]; total: number; invalid: number } => {
  const rows = parseCsvRows(removeBom(text), 200000);
  if (rows.length === 0) {
    return { normalized: [], total: 0, invalid: 0 };
  }

  const header = rows[0] ?? [];
  const dataRows = rows.slice(1);
  if (header.length === 0) {
    return { normalized: [], total: dataRows.length, invalid: dataRows.length };
  }

  const headerMap = buildHeaderMap(header);
  let invalid = 0;
  const normalized: NormalizedCsvRow[] = [];

  for (const row of dataRows) {
    const urlValue = getColumnValue(row, headerMap.url);
    const passwordValue = getColumnValue(row, headerMap.password);
    const usernameValue = getColumnValue(row, headerMap.username);
    if (!urlValue || !passwordValue || !usernameValue) {
      invalid += 1;
      continue;
    }

    const normalizedUrl = tryNormalizeUrl(urlValue);
    if (!normalizedUrl) {
      invalid += 1;
      continue;
    }

    normalized.push({
      name: (() => {
        const value = getColumnValue(row, headerMap.name);
        return value.length ? value : undefined;
      })(),
      username: usernameValue,
      password: passwordValue,
      url: normalizedUrl.url,
      origin: normalizedUrl.origin,
      signonRealm: normalizedUrl.signonRealm
    });
  }

  return { normalized, total: dataRows.length, invalid };
};

const ensureCsvSize = (text: string) => {
  if (Buffer.byteLength(text, 'utf8') > MAX_CSV_SIZE) {
    throw new Error('File is too large to import');
  }
};

const ensureMzrpassSize = (data: Buffer) => {
  if (data.length > MAX_MZRPASS_SIZE) {
    throw new Error('File is too large to import');
  }
};

const padNumber = (value: number): string => (value < 10 ? `0${value}` : `${value}`);

const formatFilenameTimestamp = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = padNumber(date.getMonth() + 1);
  const dd = padNumber(date.getDate());
  const hh = padNumber(date.getHours());
  const min = padNumber(date.getMinutes());
  return `${yyyy}${mm}${dd}-${hh}${min}`;
};

const decodeBase64 = (value: string): Buffer => Buffer.from(value, 'base64');

const encryptBufferWithKey = (key: Buffer, plaintext: Buffer) => {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { nonce, tag: cipher.getAuthTag(), ciphertext };
};

const decryptBufferWithKey = (key: Buffer, nonce: Buffer, tag: Buffer, ciphertext: Buffer): Buffer => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

export const detectFormat = (input: Buffer | string): DetectFormat => {
  const buf = ensureBuffer(input);
  const text = removeBom(buf.toString('utf8')).trimStart();
  if (!text) return 'unknown';

  try {
    const parsed = JSON.parse(text);
    if (parsed?.format === 'mzrpass') {
      return 'mzrpass';
    }
  } catch {
    // ignore
  }

  const firstLine = text.split(/\r?\n/)[0] ?? '';
  if (firstLine.includes(',') && /(url|site|name)/i.test(firstLine)) {
    return 'csv';
  }

  return 'unknown';
};

export const previewCSV = (csvText: string): CsvPreviewResult => {
  ensureCsvSize(csvText);
  const { normalized, total, invalid } = normalizeCsvRows(csvText);
  const firstRow = normalized[0];
  const sample = firstRow
    ? {
        url: firstRow.url,
        username: firstRow.username,
        name: firstRow.name
      }
    : null;
  return {
    total,
    valid: normalized.length,
    invalid,
    sample
  };
};

export const importCSV = (csvText: string, scope: { mode: 'add' | 'replace' }): { imported: number; skipped: number } => {
  ensureCsvSize(csvText);
  if (scope.mode === 'replace') {
    clearEntries();
  }
  const { normalized, invalid } = normalizeCsvRows(csvText);
  normalized.forEach((row) => {
    addOrUpdateEntry({
      origin: row.origin,
      signonRealm: row.signonRealm,
      formAction: row.url,
      username: row.username,
      password: row.password,
      notes: row.name
    });
  });
  return { imported: normalized.length, skipped: invalid };
};

export const exportCSV = (): string => {
  const entries = getAllEntries();
  const lines = ['name,url,username,password'];
  const escapeField = (value: string): string => {
    const needsQuotes = /[,"\n]/.test(value);
    if (!needsQuotes) return value;
    return `"${value.replace(/"/g, '""')}"`;
  };

  entries.forEach((entry) => {
    const name = entry.notes ?? '';
    const rowValues = [name, entry.origin, entry.username, entry.password];
    lines.push(rowValues.map((field) => escapeField(field)).join(','));
  });

  return lines.join('\n');
};

export const exportEncryptedJSON = async (
  exportPassword?: string
): Promise<{ filenameSuggested: string; content: Buffer }> => {
  const entries = getAllEntries();
  const payload = Buffer.from(
    JSON.stringify({
      version: 1,
      createdAt: Date.now(),
      exportedAt: Date.now(),
      entries: entries.map((entry) => ({
        origin: entry.origin,
        signonRealm: entry.signonRealm,
        formAction: entry.formAction,
        username: entry.username,
        password: entry.password,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        lastUsedAt: entry.lastUsedAt,
        useCount: entry.useCount,
        notes: entry.notes,
        tags: entry.tags
      }))
    }),
    'utf8'
  );

  let encrypted: { nonce: Buffer; tag: Buffer; ciphertext: Buffer };
  let kdf: MzrpassKdf;

  if (exportPassword) {
    const salt = crypto.randomBytes(16);
    const key = await deriveKeyFromPassword(exportPassword, salt);
    encrypted = encryptBufferWithKey(key, payload);
    kdf = {
      name: 'scrypt',
      salt: salt.toString('base64'),
      N: kdfParameters.N,
      r: kdfParameters.r,
      p: kdfParameters.p,
      bits: kdfParameters.bits
    };
  } else {
    encrypted = await encryptWithMasterKey(payload);
    kdf = {
      name: 'master',
      N: kdfParameters.N,
      r: kdfParameters.r,
      p: kdfParameters.p,
      bits: kdfParameters.bits
    };
  }

  const serialized: MzrpassFile = {
    format: 'mzrpass',
    version: 1,
    kdf,
    nonce: encrypted.nonce.toString('base64'),
    tag: encrypted.tag.toString('base64'),
    ciphertext: encrypted.ciphertext.toString('base64'),
    createdAt: Date.now(),
    exportedAt: Date.now()
  };

  const filenameSuggested = `passwords-${formatFilenameTimestamp(new Date())}.mzrpass`;
  return { filenameSuggested, content: Buffer.from(JSON.stringify(serialized), 'utf8') };
};

export const importEncryptedJSON = async (
  data: Buffer | string,
  payload: { mode: 'add' | 'replace'; password?: string }
): Promise<{ imported: number }> => {
  const buffer = ensureBuffer(data);
  ensureMzrpassSize(buffer);
  let parsed: MzrpassFile;
  try {
    parsed = JSON.parse(buffer.toString('utf8')) as MzrpassFile;
  } catch (err) {
    throw new Error("Couldn't import this file. It doesn't look like a passwords mzrpass.");
  }

  if (parsed.format !== 'mzrpass' || parsed.version !== 1) {
    throw new Error("Couldn't import this file. It doesn't look like a passwords mzrpass.");
  }

  const nonce = decodeBase64(parsed.nonce);
  const tag = decodeBase64(parsed.tag);
  const ciphertext = decodeBase64(parsed.ciphertext);
  let plaintext: Buffer;
  if (parsed.kdf.name === 'master') {
    plaintext = decryptWithMasterKey(nonce, tag, ciphertext);
  } else {
    if (!payload.password) {
      throw new Error('Password is required to import this file');
    }
    if (!parsed.kdf.salt) {
      throw new Error("Couldn't import this file. KDF salt is missing.");
    }
    const salt = decodeBase64(parsed.kdf.salt);
    const key = await deriveKeyFromPassword(payload.password, salt);
    plaintext = decryptBufferWithKey(key, nonce, tag, ciphertext);
  }

  const result = JSON.parse(plaintext.toString('utf8')) as { entries?: Array<Record<string, unknown>> };

  if (payload.mode === 'replace') {
    clearEntries();
  }

  const entries = Array.isArray(result.entries) ? result.entries : [];
  let imported = 0;
  entries.forEach((entry) => {
    const origin = typeof entry.origin === 'string' ? entry.origin : '';
    const signonRealm = typeof entry.signonRealm === 'string' ? entry.signonRealm : origin;
    const username = typeof entry.username === 'string' ? entry.username : '';
    const password = typeof entry.password === 'string' ? entry.password : '';
    if (!origin || !signonRealm || !username || !password) return;
    addOrUpdateEntry({
      origin,
      signonRealm,
      formAction: typeof entry.formAction === 'string' ? entry.formAction : origin,
      username,
      password,
      notes: typeof entry.notes === 'string' ? entry.notes : undefined,
      tags: Array.isArray(entry.tags)
        ? entry.tags.filter((item): item is string => typeof item === 'string')
        : undefined
    });
    imported += 1;
  });

  return { imported };
};
