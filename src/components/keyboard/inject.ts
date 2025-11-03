import type { WebviewTag } from 'electron';

export type GetWebview = () => WebviewTag | null;

const ENSURE_EDITABLE_FOCUS_JS = `
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

    const IS_ACTIVE_MULTILINE_JS = `
    (function(){
    const el = document.activeElement;
    if (!el) return false;
    if (el.isContentEditable) return true;
    const t = (el.tagName||'').toLowerCase();
    if (t === 'textarea') return true;
    return false;
    })()
    `;

export function makeMainInjects() {
  const getActive = () => document.activeElement as HTMLElement | null;

  const isTextual = (el: HTMLElement | null) => {
    if (!el) return false;
    if ((el as any).isContentEditable) return true;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const t = ((el as HTMLInputElement).type || '').toLowerCase();
      return !new Set(['button','submit','reset','checkbox','radio','range','color','file','image','hidden']).has(t);
    }
    return false;
  };

  const refocus = (el: HTMLElement) => {
    try { (el as any).focus?.({ preventScroll: true }); } catch {}
    try { (el as any).focus?.(); } catch {}
  };

  const text = async (s: string) => {
    const el = getActive();
    if (!isTextual(el)) return;
    const tag = (el!.tagName || '').toLowerCase();

    if (tag === 'textarea' || tag === 'input') {
      const ip = el as HTMLInputElement | HTMLTextAreaElement;
      const val = String(ip.value ?? '');
      const start = typeof ip.selectionStart === 'number' ? ip.selectionStart! : val.length;
      const end   = typeof ip.selectionEnd   === 'number' ? ip.selectionEnd!   : start;

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

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(s));
      range.collapse(false);
      (el as any).dispatchEvent?.(new InputEvent('input', { inputType: 'insertText', data: s, bubbles: true }));
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      refocus(el!);
    }
  };

  const backspace = async () => {
    const el = getActive();
    if (!isTextual(el)) return;
    const tag = (el!.tagName || '').toLowerCase();

    if (tag === 'textarea' || tag === 'input') {
      const ip = el as HTMLInputElement | HTMLTextAreaElement;
      const val = String(ip.value ?? '');
      const start = typeof ip.selectionStart === 'number' ? ip.selectionStart! : val.length;
      const end   = typeof ip.selectionEnd   === 'number' ? ip.selectionEnd!   : start;
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

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (!range.collapsed) {
        range.deleteContents();
      } else {
        range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
        range.deleteContents();
      }
      (el as any).dispatchEvent?.(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      refocus(el!);
    }
  };

  const enter = async () => {
    const el = getActive();
    if (!isTextual(el)) {
      const form = (el as any)?.form || (el as any)?.closest?.('form');
      if (form?.requestSubmit) form.requestSubmit();
      else form?.submit?.();
      return;
    }
    const tag = (el!.tagName || '').toLowerCase();
    const isCE = (el as any).isContentEditable;

    if (isCE) {
      let ok = false;
      try { ok = (document as any).execCommand?.('insertLineBreak'); } catch {}
      if (!ok) {
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
      (el as any).dispatchEvent?.(new InputEvent('input', { inputType: 'insertLineBreak', bubbles: true }));
      try { (el as any).focus?.({ preventScroll: true }); } catch {}
      return;
    }

    if (tag === 'textarea') {
      const ip = el as HTMLTextAreaElement;
      const val = String(ip.value ?? '');
      const s = typeof ip.selectionStart === 'number' ? ip.selectionStart! : val.length;
      const e = typeof ip.selectionEnd   === 'number' ? ip.selectionEnd!   : s;
      if (typeof ip.setRangeText === 'function') {
        ip.setRangeText('\n', s, e, 'end');
      } else {
        ip.value = val.slice(0, s) + '\n' + val.slice(e);
        ip.setSelectionRange?.(s + 1, s + 1);
      }
      ip.dispatchEvent(new InputEvent('input', { inputType: 'insertLineBreak', bubbles: true }));
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      try { ip.focus({ preventScroll: true }); } catch {}
      return;
    }

    const form = (el as any).form || (el as any).closest?.('form');
    if (form?.requestSubmit) form.requestSubmit();
    else form?.submit?.();
  };

  const arrow = async (dir: 'ArrowLeft' | 'ArrowRight') => {
    const el = getActive();
    if (!isTextual(el)) return;
    const tag = (el!.tagName || '').toLowerCase();

    if (tag === 'textarea' || tag === 'input') {
      const ip = el as HTMLInputElement | HTMLTextAreaElement;
      const val = String(ip.value ?? '');
      const s = typeof ip.selectionStart === 'number' ? ip.selectionStart! : val.length;
      const e = typeof ip.selectionEnd   === 'number' ? ip.selectionEnd!   : s;
      const pos = s !== e
        ? (dir === 'ArrowLeft' ? Math.min(s, e) : Math.max(s, e))
        : (dir === 'ArrowLeft' ? Math.max(0, s - 1) : Math.min(val.length, s + 1));
      ip.setSelectionRange?.(pos, pos);
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      try { ip.focus({ preventScroll: true }); } catch {}
      return;
    }

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      if (!sel.isCollapsed) {
        if (dir === 'ArrowLeft') {
          sel.collapseToStart();
        } else {
          sel.collapseToEnd();
        }
      }
      if (typeof (sel as any).modify === 'function') {
        (sel as any).modify('move', dir === 'ArrowLeft' ? 'backward' : 'forward', 'character');
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
      try { (el as any).focus?.({ preventScroll: true }); } catch {}
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
    injectArrowToMain: arrow
  };
}

/* =========================
   WEBVIEW INJECTS
   ========================= */
export function makeWebInjects(getWebview: GetWebview) {
  const exec = async (js: string) => {
    const wv = getWebview();
    if (!wv) return false;
    try { return await wv.executeJavaScript(js, false); } catch { return false; }
  };

  const ensureFocus = async () => {
    try { return await exec(ENSURE_EDITABLE_FOCUS_JS); }
    catch { return false; }
  };

  const isActiveMultiline = async (): Promise<boolean> => {
    try { return await exec(IS_ACTIVE_MULTILINE_JS); }
        catch { return false; }
    };

  const text = async (s: string) => {
    if (!(await ensureFocus())) return false;
    return exec(`
      (function(raw){
        try{
          var el = document.activeElement;
          if(!el) return false;
          var tag = (el.tagName||'').toLowerCase();
          var type = (el.getAttribute ? (el.getAttribute('type')||'').toLowerCase() : '');
          var nonText = {'button':1,'submit':1,'reset':1,'checkbox':1,'radio':1,'range':1,'color':1,'file':1,'image':1,'hidden':1};
          var isEditable = el.isContentEditable || tag==='textarea' || (tag==='input' && !nonText[type]);
          if(!isEditable) return false;
          var text = String(raw==null ? '' : raw);
          if(!text) return false;

          var beforeEvt;
          try { beforeEvt = new InputEvent('beforeinput',{inputType:'insertText', data:text, bubbles:true, cancelable:true}); } catch(e) { beforeEvt = null; }
          if(beforeEvt && !el.dispatchEvent(beforeEvt)) {
            try{ el.focus({preventScroll:true}); }catch(e){}
            return true;
          }

          if(el.isContentEditable){
            var sel = window.getSelection();
            if(sel && sel.rangeCount>0){
              var range = sel.getRangeAt(0);
              range.deleteContents();
              range.insertNode(document.createTextNode(text));
              range.collapse(false);
            }
            try{ el.dispatchEvent(new InputEvent('input',{inputType:'insertText', data:text, bubbles:true})); }catch(e){}
          } else {
            var val = String(el.value||'');
            var s = typeof el.selectionStart==='number' ? el.selectionStart : val.length;
            var e = typeof el.selectionEnd==='number'   ? el.selectionEnd   : s;
            if(typeof el.setRangeText==='function'){
              el.setRangeText(text, s, e, 'end');
            } else {
              var before = val.slice(0,s), after = val.slice(e);
              el.value = before + text + after;
              var pos = before.length + text.length;
              if(typeof el.setSelectionRange==='function'){ el.setSelectionRange(pos,pos); }
            }
            try{ el.dispatchEvent(new InputEvent('input',{inputType:'insertText', data:text, bubbles:true})); }catch(e){}
            if(type==='email'){ try{ el.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){} }
          }

          try{ el.focus({preventScroll:true}); }catch(e){ try{ el.focus(); }catch(e2){} }
          if(!el.isContentEditable && typeof el.selectionStart==='number' && typeof el.setSelectionRange==='function'){
            el.setSelectionRange(el.selectionStart, el.selectionStart);
          }
          try{ document.dispatchEvent(new Event('selectionchange',{bubbles:true})); }catch(e){}
          return true;
        }catch(e){ return false; }
      })(${JSON.stringify(s)})
    `)
  };

  const backspace = async () => {
    if (!(await ensureFocus())) return false;
    return exec(`
      (function(){
        try{
          var el = document.activeElement;
          if(!el) return false;
          var tag = (el.tagName||'').toLowerCase();
          var type = (el.getAttribute ? (el.getAttribute('type')||'').toLowerCase() : '');
          var nonText = {'button':1,'submit':1,'reset':1,'checkbox':1,'radio':1,'range':1,'color':1,'file':1,'image':1,'hidden':1};
          var isEditable = el.isContentEditable || tag==='textarea' || (tag==='input' && !nonText[type]);
          if(!isEditable) return false;

          var beforeEvt;
          try { beforeEvt = new InputEvent('beforeinput',{inputType:'deleteContentBackward', bubbles:true, cancelable:true}); } catch(e) { beforeEvt = null; }
          if(beforeEvt && !el.dispatchEvent(beforeEvt)) {
            try{ el.focus({preventScroll:true}); }catch(e){}
            return true;
          }

          if(el.isContentEditable){
            var sel = window.getSelection();
            if(sel && sel.rangeCount>0){
              var range = sel.getRangeAt(0);
              if(!range.collapsed){
                range.deleteContents();
              }else{
                range.setStart(range.startContainer, Math.max(0, range.startOffset-1));
                range.deleteContents();
              }
            }
            try{ el.dispatchEvent(new InputEvent('input',{inputType:'deleteContentBackward', bubbles:true})); }catch(e){}
          } else {
            var val = String(el.value||'');
            var s = typeof el.selectionStart==='number' ? el.selectionStart : val.length;
            var e = typeof el.selectionEnd==='number'   ? el.selectionEnd   : s;
            if(s===0 && e===0){
              try{ el.focus({preventScroll:true}); }catch(e){}
              return true;
            }
            var delS = s===e ? Math.max(0, s-1) : Math.min(s,e);
            var delE = Math.max(s,e);
            if(typeof el.setRangeText==='function'){
              el.setRangeText('', delS, delE, 'end');
            } else {
              var before = val.slice(0,delS), after = val.slice(delE);
              el.value = before + after;
              if(typeof el.setSelectionRange==='function'){ el.setSelectionRange(before.length, before.length); }
            }
            try{ el.dispatchEvent(new InputEvent('input',{inputType:'deleteContentBackward', bubbles:true})); }catch(e){}
            if(type==='email'){ try{ el.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){} }
          }

          try{ el.focus({preventScroll:true}); }catch(e){ try{ el.focus(); }catch(e2){} }
          if(!el.isContentEditable && typeof el.selectionStart==='number' && typeof el.setSelectionRange==='function'){
            el.setSelectionRange(el.selectionStart, el.selectionStart);
          }
          try{ document.dispatchEvent(new Event('selectionchange',{bubbles:true})); }catch(e){}
          return true;
        }catch(e){ return false; }
      })();
    `)
  };

  const enter = async () => {
    if (!(await ensureFocus())) return false;
    return exec(`
      (function(){
        try{
          var el = document.activeElement || document.body;
          var tag = (el.tagName||'').toLowerCase();
          var isCE = !!(el && el.isContentEditable);

          if(isCE){
            var ok=false;
            try{ ok = (document.execCommand && document.execCommand('insertLineBreak')); }catch(e){}
            if(!ok){
              var sel = window.getSelection();
              if(sel && sel.rangeCount>0){
                var range = sel.getRangeAt(0);
                range.deleteContents();
                var br = document.createElement('br');
                range.insertNode(br);
                range.setStartAfter(br);
                range.collapse(true);
              }
            }
            try{ el.dispatchEvent(new InputEvent('input',{inputType:'insertLineBreak', bubbles:true})); }catch(e){}
            try{ el.focus({preventScroll:true}); }catch(e){}
            return true;
          }

          if(tag==='textarea'){
            var val = String(el.value||'');
            var s = typeof el.selectionStart==='number' ? el.selectionStart : val.length;
            var e = typeof el.selectionEnd==='number'   ? el.selectionEnd   : s;
            if(typeof el.setRangeText==='function'){
              el.setRangeText('\\n', s, e, 'end');
            } else {
              el.value = val.slice(0,s) + '\\n' + val.slice(e);
              if(typeof el.setSelectionRange==='function'){ el.setSelectionRange(s+1, s+1); }
            }
            try{ el.dispatchEvent(new InputEvent('input',{inputType:'insertLineBreak', bubbles:true})); }catch(e){}
            try{ document.dispatchEvent(new Event('selectionchange',{bubbles:true})); }catch(e){}
            try{ el.focus({preventScroll:true}); }catch(e){}
            return true;
          }

          var form = el && (el.form || (el.closest && el.closest('form')));
          if(form){
            if(form.requestSubmit) form.requestSubmit();
            else if(form.submit) form.submit();
          }
          return true;
        }catch(e){ return false; }
      })();
    `)
  };

  const arrow = async (dir: 'ArrowLeft'|'ArrowRight') => {
    if (!(await ensureFocus())) return false;
    return exec(`
      (function(dir){
        try{
          var el = document.activeElement;
          if(!el) return false;
          var tag = (el.tagName||'').toLowerCase();
          if(tag==='textarea' || tag==='input'){
            var val = String(el.value||'');
            var s = typeof el.selectionStart==='number' ? el.selectionStart : val.length;
            var e = typeof el.selectionEnd==='number'   ? el.selectionEnd   : s;
            var pos = s!==e ? (dir==='ArrowLeft' ? Math.min(s,e) : Math.max(s,e))
                            : (dir==='ArrowLeft' ? Math.max(0, s-1) : Math.min(val.length, s+1));
            if(typeof el.setSelectionRange==='function'){ el.setSelectionRange(pos,pos); }
            try{ document.dispatchEvent(new Event('selectionchange',{bubbles:true})); }catch(e){}
            try{ el.focus({preventScroll:true}); }catch(e){}
            return true;
          }
          if(el.isContentEditable){
            var sel = window.getSelection();
            if(sel && sel.rangeCount>0){
              if(!sel.isCollapsed) (dir==='ArrowLeft' ? sel.collapseToStart() : sel.collapseToEnd());
              if(typeof sel.modify==='function'){
                sel.modify('move', dir==='ArrowLeft' ? 'backward' : 'forward', 'character');
              }else{
                var r = sel.getRangeAt(0);
                var n = r.startContainer;
                var off = r.startOffset + (dir==='ArrowLeft' ? -1 : 1);
                if(n.nodeType===Node.TEXT_NODE){
                  var L = (n.textContent||'').length;
                  off = Math.max(0, Math.min(L, off));
                  r.setStart(n, off); r.collapse(true);
                }
              }
              try{ document.dispatchEvent(new Event('selectionchange',{bubbles:true})); }catch(e){}
              try{ el.focus({preventScroll:true}); }catch(e){}
              return true;
            }
          }
          return false;
        }catch(e){ return false; }
      })(${JSON.stringify(dir)})
    `)
  };

  return {
    isActiveMultiline,
    text,
    backspace,
    enter,
    arrow,
    injectTextToWeb: text,
    injectBackspaceToWeb: backspace,
    injectEnterToWeb: enter,
    injectArrowToWeb: arrow
  };
}

/* =========================
   PROBE (webview): чи є зараз редаговний елемент
   ========================= */
export async function probeWebEditable(getWebview: GetWebview): Promise<boolean> {
  const wv = getWebview();
  if (!wv) return false;
  try {
    return await wv.executeJavaScript(`
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
    `, false);
  } catch {
    return false;
  }
}

export type MainInjects = ReturnType<typeof makeMainInjects>;
export type WebInjects  = ReturnType<typeof makeWebInjects>;
