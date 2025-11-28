import type { LanguageLayout } from '../types';

const ROWS_DEFAULT = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ò'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const LONG_PRESS: Record<string, string[]> = {
  a: ['à'],
  e: ['è', 'é'],
  i: ['ì'],
  o: ['ò'],
  u: ['ù']
};

export const itLayout: LanguageLayout = {
  id: 'it',
  label: 'IT',
  rows: { default: ROWS_DEFAULT },
  longPress: LONG_PRESS
};
