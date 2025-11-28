import type { Rows, SymbolId } from './types';

export const SYMBOL_LAYOUT_IDS: readonly SymbolId[] = ['symbols1', 'symbols2'] as const;

const SYMBOLS_ROWS: Record<SymbolId, Rows> = {
  symbols1: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['@', '#', '$', '%', '*', '-', '_', '+', '/', '\\'],
    ['(', ')', '?', '!', '.', ',', ';', "'", '"', ':']
  ],
  symbols2: [
    ['~', '`', '^', '|', '•', '…', '€', '£', '¥', '₴'],
    ['<', '>', '=', '±', '×', '÷', '§', '°', '&', '¢'],
    ['[', ']', '{', '}', '¿', '¡', '©', '®', '™', '¶']
  ]
};

export function getSymbolRows(id: SymbolId): Rows {
  return SYMBOLS_ROWS[id] ?? SYMBOLS_ROWS.symbols1;
}
