import type { JsDialogRequestDetail, JsDialogResult } from '../../types/models';

const listeners = new Set<(detail: JsDialogRequestDetail) => void>();
const pending = new Map<string, (result: JsDialogResult | null) => void>();

const makeId = (): string => `jsd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const requestJsDialog = (payload: Omit<JsDialogRequestDetail, 'id' | 'source'>): Promise<JsDialogResult | null> => {
  const id = makeId();
  const detail: JsDialogRequestDetail = { ...payload, id, source: 'internal' };
  const promise = new Promise<JsDialogResult | null>((resolve) => {
    pending.set(id, resolve);
    listeners.forEach((cb) => cb(detail));
  });
  return promise.finally(() => pending.delete(id));
};

export const onJsDialogRequest = (handler: (detail: JsDialogRequestDetail) => void): (() => void) => {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
};

export const dispatchExternalJsDialogRequest = (
  detail: JsDialogRequestDetail,
  onResolve?: (result: JsDialogResult | null) => void
): void => {
  if (detail.id && onResolve) {
    pending.set(detail.id, onResolve);
  }
  listeners.forEach((cb) => cb(detail));
};

export const resolveJsDialogRequest = (id: string, result: JsDialogResult | null): void => {
  const resolver = pending.get(id);
  if (resolver) {
    resolver(result);
    pending.delete(id);
  }
};
