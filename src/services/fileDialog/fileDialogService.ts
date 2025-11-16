import type {
  FileDialogOptions,
  FileDialogResult,
  FileDialogRequestDetail
} from '../../types/models';

const requestListeners = new Set<(detail: FileDialogRequestDetail) => void>();
const pendingRequests = new Map<string, (result: FileDialogResult | null) => void>();

const makeRequestId = (): string => `fd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const requestFileDialog = (options: FileDialogOptions): Promise<FileDialogResult | null> => {
  const id = makeRequestId();
  const detail: FileDialogRequestDetail = { id, options, source: 'internal' };
  const promise = new Promise<FileDialogResult | null>((resolve) => {
    pendingRequests.set(id, resolve);
    requestListeners.forEach((listener) => listener(detail));
  });
  return promise.finally(() => pendingRequests.delete(id));
};

export const onFileDialogRequest = (handler: (detail: FileDialogRequestDetail) => void): (() => void) => {
  requestListeners.add(handler);
  return () => {
    requestListeners.delete(handler);
  };
};

export const dispatchExternalFileDialog = (detail: FileDialogRequestDetail): void => {
  requestListeners.forEach((listener) => listener(detail));
};

export const resolveFileDialogRequest = (id: string, result: FileDialogResult | null): void => {
  const resolver = pendingRequests.get(id);
  if (resolver) {
    resolver(result);
    pendingRequests.delete(id);
  }
};

export const createExternalRequest = (options: FileDialogOptions, requestId: string): FileDialogRequestDetail => ({
  id: requestId,
  options,
  source: 'external'
});
