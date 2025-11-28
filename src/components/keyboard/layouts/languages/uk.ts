import type { LanguageLayout } from '../types';

const ROWS_DEFAULT = [
  ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ї'],
  ['ф', 'і', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'є'],
  ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', 'ʼ']
];

const LONG_PRESS: Record<string, string[]> = {
  "'": ['ʼ'],
  г: ['ґ'],
  Г: ['Ґ'],
  $: ['₴']
};

export const ukLayout: LanguageLayout = {
  id: 'uk',
  label: 'UK',
  rows: { default: ROWS_DEFAULT },
  longPress: LONG_PRESS
};
