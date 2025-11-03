import { ipc } from '../../services/ipc/ipc';

declare global {
  interface HTMLElementTagNameMap {
    'webview': Electron.WebviewTag & {
      getWebContentsId(): number;
      executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
    };
  }
}

export type ArrowDir = 'ArrowLeft' | 'ArrowRight';

export interface WebInjects {
  isActiveMultiline(): Promise<boolean>;
  text(text: string): Promise<boolean>;
  backspace(): Promise<boolean>;
  enter(): Promise<boolean>;
  arrow(dir: ArrowDir): Promise<boolean>;
  // Backward-compatible aliases:
  injectTextToWeb(text: string): Promise<boolean>;
  injectBackspaceToWeb(): Promise<boolean>;
  injectEnterToWeb(): Promise<boolean>;
  injectArrowToWeb(dir: ArrowDir): Promise<boolean>;
}

export type GetWebview = () => HTMLElementTagNameMap['webview'] | null;

/**
 * Kept for potential future use; underscore to satisfy no-unused-vars.
 */
const _ENSURE_EDITABLE_FOCUS_JS = `
(function(){
  const nonText = new Set(['button','submit','reset','checkbox','radio','range','color','file','image','hidden']);
  const isEditable = (el) => {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const t = (el.tagName||'').toLowerCase();
    if (t === 'textarea') return !el.disabled && !el.readOnly;
    if (t === 'input') {
      const type = (el.getAttribute('type')||'').toLowerCase();
      if (nonText.has(type)) return false;
      return !el.disabled && !el.readOnly;
    }
    return false;
  };
  let el = document.activeElement;
  if (!isEditable(el) && window.__mzrOskLastEditable && isEditable(window.__mzrOskLastEditable)) {
    try { window.__mzrOskLastEditable.focus(); } catch {}
    el = document.activeElement;
  }
  return isEditable(el);
})()
`;

const _IS_ACTIVE_MULTILINE_JS = `
(function(){
  const el = document.activeElement;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const t = (el.tagName||'').toLowerCase();
  if (t === 'textarea') return true;
  return false;
})()
`;

/* =========================
   MAIN (host window) INJECTS
   ========================= */

export function makeMainInjects() {
  const getActive = (): HTMLElement | null => {
    const el = document.activeElement;
    return el instanceof HTMLElement ? el : null;
  };

  const isTextual = (el: HTMLElement | null): boolean => {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const t = ((el as HTMLInputElement).type || '').toLowerCase();
      const nonText = new Set([
        'button', 'submit', 'reset', 'checkbox', 'radio',
        'range', 'color', 'file', 'image', 'hidden',
      ]);
      return !nonText.has(t);
    }
    return false;
  };

  const refocus = (el: HTMLElement): void => {
    try {
      // Prefer not to scroll layout while keeping the caret visible
      el.focus({ preventScroll: true });
    } catch {
      try { el.focus(); } catch { /* no-op */ }
    }
  };

  const text = async (s: string): Promise<void> => {
    const el = getActive();
    if (!isTextual(el) || !el) return;

    const tag = (el.tagName || '').toLowerCase();

    if (tag === 'textarea' || tag === 'input') {
      const ip = el as HTMLInputElement | HTMLTextAreaElement;
      const val = String(ip.value ?? '');
      const start = typeof ip.selectionStart === 'number' ? ip.selectionStart : val.length;
      const end   = typeof ip.selectionEnd   === 'number' ? ip.selectionEnd   : start;

      if (typeof ip.setRangeText === 'function') {
        ip.setRangeText(s, start, end, 'end');
      } else {
        ip.value = val.slice(0, start) + s + val.slice(end);
        const pos = start + s.length;
        ip.setSelectionRange?.(pos, pos);
      }

      ip.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: s, bubbles: true }));

      if ((ip.type || '').toLowerCase() === 'email') {
        ip.dispatchEvent(new Event('change', { bubbles: true }));
      }

      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      refocus(ip);
      return;
    }

    // contenteditable
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(s));
      range.collapse(false);
      el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: s, bubbles: true }));
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      refocus(el);
    }
  };

  const backspace = async (): Promise<void> => {
    const el = getActive();
    if (!isTextual(el) || !el) return;

    const tag = (el.tagName || '').toLowerCase();

    if (tag === 'textarea' || tag === 'input') {
      const ip = el as HTMLInputElement | HTMLTextAreaElement;
      const val = String(ip.value ?? '');
      const start = typeof ip.selectionStart === 'number' ? ip.selectionStart : val.length;
      const end   = typeof ip.selectionEnd   === 'number' ? ip.selectionEnd   : start;
      if (start === 0 && end === 0) return;

      const delStart = start === end ? Math.max(0, start - 1) : Math.min(start, end);
      const delEnd   = Math.max(start, end);

      if (typeof ip.setRangeText === 'function') {
        ip.setRangeText('', delStart, delEnd, 'end');
      } else {
        const before = val.slice(0, delStart);
        const after  = val.slice(delEnd);
        ip.value = before + after;
        ip.setSelectionRange?.(before.length, before.length);
      }

      ip.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));

      if ((ip.type || '').toLowerCase() === 'email') {
        ip.dispatchEvent(new Event('change', { bubbles: true }));
      }

      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      refocus(ip);
      return;
    }

    // contenteditable
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (!range.collapsed) {
        range.deleteContents();
      } else {
        range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
        range.deleteContents();
      }
      el.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      refocus(el);
    }
  };

  const enter = async (): Promise<void> => {
    const el = getActive();
    if (!el) return;

    if (!isTextual(el)) {
      const formEl = el instanceof HTMLElement ? el.closest('form') : null;
      if (formEl && formEl instanceof HTMLFormElement) {
        if (typeof formEl.requestSubmit === 'function') formEl.requestSubmit();
        else formEl.submit();
      }
      return;
    }

    const tag = (el.tagName || '').toLowerCase();

    if (el.isContentEditable) {
      let viaCommand = false;
      try {
        viaCommand = document.execCommand('insertLineBreak');
      } catch {
        /* ignore */
      }
      if (!viaCommand) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const br = document.createElement('br');
          range.insertNode(br);
          range.setStartAfter(br);
          range.collapse(true);
          document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
        }
      }
      el.dispatchEvent(new InputEvent('input', { inputType: 'insertLineBreak', bubbles: true }));
      refocus(el);
      return;
    }

    if (tag === 'textarea') {
      const ip = el as HTMLTextAreaElement;
      const val = String(ip.value ?? '');
      const s = typeof ip.selectionStart === 'number' ? ip.selectionStart : val.length;
      const e = typeof ip.selectionEnd   === 'number' ? ip.selectionEnd   : s;
      if (typeof ip.setRangeText === 'function') {
        ip.setRangeText('\n', s, e, 'end');
      } else {
        ip.value = val.slice(0, s) + '\n' + val.slice(e);
        ip.setSelectionRange?.(s + 1, s + 1);
      }
      ip.dispatchEvent(new InputEvent('input', { inputType: 'insertLineBreak', bubbles: true }));
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      refocus(ip);
      return;
    }

    const formEl = el instanceof HTMLElement ? el.closest('form') : null;
    if (formEl && formEl instanceof HTMLFormElement) {
      if (typeof formEl.requestSubmit === 'function') formEl.requestSubmit();
      else formEl.submit();
    }
  };

  const arrow = async (dir: ArrowDir): Promise<void> => {
    const el = getActive();
    if (!isTextual(el) || !el) return;

    const tag = (el.tagName || '').toLowerCase();

    if (tag === 'textarea' || tag === 'input') {
      const ip = el as HTMLInputElement | HTMLTextAreaElement;
      const val = String(ip.value ?? '');
      const s = typeof ip.selectionStart === 'number' ? ip.selectionStart : val.length;
      const e = typeof ip.selectionEnd   === 'number' ? ip.selectionEnd   : s;

      const pos = s !== e
        ? (dir === 'ArrowLeft' ? Math.min(s, e) : Math.max(s, e))
        : (dir === 'ArrowLeft' ? Math.max(0, s - 1) : Math.min(val.length, s + 1));

      ip.setSelectionRange?.(pos, pos);
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      refocus(ip);
      return;
    }

    // contenteditable: move by 1 code unit manually
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      if (!sel.isCollapsed) {
        if (dir === 'ArrowLeft') sel.collapseToStart();
        else sel.collapseToEnd();
      } else {
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        let off = range.startOffset + (dir === 'ArrowLeft' ? -1 : 1);
        if (node.nodeType === Node.TEXT_NODE) {
          const len = node.textContent?.length ?? 0;
          off = Math.max(0, Math.min(len, off));
          range.setStart(node, off);
          range.collapse(true);
        }
      }
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      refocus(el);
    }
  };

  return {
    text,
    backspace,
    enter,
    arrow,
    injectTextToMain: text,
    injectBackspaceToMain: backspace,
    injectEnterToMain: enter,
    injectArrowToMain: arrow,
  };
}

/* =========================
   WEBVIEW INJECTS
   ========================= */

export function makeWebInjects(
  getActiveWebview: () => HTMLElementTagNameMap['webview'] | null
): WebInjects {
  const getWcId = (): number | null => {
    const wv = getActiveWebview();
    return wv ? wv.getWebContentsId() : null;
  };

  const sendCharsTrusted = async (text: string): Promise<boolean> => {
    const wcId = getWcId();
    if (wcId == null) return false;
    for (const ch of Array.from(String(text))) {
      await ipc.osk.char(wcId, ch);
    }
    return true;
  };

  const sendKeyTrusted = async (key: string): Promise<boolean> => {
    const wcId = getWcId();
    if (wcId == null) return false;
    await ipc.osk.key(wcId, key);
    return true;
  };

  const isActiveMultiline = async (): Promise<boolean> => {
    const wv = getActiveWebview();
    if (!wv) return false;
    const probe = `
      (function () {
        try {
          var el = document.activeElement;
          if (!el) return false;

          // Dive into same-origin iframe once if possible
          try {
            if (el.tagName === 'IFRAME' && el.contentWindow && el.contentWindow.document) {
              el = el.contentWindow.document.activeElement || el;
            }
          } catch (_) {}

          // Textarea is multiline by definition
          if (el.tagName === 'TEXTAREA') return true;

          // Contenteditable often acts as multiline editor
          if (el.isContentEditable === true) {
            var aria = (el.getAttribute('aria-multiline') || '').toLowerCase();
            var single = (el.getAttribute('data-singleline') || '').toLowerCase();
            if (aria === 'false' || single === 'true') return false;
            return true;
          }

          // CSS white-space that preserves newlines may indicate multiline behavior
          var ws = getComputedStyle(el).whiteSpace;
          if (ws === 'pre' || ws === 'pre-wrap' || ws === 'break-spaces') return true;

          return false;
        } catch (e) {
          return false;
        }
      })();
    `;
    const result = await wv.executeJavaScript(probe);
    return Boolean(result);
  };

  const text = async (value: string): Promise<boolean> => {
    if (value.length === 0) return true;
    return sendCharsTrusted(value);
  };

  const backspace = async (): Promise<boolean> => {
    return sendKeyTrusted('Backspace');
  };

  const enter = async (): Promise<boolean> => {
    // Real Enter key: on textarea inserts newline; on "search" fields triggers site submit.
    return sendKeyTrusted('Enter');
  };

  const arrow = async (dir: ArrowDir): Promise<boolean> => {
    return sendKeyTrusted(dir);
  };

  return {
    isActiveMultiline,
    text,
    backspace,
    enter,
    arrow,
    // Backward-compatible aliases:
    injectTextToWeb: text,
    injectBackspaceToWeb: backspace,
    injectEnterToWeb: enter,
    injectArrowToWeb: arrow,
  };
}

/* =========================
   PROBE (webview): is there an editable element active?
   ========================= */

export async function probeWebEditable(getWebview: GetWebview): Promise<boolean> {
  const wv = getWebview();
  if (!wv) return false;
  try {
    const code = `
      (function(){
        try{
          var el = document.activeElement;
          if(!el) return false;
          var tag = (el.tagName||'').toLowerCase();
          var type = (el.getAttribute ? (el.getAttribute('type')||'').toLowerCase() : '');
          var nonText = {'button':1,'submit':1,'reset':1,'checkbox':1,'radio':1,'range':1,'color':1,'file':1,'image':1,'hidden':1};
          return !!(el.isContentEditable || tag==='textarea' || (tag==='input' && !nonText[type]));
        }catch(e){ return false; }
      })();
    `;
    const result = await wv.executeJavaScript(code, false);
    return Boolean(result);
  } catch {
    return false;
  }
}

export type MainInjects = ReturnType<typeof makeMainInjects>;
