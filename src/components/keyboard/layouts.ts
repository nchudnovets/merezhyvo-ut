// src/keyboard/layouts.ts
// Backward-compatible exports + new languages.
// Provides: LayoutId (incl. 'symbols1'|'symbols2'), LANGUAGE_LAYOUT_IDS (languages only),
// humanLabel, isRTL, LONG_PRESS, longPressMap (alias), resolveLayoutRows,
// nextLayoutId, isSymbols, and OskContext.

import React from 'react';

// --- Types --------------------------------------------------------------

export type LanguageId =
  | 'en' | 'uk' | 'de' | 'pl'
  | 'es' | 'it' | 'pt' | 'fr' | 'tr' | 'nl' | 'ro' | 'ar';

export type SymbolId = 'symbols1' | 'symbols2';

// LayoutId intentionally includes symbols pages for backward-compat
export type LayoutId = LanguageId | SymbolId;

type Rows = string[][];

// --- Language registry --------------------------------------------------

export const LANGUAGE_LAYOUT_IDS: readonly LanguageId[] = [
  'en', 'uk', 'de', 'pl',
  'es', 'it', 'pt', 'fr', 'tr', 'nl', 'ro', 'ar'
] as const;

// Symbols pages are NOT part of the selectable languages list
export const SYMBOL_LAYOUT_IDS: readonly SymbolId[] = ['symbols1', 'symbols2'] as const;

export function humanLabel(id: LayoutId): string {
  switch (id) {
    case 'en': return 'EN';
    case 'uk': return 'UK';
    case 'de': return 'DE';
    case 'pl': return 'PL';
    case 'es': return 'ES';
    case 'it': return 'IT';
    case 'pt': return 'PT';
    case 'fr': return 'FR';
    case 'tr': return 'TR';
    case 'nl': return 'NL';
    case 'ro': return 'RO';
    case 'ar': return 'AR';
    case 'symbols1': return 'SYM1';
    case 'symbols2': return 'SYM2';
  }
}

// Only Arabic is RTL here
export function isRTL(id: LayoutId): boolean {
  return id === 'ar';
}

export function isSymbols(id: LayoutId): id is SymbolId {
  return id === 'symbols1' || id === 'symbols2';
}

// --- Long-press maps ----------------------------------------------------

export const LONG_PRESS: Record<LanguageId, Record<string, string[]>> = {
  // English
  en: {
    a: ["á","à","ä","â","ã","å"],
    e: ["é","è","ë","ê"],
    i: ["í","ï","î"],
    o: ["ó","ö","ô","õ"],
    u: ["ú","ü","û"],
    c: ["ç"],
    n: ["ñ"],
    "'": ["ʼ"]
  },

  // Ukrainian (apostrophe, ґ, ₴)
  uk: {
    "'": ["ʼ"],
    г: ["ґ"],
    Г: ["Ґ"],
    $: ["₴"]
  },

  // German
  de: {
    a: ["ä"], A: ["Ä"],
    o: ["ö"], O: ["Ö"],
    u: ["ü"], U: ["Ü"],
    s: ["ß"]
  },

  // Polish
  pl: {
    a: ["ą"], A: ["Ą"],
    c: ["ć"], C: ["Ć"],
    e: ["ę"], E: ["Ę"],
    l: ["ł"], L: ["Ł"],
    n: ["ń"], N: ["Ń"],
    o: ["ó"], O: ["Ó"],
    s: ["ś"], S: ["Ś"],
    z: ["ż","ź"], Z: ["Ż","Ź"]
  },

  // Spanish
  es: {
    a: ["á"],
    e: ["é"],
    i: ["í"],
    o: ["ó"],
    u: ["ú","ü"],
    n: ["ñ"],
    "?": ["¿"],
    "!": ["¡"]
  },

  // Italian
  it: {
    a: ["à"],
    e: ["è","é"],
    i: ["ì"],
    o: ["ò"],
    u: ["ù"]
  },

  // Portuguese (generic)
  pt: {
    a: ["á","à","ã","â"],
    e: ["é","ê"],
    i: ["í"],
    o: ["ó","ô","õ"],
    u: ["ú"],
    c: ["ç"]
  },

  // French
  fr: {
    a: ["à","â","æ"],
    e: ["é","è","ê","ë"],
    i: ["î","ï"],
    o: ["ô","œ"],
    u: ["ù","û","ü"],
    c: ["ç"],
    y: ["ÿ"]
  },

  // Turkish
  tr: {
    g: ["ğ"], G: ["Ğ"],
    s: ["ş"], S: ["Ş"],
    i: ["ı","İ"],
    o: ["ö"], O: ["Ö"],
    u: ["ü"], U: ["Ü"],
    c: ["ç"], C: ["Ç"]
  },

  // Dutch
  nl: {
    a: ["á","ä","â"],
    e: ["é","ë","è"],
    i: ["í","ï"],
    o: ["ó","ö","ô"],
    u: ["ú","ü","û"]
  },

  // Romanian
  ro: {
    a: ["ă","â"], A: ["Ă","Â"],
    i: ["î"],     I: ["Î"],
    s: ["ș","ş"], S: ["Ș","Ş"],
    t: ["ț","ţ"], T: ["Ț","Ţ"]
  },

  // Arabic – handled via Arabic alpha rows; keep empty
  ar: {}
};

// Back-compat alias (some files import this name)
export const longPressMap = LONG_PRESS;

// --- Alpha rows ---------------------------------------------------------

const EN_ROWS_DEFAULT: Rows = [
  ["q","w","e","r","t","y","u","i","o","p"],
  ["a","s","d","f","g","h","j","k","l"],
  ["z","x","c","v","b","n","m"]
];
const EN_ROWS_SHIFT: Rows = EN_ROWS_DEFAULT.map(r => r.map(k => k.toUpperCase()));

// Ukrainian (mobile-like, close to Maliit; includes ʼ on third row)
const UK_ROWS_DEFAULT: Rows = [
  ["й","ц","у","к","е","н","г","ш","щ","з","х","ї"],
  ["ф","і","в","а","п","р","о","л","д","ж","є"],
  ["я","ч","с","м","и","т","ь","б","ю","ʼ"]
];
const UK_ROWS_SHIFT: Rows = UK_ROWS_DEFAULT.map(r => r.map(k => k.toUpperCase()));

// Arabic 101-like rows (no uppercase)
const AR_ROWS_DEFAULT: Rows = [
  ["ض","ص","ث","ق","ف","غ","ع","ه","خ","ح","ج","د"],
  ["ش","س","ي","ب","ل","ا","ت","ن","م","ك","ط"],
  ["ئ","ء","ؤ","ر","لا","ى","ة","و","ز","ظ"]
];
const AR_ROWS_SHIFT: Rows = AR_ROWS_DEFAULT;

// Hook to plug custom rows if you already have them for uk/de/pl etc.
const CUSTOM_ROWS: Partial<Record<LanguageId, { default: Rows; shift: Rows }>> = {
  uk: { default: UK_ROWS_DEFAULT, shift: UK_ROWS_SHIFT },
  ar: { default: AR_ROWS_DEFAULT, shift: AR_ROWS_SHIFT }
  // Add de/pl/es/... here when you introduce their native rows.
};

export function alphaRowsFor(id: LanguageId, shift: boolean): Rows {
  const custom = CUSTOM_ROWS[id];
  if (custom) return shift ? custom.shift : custom.default;
  return shift ? EN_ROWS_SHIFT : EN_ROWS_DEFAULT;
}

// --- Symbols rows (two pages, like Maliit 1/2) --------------------------

const SYMBOLS_ROWS_1: Rows = [
  ["1","2","3","4","5","6","7","8","9","0"],
  ["@","#","$","%","*","-","_","+","/","\\"],
  ["(",")","?", "!", ".", ",",";","'", "\"",":"]
];

const SYMBOLS_ROWS_2: Rows = [
  ["~","`","^","|","•","…","€","£","¥","₴"],
  ["<",">","=","±","×","÷","§","°","&","¢"],
  ["[","]","{","}","¿", "¡", "©", "®", "™", "¶"]
];

// --- Resolve rows (back-compat replacement for resolveLayoutRows) -------

export function resolveLayoutRows(layoutId: LayoutId, shift: boolean): Rows {
  if (layoutId === 'symbols1') return SYMBOLS_ROWS_1;
  if (layoutId === 'symbols2') return SYMBOLS_ROWS_2;
  // Otherwise treat as language id
  const lang = layoutId as LanguageId;
  return alphaRowsFor(lang, shift);
}

// --- Cycling helper -----------------------------------------------------

export function nextLayoutId(current: LayoutId, enabled: LayoutId[]): LayoutId {
  if (!enabled || enabled.length === 0) return 'en';
  const idx = enabled.indexOf(current);
  if (idx === -1) return enabled[0] as LayoutId;

  const n = (idx + 1) % enabled.length;
  const val = enabled[n] as LayoutId | undefined;
  return (val ?? enabled[0] ?? 'en') as LayoutId;
}

// --- Back-compat context ------------------------------------------------

export interface OskContextValue {
  longPress: typeof LONG_PRESS;
}

// Some code imports OskContext from layouts.ts; provide a harmless default.
export const OskContext = React.createContext<OskContextValue>({
  longPress: LONG_PRESS
});
