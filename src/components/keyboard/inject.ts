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
  hasSelection(): Promise<boolean>;
  getSelectionRect(): Promise<{ left: number; top: number; width: number; height: number } | null>;
  clearSelection(): Promise<boolean>;
  getSelectionTouchState(): Promise<{ touching: boolean; lastTouchTs: number }>;
  pollMenuRequest(): Promise<{ x: number; y: number } | null>;
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

  const ensureCaretVisible = (ip: HTMLInputElement | HTMLTextAreaElement, pos: number): void => {
    try {
      const style = getComputedStyle(ip);
      const padL = parseFloat(style.paddingLeft || '0') || 0;
      const padR = parseFloat(style.paddingRight || '0') || 0;
      const canvas: HTMLCanvasElement =
        (window as any).__mzrCaretCanvas || ((window as any).__mzrCaretCanvas = document.createElement('canvas'));
      const ctx = canvas?.getContext && canvas.getContext('2d');
      if (ctx) {
        const font = `${style.fontWeight || ''} ${style.fontSize || ''} ${style.fontFamily || ''}`.trim();
        if (font) ctx.font = font;
        const before = ip.value.slice(0, pos);
        const lineText = (ip.tagName || '').toLowerCase() === 'textarea'
          ? (before.split('\n').pop() || '')
          : before;
        const caretX = ctx.measureText(lineText).width;
        const viewLeft = ip.scrollLeft;
        const visibleWidth = Math.max(0, ip.clientWidth - padL - padR);
        const viewRight = viewLeft + visibleWidth;
        if (caretX <= 1) {
          ip.scrollLeft = 0;
        } else if (caretX < viewLeft + 2) {
          ip.scrollLeft = Math.max(0, caretX - 4);
        } else if (caretX > viewRight - 2) {
          ip.scrollLeft = Math.max(0, caretX - visibleWidth + 4);
        }
      }

      if ((ip.tagName || '').toLowerCase() === 'textarea') {
        const padT = parseFloat(style.paddingTop || '0') || 0;
        const padB = parseFloat(style.paddingBottom || '0') || 0;
        const borderT = parseFloat(style.borderTopWidth || '0') || 0;
        const borderB = parseFloat(style.borderBottomWidth || '0') || 0;
        const lineHeightRaw = style.lineHeight;
        let lineHeight = parseFloat(lineHeightRaw || '');
        if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
          const fontSize = parseFloat(style.fontSize || '16') || 16;
          lineHeight = Math.round(fontSize * 1.3);
        }
        const textBefore = ip.value.slice(0, pos);
        const lineIndex = textBefore.split('\n').length - 1;
        const caretTop = lineIndex * lineHeight + padT + borderT;
        const viewTop = ip.scrollTop;
        const viewBottom = viewTop + ip.clientHeight - padB - borderB;
        if (caretTop < viewTop) {
          ip.scrollTop = Math.max(0, caretTop - 4);
        } else if (caretTop + lineHeight > viewBottom) {
          const visibleHeight = ip.clientHeight - padB - borderB;
          ip.scrollTop = Math.max(0, caretTop - visibleHeight + lineHeight + 4);
        }
      }
    } catch {
      // best-effort
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

      const caretPos = typeof ip.selectionStart === 'number' ? ip.selectionStart : start + s.length;
      ensureCaretVisible(ip, caretPos);
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

      const caretPos = typeof ip.selectionStart === 'number' ? ip.selectionStart : delStart;
      ensureCaretVisible(ip, caretPos);
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
      const caretPos = typeof ip.selectionStart === 'number' ? ip.selectionStart : s + 1;
      ensureCaretVisible(ip, caretPos);
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
      ensureCaretVisible(ip, pos);
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
  const shouldUseDomInjection = (): boolean => {
    try {
      const wv = getActiveWebview();
      if (!wv) return false;
      const raw = typeof wv.getURL === 'function' ? wv.getURL() : '';
      const url = new URL(raw || 'http://localhost');
      const host = (url.hostname || '').toLowerCase();
      return host.endsWith('duckduckgo.com') || host === 'duck.com';
    } catch {
      return false;
    }
  };

  const injectViaDom = async (txt: string): Promise<boolean> => {
    const wv = getActiveWebview();
    if (!wv) return false;
    const payload = JSON.stringify(txt);
    const code = `
      (function(t){
        try{
          var nonText = {'button':1,'submit':1,'reset':1,'checkbox':1,'radio':1,'range':1,'color':1,'file':1,'image':1,'hidden':1};
          var el = document.activeElement;
          if(!el) { console.info('[osk-inject] no active el'); return false; }
          var tag = (el.tagName||'').toLowerCase();
          var type = (el.getAttribute ? (el.getAttribute('type')||'').toLowerCase() : '');
          var isText = el.isContentEditable || tag==='textarea' || (tag==='input' && !nonText[type]);
          if(!isText) { console.info('[osk-inject] nonText', {tag,type}); return false; }
          if(tag==='textarea' || tag==='input'){
            var ip = el;
            var val = String(ip.value||'');
            var s = typeof ip.selectionStart==='number' ? ip.selectionStart : val.length;
            var e = typeof ip.selectionEnd==='number' ? ip.selectionEnd : s;
            if(typeof ip.setRangeText==='function'){
              ip.setRangeText(t,s,e,'end');
            } else {
              ip.value = val.slice(0,s) + t + val.slice(e);
              var pos = s + t.length;
              if (ip.setSelectionRange) ip.setSelectionRange(pos,pos);
            }
            ip.dispatchEvent(new InputEvent('input',{inputType:'insertText',data:t,bubbles:true}));
            document.dispatchEvent(new Event('selectionchange',{bubbles:true}));
            try{ ip.focus({preventScroll:true}); }catch(_){ try{ ip.focus(); }catch(__){} }
            console.info('[osk-inject] ok input', { tag, type, len: ip.value.length });
            return true;
          }
          var sel = window.getSelection && window.getSelection();
          if(sel && sel.rangeCount>0){
            var range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(t));
            range.collapse(false);
            el.dispatchEvent(new InputEvent('input',{inputType:'insertText',data:t,bubbles:true}));
            document.dispatchEvent(new Event('selectionchange',{bubbles:true}));
            try{ el.focus({preventScroll:true}); }catch(_){ try{ el.focus(); }catch(__){} }
            console.info('[osk-inject] ok contenteditable');
            return true;
          }
          console.info('[osk-inject] fallback failed');
          return false;
        }catch(e){ console.info('[osk-inject] error', e && e.message ? e.message : e); return false; }
      })(${payload});
    `;
    try {
      const res = await wv.executeJavaScript(code, false);
      return Boolean(res);
    } catch {
      return false;
    }
  };
  const ensureEditableFocus = async (): Promise<boolean> => {
    const wv = getActiveWebview();
    if (!wv) return false;
    const code = `
      (function(){
        try{
          var nonText = {'button':1,'submit':1,'reset':1,'checkbox':1,'radio':1,'range':1,'color':1,'file':1,'image':1,'hidden':1};
          function isEditable(el){
            if(!el) return false;
            if(el.isContentEditable) return true;
            var tag = (el.tagName||'').toLowerCase();
            if(tag==='textarea') return !el.disabled && !el.readOnly;
            if(tag==='input'){
              var type = (el.getAttribute('type')||'').toLowerCase();
              if(nonText[type]) return false;
              return !el.disabled && !el.readOnly;
            }
            return false;
          }
          var el = document.activeElement;
          if(!isEditable(el) && window.__mzrLastEditable && isEditable(window.__mzrLastEditable)){
            try { window.__mzrLastEditable.focus({ preventScroll: true }); el = window.__mzrLastEditable; } catch(e) { try{ window.__mzrLastEditable.focus(); el = window.__mzrLastEditable; }catch(_){} }
          }
          if(isEditable(el)){
            try { el.focus({ preventScroll: true }); } catch(e) { try{ el.focus(); }catch(_){} }
            return true;
          }
          return false;
        }catch(e){ return false; }
      })();
    `;
    try {
      const res = await wv.executeJavaScript(code, false);
      return Boolean(res);
    } catch {
      return false;
    }
  };

  const sendCharsTrusted = async (text: string): Promise<boolean> => {
    const useDom = shouldUseDomInjection();
    if (useDom) {
      const ok = await injectViaDom(text);
      if (ok) return true;
    }
    const wcId = getWcId();
    if (wcId == null) return false;
    await ensureEditableFocus();
    await ipc.osk.char(wcId, String(text));
    // Ensure focus stays inside the active editable
    await ensureEditableFocus();
    return true;
  };

  const sendKeyTrusted = async (key: string): Promise<boolean> => {
    const wcId = getWcId();
    if (wcId == null) return false;
    await ensureEditableFocus();
    await ipc.osk.key(wcId, key);
    // Ensure focus stays inside the active editable
    await ensureEditableFocus();
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

  const detectEnterMode = async (): Promise<'newline' | 'submit'> => {
    const wv = getActiveWebview();
    if (!wv) return 'submit';
    const probe = `
      (function () {
        try {
          const nonText = { button:1, submit:1, reset:1, checkbox:1, radio:1, range:1, color:1, file:1, image:1, hidden:1 };
          const singleLineRoles = { searchbox:1, combobox:1, textbox:1 };
          function isSingleLineEditable(el) {
            if (!el) return false;
            const tag = (el.tagName || '').toLowerCase();
            if (tag === 'textarea') {
              const rows = Number(el.getAttribute('rows') || 0);
              if (rows > 1) return false;
              const aria = (el.getAttribute('aria-multiline') || '').toLowerCase();
              if (aria === 'true') return false;
              return true;
            }
            if (tag === 'input') {
              const type = (el.getAttribute('type') || '').toLowerCase();
              if (nonText[type]) return false;
              const role = (el.getAttribute('role') || '').toLowerCase();
              const aria = (el.getAttribute('aria-multiline') || '').toLowerCase();
              const dataSingle = (el.getAttribute('data-singleline') || '').toLowerCase();
              if (aria === 'true') return false;
              if (role && singleLineRoles[role]) return true;
              if (dataSingle === 'true') return true;
              const inputMode = (el.getAttribute('inputmode') || '').toLowerCase();
              if (inputMode === 'search') return true;
              return true;
            }
            if (el.isContentEditable) {
              const aria = (el.getAttribute('aria-multiline') || '').toLowerCase();
              const dataSingle = (el.getAttribute('data-singleline') || '').toLowerCase();
              if (aria === 'false' || dataSingle === 'true') return true;
              return false;
            }
            return true;
          }
          function isMultilineEditable(el) {
            if (!el) return false;
            const tag = (el.tagName || '').toLowerCase();
            if (tag === 'textarea') {
              const aria = (el.getAttribute('aria-multiline') || '').toLowerCase();
              if (aria === 'false') return false;
              const rows = Number(el.getAttribute('rows') || 0);
              return rows !== 1;
            }
            if (el.isContentEditable) {
              const aria = (el.getAttribute('aria-multiline') || '').toLowerCase();
              const dataSingle = (el.getAttribute('data-singleline') || '').toLowerCase();
              if (aria === 'false' || dataSingle === 'true') return false;
              const ws = getComputedStyle(el).whiteSpace;
              if (ws === 'pre' || ws === 'pre-wrap' || ws === 'break-spaces') return true;
              return true;
            }
            if (tag === 'input') {
              const type = (el.getAttribute('type') || '').toLowerCase();
              if (nonText[type]) return false;
              const aria = (el.getAttribute('aria-multiline') || '').toLowerCase();
              if (aria === 'true') return true;
              return false;
            }
            return false;
          }

          let el = document.activeElement;
          try {
            if (el && el.tagName === 'IFRAME' && el.contentWindow && el.contentWindow.document) {
              el = el.contentWindow.document.activeElement || el;
            }
          } catch (_) {}

          if (!el) return 'submit';
          if (isMultilineEditable(el) && !isSingleLineEditable(el)) return 'newline';
          if (isMultilineEditable(el) && el.tagName === 'TEXTAREA') return 'newline';

          return 'submit';
        } catch (e) {
          return 'submit';
        }
      })();
    `;
    try {
      const mode = await wv.executeJavaScript(probe, false);
      return mode === 'newline' ? 'newline' : 'submit';
    } catch {
      return 'submit';
    }
  };

  type DomEnterResult = { ok: boolean; didSubmit: boolean; didClick: boolean; didDispatch: boolean };

  const tryEnterSubmitDom = async (): Promise<DomEnterResult> => {
    const wv = getActiveWebview();
    if (!wv) return { ok: false, didSubmit: false, didClick: false, didDispatch: false };

    const code = `
      (() => {
        const res = { ok:false, didSubmit:false, didClick:false, didDispatch:false };
        try {
          function deepActive() {
            let win = window;
            let el = win.document.activeElement;

            // same-origin iframe drill-down (best effort)
            for (let i = 0; i < 5; i++) {
              if (!el) break;

              // shadowRoot drill-down
              if (el.shadowRoot && el.shadowRoot.activeElement) {
                el = el.shadowRoot.activeElement;
                continue;
              }

              if (el.tagName === 'IFRAME') {
                try {
                  win = el.contentWindow;
                  el = win.document.activeElement;
                  continue;
                } catch (_) {
                  break;
                }
              }
              break;
            }
            return { win, el };
          }

          const { win, el } = deepActive();
          if (!el) return res;

          // only handle single-line inputs here (textarea/newline stays in insertNewlineDom)
          if (!(el instanceof win.HTMLInputElement)) return res;

          // dispatch Enter events (some sites bind to keypress)
          const mk = (type) => new win.KeyboardEvent(type, {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          try { el.dispatchEvent(mk('keydown')); } catch {}
          try { el.dispatchEvent(mk('keypress')); } catch {}
          try { el.dispatchEvent(mk('keyup')); } catch {}
          res.didDispatch = true;

          const form = el.form || (el.closest ? el.closest('form') : null);
          if (form) {
            if (typeof form.requestSubmit === 'function') {
              form.requestSubmit();
              res.didSubmit = true;
              res.ok = true;
              return res;
            }
            const btn =
              form.querySelector('button[type="submit"]:not([disabled]),input[type="submit"]:not([disabled]),input[type="image"]:not([disabled])');
            if (btn && typeof btn.click === 'function') {
              btn.click();
              res.didClick = true;
              res.ok = true;
              return res;
            }
            if (typeof form.submit === 'function') {
              form.submit();
              res.didSubmit = true;
              res.ok = true;
              return res;
            }
          }

          res.ok = true; // dispatched, but no form/button found
          return res;
        } catch (_) {
          return res;
        }
      })();
    `;

    try {
      const r = await wv.executeJavaScript(code, false);
      if (r && typeof r === 'object') return r as DomEnterResult;
    } catch {
      // ignore
    }
    return { ok: false, didSubmit: false, didClick: false, didDispatch: false };
  };

  const insertNewlineDom = async (): Promise<boolean> => {
    const wv = getActiveWebview();
    if (!wv) return false;
    const code = `
      (function(){
        try{
          var el = document.activeElement;
          try {
            if (el && el.tagName === 'IFRAME' && el.contentWindow && el.contentWindow.document) {
              el = el.contentWindow.document.activeElement || el;
            }
          } catch(_) {}
          if(!el) return false;
          var tag = (el.tagName||'').toLowerCase();
          if(tag==='textarea'){
            var ip = el;
            var val = String(ip.value||'');
            var s = typeof ip.selectionStart==='number' ? ip.selectionStart : val.length;
            var e = typeof ip.selectionEnd==='number' ? ip.selectionEnd : s;
            var nl = '\\n';
            if(typeof ip.setRangeText==='function'){
              ip.setRangeText(nl,s,e,'end');
            } else {
              ip.value = val.slice(0,s) + nl + val.slice(e);
              var pos = s + nl.length;
              if (ip.setSelectionRange) ip.setSelectionRange(pos,pos);
            }
            ip.dispatchEvent(new InputEvent('input',{inputType:'insertLineBreak',data:'\\n',bubbles:true}));
            document.dispatchEvent(new Event('selectionchange',{bubbles:true}));
            try{ ip.focus({preventScroll:true}); }catch(_){ try{ ip.focus(); }catch(__){} }
            return true;
          }
          if(el.isContentEditable){
            var sel = window.getSelection && window.getSelection();
            if(sel){
              var range = sel.rangeCount>0 ? sel.getRangeAt(0) : null;
              if(range){
                range.deleteContents();
                range.insertNode(document.createTextNode('\\n'));
                range.collapse(false);
                el.dispatchEvent(new InputEvent('input',{inputType:'insertLineBreak',data:'\\n',bubbles:true}));
                document.dispatchEvent(new Event('selectionchange',{bubbles:true}));
                try{ el.focus({preventScroll:true}); }catch(_){ try{ el.focus(); }catch(__){} }
                return true;
              }
            }
          }
          return false;
        }catch(e){ return false; }
      })();
    `;
    try {
      return Boolean(await wv.executeJavaScript(code, false));
    } catch {
      return false;
    }
  };

  const backspace = async (): Promise<boolean> => {
    return sendKeyTrusted('Backspace');
  };

  const enter = async (): Promise<boolean> => {
    const mode = await detectEnterMode();
    if (mode === 'newline') {
      const inserted = await insertNewlineDom();
      if (inserted) return true;
    }
    const dom = await tryEnterSubmitDom();
    if (dom.didSubmit || dom.didClick) return true;
    return sendKeyTrusted('Enter');
  };

  const moveCaretDom = async (dir: ArrowDir): Promise<boolean> => {
    const wv = getActiveWebview();
    if (!wv) return false;
    const dirVal = dir === 'ArrowLeft' ? 'ArrowLeft' : 'ArrowRight';
    const code = `
      (function(){
        try{
          var nonText = {'button':1,'submit':1,'reset':1,'checkbox':1,'radio':1,'range':1,'color':1,'file':1,'image':1,'hidden':1};
          function isEditable(el){
            if(!el) return false;
            if(el.isContentEditable) return true;
            var tag = (el.tagName||'').toLowerCase();
            if(tag==='textarea') return !el.disabled && !el.readOnly;
            if(tag==='input'){
              var type = (el.getAttribute('type')||'').toLowerCase();
              if(nonText[type]) return false;
              return !el.disabled && !el.readOnly;
            }
            return false;
          }
          var el = document.activeElement;
          try {
            if (el && el.tagName === 'IFRAME' && el.contentWindow && el.contentWindow.document) {
              el = el.contentWindow.document.activeElement || el;
            }
          } catch(_) {}
          if(!isEditable(el)) return false;

          function refocus(target){
            try { target.focus({ preventScroll: true }); }
            catch(_) { try { target.focus(); } catch(__) {} }
          }

          var tag = (el.tagName||'').toLowerCase();
          if(tag==='textarea' || tag==='input'){
            var ip = el;
            var val = String(ip.value||'');
            var s = typeof ip.selectionStart==='number' ? ip.selectionStart : val.length;
            var e = typeof ip.selectionEnd==='number'   ? ip.selectionEnd   : s;
            var pos = s !== e
              ? (${dirVal}==='ArrowLeft' ? Math.min(s,e) : Math.max(s,e))
              : (${dirVal}==='ArrowLeft' ? Math.max(0, s-1) : Math.min(val.length, s+1));
            if (typeof ip.setSelectionRange === 'function') {
              ip.setSelectionRange(pos, pos);
              try {
                var style = getComputedStyle(ip);
                var canvas = window.__mzrCaretCanvas || (window.__mzrCaretCanvas = document.createElement('canvas'));
                var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
                if (ctx) {
                  var font = ((style.fontWeight||'') + ' ' + (style.fontSize||'') + ' ' + (style.fontFamily||'')).trim();
                  if (font) ctx.font = font;
                  var text = ip.value.slice(0, pos);
                  var width = ctx.measureText(text).width;
                  var padL = parseFloat(style.paddingLeft || '0') || 0;
                  var padR = parseFloat(style.paddingRight || '0') || 0;
                  var caretX = width;
                  var viewLeft = ip.scrollLeft;
                  var visibleWidth = Math.max(0, ip.clientWidth - padL - padR);
                  var viewRight = viewLeft + visibleWidth;
                  if (caretX <= 1) {
                    ip.scrollLeft = 0;
                  } else if (caretX < viewLeft + 2) {
                    ip.scrollLeft = Math.max(0, caretX - 4);
                  } else if (caretX > viewRight - 2) {
                    ip.scrollLeft = Math.max(0, caretX - visibleWidth + 4);
                  }
                }
              } catch(_) {}
              ip.dispatchEvent(new Event('select',{bubbles:true}));
              document.dispatchEvent(new Event('selectionchange',{bubbles:true}));
              refocus(ip);
              try { window.__mzrLastEditable = ip; } catch(_) {}
              return true;
            }
            return false;
          }

          if (el.isContentEditable) {
            var sel = window.getSelection && window.getSelection();
            if (!sel) return false;
            if (sel.rangeCount === 0) {
              var r = document.createRange();
              r.selectNodeContents(el);
              r.collapse(${dirVal}==='ArrowLeft');
              sel.removeAllRanges(); sel.addRange(r);
              document.dispatchEvent(new Event('selectionchange',{bubbles:true}));
              refocus(el);
              try { window.__mzrLastEditable = el; } catch(_) {}
              return true;
            }
            if (!sel.isCollapsed) {
              if (${dirVal}==='ArrowLeft') sel.collapseToStart(); else sel.collapseToEnd();
              document.dispatchEvent(new Event('selectionchange',{bubbles:true}));
              refocus(el);
              try { window.__mzrLastEditable = el; } catch(_) {}
              return true;
            }
            var range = sel.getRangeAt(0);
            var node = range.startContainer;
            var off = range.startOffset + (${dirVal}==='ArrowLeft' ? -1 : 1);
            if (node.nodeType === Node.TEXT_NODE) {
              var len = node.textContent ? node.textContent.length : 0;
              off = Math.max(0, Math.min(len, off));
              range.setStart(node, off);
              range.collapse(true);
              sel.removeAllRanges(); sel.addRange(range);
              document.dispatchEvent(new Event('selectionchange',{bubbles:true}));
              refocus(el);
              try { window.__mzrLastEditable = el; } catch(_) {}
              return true;
            }
          }
          return false;
        }catch(e){ return false; }
      })();
    `;
    try {
      return Boolean(await wv.executeJavaScript(code, false));
    } catch {
      return false;
    }
  };

  const arrow = async (dir: ArrowDir): Promise<boolean> => {
    const handled = await moveCaretDom(dir);
    if (handled) return true;
    return sendKeyTrusted(dir);
  };

  const getSelectionTouchState = async (): Promise<{ touching: boolean; lastTouchTs: number }> => {
    const wv = getActiveWebview();
    if (!wv) return { touching: false, lastTouchTs: 0 };
    const code = `
      (function(){
        try{
          var s = (window.__mzrSel || { touching:false, lastTouchTs: 0 });
          return { touching: !!s.touching, lastTouchTs: Number(s.lastTouchTs||0) };
        }catch(e){
          return { touching:false, lastTouchTs:0 };
        }
      })();
    `;
    const res = await wv.executeJavaScript(code);
    const touching = !!(res as { touching?: unknown })?.touching;
    const lastTouchTsRaw = (res as { lastTouchTs?: unknown })?.lastTouchTs;
    const lastTouchTs = Number(lastTouchTsRaw ?? 0);
    return { touching, lastTouchTs: Number.isFinite(lastTouchTs) ? lastTouchTs : 0 };
  };

  const pollMenuRequest = async (): Promise<{ x: number; y: number } | null> => {
    const wv = getActiveWebview();
    if (!wv) return null;
    const code = `
      (function(){
        try{
          var S = window.__mzrSel;
          if (!S || !S.menuReq) return null;
          var m = S.menuReq; S.menuReq = null;

          // Only trigger menu if the selection was created
          if (S.selectionCreated) {
            return { x: Math.round(Number(m.x)||0), y: Math.round(Number(m.y)||0) };
          }
          return null;
        }catch(e){
          return null;
        }
      })();
    `;
    const val = await wv.executeJavaScript(code);
    if (!val) return null;
    const x = Number((val as { x?: unknown }).x ?? NaN);
    const y = Number((val as { y?: unknown }).y ?? NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  };

  /**
   * True if there's a non-collapsed selection in the document or an input/textarea with selectionStart!=selectionEnd.
   */
  const hasSelection = async (): Promise<boolean> => {
    const wv = getActiveWebview();
    if (!wv) return false;
    const code = `
      (function(){
        try{
          var el = document.activeElement;
          // Input/textarea selection
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            var s = (typeof el.selectionStart === 'number') ? el.selectionStart : 0;
            var e = (typeof el.selectionEnd === 'number') ? el.selectionEnd : 0;
            return e > s;
          }
          // Content / contenteditable selection
          var sel = window.getSelection && window.getSelection();
          return !!(sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed);
        }catch(e){ return false; }
      })();
    `;
    const res = await wv.executeJavaScript(code);
    return Boolean(res);
  };

  /**
   * Returns a client rect to anchor the menu.
   * - For content selections: use range.getBoundingClientRect().
   * - For input/textarea: fall back to the element's bounding rect center.
   */
  const getSelectionRect = async (): Promise<{ left: number; top: number; width: number; height: number } | null> => {
    const wv = getActiveWebview();
    if (!wv) return null;
    const code = `
      (function(){
        try{
          function rectObj(r){
            return r ? { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) } : null;
          }
          var el = document.activeElement;
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            var r = el.getBoundingClientRect();
            // anchor near the top center of the control
            return rectObj({ left: r.left + r.width/2, top: r.top, width: 0, height: 0 });
          }
          var sel = window.getSelection && window.getSelection();
          if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
            var rr = sel.getRangeAt(0).getBoundingClientRect();
            return rectObj(rr);
          }
          return null;
        }catch(e){ return null; }
      })();
    `;
    const rect = await wv.executeJavaScript(code);
    if (!rect || typeof rect.left !== 'number') return null;
    return rect as { left: number; top: number; width: number; height: number };
  };

  /**
   * Collapse/clear selection.
   */
  const clearSelection = async (): Promise<boolean> => {
    const wv = getActiveWebview();
    if (!wv) return false;
    const code = `
      (function(){
        try{
          var el = document.activeElement;
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            var s = (typeof el.selectionEnd === 'number') ? el.selectionEnd : 0;
            if (typeof el.setSelectionRange === 'function') el.setSelectionRange(s, s);
            return true;
          }
          var sel = window.getSelection && window.getSelection();
          if (sel) sel.removeAllRanges();
          return true;
        }catch(e){ return false; }
      })();
    `;
    const ok = await wv.executeJavaScript(code);
    return Boolean(ok);
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
    hasSelection,
    getSelectionRect,
    clearSelection,
    getSelectionTouchState,
    pollMenuRequest,
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
