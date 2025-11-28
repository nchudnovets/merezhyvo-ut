import type { LanguageLayout } from '../types';

const ROWS_DEFAULT = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ł'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const LONG_PRESS: Record<string, string[]> = {
  a: ['ą'],
  A: ['Ą'],
  c: ['ć'],
  C: ['Ć'],
  e: ['ę'],
  E: ['Ę'],
  l: ['ł'],
  L: ['Ł'],
  n: ['ń'],
  N: ['Ń'],
  o: ['ó'],
  O: ['Ó'],
  s: ['ś'],
  S: ['Ś'],
  z: ['ż', 'ź'],
  Z: ['Ż', 'Ź']
};

export const plLayout: LanguageLayout = {
  id: 'pl',
  label: 'PL',
  rows: { default: ROWS_DEFAULT },
  longPress: LONG_PRESS
};
