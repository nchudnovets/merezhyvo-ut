import React from 'react';
import type { LayoutId, LanguageId, Rows, SymbolId } from './layouts/types';
import {
  getLanguageLabel,
  getLanguageLongPress,
  getLanguageRows,
  isLanguageRtl,
  LANGUAGE_LAYOUT_IDS
} from './layouts/languages';
import { SYMBOL_LAYOUT_IDS, getSymbolRows } from './layouts/symbols';

export type { LayoutId, LanguageId, SymbolId } from './layouts/types';

export const LONG_PRESS: Record<LanguageId, Record<string, string[]>> = (() => {
  const out: Record<LanguageId, Record<string, string[]>> = {} as Record<
    LanguageId,
    Record<string, string[]>
  >;
  for (const id of LANGUAGE_LAYOUT_IDS) {
    out[id] = getLanguageLongPress(id);
  }
  return out;
})();

export const longPressMap = LONG_PRESS;

export function humanLabel(id: LayoutId): string {
  if (isSymbols(id)) {
    return id === 'symbols1' ? 'SYM1' : 'SYM2';
  }
  return getLanguageLabel(id as LanguageId);
}

export function isRTL(id: LayoutId): boolean {
  return !isSymbols(id) && isLanguageRtl(id as LanguageId);
}

export function isSymbols(id: LayoutId): id is SymbolId {
  return id === 'symbols1' || id === 'symbols2';
}

export function resolveLayoutRows(layoutId: LayoutId, shift: boolean): Rows {
  if (isSymbols(layoutId)) return getSymbolRows(layoutId);
  return getLanguageRows(layoutId as LanguageId, shift);
}

export function nextLayoutId(current: LayoutId, enabled: LayoutId[]): LayoutId {
  if (!enabled || enabled.length === 0) return 'en';
  const idx = enabled.indexOf(current);
  if (idx === -1) return enabled[0] as LayoutId;

  const n = (idx + 1) % enabled.length;
  const val = enabled[n] as LayoutId | undefined;
  return (val ?? enabled[0] ?? 'en') as LayoutId;
}

export { LANGUAGE_LAYOUT_IDS, SYMBOL_LAYOUT_IDS };

// --- Back-compat context ------------------------------------------------

export interface OskContextValue {
  longPress: typeof LONG_PRESS;
}

// Some code imports OskContext from layouts.ts; provide a harmless default.
export const OskContext = React.createContext<OskContextValue>({
  longPress: LONG_PRESS
});
