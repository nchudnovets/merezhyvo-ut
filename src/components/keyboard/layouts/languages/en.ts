import type { LanguageLayout } from '../types';

const ROWS_DEFAULT = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const LONG_PRESS: Record<string, string[]> = {
  a: ['á', 'à', 'ä', 'â', 'ã', 'å'],
  e: ['é', 'è', 'ë', 'ê'],
  i: ['í', 'ï', 'î'],
  o: ['ó', 'ö', 'ô', 'õ'],
  u: ['ú', 'ü', 'û'],
  c: ['ç'],
  n: ['ñ'],
  "'": ['ʼ']
};

export const enLayout: LanguageLayout = {
  id: 'en',
  label: 'EN',
  rows: { default: ROWS_DEFAULT },
  longPress: LONG_PRESS
};
