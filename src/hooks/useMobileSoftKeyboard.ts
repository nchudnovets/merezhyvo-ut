import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { WebviewTag } from 'electron';
import type { Mode } from '../types/models';
import { DEFAULT_ACTIVE_INPUT_CONTEXT, type ActiveInputContext } from '../services/window/window';
import { ipc } from '../services/ipc/ipc';

type UseMobileSoftKeyboardParams = {
  mode: Mode;
  getMainInputContext: (el: Element | null) => ActiveInputContext;
  probeWebInputContext: () => Promise<ActiveInputContext>;
  getActiveWebview: () => WebviewTag | null;
  activeId: string | null;
  activeViewRevision: number;
  setActiveInputContext: (ctx: ActiveInputContext) => void;
  setKbVisible: (flag: boolean) => void;
  oskPressGuardRef: MutableRefObject<boolean>;
  ctxMenuGuardRef?: MutableRefObject<boolean>;
};

const FOCUS_CONSOLE_ACTIVE = '__MZR_OSK_FOCUS_ON__';
const FOCUS_CONSOLE_INACTIVE = '__MZR_OSK_FOCUS_OFF__';
const BRIDGE_FOCUS_INPUT_CONTEXT: ActiveInputContext = {
  editable: true,
  kind: 'text',
  multiline: false
};

export const useMobileSoftKeyboard = ({
  mode,
  getMainInputContext,
  probeWebInputContext,
  getActiveWebview,
  activeId,
  activeViewRevision,
  setActiveInputContext,
  setKbVisible,
  oskPressGuardRef,
  ctxMenuGuardRef
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
      if (ctxMenuGuardRef?.current) return;
      if (
        document.body?.getAttribute('data-mzr-emoji-panel') === '1' ||
        document.body?.getAttribute('data-mzr-emoji-panel-closing') === '1'
      ) {
        return;
      }
      const ctx = getMainInputContext(t);
      setActiveInputContext(ctx);
      if (!ctx.editable) setKbVisible(false);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (oskPressGuardRef.current) return;
      if (ctxMenuGuardRef?.current) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const ctx = getMainInputContext(t);
      setActiveInputContext(ctx);
      if (ctx.editable) setKbVisible(true);
    };

    const onFocusOut = (event: FocusEvent) => {
      if (oskPressGuardRef.current) return;
      if (ctxMenuGuardRef?.current) return;
      if (
        document.body?.getAttribute('data-mzr-emoji-panel') === '1' ||
        document.body?.getAttribute('data-mzr-emoji-panel-closing') === '1'
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && target.closest('[data-soft-keyboard="true"]')) return;
      const related = event.relatedTarget as HTMLElement | null;
      if (related && related.closest('[data-soft-keyboard="true"]')) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && active.closest('[data-soft-keyboard="true"]')) return;
      const ctx = getMainInputContext(active);
      setActiveInputContext(ctx);
      if (!ctx.editable) {
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
  }, [
    mode,
    getMainInputContext,
    oskPressGuardRef,
    setActiveInputContext,
    setKbVisible,
    ctxMenuGuardRef
  ]);

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
          var iframePolls = new WeakMap();
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

	          function isVisible(el){
	            try {
	              if (!el || !el.ownerDocument) return false;
	              var style = el.ownerDocument.defaultView && el.ownerDocument.defaultView.getComputedStyle
	                ? el.ownerDocument.defaultView.getComputedStyle(el)
	                : null;
	              if (style && (style.visibility === 'hidden' || style.display === 'none')) return false;
	              var rects = el.getClientRects ? el.getClientRects() : null;
	              return !!rects && rects.length > 0;
	            } catch(e) {
	              return false;
	            }
	          }

	          function findVisibleEditable(doc){
	            try {
	              if (!doc) return null;
	              var nodes = doc.querySelectorAll
	                ? doc.querySelectorAll('input,textarea,[contenteditable="true"],[contenteditable=""],[contenteditable="plaintext-only"]')
	                : [];
	              for (var i = 0; i < nodes.length; i++) {
	                var el = nodes[i];
	                if (isEditable(el) && isVisible(el)) return el;
	              }
	            } catch(e) {}
	            return null;
	          }

	          function inspectFrame(frame, allowVisibleFallback){
	            try {
	              var frameDoc = frame && frame.contentWindow && frame.contentWindow.document;
	              if (!frameDoc) return { iframeBoundary: true, el: frame };
	              var next = frameDoc.activeElement;
	              if (next && next !== frame) {
	                if (isEditable(next)) return { iframeBoundary: false, el: next };
	                var tag = (next.tagName || '').toUpperCase();
	                if (tag !== 'HTML' && tag !== 'BODY') {
	                  return { iframeBoundary: false, el: next };
	                }
	              }
	              var visible = allowVisibleFallback ? findVisibleEditable(frameDoc) : null;
	              if (visible) return { iframeBoundary: false, el: visible };
	              return { iframeBoundary: true, el: frame };
	            } catch(_) {
	              return { iframeBoundary: true, el: frame };
	            }
	          }

	          function deepActive(startEl, allowVisibleFallback){
	            var current = startEl || document.activeElement;
	            var depth = 0;
	            while (current && depth < 5) {
	              if (current.shadowRoot && current.shadowRoot.activeElement) {
	                current = current.shadowRoot.activeElement;
	                depth++;
	                continue;
	              }
	              if ((current.tagName || '').toUpperCase() === 'IFRAME') {
	                var frameState = inspectFrame(current, allowVisibleFallback);
	                if (frameState.iframeBoundary) return frameState;
	                current = frameState.el;
	                depth++;
	                continue;
	              }
	              break;
	            }
	            return { iframeBoundary: false, el: current };
	          }

	          function resolveEditableState(startEl, allowVisibleFallback){
	            var resolved = deepActive(startEl, allowVisibleFallback);
	            if (resolved.iframeBoundary) return { editable: true, el: resolved.el };
	            if (isEditable(resolved.el)) return { editable: true, el: resolved.el };
	            if (startEl !== document.activeElement) {
	              var activeResolved = deepActive(document.activeElement, allowVisibleFallback);
	              if (activeResolved.iframeBoundary) return { editable: true, el: activeResolved.el };
	              if (isEditable(activeResolved.el)) return { editable: true, el: activeResolved.el };
	            }
	            return { editable: false, el: resolved.el };
	          }

	          function markLast(el){
	            try { window.__mzrLastEditable = el; } catch(e) {}
	            try {
	              var ownerWin = el && el.ownerDocument && el.ownerDocument.defaultView;
	              if (ownerWin) ownerWin.__mzrLastEditable = el;
	            } catch(e) {}
	          }

	          function notify(flag, reason){
	            try { console.info(flag ? '${FOCUS_CONSOLE_ACTIVE}' : '${FOCUS_CONSOLE_INACTIVE}'); } catch(e){}
	          }

	          function scheduleIframeCandidatePoll(frame, reason){
	            try {
	              if (!frame || (frame.tagName || '').toUpperCase() !== 'IFRAME') return;
	              if (iframePolls.get(frame)) return;
	              var attempts = 0;
	              var timer = window.setInterval(function(){
	                attempts++;
	                var state = inspectFrame(frame, true);
	                if (!state.iframeBoundary && isEditable(state.el)) {
	                  iframePolls.delete(frame);
	                  window.clearInterval(timer);
	                  markLast(state.el);
	                  notify(true, reason || 'iframe-candidate');
	                  return;
	                }
	                if (attempts >= 30) {
	                  iframePolls.delete(frame);
	                  window.clearInterval(timer);
	                }
	              }, 80);
	              iframePolls.set(frame, timer);
	            } catch(e) {}
	          }

	          function attachDocBridge(doc){
	            try {
	              if (!doc || doc.__mzrFocusBridgeDocInstalled) return;
	              doc.__mzrFocusBridgeDocInstalled = true;

	              doc.addEventListener('focusin', function(ev){
	                var state = resolveEditableState(ev.target, true);
	                if (state.editable) {
	                  markLast(state.el || ev.target);
	                  notify(true, 'focusin');
	                } else if (ev.target && (ev.target.tagName || '').toUpperCase() === 'IFRAME') {
	                  scheduleIframeCandidatePoll(ev.target, 'focusin-iframe-candidate');
	                }
	              }, true);

	              doc.addEventListener('focusout', function(){
	                setTimeout(function(){
	                  var state = resolveEditableState(document.activeElement, false);
	                  var still = state.editable;
	                  if (still) markLast(state.el || document.activeElement);
	                  notify(still, 'focusout');
	                }, 0);
	              }, true);

	              doc.addEventListener('pointerdown', function(ev){
	                var target = ev.target;
	                if (isEditable(target)) {
	                  markLast(target);
	                  notify(true, 'pointerdown');
	                } else if (target && (target.tagName || '').toUpperCase() === 'IFRAME') {
	                  scheduleIframeCandidatePoll(target, 'pointerdown-iframe-candidate');
	                } else {
	                  notify(false, 'pointerdown-noneditable');
	                }
	              }, true);
	            } catch(e) {}
	          }

	          function wireFrame(frame){
	            try {
	              if (!frame) return;
	              var installFrameDoc = function(){
	                try {
	                  var frameDoc = frame.contentWindow && frame.contentWindow.document;
	                  if (!frameDoc) return;
	                  if (frame.__mzrFocusBridgeDocRef === frameDoc) return;
	                  frame.__mzrFocusBridgeDocRef = frameDoc;
	                  installDocTree(frameDoc);
	                } catch(_) {}
	              };
	              if (!frame.__mzrFocusBridgeFrameInstalled) {
	                frame.__mzrFocusBridgeFrameInstalled = true;
	                frame.addEventListener('load', installFrameDoc, true);
	              }
	              installFrameDoc();
	            } catch(e) {}
	          }

	          function wireFramesInNode(node){
	            try {
	              if (!node) return;
	              var root = node;
	              if (node.nodeType === 9) {
	                root = node.documentElement || node.body || null;
	              }
	              if (!root || root.nodeType !== 1) return;
	              var tag = (root.tagName || '').toUpperCase();
	              if (tag === 'IFRAME') {
	                wireFrame(root);
	              }
	              var nested = root.querySelectorAll ? root.querySelectorAll('iframe') : [];
	              for (var i = 0; i < nested.length; i++) {
	                wireFrame(nested[i]);
	              }
	            } catch(e) {}
	          }

	          function installDocTree(doc){
	            try {
	              if (!doc) return;
	              attachDocBridge(doc);
	              wireFramesInNode(doc);
	              if (doc.__mzrFocusBridgeObserverInstalled) return;
	              doc.__mzrFocusBridgeObserverInstalled = true;
	              var root = doc.documentElement || doc.body || doc;
	              if (!root) return;
	              var observer = new MutationObserver(function(mutations){
	                for (var i = 0; i < mutations.length; i++) {
	                  var mutation = mutations[i];
	                  var added = mutation && mutation.addedNodes ? mutation.addedNodes : [];
	                  for (var j = 0; j < added.length; j++) {
	                    wireFramesInNode(added[j]);
	                  }
	                }
	                wireFramesInNode(doc);
	              });
	              observer.observe(root, { childList: true, subtree: true });
	            } catch(e) {}
	          }

	          installDocTree(document);
	          if (!window.__mzrFocusBridgeFrameSweepInstalled) {
	            window.__mzrFocusBridgeFrameSweepInstalled = true;
	            window.setInterval(function(){
	              try { wireFramesInNode(document); } catch(_) {}
	            }, 350);
	          }

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
                var bg = cs && cs.color ? cs.backgroundColor : 'var(--mzr-scrollbar-track)';

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
        if (r && typeof r.then === 'function') {
          r.catch(() => {});
        }
      } catch {}
    };
    const syncTimers = new Set<number>();
    let syncInFlight = false;
    let transientPollTimer: number | null = null;
    let transientPollStopTimer: number | null = null;
    const inactiveTimers = new Set<number>();
    let bridgeFocusHoldUntil = 0;
    const BRIDGE_FOCUS_HOLD_MS = 5000;

    const bridgeFocusHoldRemainingMs = () =>
      Math.max(0, Math.round(bridgeFocusHoldUntil - performance.now()));

    const bridgeFocusHoldActive = () => bridgeFocusHoldRemainingMs() > 0;

    const clearInactiveTimers = () => {
      inactiveTimers.forEach((timer) => window.clearTimeout(timer));
      inactiveTimers.clear();
    };

    const syncWebInputContext = () => {
      void (async () => {
        if (syncInFlight) {
          return;
        }
        if (ctxMenuGuardRef?.current) {
          return;
        }
        syncInFlight = true;
        try {
          const ctx = await probeWebInputContext();
          if (!ctx.editable && bridgeFocusHoldActive()) {
            setActiveInputContext(BRIDGE_FOCUS_INPUT_CONTEXT);
            setKbVisible(true);
            return;
          }
          setActiveInputContext(ctx);
          setKbVisible(ctx.editable);
          if (ctx.editable) {
            bridgeFocusHoldUntil = 0;
            if (transientPollTimer != null) {
              window.clearInterval(transientPollTimer);
              transientPollTimer = null;
            }
            if (transientPollStopTimer != null) {
              window.clearTimeout(transientPollStopTimer);
              transientPollStopTimer = null;
            }
          }
        } finally {
          syncInFlight = false;
        }
      })();
    };

    const showBridgeConfirmedKeyboard = () => {
      bridgeFocusHoldUntil = Math.max(bridgeFocusHoldUntil, performance.now() + BRIDGE_FOCUS_HOLD_MS);
      clearInactiveTimers();
      setActiveInputContext(BRIDGE_FOCUS_INPUT_CONTEXT);
      setKbVisible(true);
    };

    const syncWebInputContextPositive = () => {
      void (async () => {
        if (syncInFlight) {
          return;
        }
        if (ctxMenuGuardRef?.current) {
          return;
        }
        syncInFlight = true;
        try {
          const ctx = await probeWebInputContext();
          if (!ctx.editable) {
            if (bridgeFocusHoldActive()) {
              setActiveInputContext(BRIDGE_FOCUS_INPUT_CONTEXT);
              setKbVisible(true);
              return;
            }
            return;
          }
          bridgeFocusHoldUntil = 0;
          setActiveInputContext(ctx);
          setKbVisible(true);
          if (transientPollTimer != null) {
            window.clearInterval(transientPollTimer);
            transientPollTimer = null;
          }
          if (transientPollStopTimer != null) {
            window.clearTimeout(transientPollStopTimer);
            transientPollStopTimer = null;
          }
        } finally {
          syncInFlight = false;
        }
      })();
    };

    const scheduleSyncWebInputContext = () => {
      const delays = [0, 80, 180, 320, 500, 800, 1200];
      delays.forEach((delay) => {
        const timer = window.setTimeout(() => {
          syncTimers.delete(timer);
          syncWebInputContextPositive();
        }, delay);
        syncTimers.add(timer);
      });
    };

    const stopTransientPolling = () => {
      if (transientPollTimer != null) {
        window.clearInterval(transientPollTimer);
        transientPollTimer = null;
      }
      if (transientPollStopTimer != null) {
        window.clearTimeout(transientPollStopTimer);
        transientPollStopTimer = null;
      }
    };

    const startTransientPolling = () => {
      if (ctxMenuGuardRef?.current) {
        return;
      }
      if (transientPollTimer != null) {
        return;
      }
      transientPollTimer = window.setInterval(() => {
        syncWebInputContextPositive();
      }, 220);
      transientPollStopTimer = window.setTimeout(() => {
        stopTransientPolling();
      }, 4000);
    };

    const scheduleInactiveProbe = () => {
      const delays = [90, 220, 420];
      delays.forEach((delay) => {
        const timer = window.setTimeout(() => {
          inactiveTimers.delete(timer);
          if (
            document.body?.getAttribute('data-mzr-emoji-panel') === '1' ||
            document.body?.getAttribute('data-mzr-emoji-panel-closing') === '1'
          ) {
            return;
          }
          if (oskPressGuardRef.current) return;
          if (ctxMenuGuardRef?.current) return;
          void (async () => {
            const ctx = await probeWebInputContext();
            if (ctx.editable) {
              bridgeFocusHoldUntil = 0;
              setActiveInputContext(ctx);
              setKbVisible(true);
              return;
            }
            if (delay !== delays[delays.length - 1]) return;
            if (bridgeFocusHoldActive()) {
              setActiveInputContext(BRIDGE_FOCUS_INPUT_CONTEXT);
              setKbVisible(true);
              return;
            }
            setActiveInputContext(DEFAULT_ACTIVE_INPUT_CONTEXT);
            setKbVisible(false);
          })();
        }, delay);
        inactiveTimers.add(timer);
      });
    };

    const onConsole = (event: any) => {
      const msg: string = (event && event.message) || '';
      if (msg === FOCUS_CONSOLE_ACTIVE) {
        if (document.body?.getAttribute('data-mzr-osk-user-closing') === '1') {
          return;
        }
        if (oskPressGuardRef.current) {
          showBridgeConfirmedKeyboard();
          return;
        }
        showBridgeConfirmedKeyboard();
        syncWebInputContext();
      } else if (msg === FOCUS_CONSOLE_INACTIVE) {
        if (
          document.body?.getAttribute('data-mzr-emoji-panel') === '1' ||
          document.body?.getAttribute('data-mzr-emoji-panel-closing') === '1'
        ) {
          return;
        }
        if (oskPressGuardRef.current) return;
        scheduleInactiveProbe();
      }
    };

    const unsubscribeOskFocusEvent = ipc.osk.onFocusEvent((payload) => {
      try {
        const currentWebContentsId = typeof wv.getWebContentsId === 'function' ? wv.getWebContentsId() : undefined;
        if (
          typeof payload.webContentsId === 'number' &&
          typeof currentWebContentsId === 'number' &&
          payload.webContentsId !== currentWebContentsId
        ) {
          return;
        }
        const message = typeof payload.message === 'string' ? payload.message : '';
        if (!message) return;
        onConsole({ message });
      } catch {
        // noop
      }
    });

    const onFocusFallback = () => {
      if (oskPressGuardRef.current) {
        return;
      }
      if (ctxMenuGuardRef?.current) {
        return;
      }
      scheduleSyncWebInputContext();
      startTransientPolling();
    };

    const positivePollingTimer = window.setInterval(() => {
      if (oskPressGuardRef.current) return;
      if (ctxMenuGuardRef?.current) return;
      if (
        document.body?.getAttribute('data-mzr-emoji-panel') === '1' ||
        document.body?.getAttribute('data-mzr-emoji-panel-closing') === '1'
      ) {
        return;
      }
      if (document.activeElement !== wv) return;
      syncWebInputContextPositive();
    }, 320);

    install();
    wv.addEventListener('dom-ready', install);
    wv.addEventListener('did-navigate', install);
    wv.addEventListener('did-navigate-in-page', install);
    wv.addEventListener('console-message', onConsole);
    wv.addEventListener('focus', onFocusFallback);
    wv.addEventListener('mousedown', onFocusFallback as EventListener);
    wv.addEventListener('pointerdown', onFocusFallback as EventListener);
    wv.addEventListener('touchstart', onFocusFallback as EventListener);
    wv.addEventListener('mouseup', onFocusFallback as EventListener);
    wv.addEventListener('click', onFocusFallback as EventListener);
    wv.addEventListener('touchend', onFocusFallback as EventListener);

    return () => {
      syncTimers.forEach((timer) => window.clearTimeout(timer));
      syncTimers.clear();
      inactiveTimers.forEach((timer) => window.clearTimeout(timer));
      inactiveTimers.clear();
      stopTransientPolling();
      window.clearInterval(positivePollingTimer);
      wv.removeEventListener('dom-ready', install);
      wv.removeEventListener('did-navigate', install);
      wv.removeEventListener('did-navigate-in-page', install);
      wv.removeEventListener('console-message', onConsole);
      wv.removeEventListener('focus', onFocusFallback);
      wv.removeEventListener('mousedown', onFocusFallback as EventListener);
      wv.removeEventListener('pointerdown', onFocusFallback as EventListener);
      wv.removeEventListener('touchstart', onFocusFallback as EventListener);
      wv.removeEventListener('mouseup', onFocusFallback as EventListener);
      wv.removeEventListener('click', onFocusFallback as EventListener);
      wv.removeEventListener('touchend', onFocusFallback as EventListener);
      unsubscribeOskFocusEvent();
    };
  }, [
    mode,
    getActiveWebview,
    activeId,
    activeViewRevision,
    setActiveInputContext,
    setKbVisible,
    oskPressGuardRef,
    ctxMenuGuardRef,
    probeWebInputContext
  ]);
};
