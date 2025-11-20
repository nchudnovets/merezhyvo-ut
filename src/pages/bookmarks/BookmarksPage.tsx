import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BookmarksTree, BookmarkNode, Mode } from '../../types/models';
import type { ServicePageProps } from '../services/types';
import { bookmarksStyles } from './bookmarksStyles';
import { bookmarksModeStyles } from './bookmarksModeStyles';
import { requestFileDialog } from '../../services/fileDialog/fileDialogService';

const ROOT_LABEL = 'MyBookmarks';
const SEARCH_DEBOUNCE_MS = 250;
const zoomToolbarHeights: Record<Mode, number> = {
  desktop: 72,
  mobile: 96
};

const isFolder = (node: BookmarkNode): node is BookmarkNode & { type: 'folder' } => node.type === 'folder';

const flattenSearch = (tree: BookmarksTree | null, needle: string, startId?: string): BookmarkNode[] => {
  if (!tree) return [];
  const lower = needle.toLowerCase();
  const result: BookmarkNode[] = [];
  const visit = (nodeId: string) => {
    const node = tree.nodes[nodeId];
    if (!node) return;
    const haystack = `${node.title} ${node.url ?? ''} ${(node.tags ?? []).join(' ')}`.toLowerCase();
    if (haystack.includes(lower)) {
      result.push(node);
    }
    if (isFolder(node) && node.children) {
      node.children.forEach(visit);
    }
  };
  const entryPoint = startId && tree.nodes[startId] ? startId : tree.roots.toolbar;
  visit(entryPoint);
  return result;
};

type DialogState =
  | { type: 'bookmark'; mode: 'add' | 'edit'; node?: BookmarkNode }
  | { type: 'folder'; mode: 'create' | 'rename'; node?: BookmarkNode };

type ConfirmState = {
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
};

type FolderPickerState = {
  title: string;
  selectedId: string;
  onChoose: (id: string) => void;
};

type ContextMenuState = {
  x: number;
  y: number;
  node: BookmarkNode;
};

type BookmarkFormState = {
  title: string;
  url: string;
  tags: string;
  folderId: string;
};

type ExportDialogState = {
  scope: 'current' | 'all';
  loading?: boolean;
};

type ImportDialogState = {
  mode: 'add' | 'replace';
  filePath?: string;
  preview?: { bookmarks: number; folders: number };
  error?: string;
  loading: boolean;
};

const parseTags = (value: string): string[] | undefined => {
  const raw = value
    .split(/[\s,]+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
  return raw.length > 0 ? Array.from(new Set(raw)) : undefined;
};

const formatHostname = (value?: string): string => {
  if (!value) return '';
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
};

const cloneForExport = (node: BookmarkNode): BookmarkNode => ({
  ...node,
  tags: node.tags ? [...node.tags] : undefined,
  children: node.children ? [...node.children] : undefined
});


const BookmarksPage: React.FC<ServicePageProps> = ({ mode, openInTab }) => {
  const styles = bookmarksStyles;
  const modeStyles = bookmarksModeStyles[mode] || {};
  const [tree, setTree] = useState<BookmarksTree | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [folderPicker, setFolderPicker] = useState<FolderPickerState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [bookmarkForm, setBookmarkForm] = useState<BookmarkFormState>({
    title: '',
    url: '',
    tags: '',
    folderId: ''
  });
  const [folderForm, setFolderForm] = useState({ title: '' });
  const [exportDialog, setExportDialog] = useState<ExportDialogState | null>(null);
  const [importDialog, setImportDialog] = useState<ImportDialogState | null>(null);
  const searchTimer = useRef<number | null>(null);
  const importContentRef = useRef<string | null>(null);

  const getBookmarksApi = useCallback(() => {
    if (typeof window === 'undefined') return undefined;
    return window.merezhyvo?.bookmarks;
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast(null);
    }, 2200);
  }, []);

  const notifyBookmarksChanged = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('merezhyvo:bookmarks:changed'));
  }, []);

  const refreshTree = useCallback(async () => {
    const api = getBookmarksApi();
    if (!api) return;
    try {
      const data = await api.list();
      setTree(data);
      setErrorBanner(null);
    } catch {
      setErrorBanner('Couldn\'t save changes. Retry');
    }
  }, [getBookmarksApi]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void refreshTree();
    });
  }, [refreshTree]);

  useEffect(() => {
    if (!tree) return;
    void Promise.resolve().then(() => {
      setActiveNodeId((prev) => {
        if (prev && tree.nodes[prev] && tree.nodes[prev].type === 'folder') {
          return prev;
        }
        return tree.roots.toolbar;
      });
    });
  }, [tree]);

  useEffect(() => {
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
    }
    searchTimer.current = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
      }
    };
  }, [search]);

  const currentNode = useMemo(() => {
    if (!tree) return null;
    const targetId = activeNodeId ?? tree.roots.toolbar;
    const node = tree.nodes[targetId] ?? tree.nodes[tree.roots.toolbar];
    return node?.type === 'folder' ? node : null;
  }, [tree, activeNodeId]);

  const rootId = tree?.roots.toolbar ?? '';

  const breadcrumbs = useMemo(() => {
    if (!tree) return [];
    const path: Array<{ id: string; label: string }> = [];
    let node = currentNode;
    if (!node) {
      if (tree.nodes[rootId]) {
        path.push({ id: rootId, label: ROOT_LABEL });
      }
      return path;
    }
    while (node) {
      if (node.id === rootId) {
        path.push({ id: node.id, label: ROOT_LABEL });
        break;
      }
      path.push({ id: node.id, label: node.title });
      node = node.parentId ? tree.nodes[node.parentId] ?? null : null;
    }
    return path.reverse();
  }, [tree, currentNode, rootId]);

  const tagFilterLower = tagFilter?.trim().toLowerCase() ?? '';
  const matchesTagFilter = useCallback(
    (node: BookmarkNode) => {
      if (!tagFilterLower) return true;
      const tags = node.tags ?? [];
      return tags.some((tag) => tag.toLowerCase().includes(tagFilterLower));
    },
    [tagFilterLower]
  );

  const folderList = useMemo(() => {
    if (!tree || !rootId) return [];
    const result: Array<{ id: string; label: string; depth: number }> = [];
    const traverse = (nodeId: string, depth: number, parentLabel: string) => {
      const node = tree.nodes[nodeId];
      if (!node || node.type !== 'folder') return;
      const label = depth === 0 ? ROOT_LABEL : `${parentLabel} / ${node.title}`;
      result.push({ id: nodeId, label, depth });
      const nextLabel = depth === 0 ? ROOT_LABEL : label;
      (node.children ?? []).forEach((childId) => traverse(childId, depth + 1, nextLabel));
    };
    traverse(rootId, 0, ROOT_LABEL);
    return result;
  }, [tree, rootId]);

  const folderLabels = useMemo(() => {
    return Object.fromEntries(folderList.map((item) => [item.id, item.label]));
  }, [folderList]);

  const folders = useMemo(() => {
    if (!currentNode) return [];
    const children = currentNode.children ?? [];
    return children
      .map((id) => tree?.nodes[id])
      .filter((node): node is BookmarkNode & { type: 'folder' } => !!node && node.type === 'folder')
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [currentNode, tree]);

  const bookmarks = useMemo(() => {
    if (!currentNode) return [];
    const children = currentNode.children ?? [];
    return children
      .map((id) => tree?.nodes[id])
      .filter((node): node is BookmarkNode => !!node && node.type === 'bookmark')
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [currentNode, tree]);

  const searchResults = useMemo(() => {
    if (!tree) return [];
    const startId = currentNode?.id ?? tree.roots.toolbar;
    return flattenSearch(tree, debouncedSearch, startId);
  }, [tree, debouncedSearch, currentNode?.id]);

  const displayItems = useMemo(() => {
    if (debouncedSearch || tagFilterLower) {
      return searchResults.filter((node) => matchesTagFilter(node));
    }
    return [...folders, ...bookmarks];
  }, [folders, bookmarks, debouncedSearch, searchResults, tagFilterLower, matchesTagFilter]);

  const clearSearch = () => {
    setSearch('');
    setDebouncedSearch('');
  };

  const toggleSelectionMode = (value?: boolean) => {
    if (typeof value === 'boolean') {
      setSelectionMode(value);
      if (!value) {
        setSelectedIds(new Set());
      }
      return;
    }
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
      }
      return !prev;
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const applyTagFilter = (tag: string) => {
    setTagFilter(tag);
  };

  const clearTagFilter = () => {
    setTagFilter(null);
  };

  const openExportDialog = (scope: ExportDialogState['scope']) => {
    closeMenus();
    setExportDialog({ scope, loading: false });
  };

  const closeExportDialog = () => {
    setExportDialog(null);
  };

  const openImportDialog = () => {
    closeMenus();
    importContentRef.current = null;
    setImportDialog({ mode: 'add', loading: false });
  };

  const closeImportDialog = () => {
    importContentRef.current = null;
    setImportDialog(null);
  };

  const updateExportScope = (scope: ExportDialogState['scope']) => {
    setExportDialog((prev) =>
      prev ? { ...prev, scope, loading: prev.loading ?? false } : { scope, loading: false }
    );
  };

  const chooseImportFile = useCallback(async () => {
    const api = getBookmarksApi();
    if (!api?.importHtml) {
      setImportDialog((prev) =>
        prev
          ? { ...prev, error: 'Bookmarks API unavailable', loading: false }
          : prev
      );
      return;
    }
    setImportDialog((prev) =>
      prev ? { ...prev, loading: true, error: undefined } : prev
    );
    try {
      const dialogResult = await requestFileDialog({
        kind: 'file',
        allowMultiple: false,
        filters: ['html'],
        title: 'Import bookmarks (HTML)'
      });
      const chosenPath = dialogResult?.paths?.[0];
      if (!chosenPath) {
        setImportDialog((prev) => (prev ? { ...prev, loading: false } : prev));
        return;
      }
      const fileContent = await window.merezhyvo?.fileDialog?.readFile?.({ path: chosenPath });
      if (typeof fileContent !== 'string') {
        throw new Error('Unable to read file');
      }
      importContentRef.current = fileContent;
      const preview = await api.importHtml.preview({
        content: fileContent,
        scope: importDialog?.mode ?? 'add',
        targetFolderId: currentNode?.id ?? rootId
      });
      setImportDialog((prev) =>
        prev
          ? {
              ...prev,
              filePath: chosenPath,
              preview,
              error: undefined,
              loading: false
            }
          : null
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Couldn\'t import this file';
      importContentRef.current = null;
      setImportDialog((prev) =>
        prev
          ? {
              ...prev,
              filePath: undefined,
              preview: undefined,
              error: message,
              loading: false
            }
          : prev
      );
      setErrorBanner(message);
    }
  }, [currentNode?.id, importDialog?.mode, rootId, getBookmarksApi]);

  const handleImportDialogConfirm = async () => {
    if (!importDialog) return;
    const content = importContentRef.current;
    if (!content) {
      setImportDialog((prev) =>
        prev
          ? { ...prev, error: 'Select a valid bookmarks file before importing' }
          : prev
      );
      return;
    }
    if (!tree) {
      setImportDialog((prev) =>
        prev ? { ...prev, error: 'Bookmarks are still loading' } : prev
      );
      return;
    }
    const api = getBookmarksApi();
    if (!api?.importHtml) {
      setImportDialog((prev) =>
        prev ? { ...prev, error: 'Bookmarks API unavailable' } : prev
      );
      return;
    }
    const targetId = currentNode?.id ?? tree.roots.toolbar ?? rootId;
    setImportDialog((prev) =>
      prev ? { ...prev, loading: true, error: undefined } : prev
    );
    try {
      const result = await api.importHtml.apply({
        content,
        scope: importDialog.mode,
        targetFolderId: targetId
      });
      if ((result.foldersImported ?? 0) === 0 && (result.bookmarksImported ?? 0) === 0) {
        const message = 'No new bookmarks were imported';
        setImportDialog((prev) =>
          prev ? { ...prev, loading: false, error: message } : prev
        );
        setErrorBanner(message);
        return;
      }
      await refreshTree();
      setActiveNodeId(targetId);
      setSearch('');
      setTagFilter(null);
      showToast('Import completed');
      notifyBookmarksChanged();
      setImportDialog(null);
      importContentRef.current = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Couldn\'t import bookmarks';
      setImportDialog((prev) =>
        prev ? { ...prev, loading: false, error: message } : prev
      );
      setErrorBanner(message);
    }
  };

  const buildExportTree = (
    source: BookmarksTree,
    startId: string
  ): BookmarksTree => {
    const nodes: Record<string, BookmarkNode> = {};
    const visit = (nodeId: string) => {
      const node = source.nodes[nodeId];
      if (!node) return;
      nodes[nodeId] = cloneForExport(node);
      if (node.type === 'folder') {
        (node.children ?? []).forEach(visit);
      }
    };
    visit(startId);
    return {
      schema: source.schema,
      roots: {
        toolbar: startId,
        mobile: startId,
        other: startId
      },
      nodes
    };
  };

  const handleJsonExport = () => {
    if (!tree) return;
    const scope = exportDialog?.scope ?? 'all';
    const payload =
      scope === 'current' && currentNode
        ? buildExportTree(tree, currentNode.id)
        : tree;
    const label = currentNode ? folderItemLabel(currentNode.id) : 'bookmarks';
    const safeLabel = label.replace(/[^a-z0-9]+/gi, '_') || 'bookmarks';
    const fileName = `${scope === 'current' ? safeLabel : 'bookmarks'}.json`;
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Bookmarks exported');
    closeExportDialog();
  };

  const handleHtmlExportConfirm = async () => {
    if (!tree) return;
    const api = getBookmarksApi();
    if (!api?.exportHtml) {
      setErrorBanner('Bookmarks API unavailable');
      return;
    }
    setExportDialog((prev) => (prev ? { ...prev, loading: true } : prev));
    const scope = exportDialog?.scope ?? 'all';
    const targetFolderId =
      scope === 'current' ? currentNode?.id ?? tree.roots.toolbar ?? rootId : undefined;
    try {
      const result = await api.exportHtml({ scope, targetFolderId });
      const folderChoice = await requestFileDialog({
        kind: 'folder',
        title: 'Export bookmarks (HTML)',
        allowMultiple: false
      });
      const folderPath = folderChoice?.paths?.[0];
      if (!folderPath) {
        setExportDialog((prev) => (prev ? { ...prev, loading: false } : prev));
        return;
      }
      const savePath = `${folderPath.replace(/[/\\\\]+$/, '')}/${result.filenameSuggested}`;
      await window.merezhyvo?.fileDialog?.saveFile?.({
        path: savePath,
        data: result.htmlContent,
        encoding: 'utf8'
      });
      showToast(`Exported to ${result.filenameSuggested}`);
      setExportDialog(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Couldn\'t export bookmarks';
      setErrorBanner(message);
      setExportDialog((prev) => (prev ? { ...prev, loading: false } : prev));
    }
  };

  const openContextMenu = (node: BookmarkNode, event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenus();
    setContextMenu({ x: event.clientX, y: event.clientY, node });
  };

  const closeMenus = useCallback(() => {
    setShowAddMenu(false);
    setShowOverflowMenu(false);
  }, []);

  useEffect(() => {
    const handleGlobalPointerDown = (event: PointerEvent) => {
      const target = event?.target as HTMLElement | null;
      if (target?.closest('.bookmarks-context-menu')) {
        return;
      }
      if (!target?.closest('.bookmarks-action-menu')) {
        closeMenus();
      }
      setContextMenu(null);
    };
    window.addEventListener('pointerdown', handleGlobalPointerDown);
    return () => {
      window.removeEventListener('pointerdown', handleGlobalPointerDown);
    };
  }, [closeMenus]);

  const folderItemLabel = (nodeId: string | null) => {
    if (!nodeId) return ROOT_LABEL;
    return folderLabels[nodeId] ?? ROOT_LABEL;
  };

  const openFolder = (node: BookmarkNode & { type: 'folder' }) => {
    setActiveNodeId(node.id);
  };

  const openAddBookmarkDialog = () => {
    setBookmarkForm((prev) => ({
      title: '',
      url: '',
      tags: '',
      folderId: prev.folderId || currentNode?.id || rootId
    }));
    setDialogState({ type: 'bookmark', mode: 'add' });
    closeMenus();
  };

  const openNewFolderDialog = (parentId?: string) => {
    setFolderForm({ title: '' });
    setDialogState({ type: 'folder', mode: 'create', node: parentId ? tree?.nodes[parentId] : currentNode ?? tree?.nodes[rootId] });
    closeMenus();
  };

  const openEditBookmarkDialog = (node: BookmarkNode) => {
    setBookmarkForm({
      title: node.title,
      url: node.url ?? '',
      tags: (node.tags ?? []).join(' '),
      folderId: node.parentId ?? rootId
    });
    setDialogState({ type: 'bookmark', mode: 'edit', node });
  };

  const openRenameFolderDialog = (node: BookmarkNode) => {
    if (!isFolder(node)) return;
    setFolderForm({ title: node.title });
    setDialogState({ type: 'folder', mode: 'rename', node });
  };

  const openFolderPicker = (purpose: 'parent' | 'move', onChoose: (id: string) => void, initialId?: string) => {
    const fallback = initialId || currentNode?.id || rootId;
    if (!fallback) return;
    const title = purpose === 'move' ? 'Choose destination' : 'Choose folder';
    setFolderPicker({ title, selectedId: fallback, onChoose });
  };

  const handleFolderPickerChoose = () => {
    if (!folderPicker) return;
    folderPicker.onChoose(folderPicker.selectedId);
    setFolderPicker(null);
  };

  const handleBookmarkFormSave = async () => {
    const api = getBookmarksApi();
    if (!api || !dialogState) return;
    const payload = {
      title: bookmarkForm.title,
      url: bookmarkForm.url,
      tags: parseTags(bookmarkForm.tags),
      parentId: bookmarkForm.folderId || rootId
    };
    if (!payload.title.trim() || !payload.url?.trim()) {
      setErrorBanner('Title and URL are required.');
      return;
    }
    try {
      if (dialogState.type === 'bookmark' && dialogState.mode === 'add') {
        const result = await api.add({ ...payload, type: 'bookmark' });
        if (result.ok) {
          showToast('Bookmark added');
          notifyBookmarksChanged();
          setDialogState(null);
          await refreshTree();
        } else {
          setErrorBanner(result.error || 'Couldn\'t save changes. Retry');
        }
      } else if (dialogState.type === 'bookmark' && dialogState.mode === 'edit' && dialogState.node) {
        const result = await api.update({
          id: dialogState.node.id,
          title: payload.title,
          url: payload.url,
          tags: payload.tags
        });
        if (result.ok) {
          showToast('Bookmark added');
          notifyBookmarksChanged();
          setDialogState(null);
          await refreshTree();
        } else {
          setErrorBanner('Couldn\'t save changes. Retry');
        }
      }
    } catch {
      setErrorBanner('Couldn\'t save changes. Retry');
    }
  };

  const handleFolderFormSave = async () => {
    const api = getBookmarksApi();
    if (!api || !dialogState) return;
    if (!folderForm.title.trim()) {
      setErrorBanner('Name is required.');
      return;
    }
    try {
      if (dialogState.type === 'folder' && dialogState.mode === 'create') {
        const parentId = dialogState.node?.id ?? rootId;
        const result = await api.add({ type: 'folder', title: folderForm.title, parentId });
        if (result.ok) {
          showToast('Bookmark added');
          notifyBookmarksChanged();
          setDialogState(null);
          await refreshTree();
        } else {
          setErrorBanner(result.error || 'Couldn\'t save changes. Retry');
        }
      } else if (dialogState.type === 'folder' && dialogState.mode === 'rename' && dialogState.node) {
        const result = await api.update({ id: dialogState.node.id, title: folderForm.title });
        if (result.ok) {
          showToast('Bookmark added');
          notifyBookmarksChanged();
          setDialogState(null);
          await refreshTree();
        } else {
          setErrorBanner('Couldn\'t save changes. Retry');
        }
      }
    } catch {
      setErrorBanner('Couldn\'t save changes. Retry');
    }
  };

  const handleRemoveNode = (node: BookmarkNode) => {
    setConfirmState({
      message: node.type === 'folder' ? 'Delete folder?' : 'Remove bookmark?',
      confirmLabel: node.type === 'folder' ? 'Delete' : 'Remove',
      onConfirm: async () => {
        const api = getBookmarksApi();
        if (!api) return;
        const result = await api.remove(node.id);
        if (result.ok) {
          showToast(node.type === 'folder' ? 'Deleted 1 items' : 'Bookmark removed');
          notifyBookmarksChanged();
          setConfirmState(null);
          await refreshTree();
        } else {
          setErrorBanner('Couldn\'t save changes. Retry');
        }
      }
    });
  };

  const handleStarClick = (node: BookmarkNode, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (node.type !== 'bookmark') return;
    setConfirmState({
      message: 'Remove bookmark?',
      confirmLabel: 'Remove',
      onConfirm: async () => {
        const api = getBookmarksApi();
        if (!api) return;
        const result = await api.remove(node.id);
        if (result.ok) {
          showToast('Bookmark removed');
          notifyBookmarksChanged();
          setConfirmState(null);
          await refreshTree();
        } else {
          setErrorBanner('Couldn\'t save changes. Retry');
        }
      }
    });
  };

  const handleDeleteSelection = () => {
    if (!selectedIds.size) return;
    setConfirmState({
      message: `Delete ${selectedIds.size} items`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        const api = getBookmarksApi();
        if (!api) return;
        const ids = Array.from(selectedIds);
        await Promise.all(ids.map((id) => api.remove(id)));
        showToast(`Deleted ${ids.length} items`);
        notifyBookmarksChanged();
        setConfirmState(null);
        toggleSelectionMode(false);
        await refreshTree();
      }
    });
  };

  const handleMoveSelection = () => {
    if (!selectedIds.size) return;
    openFolderPicker('move', async (targetId) => {
      const api = getBookmarksApi();
      if (!api) return;
      const target = tree?.nodes[targetId];
      if (!target || target.type !== 'folder') return;
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => api.move({ id, newParentId: targetId })));
      showToast(`Moved to '${target.title}'`);
      notifyBookmarksChanged();
      toggleSelectionMode(false);
      await refreshTree();
    });
  };

  const handleExportSelection = async () => {
    const api = getBookmarksApi();
    if (!api) return;
    await api.export();
    showToast('Exported selected items');
  };

  const handleFolderMove = async (node: BookmarkNode, targetId: string) => {
    const api = getBookmarksApi();
    if (!api) return;
    const target = tree?.nodes[targetId];
    if (!target || target.type !== 'folder') return;
    await api.move({ id: node.id, newParentId: targetId });
    showToast(`Moved to '${target.title}'`);
    notifyBookmarksChanged();
    setContextMenu(null);
    await refreshTree();
  };

  const handleBookmarkMove = async (node: BookmarkNode, targetId: string) => {
    const api = getBookmarksApi();
    if (!api) return;
    const target = tree?.nodes[targetId];
    if (!target || target.type !== 'folder') return;
    await api.move({ id: node.id, newParentId: targetId });
    showToast(`Moved to '${target.title}'`);
    notifyBookmarksChanged();
    setContextMenu(null);
    await refreshTree();
  };

  const handleCopyUrl = async (url: string) => {
    if (!url) return;
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        showToast('Couldn\'t copy URL');
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast('Copied to clipboard');
    } catch {
      showToast('Couldn\'t copy URL');
    }
  };

  const handleFolderPickerSelect = (id: string) => {
    setFolderPicker((prev) => (prev ? { ...prev, selectedId: id } : null));
  };

  const contextMenuItems = contextMenu
    ? (() => {
        const node = contextMenu.node;
        if (node.type === 'folder') {
          const isRoot = node.id === rootId;
          return [
            { label: 'Rename…', action: () => openRenameFolderDialog(node), disabled: isRoot },
            { label: 'Move…', action: () => openFolderPicker('move', async (targetId) => { await handleFolderMove(node, targetId); }) },
            { label: 'Delete', action: () => handleRemoveNode(node), disabled: isRoot },
            { label: 'New subfolder…', action: () => openNewFolderDialog(node.id) },
            { label: 'Select', action: () => { toggleSelectionMode(true); setSelectedIds(new Set([node.id])); } }
          ];
        }
        return [
          { label: 'Open', action: () => openInTab(node.url ?? '') },
          { label: 'Edit…', action: () => openEditBookmarkDialog(node) },
          { label: 'Move…', action: () => openFolderPicker('move', async (targetId) => { await handleBookmarkMove(node, targetId); }) },
          { label: 'Copy URL', action: () => handleCopyUrl(node.url ?? '') },
          { label: 'Delete', action: () => handleRemoveNode(node) },
          { label: 'Select', action: () => { toggleSelectionMode(true); setSelectedIds(new Set([node.id])); } }
        ];
      })()
    : [];

  if (!tree || !currentNode) {
    return <div style={styles.container}>Loading bookmarks…</div>;
  }

  const addMenuStyle = { ...styles.menu, ...(modeStyles.menu ?? {}) };
  const listWrapperStyle = {
    ...styles.list,
    ...(modeStyles.list ?? {}),
    paddingBottom: selectionMode ? '140px' : '24px'
  };
  const zoomToolbarHeight = zoomToolbarHeights[mode];
  const selectionBarStyle = {
    ...styles.bottomBar,
    ...(modeStyles.bottomBar ?? {}),
    bottom: `calc(${zoomToolbarHeight}px + env(safe-area-inset-bottom, 0px))`
  };

  return (
    <div style={{ ...styles.container, ...(modeStyles.container ?? {}) }}>
      <header style={styles.hero}>
        <h1 style={{ ...styles.heroTitle, ...(modeStyles.heroTitle ?? {}) }}>Bookmarks</h1>
        <div style={styles.badgeGroup}>
          {selectionMode && (
            <span style={{...styles.feedback, ...modeStyles.feedback}}>{`${selectedIds.size} selected`}</span>
          )}
          {selectionMode && (
            <button type="button" style={{...styles.smallButton, ...modeStyles.smallButton}} onClick={() => toggleSelectionMode(false)}>
              Done
            </button>
          )}
          <div style={{...styles.actionGroup, ...modeStyles.actionGroup}}>
            <button
              type="button"
              style={{...styles.button, ...modeStyles.button}}
              onClick={() => {
                closeMenus();
                setShowAddMenu((prev) => !prev);
              }}
            >
              +
            </button>
            {showAddMenu && (
              <div
                style={addMenuStyle}
                className="bookmarks-action-menu"
                onClick={(event) => event.stopPropagation()}
              >
                <button style={{...styles.menuItem, ...modeStyles.menuItem}} onClick={openAddBookmarkDialog}>
                  Add bookmark…
                </button>
                <button style={{...styles.menuItem, ...modeStyles.menuItem}} onClick={() => openNewFolderDialog(undefined)}>
                  New folder…
                </button>
              </div>
            )}
          </div>
          <div style={styles.actionGroup}>
            <button
              type="button"
              style={{...styles.button, ...modeStyles.button}}
              onClick={() => {
                closeMenus();
                setShowOverflowMenu((prev) => !prev);
              }}
            >
              ⋮
            </button>
            {showOverflowMenu && (
              <div
                style={addMenuStyle}
                className="bookmarks-action-menu"
                onClick={(event) => event.stopPropagation()}
              >
                <button style={{...styles.menuItem, ...modeStyles.menuItem}} onClick={openImportDialog}>
                  Import (HTML)…
                </button>
                <button style={{...styles.menuItem, ...modeStyles.menuItem}} onClick={() => openExportDialog('all')}>
                  Export (HTML)…
                </button>
                <button style={{...styles.menuItem, ...modeStyles.menuItem}} onClick={handleJsonExport}>
                  Export JSON
                </button>
                <button style={{...styles.menuItem, ...modeStyles.menuItem}} onClick={() => toggleSelectionMode(true)}>
                  Select
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div style={{ ...styles.section, ...(modeStyles.section ?? {}) }}>
        <div style={styles.searchWrapper}>
          <input
            style={{ ...styles.searchInput, ...(modeStyles.searchInput ?? {}) }}
            value={search}
            placeholder="Search in titles, URLs, and tags…"
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button type="button" style={{...styles.clearButton, ...modeStyles.clearButton}} onClick={clearSearch}>
              ×
            </button>
          )}
        </div>
        {tagFilter && (
          <div style={{ ...styles.filterBar, ...(modeStyles.filterBar ?? {}) }}>
            <button
              type="button"
              style={{ ...styles.filterChip, ...(modeStyles.filterChip ?? {}) }}
              onClick={clearTagFilter}
            >
              {tagFilter}
              <span style={{ ...styles.filterChipClear, ...(modeStyles.filterChipClear ?? {}) }}>×</span>
            </button>
          </div>
        )}
      </div>
      <nav style={styles.breadcrumbs}>
        {breadcrumbs.map((crumb, idx) => (
          <span key={crumb.id} style={{...styles.crumbItem, ...modeStyles.crumbItem}}> 
            {idx < breadcrumbs.length - 1 ? (
              <button
                type="button"
                style={{...styles.crumbButton, ...modeStyles.crumbButton}}
                onClick={() => setActiveNodeId(crumb.id)}
              >
                {crumb.label}
              </button>
            ) : (
              <span>{crumb.label}</span>
            )}
            {idx < breadcrumbs.length - 1 && <span style={{...styles.crumbSeparator, ...modeStyles.crumbSeparator}}>/</span>}
          </span>
        ))}
      </nav>
      {errorBanner && <div style={styles.banner}>{errorBanner}</div>}
      <div style={listWrapperStyle} className="service-scroll">
        {!displayItems.length && (
          <div style={styles.emptyState}>
            <p>No items here yet</p>
            <button style={{...styles.button, ...modeStyles.button}} onClick={openAddBookmarkDialog}>
              Add bookmark
            </button>
          </div>
        )}
        {displayItems.map((node) => (
          <div
            key={node.id}
            role="button"
            tabIndex={0}
            style={isFolder(node) ? styles.folderRow : styles.bookmarkRow}
            onClick={() => (isFolder(node) ? openFolder(node) : openInTab(node.url ?? ''))}
            onContextMenu={(event) => openContextMenu(node, event)}
          >
            {selectionMode && (
              <label
                style={styles.checkboxWrap}
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(node.id)}
                  onChange={(event) => {
                    event.stopPropagation();
                    toggleSelection(node.id);
                  }}
                  style={{...styles.checkbox, ...modeStyles.checkbox}}
                  onClick={(event) => event.stopPropagation()}
                />
              </label>
            )}
            {isFolder(node) ? (
              <>
                <span style={{...styles.folderIcon, ...modeStyles.folderIcon}}>📁</span>
                <span style={{...styles.folderTitle, ...modeStyles.folderTitle}}>{node.title}</span>
                <span style={{...styles.folderMeta, ...modeStyles.folderMeta}}>{`${(node.children ?? []).length} items`}</span>
                <span style={{...styles.folderChevron, ...modeStyles.folderChevron}}>›</span>
              </>
            ) : (
              <>
                <span style={{...styles.bookmarkFavicon, ...modeStyles.bookmarkFavicon}}>🌐</span>
                <div style={{...styles.bookmarkDetails, ...modeStyles.bookmarkDetails}}>
                  <span style={{...styles.bookmarkTitle, ...modeStyles.bookmarkTitle}}>{node.title}</span>
                  {node.url && <span style={{...styles.bookmarkSubtitle, ...modeStyles.bookmarkSubtitle}}>{formatHostname(node.url)}</span>}
                  {node.tags && node.tags.length > 0 && (
                    <div style={styles.tagGroup}>
                      {node.tags.slice(0, 2).map((tag) => (
                        <button
                          key={`${node.id}-${tag}`}
                          type="button"
                          style={{...styles.tagChip, ...modeStyles.tagChip}}
                          onClick={(event) => {
                            event.stopPropagation();
                            applyTagFilter(tag);
                          }}
                          aria-label={`Filter by tag ${tag}`}
                        >
                          {tag}
                        </button>
                      ))}
                      {node.tags.length > 2 && (
                        <span style={{...styles.tagMore, ...modeStyles.tagMore}}>+{node.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  style={{...styles.starButton, ...modeStyles.starButton}}
                  onClick={(event) => handleStarClick(node, event)}
                >
                  ⭐
                </button>
              </>
            )}
          </div>
        ))}
        {debouncedSearch && !displayItems.length && (
          <div style={styles.emptyState}>No results for ‘{debouncedSearch}’</div>
        )}
      </div>
      {selectionMode && (
        <div style={selectionBarStyle}>
          <button type="button" style={styles.bottomButton} onClick={handleDeleteSelection}>
            Delete
          </button>
          <button type="button" style={styles.bottomButton} onClick={handleMoveSelection}>
            Move…
          </button>
          <button type="button" style={styles.bottomButton} onClick={handleExportSelection}>
            Export selected…
          </button>
        </div>
      )}
      {contextMenu && (
        <div
          className="bookmarks-context-menu"
          style={{
            ...styles.contextMenu,
            top: contextMenu.y,
            left: contextMenu.x,
            ...(modeStyles.contextMenu ?? {})
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {contextMenuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              style={{...styles.contextMenuItem, ...modeStyles.contextMenuItem}}
              onClick={() => {
                setContextMenu(null);
                item.action();
              }}
              disabled={item.disabled}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {exportDialog && (
        <div style={styles.overlay}>
          <div style={{ ...styles.dialog, ...(modeStyles.dialog ?? {}) }}>
            <h2 style={{...styles.dialogTitle, ...modeStyles.dialogTitle}}>Export bookmarks (HTML)</h2>
            <div style={{...styles.dialogBody, ...modeStyles.dialogBody}}>
              <label style={{...styles.dialogLabel, ...modeStyles.dialogLabel}}>
                <input
                  type="radio"
                  name="exportScope"
                  value="all"
                  checked={exportDialog.scope === 'all'}
                  onChange={() => updateExportScope('all')}
                  style={{...styles.dialogRadioInput, ...modeStyles.dialogRadioInput}}
                />
                <span style={{ marginLeft: '10px' }}>All bookmarks</span>
              </label>
              <label style={{...styles.dialogLabel, ...modeStyles.dialogLabel}}>
                <input
                  type="radio"
                  name="exportScope"
                  value="current"
                  checked={exportDialog.scope === 'current'}
                  onChange={() => updateExportScope('current')}
                  disabled={!currentNode}
                  style={{...styles.dialogRadioInput, ...modeStyles.dialogRadioInput}}
                />
                <span style={{ marginLeft: '10px' }}>
                  Current folder
                  {!currentNode && ' (no folder selected yet)'}
                </span>
              </label>
            </div>
            <div style={{...styles.dialogActions, ...modeStyles.dialogActions}}>
              <button type="button" style={{...styles.smallButton, ...modeStyles.smallButton}} onClick={closeExportDialog}>
                Cancel
              </button>
              <button
                type="button"
                style={{...styles.button, ...modeStyles.button}}
                onClick={handleHtmlExportConfirm}
                disabled={
                  !tree ||
                  exportDialog.loading ||
                  (exportDialog.scope === 'current' && !currentNode)
                }
              >
                {exportDialog.loading ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}
      {importDialog && (
        <div style={styles.overlay}>
          <div style={{ ...styles.dialog, ...(modeStyles.dialog ?? {}) }}>
            <h2 style={{...styles.dialogTitle, ...modeStyles.dialogTitle}}>Import bookmarks (HTML)</h2>
            <div style={{...styles.dialogBody, ...modeStyles.dialogBody}}>
              <label style={{...styles.dialogLabel, ...modeStyles.dialogLabel}}>
                File
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    style={{...styles.smallButton, ...modeStyles.smallButton}}
                    onClick={chooseImportFile}
                    disabled={importDialog.loading}
                  >
                    {importDialog.filePath ? 'Change file…' : 'Choose file…'}
                  </button>
                  <span style={{...styles.fileHint, ...modeStyles.fileHint}}>
                    {importDialog.filePath ? importDialog.filePath.split(/[\\/]/).pop() : 'No file selected'}
                  </span>
                </div>
              </label>
              <div style={{...styles.dialogLabel, ...modeStyles.dialogLabel}}>
                <span>Mode</span>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <label>
                    <input
                      type="radio"
                      name="importMode"
                      value="add"
                      checked={importDialog.mode === 'add'}
                      onChange={() =>
                        setImportDialog((prev) => (prev ? { ...prev, mode: 'add' } : prev))
                      }
                      style={{...styles.dialogRadioInput, ...modeStyles.dialogRadioInput}}
                    />
                    <span style={{ marginLeft: '8px' }}>Add to current folder</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importDialog.mode === 'replace'}
                      onChange={() =>
                        setImportDialog((prev) => (prev ? { ...prev, mode: 'replace' } : prev))
                      }
                      style={{...styles.dialogRadioInput, ...modeStyles.dialogRadioInput}}
                    />
                    <span style={{ marginLeft: '8px' }}>Replace current folder</span>
                  </label>
                </div>
              </div>
              {importDialog.preview && (
                <p style={{...styles.feedback, ...modeStyles.feedback}}>
                  Found {importDialog.preview.folders} folders · {importDialog.preview.bookmarks} bookmarks
                </p>
              )}
              {importDialog.error && (
                <div style={{...styles.banner, ...modeStyles.banner}}>
                  {importDialog.error}
                </div>
              )}
            </div>
            <div style={{...styles.dialogActions, ...modeStyles.dialogActions}}>
              <button type="button" style={{...styles.smallButton, ...modeStyles.smallButton}} onClick={closeImportDialog}>
                Cancel
              </button>
              <button
                type="button"
                style={{...styles.button, ...modeStyles.button}}
                onClick={handleImportDialogConfirm}
                disabled={!importContentRef.current || importDialog.loading || !tree}
              >
                {importDialog.loading ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
      {dialogState && dialogState.type === 'bookmark' && (
        <div style={styles.overlay}>
          <div style={{ ...styles.dialog, ...(modeStyles.dialog ?? {}) }}>
            <h2 style={{...styles.dialogTitle, ...modeStyles.dialogTitle}}>
              {dialogState.mode === 'add' ? 'Add bookmark' : 'Edit bookmark'}
            </h2>
            <div style={{...styles.dialogBody, ...modeStyles.dialogBody}}>
              <label style={{...styles.dialogLabel, ...modeStyles.dialogLabel}}>
                Title
                <input
                  type="text"
                  style={{...styles.dialogInput, ...modeStyles.dialogInput}}
                  value={bookmarkForm.title}
                  onChange={(event) => setBookmarkForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label style={{...styles.dialogLabel, ...modeStyles.dialogLabel}}>
                URL
                <input
                  type="text"
                  style={{...styles.dialogInput, ...modeStyles.dialogInput}}
                  value={bookmarkForm.url}
                  onChange={(event) => setBookmarkForm((prev) => ({ ...prev, url: event.target.value }))}
                />
              </label>
              <label style={{...styles.dialogLabel, ...modeStyles.dialogLabel}}>
                Tags
                <input
                  type="text"
                  style={{...styles.dialogInput, ...modeStyles.dialogInput}}
                  placeholder="comma separated"
                  value={bookmarkForm.tags}
                  onChange={(event) => setBookmarkForm((prev) => ({ ...prev, tags: event.target.value }))}
                />
              </label>
              <div style={styles.folderPickerRow}>
                <span style={{...styles.folderPickerLabel, ...modeStyles.folderPickerLabel}}>Folder</span>
                <button
                  type="button"
                  style={{...styles.smallButton, ...modeStyles.smallButton}}
                  onClick={() =>
                    openFolderPicker(
                      'parent',
                      (id) => {
                        setBookmarkForm((prev) => ({ ...prev, folderId: id }));
                      },
                      bookmarkForm.folderId
                    )
                  }
                >
                  Choose…
                </button>
                <span style={{...styles.folderPickerValue, ...modeStyles.folderPickerValue}}>
                  {folderItemLabel(bookmarkForm.folderId)}
                </span>
              </div>
            </div>
            <div style={styles.dialogActions}>
              <button style={{...styles.smallButton, ...modeStyles.smallButton}} type="button" onClick={() => setDialogState(null)}>
                Cancel
              </button>
              <button style={{...styles.button, ...modeStyles.button}} type="button" onClick={handleBookmarkFormSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {dialogState && dialogState.type === 'folder' && (
        <div style={styles.overlay}>
          <div style={{ ...styles.dialog, ...(modeStyles.dialog ?? {}) }}>
            <h2 style={{...styles.dialogTitle, ...modeStyles.dialogTitle}}>
              {dialogState.mode === 'create' ? 'New folder' : 'Rename folder'}
            </h2>
            <div style={styles.dialogBody}>
              <label style={{...styles.dialogLabel, ...modeStyles.dialogLabel}}>
                Name
                <input
                  type="text"
                  style={{...styles.dialogInput, ...modeStyles.dialogInput}}
                  value={folderForm.title}
                  onChange={(event) => setFolderForm({ title: event.target.value })}
                />
              </label>
            </div>
            <div style={styles.dialogActions}>
              <button style={{...styles.smallButton, ...modeStyles.smallButton}} type="button" onClick={() => setDialogState(null)}>
                Cancel
              </button>
              <button style={{...styles.button, ...modeStyles.button}} type="button" onClick={handleFolderFormSave}>
                {dialogState.mode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {folderPicker && (
        <div style={styles.overlay}>
          <div style={{ ...styles.dialog, ...(modeStyles.dialog ?? {}) }}>
            <h2 style={{...styles.dialogTitle, ...modeStyles.dialogTitle}}>{folderPicker.title}</h2>
            <div style={styles.folderPickerActions}>
              <button
                type="button"
                style={{...styles.smallButton, ...modeStyles.smallButton}}
                onClick={() => {
                  const parentId = folderPicker.selectedId;
                  setFolderPicker(null);
                  openNewFolderDialog(parentId);
                }}
              >
                New folder…
              </button>
            </div>
            <div style={styles.folderListPicker}>
              {folderList.map((folder) => (
                <button
                  type="button"
                  key={folder.id}
                  style={
                    folder.id === folderPicker.selectedId
                      ? { ...styles.folderPickerRow, ...modeStyles.folderPickerRow, ...styles.folderPickerActive }
                      : {...styles.folderPickerRow, ...modeStyles.folderPickerRow}
                  }
                  onClick={() => handleFolderPickerSelect(folder.id)}
                >
                  <span>{folder.label}</span>
                </button>
              ))}
            </div>
            <div style={styles.dialogActions}>
              <button style={{...styles.smallButton, ...modeStyles.smallButton}} type="button" onClick={() => setFolderPicker(null)}>
                Cancel
              </button>
              <button style={{...styles.button, ...modeStyles.button}} type="button" onClick={handleFolderPickerChoose}>
                Choose
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmState && (
        <div style={styles.overlay}>
          <div style={{ ...styles.dialog, ...(modeStyles.dialog ?? {}) }}>
            <p style={{...styles.dialogMessage, ...modeStyles.dialogMessage}}>{confirmState.message}</p>
            <div style={styles.dialogActions}>
              <button style={{...styles.smallButton, ...modeStyles.smallButton}} type="button" onClick={() => setConfirmState(null)}>
                {confirmState.cancelLabel ?? 'Cancel'}
              </button>
              <button style={{...styles.button, ...modeStyles.button}} type="button" onClick={confirmState.onConfirm}>
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
};

export default BookmarksPage;
