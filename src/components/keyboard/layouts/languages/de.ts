import type { LanguageLayout } from '../types';

const ROWS_DEFAULT = [
  ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
  ['y', 'x', 'c', 'v', 'b', 'n', 'm', 'ß']
];

const LONG_PRESS: Record<string, string[]> = {
  a: ['ä'],
  A: ['Ä'],
  o: ['ö'],
  O: ['Ö'],
  u: ['ü'],
  U: ['Ü'],
  s: ['ß']
};

export const deLayout: LanguageLayout = {
  id: 'de',
  label: 'DE',
  rows: { default: ROWS_DEFAULT },
  longPress: LONG_PRESS
};
