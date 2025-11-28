import type { LanguageLayout } from '../types';

const ROWS_DEFAULT = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
  ['ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ']
];

export const arLayout: LanguageLayout = {
  id: 'ar',
  label: 'AR',
  rows: { default: ROWS_DEFAULT, shift: ROWS_DEFAULT },
  rtl: true,
  longPress: {}
};
