const NON_TEXT_INPUT_TYPES = new Set<string>([
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'range',
  'color',
  'file',
  'image',
  'hidden'
]);

export type ActiveInputKind = 'text' | 'email' | 'numeric' | 'decimal' | 'tel' | 'search';

export type ActiveInputContext = {
  editable: boolean;
  kind: ActiveInputKind;
  multiline: boolean;
};

export const DEFAULT_ACTIVE_INPUT_CONTEXT: ActiveInputContext = {
  editable: false,
  kind: 'text',
  multiline: false
};

const INPUTMODE_KIND: Record<string, ActiveInputKind> = {
  text: 'text',
  email: 'email',
  numeric: 'numeric',
  decimal: 'decimal',
  tel: 'tel',
  search: 'search'
};

const TYPE_KIND: Record<string, ActiveInputKind> = {
  text: 'text',
  email: 'email',
  number: 'numeric',
  tel: 'tel',
  search: 'search'
};

const OTP_AUTOCOMPLETE = 'one-time-code';

const isLikelyNumericPattern = (pattern: string): boolean => {
  const normalized = pattern.trim();
  if (!normalized) return false;
  if (/[a-z]/i.test(normalized)) return false;
  return (
    normalized.includes('\\d') ||
    normalized.includes('[0-9]') ||
    normalized.includes('[\\d]')
  );
};

const inferInputKind = (input: HTMLInputElement): ActiveInputKind => {
  const inputMode = (input.getAttribute('inputmode') || '').toLowerCase().trim();
  if (inputMode && INPUTMODE_KIND[inputMode]) {
    return INPUTMODE_KIND[inputMode];
  }

  const type = (input.getAttribute('type') || input.type || 'text').toLowerCase().trim();
  if (type && TYPE_KIND[type]) {
    return TYPE_KIND[type];
  }

  const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase().trim();
  if (autocomplete === OTP_AUTOCOMPLETE) {
    return 'numeric';
  }

  const pattern = input.getAttribute('pattern') || '';
  if (isLikelyNumericPattern(pattern)) {
    return 'numeric';
  }

  const maxLength = Number(input.getAttribute('maxlength') || input.maxLength || 0);
  if (Number.isFinite(maxLength) && maxLength > 0 && maxLength <= 8) {
    return 'numeric';
  }

  return 'text';
};

export const windowHelpers = {
  getActiveInputContext(element: Element | null | undefined): ActiveInputContext {
    if (!element) return DEFAULT_ACTIVE_INPUT_CONTEXT;
    const el = element as HTMLElement;
    const tag = (el.tagName || '').toLowerCase();
    if (el.isContentEditable) {
      const ariaMultiline = (el.getAttribute('aria-multiline') || '').toLowerCase();
      const dataSingleline = (el.getAttribute('data-singleline') || '').toLowerCase();
      const multiline = !(ariaMultiline === 'false' || dataSingleline === 'true');
      return {
        editable: true,
        kind: 'text',
        multiline
      };
    }
    if (tag === 'textarea') {
      const textarea = el as HTMLTextAreaElement;
      if (textarea.disabled || textarea.readOnly) return DEFAULT_ACTIVE_INPUT_CONTEXT;
      return {
        editable: true,
        kind: 'text',
        multiline: true
      };
    }
    if (tag === 'input') {
      const input = el as HTMLInputElement;
      const type = (input.getAttribute('type') || '').toLowerCase();
      if (NON_TEXT_INPUT_TYPES.has(type)) {
        return DEFAULT_ACTIVE_INPUT_CONTEXT;
      }
      if (input.disabled || input.readOnly) return DEFAULT_ACTIVE_INPUT_CONTEXT;
      return {
        editable: true,
        kind: inferInputKind(input),
        multiline: false
      };
    }
    return DEFAULT_ACTIVE_INPUT_CONTEXT;
  },

  isEditableElement(element: Element | null | undefined): boolean {
    return windowHelpers.getActiveInputContext(element).editable;
  },

  blurActiveElement(): void {
    try {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && typeof activeEl.blur === 'function') {
        activeEl.blur();
      }
    } catch {}
  }
};
