import type { LanguageLayout } from '../types';

const ROWS_DEFAULT = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ă'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const LONG_PRESS: Record<string, string[]> = {
  a: ['ă', 'â'],
  A: ['Ă', 'Â'],
  i: ['î'],
  I: ['Î'],
  s: ['ș', 'ş'],
  S: ['Ș', 'Ş'],
  t: ['ț', 'ţ'],
  T: ['Ț', 'Ţ']
};

export const roLayout: LanguageLayout = {
  id: 'ro',
  label: 'RO',
  rows: { default: ROWS_DEFAULT },
  longPress: LONG_PRESS
};
