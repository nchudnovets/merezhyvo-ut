import type { OskLayoutChangedDetail } from './layoutEvents';

type RtlState = { rtl: boolean };
const appliedFlag = 'data-osk-dir-applied';

function isHostEditable(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLInputElement) {
    const nonText = new Set([
      'button','submit','reset','checkbox','radio','range','color','file','image','hidden',
    ]);
    return !nonText.has((el.type || '').toLowerCase()) && !el.disabled && !el.readOnly;
  }
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  return false;
}

function applyDir(el: HTMLElement, rtl: boolean): void {
  // Mark that we touched this element
  el.setAttribute(appliedFlag, '1');
  el.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  // Align caret visually according to direction while keeping "logical start"
  (el.style as CSSStyleDeclaration).textAlign = 'start';
}

function clearDir(el: HTMLElement): void {
  if (el.getAttribute(appliedFlag) !== '1') return;
  el.removeAttribute(appliedFlag);
  el.removeAttribute('dir');
  (el.style as CSSStyleDeclaration).removeProperty('text-align');
}

/** Install listeners; returns teardown fn */
export function setupHostRtlDirection(): () => void {
  const state: RtlState = { rtl: false };

  const onLayout = (e: CustomEvent<OskLayoutChangedDetail>): void => {
    state.rtl = e.detail.rtl;
    const el = document.activeElement;
    if (isHostEditable(el)) applyDir(el, state.rtl);
  };

  const onFocusIn = (): void => {
    const el = document.activeElement;
    if (isHostEditable(el)) applyDir(el, state.rtl);
  };

  const onFocusOut = (e: FocusEvent): void => {
    const target = e.target;
    if (isHostEditable(target as Element)) clearDir(target as HTMLElement);
  };

  window.addEventListener('mzr-osk-layout-changed', onLayout as EventListener);
  window.addEventListener('focusin', onFocusIn);
  window.addEventListener('focusout', onFocusOut);

  // Best effort: apply to already-focused element on boot
  onFocusIn();

  return () => {
    window.removeEventListener('mzr-osk-layout-changed', onLayout as EventListener);
    window.removeEventListener('focusin', onFocusIn);
    window.removeEventListener('focusout', onFocusOut);
  };
}
