import type { LanguageLayout } from '../types';

const ROWS_DEFAULT = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ç'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const LONG_PRESS: Record<string, string[]> = {
  a: ['á', 'à', 'ã', 'â'],
  e: ['é', 'ê'],
  i: ['í'],
  o: ['ó', 'ô', 'õ'],
  u: ['ú'],
  c: ['ç']
};

export const ptLayout: LanguageLayout = {
  id: 'pt',
  label: 'PT',
  rows: { default: ROWS_DEFAULT },
  longPress: LONG_PRESS
};
