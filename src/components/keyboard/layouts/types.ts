export type LanguageId =
  | 'en'
  | 'uk'
  | 'de'
  | 'pl'
  | 'es'
  | 'it'
  | 'pt'
  | 'fr'
  | 'tr'
  | 'nl'
  | 'no'
  | 'ro'
  | 'ar';

export type SymbolId = 'symbols1' | 'symbols2';
export type LayoutId = LanguageId | SymbolId;

export type Rows = string[][];

export type LanguageLayout = {
  id: LanguageId;
  label: string;
  rows: {
    default: Rows;
    shift?: Rows;
  };
  rtl?: boolean;
  longPress?: Record<string, string[]>;
};
