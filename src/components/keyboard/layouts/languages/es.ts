import type { LanguageLayout } from '../types';

const ROWS_DEFAULT = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const LONG_PRESS: Record<string, string[]> = {
  a: ['á'],
  e: ['é'],
  i: ['í'],
  o: ['ó'],
  u: ['ú', 'ü'],
  n: ['ñ'],
  '?': ['¿'],
  '!': ['¡']
};

export const esLayout: LanguageLayout = {
  id: 'es',
  label: 'ES',
  rows: { default: ROWS_DEFAULT },
  longPress: LONG_PRESS
};
