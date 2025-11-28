import type { LanguageLayout } from '../types';

const ROWS_DEFAULT = [
  ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
  ['w', 'x', 'c', 'v', 'b', 'n', 'ç']
];

const LONG_PRESS: Record<string, string[]> = {
  a: ['à', 'â', 'æ'],
  e: ['é', 'è', 'ê', 'ë'],
  i: ['î', 'ï'],
  o: ['ô', 'œ'],
  u: ['ù', 'û', 'ü'],
  c: ['ç'],
  y: ['ÿ']
};

export const frLayout: LanguageLayout = {
  id: 'fr',
  label: 'FR',
  rows: { default: ROWS_DEFAULT },
  longPress: LONG_PRESS
};
