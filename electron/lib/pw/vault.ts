'use strict';

import crypto, { type ScryptOptions } from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { ensureDir, getProfileDir } from '../shortcuts';

type ScryptAsyncFn = (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

const scryptAsync = promisify(crypto.scrypt) as ScryptAsyncFn;
const kdfParams = { name: 'scrypt', N: 16384, r: 8, p: 1, bits: 256 } as const;
const VAULT_FILE = path.join(getProfileDir(), 'vault.mzrpw');

export type Settings = {
  saveAndFill: boolean;
  offerToSave: boolean;
  disallowHttp: boolean;
  autoLockMinutes: number;
};

const DEFAULT_SETTINGS: Settings = {
  saveAndFill: true,
  offerToSave: true,
  disallowHttp: true,
  autoLockMinutes: 15
};

export type Entry = {
  id: string;
  origin: string;
  signonRealm: string;
  formAction?: string;
  username: string;
  password: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number;
  useCount: number;
  notes?: string;
  tags?: string[];
};

export type EntryMeta = Omit<Entry, 'password'>;

type VaultPayload = {
  entries: Entry[];
  blacklist: string[];
  settings: Settings;
};

type VaultFile = {
  schema: 1;
  kdf: { name: string; salt: string; N: number; r: number; p: number; bits: number };
  nonce: string;
  tag: string;
  ciphertext: string;
  createdAt: number;
  updatedAt: number;
};

let vaultState: VaultPayload | null = null;
let masterKey: Buffer | null = null;
let currentSalt: Buffer | null = null;
let vaultMeta: { createdAt: number; updatedAt: number } | null = null;
let cachedSettings: Settings = { ...DEFAULT_SETTINGS };
let cachedBlacklist: string[] = [];

const ensureDirReady = (): void => {
  ensureDir(path.dirname(VAULT_FILE));
};

const deriveScryptKey = async (master: string, salt: Buffer): Promise<Buffer> =>
  scryptAsync(master, salt, 32, { N: kdfParams.N, r: kdfParams.r, p: kdfParams.p }) as Promise<Buffer>;

const zeroize = (buf?: Buffer | null): void => {
  if (buf && Buffer.isBuffer(buf)) {
    buf.fill(0);
  }
};

const isUnlocked = () => Boolean(masterKey && vaultState);

const ensureUnlocked = (): void => {
  if (!isUnlocked()) {
    throw new Error('Vault is locked');
  }
};

const serializePayload = (): Buffer => Buffer.from(JSON.stringify(vaultState ?? { entries: [], blacklist: [], settings: DEFAULT_SETTINGS }), 'utf8');

const encryptPayload = async (key: Buffer, salt: Buffer): Promise<VaultFile> => {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const plaintext = serializePayload();
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const now = Date.now();
  if (!vaultMeta) {
    vaultMeta = { createdAt: now, updatedAt: now };
  } else {
    vaultMeta.updatedAt = now;
  }
  return {
    schema: 1,
    kdf: { ...kdfParams, salt: salt.toString('base64') },
    nonce: nonce.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    createdAt: vaultMeta.createdAt,
    updatedAt: vaultMeta.updatedAt
  };
};

const resetVault = (): void => {
  vaultState = null;
  vaultMeta = null;
  if (currentSalt) {
    currentSalt.fill(0);
  }
  currentSalt = null;
};

const updateCaches = (): void => {
  if (!vaultState) return;
  cachedSettings = { ...vaultState.settings };
  cachedBlacklist = [...vaultState.blacklist];
};

const ensureVaultState = (): VaultPayload => {
  if (!vaultState) {
    vaultState = { entries: [], blacklist: [], settings: { ...DEFAULT_SETTINGS } };
  }
  updateCaches();
  return vaultState;
};

export const initNewVault = async (master: string): Promise<void> => {
  if (!master) throw new Error('Master password is required');
  ensureDirReady();
  vaultState = { entries: [], blacklist: [], settings: { ...DEFAULT_SETTINGS } };
  vaultMeta = { createdAt: Date.now(), updatedAt: Date.now() };
  updateCaches();
  const salt = crypto.randomBytes(16);
  const key = await deriveScryptKey(master, salt);
  masterKey = key;
  currentSalt = salt;
  const vaultFile = await encryptPayload(key, salt);
  await fs.promises.writeFile(VAULT_FILE, JSON.stringify(vaultFile), 'utf8');
};

export const hasVaultFile = (): boolean => {
  return fs.existsSync(VAULT_FILE);
};

export const createMasterPassword = async (master: string): Promise<void> => {
  if (!master) throw new Error('Master password is required');
  if (hasVaultFile()) {
    throw new Error('Master password already exists');
  }
  await initNewVault(master);
};

const decryptPayload = async (master: string, file: VaultFile): Promise<void> => {
  const salt = Buffer.from(file.kdf.salt, 'base64');
  const key = await deriveScryptKey(master, salt);
  const nonce = Buffer.from(file.nonce, 'base64');
  const ciphertext = Buffer.from(file.ciphertext, 'base64');
  const tag = Buffer.from(file.tag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const parsed = JSON.parse(plaintext.toString('utf8')) as VaultPayload;
  vaultState = {
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    blacklist: Array.isArray(parsed.blacklist) ? parsed.blacklist : [],
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings }
  };
  vaultMeta = { createdAt: file.createdAt, updatedAt: file.updatedAt };
  masterKey = key;
  currentSalt = salt;
  updateCaches();
};

export const loadVault = async (master: string): Promise<void> => {
  const raw = await fs.promises.readFile(VAULT_FILE, 'utf8');
  const data = JSON.parse(raw) as VaultFile;
  if (data.schema !== 1) {
    throw new Error('Unsupported vault schema');
  }
  await decryptPayload(master, data);
};

export const lock = (): void => {
  zeroize(masterKey);
  masterKey = null;
  resetVault();
};

export const changeMasterPassword = async (oldMaster: string, newMaster: string): Promise<void> => {
  await loadVault(oldMaster);
  if (!newMaster) throw new Error('New master password is required');
  vaultMeta = { createdAt: vaultMeta?.createdAt ?? Date.now(), updatedAt: Date.now() };
  const salt = crypto.randomBytes(16);
  const key = await deriveScryptKey(newMaster, salt);
  masterKey = key;
  currentSalt = salt;
  const file = await encryptPayload(key, salt);
  vaultMeta = { createdAt: file.createdAt, updatedAt: file.updatedAt };
  await fs.promises.writeFile(VAULT_FILE, JSON.stringify(file), 'utf8');
};

export const save = async (): Promise<void> => {
  ensureUnlocked();
  const salt = currentSalt ?? crypto.randomBytes(16);
  if (!currentSalt) currentSalt = salt;
  const file = await encryptPayload(masterKey as Buffer, salt);
  vaultMeta = { createdAt: file.createdAt, updatedAt: file.updatedAt };
  await fs.promises.writeFile(VAULT_FILE, JSON.stringify(file), 'utf8');
  updateCaches();
};

export const getSummary = () => ({
  entries: vaultState?.entries.length ?? 0,
  blacklist: vaultState?.blacklist.length ?? 0,
  updatedAt: vaultMeta?.updatedAt ?? 0
});

export const getEntriesMeta = (): EntryMeta[] => {
  ensureUnlocked();
  return (vaultState?.entries ?? []).map((entry) => ({
    id: entry.id,
    origin: entry.origin,
    signonRealm: entry.signonRealm,
    formAction: entry.formAction,
    username: entry.username,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    lastUsedAt: entry.lastUsedAt,
    useCount: entry.useCount,
    notes: entry.notes,
    tags: entry.tags
  }));
};

export const getEntrySecret = (id: string) => {
  ensureUnlocked();
  const entry = vaultState?.entries.find((e) => e.id === id);
  if (!entry) throw new Error('Entry not found');
  return { username: entry.username, password: entry.password };
};

export const addOrUpdateEntry = (input: { id?: string; origin: string; signonRealm: string; formAction?: string; username: string; password: string; notes?: string; tags?: string[] }): { id: string; updated: boolean } => {
  ensureUnlocked();
  const entries = vaultState!.entries;
  const now = Date.now();
  if (input.id) {
    const existing = entries.find((e) => e.id === input.id);
    if (existing) {
      existing.origin = input.origin;
      existing.signonRealm = input.signonRealm;
      existing.formAction = input.formAction;
      existing.username = input.username;
      existing.password = input.password;
      existing.notes = input.notes;
      existing.tags = input.tags ? [...input.tags] : undefined;
      existing.updatedAt = now;
      existing.useCount += 1;
      existing.lastUsedAt = now;
      return { id: existing.id, updated: true };
    }
  }
  const id = crypto.randomBytes(12).toString('hex');
  entries.push({
    id,
    origin: input.origin,
    signonRealm: input.signonRealm,
    formAction: input.formAction,
    username: input.username,
    password: input.password,
    notes: input.notes,
    tags: input.tags ? [...input.tags] : undefined,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    useCount: 1
  });
  return { id, updated: false };
};

export const removeEntry = (id: string): void => {
  ensureUnlocked();
  if (!vaultState) return;
  vaultState.entries = vaultState.entries.filter((entry) => entry.id !== id);
};

export const blacklist = {
  add(origin: string) {
    ensureUnlocked();
    const list = vaultState!.blacklist;
    if (!list.includes(origin)) list.push(origin);
    updateCaches();
  },
  remove(origin: string) {
    ensureUnlocked();
    vaultState!.blacklist = vaultState!.blacklist.filter((item) => item !== origin);
    updateCaches();
  },
  list() {
    ensureUnlocked();
    return [...vaultState!.blacklist];
  }
};

export const getSettings = (): Settings => ({ ...ensureVaultState().settings });

export const setSettings = (updates: Partial<Settings>): Settings => {
  ensureUnlocked();
  const settings = ensureVaultState().settings;
  Object.assign(settings, updates);
  settings.autoLockMinutes = updates.autoLockMinutes ?? settings.autoLockMinutes;
  updateCaches();
  return { ...settings };
};

export const isVaultUnlocked = isUnlocked;

export const clearEntries = (): void => {
  ensureUnlocked();
  if (vaultState) {
    vaultState.entries = [];
  }
  updateCaches();
};

export const getCachedSettings = (): Settings => ({ ...cachedSettings });

export const getCachedBlacklist = (): string[] => [...cachedBlacklist];

export const isOriginBlacklisted = (origin: string): boolean =>
  cachedBlacklist.some((item) => item.toLowerCase() === origin.toLowerCase());

export const getAllEntries = (): Entry[] => {
  ensureUnlocked();
  return (vaultState?.entries ?? []).map((entry) => ({ ...entry, tags: entry.tags ? [...entry.tags] : undefined }));
};

const encryptBufferWithKey = (key: Buffer, plaintext: Buffer) => {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { nonce, tag, ciphertext };
};

const decryptBufferWithKey = (key: Buffer, nonce: Buffer, tag: Buffer, ciphertext: Buffer) => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

export const encryptWithMasterKey = async (plaintext: Buffer) => {
  ensureUnlocked();
  const key = masterKey as Buffer;
  return encryptBufferWithKey(key, plaintext);
};

export const decryptWithMasterKey = (nonce: Buffer, tag: Buffer, ciphertext: Buffer): Buffer => {
  ensureUnlocked();
  const key = masterKey as Buffer;
  return decryptBufferWithKey(key, nonce, tag, ciphertext);
};

export const deriveKeyFromPassword = deriveScryptKey;

export const kdfParameters = kdfParams;
