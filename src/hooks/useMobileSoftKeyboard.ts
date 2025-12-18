import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { WebviewTag } from 'electron';
import type { Mode } from '../types/models';

type UseMobileSoftKeyboardParams = {
  mode: Mode;
  isEditableElement: (el: Element | null) => boolean;
  getActiveWebview: () => WebviewTag | null;
  activeId: string | null;
  activeViewRevision: number;
  setKbVisible: (flag: boolean) => void;
  oskPressGuardRef: MutableRefObject<boolean>;
};

const FOCUS_CONSOLE_ACTIVE = '__MZR_OSK_FOCUS_ON__';
const FOCUS_CONSOLE_INACTIVE = '__MZR_OSK_FOCUS_OFF__';

export const useMobileSoftKeyboard = ({
  mode,
  isEditableElement,
  getActiveWebview,
  activeId,
  activeViewRevision,
  setKbVisible,
  oskPressGuardRef
}: UseMobileSoftKeyboardParams) => {
  // Toggle keyboard visibility based on focus/pointer inside the main window.
  useEffect(() => {
    if (mode !== 'mobile') return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const insideOsk = t.closest('[data-soft-keyboard="true"]');
      if (insideOsk) {
        oskPressGuardRef.current = true;
        setTimeout(() => { oskPressGuardRef.current = false; }, 250);
        return;
      }
      if (!isEditableElement(t)) setKbVisible(false);
    };

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (isEditableElement(t)) setKbVisible(true);
    };

    const onFocusOut = () => {
      if (oskPressGuardRef.current) return;
      const active = document.activeElement as HTMLElement | null;
      if (!isEditableElement(active)) {
        setKbVisible(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
    };
  }, [mode, isEditableElement, oskPressGuardRef, setKbVisible]);

  // Bridge focus/selection events inside the active webview back to the host.
  useEffect(() => {
    if (mode !== 'mobile') return;
    const wv = getActiveWebview();
    if (!wv) return;
    const bridgeScript = `
      (function(){
        try {
          if (window.__mzrFocusBridgeInstalled) return;
          window.__mzrFocusBridgeInstalled = true;

          var nonText = new Set(['button','submit','reset','checkbox','radio','range','color','file','image','hidden']);
          function isEditable(el){
            if(!el) return false;
            if(el.isContentEditable) return true;
            var tag = (el.tagName||'').toLowerCase();
            if(tag==='textarea') return !el.disabled && !el.readOnly;
            if(tag==='input'){
              var type = (el.getAttribute('type')||'').toLowerCase();
              if(nonText.has(type)) return false;
              return !el.disabled && !el.readOnly;
            }
            return false;
          }

          function markLast(el){
            try { window.__mzrLastEditable = el; } catch(e) {}
          }

          function notify(flag){
            try { console.info(flag ? '${FOCUS_CONSOLE_ACTIVE}' : '${FOCUS_CONSOLE_INACTIVE}'); } catch(e){}
          }

          document.addEventListener('focusin', function(ev){
            if (isEditable(ev.target)) { markLast(ev.target); notify(true); }
          }, true);

          document.addEventListener('focusout', function(ev){
            if (!isEditable(ev.target)) return;
            setTimeout(function(){
              var still = isEditable(document.activeElement);
              if (still) markLast(document.activeElement);
              notify(still);
            }, 0);
          }, true);

          document.addEventListener('pointerdown', function(ev){
            var t = ev.target;
            if (isEditable(t)) { markLast(t); notify(true); }
          }, true);

           // === Merezhyvo: custom <select> overlay for mobile ===
          (function(){
            try {
              if (window.__mzrSelectBridgeInstalled) return;
              window.__mzrSelectBridgeInstalled = true;

              var win = window;
              var overlayId = '__mzr_select_overlay';

              function resolveSelectFromEvent(ev){
                try {
                  var t = ev && ev.target;
                  if (!t) return null;
                  var el = t;
                  while (el && el.nodeType === 1) {
                    var tag = (el.tagName || '').toLowerCase();
                    if (tag === 'select') return el;
                    el = el.parentElement;
                  }
                } catch(_) {}
                return null;
              }

              function closeSelectOverlay(doc){
                try {
                  doc = doc || document;
                  var existing = doc.getElementById(overlayId);
                  if (existing && existing.parentNode) {
                    existing.parentNode.removeChild(existing);
                  }
                } catch(_) {}
              }

              function openSelectOverlay(el){
                if (!el || el.disabled) return;

                var doc = el.ownerDocument || document;
                var body = doc.body || doc.documentElement;
                var cs = win.getComputedStyle ? win.getComputedStyle(el) : null;
                var fg = cs ? cs.color : '#f9fafb';
                var bg = cs && cs.color ? cs.backgroundColor : '#111827';

                closeSelectOverlay(doc);

                var currentValue = el.value;

                var overlay = doc.createElement('div');
                overlay.id = overlayId;
                overlay.setAttribute('data-mzr', 'select-overlay');

                overlay.style.position = 'fixed';
                overlay.style.left = '0';
                overlay.style.top = '0';
                overlay.style.right = '0';
                overlay.style.bottom = '0';
                overlay.style.zIndex = '999999';
                overlay.style.background = 'rgba(0,0,0,0.35)';
                overlay.style.display = 'flex';
                overlay.style.alignItems = 'flex-end';
                overlay.style.justifyContent = 'center';

                var panel = doc.createElement('div');
                panel.style.maxHeight = '60vh';
                panel.style.width = '100%';
                panel.style.maxWidth = '480px';
                panel.style.margin = '0 8px 12px 8px';
                panel.style.borderRadius = '12px';
                panel.style.background = bg;
                panel.style.color = fg;
                panel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.45)';
                panel.style.overflowY = 'auto';
                panel.style.fontFamily =
                  'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

                var list = doc.createElement('div');
                list.style.padding = '4px 0';
                panel.appendChild(list);

                var opts = el.options || [];
                for (var i = 0; i < opts.length; i++) {
                  var opt = opts[i];
                  if (!opt) continue;
                  if (opt.disabled) continue;
                  var item = doc.createElement('div');
                  item.style.padding = '14px 18px';
                  item.style.cursor = 'pointer';
                  item.style.fontSize = '17px';
                  item.style.display = 'flex';
                  item.style.alignItems = 'center';
                  item.style.justifyContent = 'space-between';
                  item.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
                  item.innerText = opt.textContent || '';
                  if (opt.value === currentValue) {
                    item.style.fontWeight = '600';
                    item.style.color = '#22d3ee';
                  }
                  (function(optionValue){
                    item.addEventListener('click', function(ev){
                      try {
                        ev.preventDefault();
                        ev.stopPropagation();
                        el.value = optionValue;
                        var event = new Event('change', { bubbles: true });
                        el.dispatchEvent(event);
                        closeSelectOverlay(doc);
                      } catch(_) {}
                    }, { once: true });
                  })(opt.value);
                  list.appendChild(item);
                }

                var cancel = doc.createElement('button');
                cancel.innerText = 'Cancel';
                cancel.style.width = '100%';
                cancel.style.padding = '14px 18px';
                cancel.style.border = 'none';
                cancel.style.background = 'transparent';
                cancel.style.color = fg;
                cancel.style.fontSize = '16px';
                cancel.style.cursor = 'pointer';
                cancel.addEventListener('click', function(ev){
                  try {
                    ev.preventDefault();
                    ev.stopPropagation();
                  } catch(_) {}
                  closeSelectOverlay(doc);
                }, { once: true });
                panel.appendChild(cancel);

                overlay.addEventListener('click', function(ev){
                  try {
                    if (ev.target === overlay) {
                      closeSelectOverlay(doc);
                    }
                  } catch(_) {}
                });

                overlay.appendChild(panel);
                body.appendChild(overlay);

              }

              document.addEventListener('click', function(ev){
                var el = resolveSelectFromEvent(ev);
                if (!el) return;
                if (el.disabled) return;

                try {
                  if (ev.button != null && ev.button !== 0) return;
                } catch(_) {}

                ev.preventDefault();
                ev.stopPropagation();

                openSelectOverlay(el);
              }, true);
            } catch(e){}
          })();
        } catch(e){}
      })();
    `;

    const install = () => {
      try {
        const r = wv.executeJavaScript(bridgeScript, false);
        if (r && typeof r.then === 'function') r.catch(()=>{});
      } catch {}
    };

    const onConsole = (event: any) => {
      const msg: string = (event && event.message) || '';
      if (msg === FOCUS_CONSOLE_ACTIVE) {
        setKbVisible(true);
      } else if (msg === FOCUS_CONSOLE_INACTIVE) {
        if (oskPressGuardRef.current) return;
        setKbVisible(false);
      }
    };

    install();
    wv.addEventListener('dom-ready', install);
    wv.addEventListener('did-navigate', install);
    wv.addEventListener('did-navigate-in-page', install);
    wv.addEventListener('console-message', onConsole);

    return () => {
      wv.removeEventListener('dom-ready', install);
      wv.removeEventListener('did-navigate', install);
      wv.removeEventListener('did-navigate-in-page', install);
      wv.removeEventListener('console-message', onConsole);
    };
  }, [mode, getActiveWebview, activeId, activeViewRevision, setKbVisible, oskPressGuardRef]);
};
