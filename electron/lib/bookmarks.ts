'use strict';

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ensureDir, getProfileDir } from './shortcuts';

const fsp = fs.promises;
const BOOKMARKS_FILE = path.join(getProfileDir(), 'bookmarks.json');
const TEMP_SUFFIX = '.tmp';

export type BookmarkNodeType = 'bookmark' | 'folder';

export interface BookmarkNode {
  id: string;
  type: BookmarkNodeType;
  title: string;
  parentId: string | null;
  url?: string;
  tags?: string[];
  children?: string[];
}

export interface RootIds {
  toolbar: string;
  mobile: string;
  other: string;
}

export interface BookmarksTree {
  schema: 1;
  roots: RootIds;
  nodes: Record<string, BookmarkNode>;
}

const ROOT_IDS: RootIds = {
  toolbar: 'bm_root_toolbar',
  mobile: 'bm_root_mobile',
  other: 'bm_root_other'
};

const DEFAULT_TREE: BookmarksTree = {
  schema: 1,
  roots: ROOT_IDS,
  nodes: {
    [ROOT_IDS.toolbar]: {
      id: ROOT_IDS.toolbar,
      type: 'folder',
      title: 'Toolbar',
      parentId: null,
      children: []
    },
    [ROOT_IDS.mobile]: {
      id: ROOT_IDS.mobile,
      type: 'folder',
      title: 'Mobile',
      parentId: null,
      children: []
    },
    [ROOT_IDS.other]: {
      id: ROOT_IDS.other,
      type: 'folder',
      title: 'Other',
      parentId: null,
      children: []
    }
  }
};

const ensureDirReady = (): void => {
  ensureDir(path.dirname(BOOKMARKS_FILE));
};

const createAtomicPath = (target: string): string => {
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return `${target}.${unique}${TEMP_SUFFIX}`;
};

const writeAtomicJson = async (tree: BookmarksTree): Promise<void> => {
  ensureDirReady();
  const payload = JSON.stringify(tree, null, 2);
  const tempPath = createAtomicPath(BOOKMARKS_FILE);
  await fsp.writeFile(tempPath, payload, 'utf8');
  await fsp.rename(tempPath, BOOKMARKS_FILE);
};

const cloneNode = (node: BookmarkNode): BookmarkNode => ({
  ...node,
  tags: node.tags ? [...node.tags] : undefined,
  children: node.children ? [...node.children] : undefined
});

const cloneTree = (tree: BookmarksTree): BookmarksTree => ({
  schema: tree.schema,
  roots: { ...tree.roots },
  nodes: Object.fromEntries(
    Object.entries(tree.nodes).map(([id, node]) => [id, cloneNode(node)])
  ) as Record<string, BookmarkNode>
});

const loadTree = async (): Promise<BookmarksTree> => {
  try {
    const raw = await fsp.readFile(BOOKMARKS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!isValidTree(parsed)) {
      throw new Error('Bookmarks data has invalid schema');
    }
    return cloneTree(parsed as BookmarksTree);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeAtomicJson(DEFAULT_TREE);
      return cloneTree(DEFAULT_TREE);
    }
    throw err;
  }
};

const normalizeUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    const hashIdx = trimmed.indexOf('#');
    return hashIdx === -1 ? trimmed : trimmed.slice(0, hashIdx);
  }
};

const makeId = (): string => `bm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

const sanitizeTitle = (value?: string | null): string => (value?.trim() || 'Untitled');

const sanitizeTags = (tags?: string[] | null): string[] | undefined => {
  if (!Array.isArray(tags)) return undefined;
  const filtered = tags
    .map((value) => value?.trim())
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  return filtered.length > 0 ? Array.from(new Set(filtered)) : undefined;
};

const isValidTree = (value: unknown): value is BookmarksTree => {
  if (!value || typeof value !== 'object') return false;
  const tree = value as BookmarksTree;
  if (tree.schema !== 1) return false;
  if (!tree.roots) return false;
  if (!tree.nodes || typeof tree.nodes !== 'object') return false;
  return true;
};

const addChild = (tree: BookmarksTree, parentId: string, childId: string, index?: number): void => {
  const parent = tree.nodes[parentId];
  if (!parent || parent.type !== 'folder') return;
  parent.children = parent.children ?? [];
  const normalizedIndex = typeof index === 'number' && index >= 0 ? Math.min(index, parent.children.length) : parent.children.length;
  parent.children.splice(normalizedIndex, 0, childId);
};

const removeChildRef = (tree: BookmarksTree, parentId: string | null, childId: string): void => {
  if (!parentId) return;
  const parent = tree.nodes[parentId];
  if (!parent || parent.type !== 'folder' || !Array.isArray(parent.children)) return;
  parent.children = parent.children.filter((id) => id !== childId);
};

const ensureRootsExist = (tree: BookmarksTree): boolean => {
  const { roots, nodes } = tree;
  const required = [roots.toolbar, roots.mobile, roots.other];
  return required.every((id) => {
    const node = nodes[id];
    return node?.type === 'folder';
  });
};

export const initIfMissing = async (): Promise<BookmarksTree> => {
  try {
    const tree = await loadTree();
    if (!ensureRootsExist(tree)) {
      await writeAtomicJson(DEFAULT_TREE);
      return cloneTree(DEFAULT_TREE);
    }
    return tree;
  } catch {
    await writeAtomicJson(DEFAULT_TREE);
    return cloneTree(DEFAULT_TREE);
  }
};

export const list = async (): Promise<BookmarksTree> => cloneTree(await loadTree());

export const isBookmarked = async (url: string): Promise<{ yes: boolean; nodeId?: string }> => {
  const normalized = normalizeUrl(url);
  const tree = await loadTree();
  for (const node of Object.values(tree.nodes)) {
    if (node.type === 'bookmark' && node.url === normalized) {
      return { yes: true, nodeId: node.id };
    }
  }
  return { yes: false };
};

type AddParams = {
  type?: BookmarkNodeType;
  title?: string | null;
  url?: string | null;
  parentId?: string;
  tags?: string[] | null;
};

export const add = async ({ type = 'bookmark', title, url, parentId, tags }: AddParams): Promise<string> => {
  const normalizedType: BookmarkNodeType = type === 'folder' ? 'folder' : 'bookmark';
  const tree = await loadTree();
  const candidateParent = parentId && tree.nodes[parentId] ? parentId : tree.roots.toolbar;
  const nodeId = makeId();
  const baseNode: BookmarkNode = {
    id: nodeId,
    type: normalizedType,
    title: sanitizeTitle(title),
    parentId: candidateParent
  };
  if (normalizedType === 'bookmark') {
    const normalizedUrl = normalizeUrl(url ?? '');
    if (!normalizedUrl) {
      throw new Error('Bookmark URL is required');
    }
    baseNode.url = normalizedUrl;
    baseNode.tags = sanitizeTags(tags);
  } else {
    baseNode.children = [];
  }
  tree.nodes[nodeId] = baseNode;
  addChild(tree, candidateParent, nodeId);
  await writeAtomicJson(tree);
  return nodeId;
};

type UpdateParams = {
  id: string;
  title?: string | null;
  url?: string | null;
  tags?: string[] | null;
};

export const update = async ({ id, title, url, tags }: UpdateParams): Promise<boolean> => {
  const tree = await loadTree();
  const node = tree.nodes[id];
  if (!node || node.type !== 'bookmark') return false;
  if (title !== undefined) {
    node.title = sanitizeTitle(title);
  }
  if (url !== undefined && url !== null) {
    const normalized = normalizeUrl(url);
    if (normalized) {
      node.url = normalized;
    }
  }
  const normalizedTags = sanitizeTags(tags);
  if (normalizedTags !== undefined) {
    node.tags = normalizedTags;
  } else if (tags && tags.length === 0) {
    delete node.tags;
  }
  await writeAtomicJson(tree);
  return true;
};

type MoveParams = {
  id: string;
  newParentId: string;
  index?: number;
};

export const move = async ({ id, newParentId, index }: MoveParams): Promise<boolean> => {
  const tree = await loadTree();
  const node = tree.nodes[id];
  const newParent = tree.nodes[newParentId];
  if (!node || !newParent || newParent.type !== 'folder') {
    return false;
  }
  removeChildRef(tree, node.parentId, id);
  node.parentId = newParentId;
  addChild(tree, newParentId, id, index);
  await writeAtomicJson(tree);
  return true;
};

const collectDescendants = (tree: BookmarksTree, nodeId: string, collection: string[]): void => {
  const node = tree.nodes[nodeId];
  if (!node) return;
  collection.push(nodeId);
  if (node.type === 'folder' && Array.isArray(node.children)) {
    for (const childId of node.children) {
      collectDescendants(tree, childId, collection);
    }
  }
};

export const remove = async (params: { id: string }): Promise<boolean> => {
  const tree = await loadTree();
  const node = tree.nodes[params.id];
  if (!node) return false;
  const toRemove: string[] = [];
  collectDescendants(tree, node.id, toRemove);
  for (const removeId of toRemove) {
    const current = tree.nodes[removeId];
    if (!current) continue;
    removeChildRef(tree, current.parentId, current.id);
    delete tree.nodes[removeId];
  }
  await writeAtomicJson(tree);
  return true;
};

export const exportJson = async (): Promise<BookmarksTree> => loadTree();

export const importJson = async (data: unknown): Promise<boolean> => {
  if (!isValidTree(data)) {
    return false;
  }
  const tree = data as BookmarksTree;
  if (!ensureRootsExist(tree)) {
    return false;
  }
  await writeAtomicJson(tree);
  return true;
};

/*
 * Format: JSON with schema=1, a `roots` object pointing to `toolbar`, `mobile`, and `other`, and a `nodes` map keyed by node IDs. Each node stores type, title, parentId, optional url, tags and, for folders, child ID arrays so the renderer can reconstruct the tree.
 */
