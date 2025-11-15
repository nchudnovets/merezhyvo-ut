'use strict';

import { Buffer } from 'buffer';

const MAX_NESTING = 32;
const MAX_ITEMS = 100000;
const MAX_ICON_BYTES = 128 * 1024;

export type ParsedBookmark = {
  type: 'bookmark';
  title: string;
  url: string;
  addDate: number;
  lastModified?: number;
  tags?: string[];
  iconData?: Buffer;
  iconMime?: string;
};

export type ParsedFolder = {
  type: 'folder';
  title: string;
  addDate: number;
  lastModified?: number;
  children: ParsedEntry[];
};

export type ParsedEntry = ParsedBookmark | ParsedFolder;

const attributeRegex = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>\/]+))/g;

const normalizeNumber = (value: string | undefined | null): number | undefined => {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const extractAttributes = (attrString: string): Record<string, string> => {
  const out: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = attributeRegex.exec(attrString))) {
    const key = (match[1] ?? '').toUpperCase();
    const raw = match[2] ?? match[3] ?? match[4];
    if (!raw) continue;
    out[key] = raw;
  }
  return out;
};

const unescapeHtml = (text: string): string =>
  text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

type DataUriResult = {
  buffer: Buffer;
  mime?: string;
};

const parseDataUri = (value: string): DataUriResult | null => {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith('data:')) {
    try {
      return { buffer: Buffer.from(trimmed, 'base64') };
    } catch {
      return null;
    }
  }
  const comma = trimmed.indexOf(',');
  if (comma === -1) return null;
  const meta = trimmed.slice(0, comma);
  if (!/base64/i.test(meta)) return null;
  const payload = trimmed.slice(comma + 1);
  try {
    const buffer = Buffer.from(payload, 'base64');
    const mimeMatch = meta.match(/^data:([^;]+)(?:;|$)/i);
    const mimeType = mimeMatch && mimeMatch[1];
    return { buffer, mime: mimeType ? mimeType.toLowerCase() : undefined };
  } catch {
    return null;
  }
};

type ParserState = {
  entries: ParsedEntry[];
  stack: ParsedEntry[][];
  pendingFolder: ParsedFolder | null;
  currentTag: 'H3' | 'A' | 'DD' | null;
  currentEntity: ParsedEntry | null;
  lastBookmark: ParsedBookmark | null;
  depth: number;
  count: number;
};

const MAX_ITEMS_LIMIT = MAX_ITEMS;

export const detectHtmlBookmarkFile = (content: string): boolean => {
  const trimmed = content.trimStart();
  return trimmed.toUpperCase().startsWith('<!DOCTYPE NETSCAPE-BOOKMARK-FILE-1>');
};

export const parseNetscapeHtml = (content: string): { entries: ParsedEntry[]; folders: number; bookmarks: number } => {
  const state: ParserState = {
    entries: [],
    stack: [[]],
    pendingFolder: null,
    currentTag: null,
    currentEntity: null,
    lastBookmark: null,
    depth: 0,
    count: 0
  };

  const pushChildren = (list: ParsedEntry[]) => {
    state.stack.push(list);
  };

  const popChildren = () => {
    if (state.stack.length > 1) {
      state.stack.pop();
    }
  };

  const currentChildren = (): ParsedEntry[] =>
    state.stack[state.stack.length - 1] ?? state.stack[0] ?? [];

  const appendEntry = (entry: ParsedEntry) => {
    state.count += 1;
    if (state.count > MAX_ITEMS_LIMIT) {
      throw new Error('Too many bookmarks');
    }
    currentChildren().push(entry);
  };

  const regex = /<\s*(\/)?([A-Za-z0-9]+)([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content))) {
    if (match[4]) {
      const text = match[4];
      if (!state.currentEntity) continue;
      const trimmed = text.replace(/\s+/g, ' '); // keep spaces
      if (!trimmed || !trimmed.trim()) continue;
      if (state.currentTag === 'H3' && state.currentEntity.type === 'folder') {
        state.currentEntity.title += trimmed;
      }
      if (state.currentTag === 'A' && state.currentEntity.type === 'bookmark') {
        state.currentEntity.title += trimmed;
      }
      continue;
    }

    const closing = !!match[1];
    const tag = match[2]?.toUpperCase();
    const attrs = match[3] ?? '';
    if (!tag) continue;

    if (!closing) {
      if (tag === 'H3') {
        const attrMap = extractAttributes(attrs);
        const folder: ParsedFolder = {
          type: 'folder',
          title: '',
          addDate: (normalizeNumber(attrMap.ADD_DATE) ?? Date.now()) * 1000,
          lastModified: attrMap.LAST_MODIFIED ? normalizeNumber(attrMap.LAST_MODIFIED) : undefined,
          children: []
        };
        appendEntry(folder);
        state.pendingFolder = folder;
        state.currentTag = 'H3';
        state.currentEntity = folder;
      } else if (tag === 'DL') {
        state.depth += 1;
        if (state.depth > MAX_NESTING) {
          throw new Error('Folder depth exceeds limit');
        }
        const targetChildren = state.pendingFolder?.children ?? currentChildren();
        pushChildren(targetChildren);
        if (state.pendingFolder) {
          // next DL corresponds to pending folder
          state.pendingFolder = null;
        }
        state.currentTag = null;
        state.currentEntity = null;
      } else if (tag === 'A') {
        const attrMap = extractAttributes(attrs);
        const href = attrMap.HREF;
        if (!href) {
          state.currentEntity = null;
          continue;
        }
        const bookmark: ParsedBookmark = {
          type: 'bookmark',
          title: '',
          url: href,
          addDate: (normalizeNumber(attrMap.ADD_DATE) ?? Date.now()) * 1000,
          lastModified: attrMap.LAST_MODIFIED ? normalizeNumber(attrMap.LAST_MODIFIED) : undefined,
          tags: attrMap.TAGS ? attrMap.TAGS.split(',').map((t) => t.trim()).filter(Boolean) : undefined
        };
        if (attrMap.ICON) {
          const data = parseDataUri(attrMap.ICON);
          if (data && data.buffer.length <= MAX_ICON_BYTES) {
            bookmark.iconData = data.buffer;
            bookmark.iconMime = data.mime;
          }
        }
        appendEntry(bookmark);
        state.lastBookmark = bookmark;
        state.currentEntity = bookmark;
        state.currentTag = 'A';
      } else if (tag === 'DD') {
        state.currentTag = 'DD';
      }
    } else {
      if (tag === 'H3') {
        state.currentTag = null;
        state.currentEntity = null;
      } else if (tag === 'A') {
        state.currentTag = null;
        state.currentEntity = null;
      } else if (tag === 'DL') {
        popChildren();
        state.depth = Math.max(0, state.depth - 1);
      }
    }
  }

  const ids = { folders: 0, bookmarks: 0 };
  const countEntries = (arr: ParsedEntry[]) => {
    for (const entry of arr) {
      if (entry.type === 'folder') {
        ids.folders += 1;
        countEntries(entry.children);
      } else {
        ids.bookmarks += 1;
      }
    }
  };
  countEntries(state.entries);

  return { entries: state.entries, folders: ids.folders, bookmarks: ids.bookmarks };
};

const escapeAttr = (value: string): string => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const header = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<!-- This is an automatically generated file. -->\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>`;

const formatTimestamp = (value: number | undefined): string => (value ? Math.floor(value / 1000).toString() : '');

const writeEntries = (entries: ParsedEntry[], depth = 0): string => {
  const indent = '  '.repeat(depth);
  let out = `${indent}<DL><p>\n`;
  for (const entry of entries) {
    if (entry.type === 'folder') {
      const add = formatTimestamp(entry.addDate);
      const mod = formatTimestamp(entry.lastModified);
      const attrParts = [];
      if (add) attrParts.push(`ADD_DATE="${add}"`);
      if (mod) attrParts.push(`LAST_MODIFIED="${mod}"`);
      const attrs = attrParts.length ? ' ' + attrParts.join(' ') : '';
      out += `${indent}  <DT><H3${attrs}>${escapeText(entry.title)}</H3>\n`;
      out += writeEntries(entry.children, depth + 1);
    } else {
      const add = formatTimestamp(entry.addDate);
      const mod = formatTimestamp(entry.lastModified);
      const attrs: string[] = [`HREF="${escapeAttr(entry.url)}"`];
      if (add) attrs.push(`ADD_DATE="${add}"`);
      if (mod) attrs.push(`LAST_MODIFIED="${mod}"`);
      if (entry.tags?.length) attrs.push(`TAGS="${escapeAttr(entry.tags.join(','))}"`);
      out += `${indent}  <DT><A ${attrs.join(' ')}>${escapeText(entry.title)}</A>\n`;
    }
  }
  out += `${indent}</DL><p>\n`;
  return out;
};

export const buildHtmlExport = (entries: ParsedEntry[], prefixTitle: string): string => {
  const now = Date.now();
  const headerFolder: ParsedFolder = {
    type: 'folder',
    title: prefixTitle,
    addDate: now,
    lastModified: now,
    children: entries
  };
  return `${header}\n${writeEntries([headerFolder], 0)}`;
};
