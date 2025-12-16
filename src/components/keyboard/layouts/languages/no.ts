import type { LanguageLayout } from '../types';

const ROWS_DEFAULT = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'å'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ø', 'æ'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const ROWS_SHIFT = ROWS_DEFAULT.map((row) => row.map((key) => key.toUpperCase()));

const LONG_PRESS: Record<string, string[]> = {
  a: ['á', 'à', 'â', 'ä', 'ã', 'å'],
  e: ['é', 'è', 'ê', 'ë'],
  i: ['í', 'ì', 'î', 'ï'],
  o: ['ó', 'ò', 'ô', 'ö', 'õ', 'ø'],
  u: ['ú', 'ù', 'û', 'ü'],
  y: ['ý', 'ÿ'],
  c: ['ç'],
  s: ['š', 'ß'],
  n: ['ñ']
};

export const noLayout: LanguageLayout = {
  id: 'no',
  label: 'NO',
  rows: { default: ROWS_DEFAULT, shift: ROWS_SHIFT },
  longPress: LONG_PRESS
};
