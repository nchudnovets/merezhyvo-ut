import type { LanguageLayout } from '../types';

const ROWS_DEFAULT = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'ı', 'o', 'p', 'ğ', 'ü'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ş', 'i'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'ö', 'ç']
];

const LONG_PRESS: Record<string, string[]> = {
  g: ['ğ'],
  G: ['Ğ'],
  s: ['ş'],
  S: ['Ş'],
  i: ['ı', 'İ'],
  o: ['ö'],
  O: ['Ö'],
  u: ['ü'],
  U: ['Ü'],
  c: ['ç'],
  C: ['Ç']
};

export const trLayout: LanguageLayout = {
  id: 'tr',
  label: 'TR',
  rows: { default: ROWS_DEFAULT },
  longPress: LONG_PRESS
};
