import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { BookmarksTree, BookmarkNode } from '../../types/models';
import type { ServicePageProps } from '../services/types';
import { bookmarksStyles } from './bookmarksStyles';
import { bookmarksModeStyles } from './bookmarksModeStyles';

const ROOT_KEYS = ['toolbar', 'mobile', 'other'] as const;
type RootKey = (typeof ROOT_KEYS)[number];

const ROOT_LABELS: Record<RootKey, string> = {
  toolbar: 'Toolbar',
  mobile: 'Mobile',
  other: 'Other'
};

const flattenChildren = (tree: BookmarksTree, parentId: string) => {
  const parent = tree.nodes[parentId];
  if (!parent || !Array.isArray(parent.children)) return [] as Array<{ node: BookmarkNode; depth: number }>;
  const queue = parent.children.map((id) => ({ id, depth: 0 }));
  const result: Array<{ node: BookmarkNode; depth: number }> = [];
  while (queue.length) {
    const { id, depth } = queue.shift()!;
    const node = tree.nodes[id];
    if (!node) continue;
    result.push({ node, depth });
    if (node.type === 'folder' && Array.isArray(node.children) && node.children.length) {
      queue.unshift(...node.children.map((childId) => ({ id: childId, depth: depth + 1 })));
    }
  }
  return result;
};

const resolveRootForNode = (tree: BookmarksTree, node: BookmarkNode): RootKey | null => {
  let parentId = node.parentId;
  while (parentId) {
    const rootKey = ROOT_KEYS.find((key) => tree.roots[key] === parentId);
    if (rootKey) return rootKey;
    const parent = tree.nodes[parentId];
    parentId = parent?.parentId ?? null;
  }
  return null;
};

const BookmarksPage: React.FC<ServicePageProps> = ({ mode, openInNewTab }) => {
  const [tree, setTree] = useState<BookmarksTree | null>(null);
  const [activeRoot, setActiveRoot] = useState<RootKey>('toolbar');
  const [search, setSearch] = useState('');
  const [bookmarkForm, setBookmarkForm] = useState({ title: '', url: '', tags: '' });
  const [folderTitle, setFolderTitle] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const styles = bookmarksStyles;
  const modeStyles = bookmarksModeStyles[mode] || {};

  const toMessage = (value: unknown): string =>
    value instanceof Error ? value.message : String(value);

  const refreshTree = useCallback(async () => {
    const api = typeof window !== 'undefined' ? window.merezhyvo?.bookmarks : undefined;
    if (!api) return;
    try {
      const data = await api.list();
      setTree(data);
    } catch (err) {
      setFeedback(toMessage(err));
    }
  }, []);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    if (!tree) return;
    if (!Object.keys(tree.roots).includes(activeRoot)) {
      setActiveRoot('toolbar');
    }
  }, [tree, activeRoot]);

  const activeRootId = tree?.roots[activeRoot];

  const nodesForActiveRoot = useMemo(() => {
    if (!tree || !activeRootId) return [] as Array<{ node: BookmarkNode; depth: number }>;
    return flattenChildren(tree, activeRootId);
  }, [tree, activeRootId]);

  const searchResults = useMemo(() => {
    if (!tree || !search.trim()) return [] as Array<{ node: BookmarkNode; rootKey: RootKey | null }>;
    const needle = search.trim().toLowerCase();
    return Object.values(tree.nodes)
      .filter((node) => {
        const tags = node.tags?.join(' ') ?? '';
        const haystack = `${node.title} ${node.url ?? ''} ${tags}`.toLowerCase();
        return haystack.includes(needle);
      })
      .map((node) => ({ node, rootKey: resolveRootForNode(tree, node) }));
  }, [tree, search]);

  const displayEntries = useMemo(() => {
    if (search.trim()) {
      return searchResults.map((entry) => ({ node: entry.node, depth: 0, rootKey: entry.rootKey }));
    }
    return nodesForActiveRoot.map((entry) => ({ node: entry.node, depth: entry.depth, rootKey: resolveRootForNode(tree!, entry.node) }));
  }, [searchResults, nodesForActiveRoot, search, tree]);

  const handleAddBookmark = useCallback(async () => {
    if (busy) return;
    if (!bookmarkForm.url.trim()) {
      setFeedback('URL is required');
      return;
    }
    const api = typeof window !== 'undefined' ? window.merezhyvo?.bookmarks : undefined;
    if (!api) {
      setFeedback('Bookmarks service unavailable');
      return;
    }
    setBusy(true);
    try {
      const tags = bookmarkForm.tags
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      await api.add({
        type: 'bookmark',
        title: bookmarkForm.title,
        url: bookmarkForm.url,
        parentId: activeRootId,
        tags: tags.length ? tags : undefined
      });
      setBookmarkForm({ title: '', url: '', tags: '' });
      setFeedback('Bookmark created');
      await refreshTree();
    } catch (err) {
      setFeedback(toMessage(err));
    } finally {
      setBusy(false);
    }
  }, [activeRootId, bookmarkForm, busy, refreshTree]);

  const handleAddFolder = useCallback(async () => {
    if (busy) return;
    if (!folderTitle.trim()) {
      setFeedback('Folder name is required');
      return;
    }
    const api = typeof window !== 'undefined' ? window.merezhyvo?.bookmarks : undefined;
    if (!api) {
      setFeedback('Bookmarks service unavailable');
      return;
    }
    setBusy(true);
    try {
      await api.add({
        type: 'folder',
        title: folderTitle,
        parentId: activeRootId
      });
      setFolderTitle('');
      setFeedback('Folder created');
      await refreshTree();
    } catch (err) {
      setFeedback(toMessage(err));
    } finally {
      setBusy(false);
    }
  }, [activeRootId, folderTitle, busy, refreshTree]);

  const handleRename = useCallback(
    async (node: BookmarkNode) => {
      if (!node) return;
      const api = typeof window !== 'undefined' ? window.merezhyvo?.bookmarks : undefined;
      if (!api) return;
      const next = window.prompt('Enter new name', node.title);
      if (!next || !next.trim()) return;
      await api.update({ id: node.id, title: next.trim() });
      setFeedback('Bookmark renamed');
      await refreshTree();
    },
    [refreshTree]
  );

  const handleDelete = useCallback(
    async (node: BookmarkNode) => {
      const api = typeof window !== 'undefined' ? window.merezhyvo?.bookmarks : undefined;
      if (!api) return;
      if (!window.confirm('Remove this item?')) return;
      const result = await api.remove(node.id);
      if (result.ok) {
        setFeedback('Item removed');
        await refreshTree();
      }
    },
    [refreshTree]
  );

  const handleMove = useCallback(
    async (node: BookmarkNode, targetRoot: RootKey) => {
      const api = typeof window !== 'undefined' ? window.merezhyvo?.bookmarks : undefined;
      if (!api || !tree) return;
      const targetId = tree.roots[targetRoot];
      if (!targetId) return;
      await api.move({ id: node.id, newParentId: targetId });
      setFeedback('Moved');
      await refreshTree();
    },
    [refreshTree, tree]
  );

  if (!tree) {
    return (
      <div style={styles.container}>
        <p>Loading bookmarks...</p>
      </div>
    );
  }

  const heroTitleStyle = {
    ...styles.heroTitle,
    ...(modeStyles.heroTitle ?? {})
  };
  const badgeStyle = {
    ...styles.badge,
    ...(modeStyles.badge ?? {})
  };
  const listStyle = {
    ...styles.list,
    ...(modeStyles.list ?? {})
  };
  const nodeRowStyle = (depth: number) => ({
    ...styles.nodeRow,
    ...(modeStyles.nodeRow ?? {}),
    paddingLeft: `${depth * 12}px`
  });
  const nodeActionsStyle = {
    ...styles.nodeActions,
    ...(modeStyles.nodeActions ?? {})
  };
  const nodeTitleStyle = {
    ...styles.nodeTitle,
    ...(modeStyles.nodeTitle ?? {})
  };
  const nodeUrlStyle = styles.nodeUrl;
  const smallButtonStyle = {
    ...styles.smallButton,
    ...(modeStyles.smallButton ?? {})
  };
  const searchInputStyle = {
    ...styles.searchInput,
    ...(modeStyles.searchInput ?? {})
  };

  return (
    <div style={styles.container}>
      <div style={styles.hero}>
        <h1 style={heroTitleStyle}>Bookmarks</h1>
        <div style={styles.badgeGroup}>
          {ROOT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              style={{
                ...badgeStyle,
                ...(activeRoot === key ? styles.badgeActive : null)
              }}
              onClick={() => setActiveRoot(key)}
            >
              {ROOT_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.label}>Search</div>
        <input
          style={searchInputStyle}
          placeholder="Search title, URL, or tags"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div style={styles.section}>
        <div style={styles.label}>Add Bookmark</div>
        <div style={styles.form}>
          <input
            placeholder="Title"
            style={styles.input}
            value={bookmarkForm.title}
            onChange={(event) => setBookmarkForm((prev) => ({ ...prev, title: event.target.value }))}
          />
          <input
            placeholder="URL"
            style={styles.input}
            value={bookmarkForm.url}
            onChange={(event) => setBookmarkForm((prev) => ({ ...prev, url: event.target.value }))}
          />
          <input
            placeholder="Tags (comma separated)"
            style={styles.input}
            value={bookmarkForm.tags}
            onChange={(event) => setBookmarkForm((prev) => ({ ...prev, tags: event.target.value }))}
          />
          <button style={styles.button} type="button" onClick={handleAddBookmark} disabled={busy}>
            Save Bookmark
          </button>
        </div>
        <div style={styles.label}>Add Folder</div>
        <div style={styles.form}>
          <input
            placeholder="Folder name"
            style={styles.input}
            value={folderTitle}
            onChange={(event) => setFolderTitle(event.target.value)}
          />
          <button style={styles.button} type="button" onClick={handleAddFolder} disabled={busy}>
            Create Folder
          </button>
        </div>
        {feedback && <div style={styles.feedback}>{feedback}</div>}
      </div>

      <div style={styles.section}>
        <div style={styles.label}>{search.trim() ? 'Search Results' : `${ROOT_LABELS[activeRoot]} Content`}</div>
        <div style={listStyle} className="service-scroll">
          {displayEntries.map((entry) => {
            const node = entry.node;
            const depth = entry.depth;
            const rootKey = entry.rootKey;
            return (
              <div key={node.id} style={nodeRowStyle(depth)}>
                <div style={styles.nodeMain}>
                  <span style={nodeTitleStyle}>
                    <strong>{node.title}</strong> {node.type === 'folder' ? '📁' : '🔖'}
                  </span>
                  {node.url && <span style={nodeUrlStyle}>{node.url}</span>}
                  {node.tags && node.tags.length > 0 && (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Tags: {node.tags.join(', ')}</span>
                  )}
                  {rootKey && <span style={{ fontSize: '11px', color: '#94a3b8' }}>{ROOT_LABELS[rootKey]}</span>}
                </div>
                <div style={nodeActionsStyle}>
                  {node.url && (
                    <button
                      type="button"
                      style={smallButtonStyle}
                      onClick={() => openInNewTab(node.url ?? '')}
                    >
                      Open
                    </button>
                  )}
                  <button type="button" style={smallButtonStyle} onClick={() => handleRename(node)}>
                    Rename
                  </button>
                  <button type="button" style={smallButtonStyle} onClick={() => handleDelete(node)}>
                    Delete
                  </button>
                  <select
                    style={styles.select}
                    value={rootKey ?? activeRoot}
                    onChange={(event) => {
                      const targetKey = event.target.value as RootKey;
                      if (targetKey === rootKey) return;
                      void handleMove(node, targetKey);
                    }}
                  >
                    {ROOT_KEYS.map((key) => (
                      <option key={key} value={key}>
                        Move to {ROOT_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
          {!search.trim() && nodesForActiveRoot.length === 0 && (
            <span style={styles.placeholder}>No entries yet in this section.</span>
          )}
          {search.trim() && searchResults.length === 0 && (
            <span style={styles.placeholder}>No bookmarks match your search.</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookmarksPage;
