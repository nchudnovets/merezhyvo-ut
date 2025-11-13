import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { BookmarksTree, BookmarkNode } from '../../types/models';
import type { ServicePageProps } from '../services/types';

const ROOT_KEYS = ['toolbar', 'mobile', 'other'] as const;
type RootKey = (typeof ROOT_KEYS)[number];

const ROOT_LABELS: Record<RootKey, string> = {
  toolbar: 'Toolbar',
  mobile: 'Mobile',
  other: 'Other'
};

const pageStyles = {
  container: {
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '18px',
    height: '100%',
    overflow: 'hidden',
    overflowX: 'hidden'
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  heroTitle: {
    fontSize: '24px',
    margin: 0
  },
  badgeGroup: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap' as const
  },
  badge: {
    padding: '6px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    background: 'rgba(59, 130, 246, 0.18)',
    color: '#f8fafc',
    cursor: 'pointer'
  },
  badgeActive: {
    borderColor: 'rgba(59, 130, 246, 0.85)',
    background: 'rgba(37, 99, 235, 0.35)'
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px'
  },
  label: {
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: '#94a3b8'
  },
  form: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '10px'
  },
  input: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    background: 'rgba(15, 23, 42, 0.85)',
    color: '#f8fafc',
    flex: 1,
    minWidth: '180px'
  },
  button: {
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid rgba(37, 99, 235, 0.8)',
    background: 'rgba(37, 99, 235, 0.25)',
    color: '#f8fafc',
    fontWeight: 600,
    cursor: 'pointer'
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    paddingRight: '12px',
    boxSizing: 'border-box',
    scrollbarWidth: 'thin',
    scrollbarColor: '#2563eb #111827'
  },
  nodeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.8)'
  },
  nodeMain: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px'
  },
  nodeActions: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center'
  },
  smallButton: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid rgba(148, 163, 184, 0.4)',
    background: 'rgba(224, 231, 255, 0.08)',
    color: '#f8fafc',
    cursor: 'pointer'
  },
  select: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid rgba(148, 163, 184, 0.4)',
    background: 'rgba(15, 23, 42, 0.95)',
    color: '#f8fafc'
  },
  feedback: {
    fontSize: '12px',
    color: '#34d399'
  },
  searchInput: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    background: 'rgba(15, 23, 42, 0.85)',
    color: '#f8fafc',
    width: 'min(640px, 100%)',
    boxSizing: 'border-box'
  },
  placeholder: {
    color: '#94a3b8'
  }
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

const BookmarksPage: React.FC<ServicePageProps> = ({ openInNewTab }) => {
  const [tree, setTree] = useState<BookmarksTree | null>(null);
  const [activeRoot, setActiveRoot] = useState<RootKey>('toolbar');
  const [search, setSearch] = useState('');
  const [bookmarkForm, setBookmarkForm] = useState({ title: '', url: '', tags: '' });
  const [folderTitle, setFolderTitle] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toMessage = (value: unknown): string =>
    value instanceof Error ? value.message : String(value);

  const refreshTree = useCallback(async () => {
    const api = typeof window !== 'undefined' ? window.merezhyvo?.bookmarks : undefined;
    if (!api) return;
    try {
      const data = await api.list();
      setTree(data);
    } catch {
      // ignore
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
      <div style={pageStyles.container}>
        <p>Loading bookmarks...</p>
      </div>
    );
  }

  return (
    <div style={pageStyles.container}>
      <div style={pageStyles.hero}>
        <h1 style={pageStyles.heroTitle}>Bookmarks</h1>
        <div style={pageStyles.badgeGroup}>
          {ROOT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              style={{
                ...pageStyles.badge,
                ...(activeRoot === key ? pageStyles.badgeActive : null)
              }}
              onClick={() => setActiveRoot(key)}
            >
              {ROOT_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div style={pageStyles.section}>
        <div style={pageStyles.label}>Search</div>
        <input
          style={pageStyles.searchInput}
          placeholder="Search title, URL, or tags"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div style={pageStyles.section}>
        <div style={pageStyles.label}>Add Bookmark</div>
        <div style={pageStyles.form}>
          <input
            placeholder="Title"
            style={pageStyles.input}
            value={bookmarkForm.title}
            onChange={(event) => setBookmarkForm((prev) => ({ ...prev, title: event.target.value }))}
          />
          <input
            placeholder="URL"
            style={pageStyles.input}
            value={bookmarkForm.url}
            onChange={(event) => setBookmarkForm((prev) => ({ ...prev, url: event.target.value }))}
          />
          <input
            placeholder="Tags (comma separated)"
            style={pageStyles.input}
            value={bookmarkForm.tags}
            onChange={(event) => setBookmarkForm((prev) => ({ ...prev, tags: event.target.value }))}
          />
          <button style={pageStyles.button} type="button" onClick={handleAddBookmark} disabled={busy}>
            Save Bookmark
          </button>
        </div>
        <div style={pageStyles.label}>Add Folder</div>
        <div style={pageStyles.form}>
          <input
            placeholder="Folder name"
            style={pageStyles.input}
            value={folderTitle}
            onChange={(event) => setFolderTitle(event.target.value)}
          />
          <button style={pageStyles.button} type="button" onClick={handleAddFolder} disabled={busy}>
            Create Folder
          </button>
        </div>
        {feedback && <div style={pageStyles.feedback}>{feedback}</div>}
      </div>

      <div style={pageStyles.section}>
        <div style={pageStyles.label}>{search.trim() ? 'Search Results' : `${ROOT_LABELS[activeRoot]} Content`}</div>
        <div style={pageStyles.list} className="service-scroll">
          {(search.trim() ? searchResults : nodesForActiveRoot).map((entry) => {
            const node = entry.node;
            const depth = search.trim() ? 0 : entry.depth;
            const rootKey = search.trim() ? entry.rootKey : resolveRootForNode(tree, node);
            return (
              <div key={node.id} style={pageStyles.nodeRow}>
                <div style={{ ...pageStyles.nodeMain, paddingLeft: `${depth * 12}px` }}>
                  <span>
                    <strong>{node.title}</strong> {node.type === 'folder' ? '📁' : '🔖'}
                  </span>
                  {node.url && <span style={{ fontSize: '12px', color: '#94a3b8' }}>{node.url}</span>}
                  {node.tags && node.tags.length > 0 && (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Tags: {node.tags.join(', ')}</span>
                  )}
                  {rootKey && <span style={{ fontSize: '11px', color: '#94a3b8' }}>{ROOT_LABELS[rootKey]}</span>}
                </div>
                <div style={pageStyles.nodeActions}>
                  {node.url && (
                    <button
                      type="button"
                      style={pageStyles.smallButton}
                      onClick={() => openInNewTab(node.url ?? '')}
                    >
                      Open
                    </button>
                  )}
                  <button type="button" style={pageStyles.smallButton} onClick={() => handleRename(node)}>
                    Rename
                  </button>
                  <button type="button" style={pageStyles.smallButton} onClick={() => handleDelete(node)}>
                    Delete
                  </button>
                  <select
                    style={pageStyles.select}
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
          {!search.trim() && nodesForActiveRoot.length === 0 && <span style={pageStyles.placeholder}>No entries yet in this section.</span>}
          {search.trim() && searchResults.length === 0 && <span style={pageStyles.placeholder}>No bookmarks match your search.</span>}
        </div>
      </div>
    </div>
  );
};

export default BookmarksPage;
