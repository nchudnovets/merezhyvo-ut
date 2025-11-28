import type { LanguageLayout } from '../types';

const ROWS_DEFAULT = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const LONG_PRESS: Record<string, string[]> = {
  a: ['á', 'ä', 'â'],
  e: ['é', 'ë', 'è'],
  i: ['í', 'ï'],
  o: ['ó', 'ö', 'ô'],
  u: ['ú', 'ü', 'û']
};

export const nlLayout: LanguageLayout = {
  id: 'nl',
  label: 'NL',
  rows: { default: ROWS_DEFAULT },
  longPress: LONG_PRESS
};
