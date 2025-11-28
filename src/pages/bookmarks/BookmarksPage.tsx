import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BookmarksTree, BookmarkNode, Mode } from '../../types/models';
import type { ServicePageProps } from '../services/types';
import { bookmarksStyles } from './bookmarksStyles';
import { bookmarksModeStyles } from './bookmarksModeStyles';
import { requestFileDialog } from '../../services/fileDialog/fileDialogService';
import { useI18n } from '../../i18n/I18nProvider';

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
  const { t } = useI18n();
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
      setErrorBanner(t('bookmarks.error.save'));
    }
  }, [getBookmarksApi, t]);

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
  const rootLabel = useMemo(() => t('bookmarks.title'), [t]);

  const breadcrumbs = useMemo(() => {
    if (!tree) return [];
    const path: Array<{ id: string; label: string }> = [];
    let node = currentNode;
    if (!node) {
      if (tree.nodes[rootId]) {
        path.push({ id: rootId, label: rootLabel });
      }
      return path;
    }
    while (node) {
      if (node.id === rootId) {
        path.push({ id: node.id, label: rootLabel });
        break;
      }
      path.push({ id: node.id, label: node.title });
      node = node.parentId ? tree.nodes[node.parentId] ?? null : null;
    }
    return path.reverse();
  }, [tree, currentNode, rootId, rootLabel]);

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
      const label = depth === 0 ? rootLabel : `${parentLabel} / ${node.title}`;
      result.push({ id: nodeId, label, depth });
      const nextLabel = depth === 0 ? rootLabel : label;
      (node.children ?? []).forEach((childId) => traverse(childId, depth + 1, nextLabel));
    };
    traverse(rootId, 0, rootLabel);
    return result;
  }, [tree, rootId, rootLabel]);

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
        prev ? { ...prev, error: t('bookmarks.error.api'), loading: false } : prev
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
        title: t('bookmarks.import.title')
      });
      const chosenPath = dialogResult?.paths?.[0];
      if (!chosenPath) {
        setImportDialog((prev) => (prev ? { ...prev, loading: false } : prev));
        return;
      }
      const fileContent = await window.merezhyvo?.fileDialog?.readFile?.({ path: chosenPath });
      if (typeof fileContent !== 'string') {
        throw new Error(t('bookmarks.import.error.read'));
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
      const message =
        err instanceof Error ? err.message : t('bookmarks.import.error.generic');
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
  }, [currentNode?.id, importDialog?.mode, rootId, getBookmarksApi, t]);

  const handleImportDialogConfirm = async () => {
    if (!importDialog) return;
    const content = importContentRef.current;
    if (!content) {
      setImportDialog((prev) =>
        prev ? { ...prev, error: t('bookmarks.import.error.noFile') } : prev
      );
      return;
    }
    if (!tree) {
      setImportDialog((prev) =>
        prev ? { ...prev, error: t('bookmarks.import.error.loading') } : prev
      );
      return;
    }
    const api = getBookmarksApi();
    if (!api?.importHtml) {
      setImportDialog((prev) =>
        prev ? { ...prev, error: t('bookmarks.error.api') } : prev
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
        const message = t('bookmarks.import.noNew');
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
      showToast(t('bookmarks.import.success'));
      notifyBookmarksChanged();
      setImportDialog(null);
      importContentRef.current = null;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('bookmarks.import.error.generic');
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
    showToast(t('bookmarks.export.success'));
    closeExportDialog();
  };

  const handleHtmlExportConfirm = async () => {
    if (!tree) return;
    const api = getBookmarksApi();
    if (!api?.exportHtml) {
      setErrorBanner(t('bookmarks.error.api'));
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
        title: t('bookmarks.export.title'),
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
      showToast(t('bookmarks.export.successPath', { filename: result.filenameSuggested }));
      setExportDialog(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('bookmarks.export.error.generic');
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
    if (!nodeId) return rootLabel;
    return folderLabels[nodeId] ?? rootLabel;
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
    const title =
      purpose === 'move'
        ? t('bookmarks.folderPicker.chooseDestination')
        : t('bookmarks.folderPicker.chooseFolder');
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
      setErrorBanner(t('bookmarks.dialog.required.titleUrl'));
      return;
    }
    try {
      if (dialogState.type === 'bookmark' && dialogState.mode === 'add') {
        const result = await api.add({ ...payload, type: 'bookmark' });
        if (result.ok) {
          showToast(t('bookmarks.toast.added'));
          notifyBookmarksChanged();
          setDialogState(null);
          await refreshTree();
        } else {
          setErrorBanner(result.error || t('bookmarks.error.save'));
        }
      } else if (dialogState.type === 'bookmark' && dialogState.mode === 'edit' && dialogState.node) {
        const result = await api.update({
          id: dialogState.node.id,
          title: payload.title,
          url: payload.url,
          tags: payload.tags
        });
        if (result.ok) {
          showToast(t('bookmarks.toast.added'));
          notifyBookmarksChanged();
          setDialogState(null);
          await refreshTree();
        } else {
          setErrorBanner(t('bookmarks.error.save'));
        }
      }
    } catch {
      setErrorBanner(t('bookmarks.error.save'));
    }
  };

  const handleFolderFormSave = async () => {
    const api = getBookmarksApi();
    if (!api || !dialogState) return;
    if (!folderForm.title.trim()) {
      setErrorBanner(t('bookmarks.dialog.required.name'));
      return;
    }
    try {
      if (dialogState.type === 'folder' && dialogState.mode === 'create') {
        const parentId = dialogState.node?.id ?? rootId;
        const result = await api.add({ type: 'folder', title: folderForm.title, parentId });
        if (result.ok) {
          showToast(t('bookmarks.toast.folderSaved'));
          notifyBookmarksChanged();
          setDialogState(null);
          await refreshTree();
        } else {
          setErrorBanner(result.error || t('bookmarks.error.save'));
        }
      } else if (dialogState.type === 'folder' && dialogState.mode === 'rename' && dialogState.node) {
        const result = await api.update({ id: dialogState.node.id, title: folderForm.title });
        if (result.ok) {
          showToast(t('bookmarks.toast.folderSaved'));
          notifyBookmarksChanged();
          setDialogState(null);
          await refreshTree();
        } else {
          setErrorBanner(t('bookmarks.error.save'));
        }
      }
    } catch {
      setErrorBanner(t('bookmarks.error.save'));
    }
  };

  const handleRemoveNode = (node: BookmarkNode) => {
    setConfirmState({
      message: node.type === 'folder' ? t('bookmarks.confirm.deleteFolder') : t('bookmarks.confirm.removeBookmark'),
      confirmLabel: node.type === 'folder' ? t('bookmarks.confirm.delete') : t('bookmarks.confirm.remove'),
      onConfirm: async () => {
        const api = getBookmarksApi();
        if (!api) return;
        const result = await api.remove(node.id);
        if (result.ok) {
          showToast(node.type === 'folder' ? t('bookmarks.toast.deletedOne') : t('bookmarks.toast.removed'));
          notifyBookmarksChanged();
          setConfirmState(null);
          await refreshTree();
        } else {
          setErrorBanner(t('bookmarks.error.save'));
        }
      }
    });
  };

  const handleStarClick = (node: BookmarkNode, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (node.type !== 'bookmark') return;
    setConfirmState({
      message: t('bookmarks.confirm.removeBookmark'),
      confirmLabel: t('bookmarks.confirm.remove'),
      onConfirm: async () => {
        const api = getBookmarksApi();
        if (!api) return;
        const result = await api.remove(node.id);
        if (result.ok) {
          showToast(t('bookmarks.toast.bookmarkRemoved'));
          notifyBookmarksChanged();
          setConfirmState(null);
          await refreshTree();
        } else {
          setErrorBanner(t('bookmarks.error.save'));
        }
      }
    });
  };

const handleDeleteSelection = () => {
    if (!selectedIds.size) return;
    setConfirmState({
      message: t('bookmarks.confirm.deleteMany', { count: selectedIds.size }),
      confirmLabel: t('bookmarks.confirm.delete'),
      onConfirm: async () => {
        const api = getBookmarksApi();
        if (!api) return;
        const ids = Array.from(selectedIds);
        await Promise.all(ids.map((id) => api.remove(id)));
        showToast(t('bookmarks.toast.deletedMany', { count: ids.length }));
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
      showToast(t('bookmarks.toast.moved', { title: target.title }));
      notifyBookmarksChanged();
      toggleSelectionMode(false);
      await refreshTree();
    });
  };

  const handleExportSelection = async () => {
    const api = getBookmarksApi();
    if (!api) return;
    await api.export();
    showToast(t('bookmarks.toast.exportSelected'));
  };

  const handleFolderMove = async (node: BookmarkNode, targetId: string) => {
    const api = getBookmarksApi();
    if (!api) return;
    const target = tree?.nodes[targetId];
    if (!target || target.type !== 'folder') return;
    await api.move({ id: node.id, newParentId: targetId });
    showToast(t('bookmarks.toast.moved', { title: target.title }));
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
    showToast(t('bookmarks.toast.moved', { title: target.title }));
    notifyBookmarksChanged();
    setContextMenu(null);
    await refreshTree();
  };

  const handleCopyUrl = async (url: string) => {
    if (!url) return;
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        showToast(t('bookmarks.copy.error'));
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast(t('bookmarks.copy.success'));
    } catch {
      showToast(t('bookmarks.copy.error'));
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
            { label: t('bookmarks.menu.rename'), action: () => openRenameFolderDialog(node), disabled: isRoot },
            { label: t('bookmarks.menu.move'), action: () => openFolderPicker('move', async (targetId) => { await handleFolderMove(node, targetId); }) },
            { label: t('bookmarks.menu.delete'), action: () => handleRemoveNode(node), disabled: isRoot },
            { label: t('bookmarks.menu.newSubfolder'), action: () => openNewFolderDialog(node.id) },
            { label: t('bookmarks.menu.select'), action: () => { toggleSelectionMode(true); setSelectedIds(new Set([node.id])); } }
          ];
        }
        return [
          { label: t('bookmarks.menu.open'), action: () => openInTab(node.url ?? '') },
          { label: t('bookmarks.menu.edit'), action: () => openEditBookmarkDialog(node) },
          { label: t('bookmarks.menu.move'), action: () => openFolderPicker('move', async (targetId) => { await handleBookmarkMove(node, targetId); }) },
          { label: t('bookmarks.menu.copyUrl'), action: () => handleCopyUrl(node.url ?? '') },
          { label: t('bookmarks.menu.delete'), action: () => handleRemoveNode(node) },
          { label: t('bookmarks.menu.select'), action: () => { toggleSelectionMode(true); setSelectedIds(new Set([node.id])); } }
        ];
      })()
    : [];

  if (!tree || !currentNode) {
    return <div style={styles.container}>{t('bookmarks.loading')}</div>;
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
        <h1 style={{ ...styles.heroTitle, ...(modeStyles.heroTitle ?? {}) }}>{t('bookmarks.title')}</h1>
        <div style={styles.badgeGroup}>
          {selectionMode && (
            <span style={{...styles.feedback, ...modeStyles.feedback}}>
              {t('bookmarks.selected', { count: selectedIds.size })}
            </span>
          )}
          {selectionMode && (
            <button type="button" style={{...styles.smallButton, ...modeStyles.smallButton}} onClick={() => toggleSelectionMode(false)}>
              {t('bookmarks.done')}
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
                  {t('bookmarks.menu.addBookmark')}
                </button>
                <button style={{...styles.menuItem, ...modeStyles.menuItem}} onClick={() => openNewFolderDialog(undefined)}>
                  {t('bookmarks.menu.newFolder')}
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
                  {t('bookmarks.menu.importHtml')}
                </button>
                <button style={{...styles.menuItem, ...modeStyles.menuItem}} onClick={() => openExportDialog('all')}>
                  {t('bookmarks.menu.exportHtml')}
                </button>
                <button style={{...styles.menuItem, ...modeStyles.menuItem}} onClick={handleJsonExport}>
                  {t('bookmarks.menu.exportJson')}
                </button>
                <button style={{...styles.menuItem, ...modeStyles.menuItem}} onClick={() => toggleSelectionMode(true)}>
                  {t('bookmarks.menu.select')}
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
            placeholder={t('bookmarks.search.placeholder')}
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
            <p>{t('bookmarks.empty')}</p>
            <button style={{...styles.button, ...modeStyles.button}} onClick={openAddBookmarkDialog}>
              {t('bookmarks.menu.addBookmark')}
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
                <span style={{...styles.folderMeta, ...modeStyles.folderMeta}}>
                  {t('bookmarks.folder.items', { count: (node.children ?? []).length })}
                </span>
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
          <div style={styles.emptyState}>
            {t('bookmarks.search.empty', { query: debouncedSearch })}
          </div>
        )}
      </div>
      {selectionMode && (
        <div style={selectionBarStyle}>
          <button type="button" style={styles.bottomButton} onClick={handleDeleteSelection}>
            {t('bookmarks.confirm.delete')}
          </button>
          <button type="button" style={styles.bottomButton} onClick={handleMoveSelection}>
            {t('bookmarks.menu.move')}
          </button>
          <button type="button" style={styles.bottomButton} onClick={handleExportSelection}>
            {t('bookmarks.toast.exportSelected')}
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
            <h2 style={{...styles.dialogTitle, ...modeStyles.dialogTitle}}>{t('bookmarks.export.title')}</h2>
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
                <span style={{ marginLeft: '10px' }}>{t('bookmarks.export.scope.all')}</span>
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
                  {t('bookmarks.export.scope.current')}
                  {!currentNode && ` (${t('bookmarks.export.scope.noneSelected')})`}
                </span>
              </label>
            </div>
            <div style={{...styles.dialogActions, ...modeStyles.dialogActions}}>
              <button type="button" style={{...styles.smallButton, ...modeStyles.smallButton}} onClick={closeExportDialog}>
                {t('bookmarks.button.cancel')}
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
                {exportDialog.loading ? t('bookmarks.export.loading') : t('bookmarks.export.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
      {importDialog && (
        <div style={styles.overlay}>
          <div style={{ ...styles.dialog, ...(modeStyles.dialog ?? {}) }}>
            <h2 style={{...styles.dialogTitle, ...modeStyles.dialogTitle}}>{t('bookmarks.import.title')}</h2>
            <div style={{...styles.dialogBody, ...modeStyles.dialogBody}}>
              <label style={{...styles.dialogLabel, ...modeStyles.dialogLabel}}>
                {t('bookmarks.dialog.fileLabel')}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    style={{...styles.smallButton, ...modeStyles.smallButton}}
                    onClick={chooseImportFile}
                    disabled={importDialog.loading}
                  >
                    {importDialog.filePath ? t('bookmarks.import.changeFile') : t('bookmarks.import.chooseFile')}
                  </button>
                  <span style={{...styles.fileHint, ...modeStyles.fileHint}}>
                    {importDialog.filePath ? importDialog.filePath.split(/[\\/]/).pop() : t('bookmarks.import.noFileSelected')}
                  </span>
                </div>
              </label>
              <div style={{...styles.dialogLabel, ...modeStyles.dialogLabel}}>
                <span>{t('bookmarks.dialog.modeLabel')}</span>
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
                    <span style={{ marginLeft: '8px' }}>{t('bookmarks.import.mode.add')}</span>
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
                    <span style={{ marginLeft: '8px' }}>{t('bookmarks.import.mode.replace')}</span>
                  </label>
                </div>
              </div>
              {importDialog.preview && (
                <p style={{...styles.feedback, ...modeStyles.feedback}}>
                  {t('bookmarks.import.preview', { folders: importDialog.preview.folders, bookmarks: importDialog.preview.bookmarks })}
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
                {t('bookmarks.button.cancel')}
              </button>
              <button
                type="button"
                style={{...styles.button, ...modeStyles.button}}
                onClick={handleImportDialogConfirm}
                disabled={!importContentRef.current || importDialog.loading || !tree}
              >
                {importDialog.loading ? t('bookmarks.import.loading') : t('bookmarks.import.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
      {dialogState && dialogState.type === 'bookmark' && (
        <div style={styles.overlay}>
          <div style={{ ...styles.dialog, ...(modeStyles.dialog ?? {}) }}>
            <h2 style={{...styles.dialogTitle, ...modeStyles.dialogTitle}}>
              {dialogState.mode === 'add'
                ? t('bookmarks.dialog.addBookmark')
                : t('bookmarks.dialog.editBookmark')}
            </h2>
            <div style={{...styles.dialogBody, ...modeStyles.dialogBody}}>
              <label style={{...styles.dialogLabel, ...modeStyles.dialogLabel}}>
                {t('bookmarks.field.title')}
                <input
                  type="text"
                  style={{...styles.dialogInput, ...modeStyles.dialogInput}}
                  value={bookmarkForm.title}
                  onChange={(event) => setBookmarkForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label style={{...styles.dialogLabel, ...modeStyles.dialogLabel}}>
                {t('bookmarks.field.url')}
                <input
                  type="text"
                  style={{...styles.dialogInput, ...modeStyles.dialogInput}}
                  value={bookmarkForm.url}
                  onChange={(event) => setBookmarkForm((prev) => ({ ...prev, url: event.target.value }))}
                />
              </label>
              <label style={{...styles.dialogLabel, ...modeStyles.dialogLabel}}>
                {t('bookmarks.field.tags')}
                <input
                  type="text"
                  style={{...styles.dialogInput, ...modeStyles.dialogInput}}
                  placeholder={t('bookmarks.tags.placeholder')}
                  value={bookmarkForm.tags}
                  onChange={(event) => setBookmarkForm((prev) => ({ ...prev, tags: event.target.value }))}
                />
              </label>
              <div style={styles.folderPickerRow}>
                <span style={{...styles.folderPickerLabel, ...modeStyles.folderPickerLabel}}>
                  {t('bookmarks.field.folder')}
                </span>
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
                  {t('bookmarks.button.choose')}
                </button>
                <span style={{...styles.folderPickerValue, ...modeStyles.folderPickerValue}}>
                  {folderItemLabel(bookmarkForm.folderId)}
                </span>
              </div>
            </div>
            <div style={styles.dialogActions}>
              <button style={{...styles.smallButton, ...modeStyles.smallButton}} type="button" onClick={() => setDialogState(null)}>
                {t('bookmarks.button.cancel')}
              </button>
              <button style={{...styles.button, ...modeStyles.button}} type="button" onClick={handleBookmarkFormSave}>
                {t('bookmarks.button.save')}
              </button>
            </div>
          </div>
        </div>
      )}
      {dialogState && dialogState.type === 'folder' && (
        <div style={styles.overlay}>
          <div style={{ ...styles.dialog, ...(modeStyles.dialog ?? {}) }}>
            <h2 style={{...styles.dialogTitle, ...modeStyles.dialogTitle}}>
              {dialogState.mode === 'create'
                ? t('bookmarks.dialog.newFolder')
                : t('bookmarks.dialog.renameFolder')}
            </h2>
            <div style={styles.dialogBody}>
              <label style={{...styles.dialogLabel, ...modeStyles.dialogLabel}}>
                {t('bookmarks.field.name')}
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
                {t('bookmarks.button.cancel')}
              </button>
              <button style={{...styles.button, ...modeStyles.button}} type="button" onClick={handleFolderFormSave}>
                {dialogState.mode === 'create' ? t('bookmarks.button.create') : t('bookmarks.button.save')}
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
                {t('bookmarks.folderPicker.newFolder')}
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
                {t('bookmarks.button.cancel')}
              </button>
              <button style={{...styles.button, ...modeStyles.button}} type="button" onClick={handleFolderPickerChoose}>
                {t('bookmarks.folderPicker.choose')}
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
                {confirmState.cancelLabel ?? t('bookmarks.button.cancel')}
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
