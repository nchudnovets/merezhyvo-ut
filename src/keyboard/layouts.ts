export type OskContext = 'text' | 'email' | 'url' | 'password';
export type LangId = 'en' | 'uk' | 'de' | 'pl';
export type LayoutId = LangId | 'symbols1' | 'symbols2';

export const isSymbols = (id: LayoutId) => id === 'symbols1' || id === 'symbols2';

const HUMAN: Record<LangId, string> = {
  en: 'EN', uk: 'UK', de: 'DE', pl: 'PL'
};
export const humanLabel = (id: LayoutId): string => {
  if (isSymbols(id)) return 'SYM';
  return HUMAN[id as LangId] || 'EN';
};

export const nextLayoutId = (curr: LayoutId, enabled: LayoutId[]): LayoutId => {
  const langs = enabled.filter(l => !isSymbols(l)) as LangId[];
  const i = Math.max(0, langs.indexOf((isSymbols(curr) ? langs[0] : curr) as LangId));
  return langs[(i + 1) % Math.max(langs.length, 1)] || 'en';
};

// --- Базові ряди (спрощено; підганяли під Maliit)
const EN: string[] = [
  'q w e r t y u i o p',
  'a s d f g h j k l',
  '{shift} z x c v b n m {bksp}',
  '{symbols} {lang} {space} {arrowleft} {arrowright} {enter}'
];

const UK: string[] = [
  'й ц у к е н г ш щ з х ї',
  'ф і в а п р о л д ж є',
  '{shift} я ч с м и т ь б ю {bksp}',
  '{symbols} {lang} {space} {arrowleft} {arrowright} {enter}'
];

const DE: string[] = [
  'q w e r t z u i o p',
  'a s d f g h j k l',
  '{shift} y x c v b n m {bksp}',
  '{symbols} {lang} {space} {arrowleft} {arrowright} {enter}'
];

const PL: string[] = [
  'q w e r t y u i o p',
  'a s d f g h j k l',
  '{shift} z x c v b n m {bksp}',
  '{symbols} {lang} {space} {arrowleft} {arrowright} {enter}'
];

// --- Символи: сторінка 1 (часті)
const SYM1: string[] = [
  '1 2 3 4 5 6 7 8 9 0',
  `@ # $ % & * ( ) - _`,
  `! ? : ; ' " , . / \\ |`,
  '{sym12} {lang} {space} {arrowleft} {arrowright} {enter} {bksp} {abc}'
];

// --- Символи: сторінка 2 (рідші, валюти, лапки, тире)
const SYM2: string[] = [
  '€ £ ₴ ¥ • … — – _',
  '§ + = ~ ^ < > [ ]',
  '« » “ ” ’ ʼ ° ¶ © ®',
  '{sym12} {lang} {space} {arrowleft} {arrowright} {enter} {bksp} {abc}'
];

export const resolveLayoutRows = (id: LayoutId, _ctx: OskContext): string[] => {
  switch (id) {
    case 'en': return EN;
    case 'uk': return UK;
    case 'de': return DE;
    case 'pl': return PL;
    case 'symbols1': return SYM1;
    case 'symbols2': return SYM2;
    default: return EN;
  }
};

// --- Long-press альтернативи (мінімально необхідне + приклади)
export const longPressMap: Record<string, string[]> = {
  // апостроф: ASCII → укр. апостроф (U+02BC) → типографський ’
  "'": ['ʼ','’'],

  // укр. специфіка
  'г': ['ґ'], 'Г': ['Ґ'],
  'і': ['ї','І','Ї'], 'И': ['І'], 'и': ['і'],
  'є': ['Є'],

  // латиниця (приклади)
  'a': ['á','à','â','ä','å','ā'], 'A': ['Á','À','Â','Ä','Å','Ā'],
  'e': ['é','è','ê','ë','ē'],     'E': ['É','È','Ê','Ë','Ē'],
  'i': ['í','ì','î','ï','ī'],     'I': ['Í','Ì','Î','Ï','Ī'],
  'o': ['ó','ò','ô','ö','ō'],     'O': ['Ó','Ò','Ô','Ö','Ō'],
  'u': ['ú','ù','û','ü','ū'],     'U': ['Ú','Ù','Û','Ü','Ū'],

  // тире / дефіси
  '-': ['–','—','-'],

  // лапки
  '"': ['“','”','„','«','»'],

  // гривня на довге натискання $
  '$': ['₴']
};

export const LANGUAGE_LAYOUT_IDS = (Object.keys({ en:1, uk:1, de:1, pl:1 }) as LangId[]);
