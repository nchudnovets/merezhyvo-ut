'use strict';

import fs from 'fs';
import os from 'os';
import path from 'path';

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

const resolveTargetPath = (provided?: string): string => {
  if (provided) {
    try {
      return path.resolve(provided);
    } catch {
      // fallback to home
    }
  }
  return os.homedir();
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
    .map((dirent) => ({
      name: dirent.name,
      path: path.join(resolved, dirent.name),
      isDirectory: dirent.isDirectory()
    }))
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
  const resolved = path.resolve(filePath);
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
