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

export const windowHelpers = {
  isEditableElement(element: Element | null | undefined): boolean {
    if (!element) return false;
    const el = element as HTMLElement;
    const tag = (el.tagName || '').toLowerCase();
    if (el.isContentEditable) return true;
    if (tag === 'textarea') {
      const textarea = el as HTMLTextAreaElement;
      return !textarea.disabled && !textarea.readOnly;
    }
    if (tag === 'input') {
      const input = el as HTMLInputElement;
      const type = (input.getAttribute('type') || '').toLowerCase();
      if (NON_TEXT_INPUT_TYPES.has(type)) {
        return false;
      }
      return !input.disabled && !input.readOnly;
    }
    return false;
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
