'use strict';

import fs from 'fs';
import path from 'path';
import { DOCUMENTS_FOLDER } from './internal-paths';

const fsp = fs.promises;

export type FileDialogEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
};

export type FileDialogListing = {
  path: string;
  parent: string | null;
  entries: FileDialogEntry[];
};

const DOCUMENTS_PATH = path.resolve(DOCUMENTS_FOLDER);

const isPathWithinDocuments = (target: string): boolean => {
  const normalized = path.resolve(target);
  return (
    normalized === DOCUMENTS_PATH ||
    normalized.startsWith(`${DOCUMENTS_PATH}${path.sep}`)
  );
};

const ensureDocumentsScope = (target: string): string => {
  const normalized = path.resolve(target);
  if (isPathWithinDocuments(normalized)) {
    return normalized;
  }
  throw new Error('Access to the requested path is not allowed');
};

const resolveTargetPath = (provided?: string): string => {
  let candidate = DOCUMENTS_PATH;
  if (provided) {
    try {
      candidate = ensureDocumentsScope(provided);
    } catch {
      candidate = DOCUMENTS_PATH;
    }
  }
  try {
    fs.mkdirSync(DOCUMENTS_PATH, { recursive: true });
  } catch {
    // noop
  }
  return candidate;
};

const normalizeFilters = (filters?: string[] | null): string[] | undefined => {
  if (!filters) return undefined;
  const normalized = filters
    .map((item) => (item ? item.trim().toLowerCase().replace(/^\./, '') : ''))
    .filter((item) => item.length > 0);
  return normalized.length ? Array.from(new Set(normalized)) : undefined;
};

export const listDirectory = async (
  target?: string,
  filters?: string[] | null
): Promise<FileDialogListing> => {
  const resolved = resolveTargetPath(target);
  let stat: fs.Stats;
  try {
    stat = await fsp.stat(resolved);
  } catch {
    throw new Error('Unable to access directory');
  }
  if (!stat.isDirectory()) {
    throw new Error('Path is not a directory');
  }
  let dirents: fs.Dirent[];
  try {
    dirents = await fsp.readdir(resolved, { withFileTypes: true });
  } catch {
    throw new Error('Unable to read directory');
  }
  const normalizedFilters = normalizeFilters(filters);
  const entries = dirents
    .map((dirent) => {
      const entryPath = path.join(resolved, dirent.name);
      if (!isPathWithinDocuments(entryPath)) return null;
      return {
        name: dirent.name,
        path: entryPath,
        isDirectory: dirent.isDirectory()
      };
    })
    .filter((entry): entry is FileDialogEntry => Boolean(entry))
    .filter((entry) => {
      if (entry.isDirectory || !normalizedFilters) return true;
      const lower = entry.name.toLowerCase();
      return normalizedFilters.some((ext) => lower.endsWith(`.${ext}`));
    })
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  const parent = resolved === path.parse(resolved).root ? null : path.dirname(resolved);
  return { path: resolved, parent, entries };
};

export const readFileContent = async (filePath: string): Promise<string> => {
  if (!filePath) {
    throw new Error('Path is required');
  }
  const resolved = ensureDocumentsScope(filePath);
  let stat: fs.Stats;
  try {
    stat = await fsp.stat(resolved);
  } catch {
    throw new Error('Unable to access file');
  }
  if (!stat.isFile()) {
    throw new Error('Path is not a file');
  }
  const data = await fsp.readFile(resolved, 'utf8');
  return data;
};

export const readFileAsBase64 = async (filePath: string): Promise<string> => {
  if (!filePath) {
    throw new Error('Path is required');
  }
  const resolved = ensureDocumentsScope(filePath);
  let stat: fs.Stats;
  try {
    stat = await fsp.stat(resolved);
  } catch {
    throw new Error('Unable to access file');
  }
  if (!stat.isFile()) {
    throw new Error('Path is not a file');
  }
  const data = await fsp.readFile(resolved);
  return data.toString('base64');
};

export const writeFileContent = async (
  filePath: string,
  data: string,
  encoding: BufferEncoding = 'utf8'
): Promise<void> => {
  if (!filePath) {
    throw new Error('Path is required');
  }
  const resolved = ensureDocumentsScope(filePath);
  const dir = path.dirname(resolved);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
  await fsp.writeFile(resolved, data, { encoding });
};
