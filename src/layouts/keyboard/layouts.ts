export const SPECIAL_KEYS = {
  SHIFT: '{shift}',
  BACKSPACE: '{backspace}',
  TOGGLE_SYMBOLS: '{toggleSymbols}',
  NEXT_LAYOUT: '{nextLayout}',
  SPACE: '{space}',
  ARROW_LEFT: '{arrowLeft}',
  ARROW_RIGHT: '{arrowRight}',
  ENTER: '{enter}'
};

const {
  SHIFT,
  BACKSPACE,
  TOGGLE_SYMBOLS,
  NEXT_LAYOUT,
  SPACE,
  ARROW_LEFT,
  ARROW_RIGHT,
  ENTER
} = SPECIAL_KEYS;

export const layouts = {
  en: {
    name: 'English',
    shortLabel: 'eng',
    rows: [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
      [SHIFT, 'z', 'x', 'c', 'v', 'b', 'n', 'm', BACKSPACE]
    ],
    bottomRow: [TOGGLE_SYMBOLS, '@', NEXT_LAYOUT, SPACE, ARROW_LEFT, ARROW_RIGHT, ENTER]
  },
  uk: {
    name: 'Ukrainian',
    shortLabel: 'укр',
    rows: [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х'],
      ['ф', 'і', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'є'],
      [SHIFT, 'я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', 'ї', 'ґ', BACKSPACE]
    ],
    bottomRow: [TOGGLE_SYMBOLS, '@', NEXT_LAYOUT, SPACE, ARROW_LEFT, ARROW_RIGHT, ENTER]
  },
  symbols: {
    name: 'Symbols',
    shortLabel: '?!$',
    rows: [
      ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
      ['-', '_', '=', '+', '[', ']', '{', '}', '\\', '/'],
      [SHIFT, ';', ':', "'", '"', '<', '>'],
      ['?', '|', '`', '~', ',', '.', BACKSPACE]
    ],
    bottomRow: [TOGGLE_SYMBOLS, '@', NEXT_LAYOUT, SPACE, ARROW_LEFT, ARROW_RIGHT, ENTER]
  }
};
