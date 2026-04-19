'use strict';

import './lib/bootstrap-user-data';

import fs from 'fs';
import path from 'path';
import {
  app,
  BrowserWindow,
  Menu,
  clipboard,
  ipcMain,
  nativeImage,
  nativeTheme,
  powerSaveBlocker,
  screen,
  session,
  webContents,
  type ContextMenuParams,
  type Event,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type WebContents
} from 'electron';
import type { KeyboardInputEvent } from 'electron';

import { resolveMode } from './mode';
import * as windows from './lib/windows';
import * as links from './lib/links';
import {
  createDefaultSettingsState,
  getSessionFilePath,
  getSettingsFilePath,
  readSettingsState,
  writeSettingsState,
  sanitizeDownloadsSettings,
  sanitizeUiSettings,
  sanitizeSettingsPayload,
  sanitizeSecureDnsSettings,
  sanitizeHttpsMode,
  sanitizeSslExceptions,
  sanitizeNetworkSettings,
  sanitizeSavingsSettings,
  sanitizeStartPageSettings,
  type SettingsState,
  type SavingsSettings,
  type StartPageSettings,
  type WebrtcMode,
  type TrackerPrivacySettings,
  type BlockingMode
} from './lib/shortcuts';
import {
  initTrackerBlocker,
  getTrackerStatus,
  setTrackersEnabledGlobal,
  setTrackersSiteAllowed,
  clearTrackerExceptions,
  setAdsEnabledGlobal,
  setAdsSiteAllowed,
  clearAdsExceptions,
  setBlockingMode
} from './lib/tracker-blocker';
import { DEFAULT_LOCALE, isValidLocale } from '../src/i18n/locales';
import { attachCertificateTracking, getCertificateInfo, allowCertificate } from './lib/certificates';
import * as downloads from './lib/downloads';
import * as tor from './lib/tor';
import { updateTorConfig } from './lib/tor-settings';
import { getTorState } from './lib/tor-state';
import type { UISettings } from './lib/shortcuts';
import { registerKeyboardSettingsIPC } from './lib/keyboard-settings-ipc';
import { registerMessengerSettingsIPC } from './lib/messenger-settings-ipc';
import { registerHistoryIpc } from './lib/history-ipc';
import { registerBookmarksIpc } from './lib/bookmarks-ipc';
import { registerFaviconsIpc } from './lib/favicons-ipc';
import { registerFileDialogIpc } from './lib/file-dialog-ipc';
import { registerSecureDnsIpc } from './lib/secure-dns-ipc';
import { getAutofillStateForWebContents, registerPasswordsIpc, requestUnlockDialog } from './lib/pw/ipc';
import { getEntrySecret } from './lib/pw/vault';
import { registerSiteDataIpc } from './lib/site-data-ipc';
import { isCtxtExcludedSite } from '../src/helpers/websiteCtxtExclusions';
import { getSiteKey } from './lib/site-key';
import { getEffectiveWebrtcPolicy, getEffectiveWebrtcPolicySync, setWebrtcMode } from './lib/webrtc-policy';
import { registerCookieSettingsIPC } from './lib/cookie-settings-ipc';
import { getCookieStatus, installCookiePolicy } from './lib/cookie-policy';
import { applySecureDnsFromSettings, resolveSecureDnsConfig, type SecureDnsResolvedConfig } from './lib/secure-dns';
// import { installPermissionHandlers } from './lib/permissions';
// import { installGeoHandlers } from './lib/geo-ipc';

const requireWithExtensions = require as NodeJS.Require & { extensions: NodeJS.RequireExtensions };
if (!requireWithExtensions.extensions['.ts']) {
  requireWithExtensions.extensions['.ts'] = requireWithExtensions.extensions['.js'];
}

const setNativeThemeSource = (theme: 'light' | 'dark'): void => {
  try {
    nativeTheme.themeSource = theme;
  } catch {
    // noop
  }
};
setNativeThemeSource('dark');

// Default environment values (for launches without wrapper scripts)
if (!process.env.XCURSOR_SIZE) {
  process.env.XCURSOR_SIZE = '14';
}
if (!process.env.OZONE_PLATFORM) {
  process.env.OZONE_PLATFORM = 'wayland';
}
if (!process.env.ELECTRON_DISABLE_SANDBOX) {
  process.env.ELECTRON_DISABLE_SANDBOX = '1';
}

const fsp = fs.promises;

const probeWebContentsActiveElement = async (wc: WebContents): Promise<Record<string, unknown>> => {
  try {
    const result = await wc.executeJavaScript(
      `(function(){
        try {
          function describe(el) {
            if (!el) return null;
            var tag = (el.tagName || '').toLowerCase();
            return {
              tag: tag,
              type: typeof el.getAttribute === 'function' ? (el.getAttribute('type') || '') : '',
              id: el.id || '',
              name: typeof el.getAttribute === 'function' ? (el.getAttribute('name') || '') : '',
              className: typeof el.className === 'string' ? el.className.slice(0, 120) : '',
              editable: !!(el.isContentEditable || tag === 'textarea' || tag === 'input'),
              valueLen: typeof el.value === 'string' ? el.value.length : null,
              selectionStart: typeof el.selectionStart === 'number' ? el.selectionStart : null,
              selectionEnd: typeof el.selectionEnd === 'number' ? el.selectionEnd : null,
            };
          }
          return {
            href: location.href,
            hasFocus: !!document.hasFocus(),
            active: describe(document.activeElement),
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })();`,
      false
    );
    return result && typeof result === 'object'
      ? (result as Record<string, unknown>)
      : { value: result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const findEditableFrame = async (
  wc: WebContents
): Promise<{ frame: Electron.WebFrameMain | null; probeDetail?: Record<string, unknown>; reason?: string }> => {
  try {
    const nonTextTypes = new Set(['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image', 'hidden']);
    const probeFrame = async (frame: Electron.WebFrameMain): Promise<{ editable: boolean; detail?: Record<string, unknown> }> => {
      try {
        if (frame.isDestroyed() || frame.detached) return { editable: false };
        const result = await frame.executeJavaScript(
          `(function(){
            try {
              var el = document.activeElement;
              if (!el) return { editable: false };
              var tag = (el.tagName || '').toLowerCase();
              var type = typeof el.getAttribute === 'function' ? (el.getAttribute('type') || '').toLowerCase() : '';
              var editable =
                !!el.isContentEditable ||
                tag === 'textarea' ||
                (tag === 'input' && !${JSON.stringify(Array.from(nonTextTypes))}.includes(type) && !el.disabled && !el.readOnly);
              return {
                editable: editable,
                tag: tag,
                type: type,
                id: el.id || '',
                className: typeof el.className === 'string' ? el.className.slice(0, 120) : '',
                href: location.href
              };
            } catch (error) {
              return { editable: false };
            }
          })();`,
          true
        );
        return result && typeof result === 'object'
          ? {
              editable: (result as { editable?: unknown }).editable === true,
              detail: result as Record<string, unknown>,
            }
          : { editable: false };
      } catch {
        return { editable: false };
      }
    };

    const candidates: Electron.WebFrameMain[] = [];
    if (wc.focusedFrame && !wc.focusedFrame.isDestroyed() && !wc.focusedFrame.detached) {
      candidates.push(wc.focusedFrame);
    }
    for (const frame of wc.mainFrame.framesInSubtree) {
      if (frame.isDestroyed() || frame.detached) continue;
      if (candidates.some((candidate) => candidate.frameTreeNodeId === frame.frameTreeNodeId)) continue;
      candidates.push(frame);
    }

    let frame: Electron.WebFrameMain | null = null;
    let probeDetail: Record<string, unknown> | undefined;
    for (const candidate of candidates) {
      const probed = await probeFrame(candidate);
      if (!probed.editable) continue;
      frame = candidate;
      probeDetail = probed.detail;
      break;
    }
    if (!frame) {
      return { frame: null, reason: 'no-editable-frame' };
    }
    return { frame, probeDetail };
  } catch (error) {
    return {
      frame: null,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

const insertTextIntoFocusedFrame = async (wc: WebContents, text: string): Promise<{ ok: boolean; reason: string; probeDetail?: Record<string, unknown> }> => {
  try {
    const found = await findEditableFrame(wc);
    const frame = found.frame;
    if (!frame) {
      return { ok: false, reason: found.reason ?? 'no-editable-frame' };
    }
    const payload = JSON.stringify(text);
    const result = await frame.executeJavaScript(
      `(function(t){
        try {
          var el = document.activeElement;
          if (!el) return false;
          var tag = (el.tagName || '').toLowerCase();
          if (tag === 'textarea' || tag === 'input') {
            if (el.disabled || el.readOnly) return false;
            var val = String(el.value || '');
            var start = typeof el.selectionStart === 'number' ? el.selectionStart : val.length;
            var end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
            if (typeof el.setRangeText === 'function') {
              el.setRangeText(t, start, end, 'end');
            } else {
              el.value = val.slice(0, start) + t + val.slice(end);
              var pos = start + t.length;
              if (typeof el.setSelectionRange === 'function') el.setSelectionRange(pos, pos);
            }
            try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) {} }
            try {
              var caret = typeof el.selectionStart === 'number' ? el.selectionStart : start + t.length;
              if (typeof el.setSelectionRange === 'function') el.setSelectionRange(caret, caret);
            } catch (_) {}
            try {
              el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: t, bubbles: true, cancelable: true }));
            } catch (_) {}
            el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: t, bubbles: true }));
            try { document.dispatchEvent(new Event('selectionchange', { bubbles: true })); } catch (_) {}
            if ((el.type || '').toLowerCase() === 'email') {
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return true;
          }
          if (el.isContentEditable) {
            var sel = window.getSelection();
            if (!sel || !sel.rangeCount) return false;
            try {
              el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: t, bubbles: true, cancelable: true }));
            } catch (_) {}
            var range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(t));
            range.collapse(false);
            try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) {} }
            el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: t, bubbles: true }));
            try { document.dispatchEvent(new Event('selectionchange', { bubbles: true })); } catch (_) {}
            return true;
          }
          return false;
        } catch (error) {
          return false;
        }
      })(${payload});`,
      true
    );
    return {
      ok: result === true,
      reason: result === true ? 'focused-frame-dom' : 'focused-frame-dom-false',
      ...(found.probeDetail ? { probeDetail: found.probeDetail } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

const handleKeyInEditableFrame = async (
  wc: WebContents,
  key: string
): Promise<{ ok: boolean; reason: string; probeDetail?: Record<string, unknown> }> => {
  try {
    const found = await findEditableFrame(wc);
    const frame = found.frame;
    if (!frame) {
      return { ok: false, reason: found.reason ?? 'no-editable-frame' };
    }
    const payload = JSON.stringify(key);
    const result = await frame.executeJavaScript(
      `(function(key){
        try {
          var el = document.activeElement;
          if (!el) return false;
          var tag = (el.tagName || '').toLowerCase();
          var isTextControl = tag === 'textarea' || tag === 'input';
          if (isTextControl) {
            if (el.disabled || el.readOnly) return false;
            var val = String(el.value || '');
            var start = typeof el.selectionStart === 'number' ? el.selectionStart : val.length;
            var end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
            var nextStart = start;
            var nextEnd = end;
            if (key === 'Backspace') {
              if (start !== end) {
                el.value = val.slice(0, start) + val.slice(end);
                nextStart = nextEnd = start;
              } else if (start > 0) {
                el.value = val.slice(0, start - 1) + val.slice(end);
                nextStart = nextEnd = start - 1;
              }
              try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) {} }
              if (typeof el.setSelectionRange === 'function') el.setSelectionRange(nextStart, nextEnd);
              try {
                el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'deleteContentBackward', bubbles: true, cancelable: true }));
              } catch (_) {}
              el.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
              try { document.dispatchEvent(new Event('selectionchange', { bubbles: true })); } catch (_) {}
              return true;
            }
            if (key === 'ArrowLeft' || key === 'ArrowRight') {
              if (start !== end) {
                nextStart = nextEnd = key === 'ArrowLeft' ? Math.min(start, end) : Math.max(start, end);
              } else {
                nextStart = nextEnd = key === 'ArrowLeft' ? Math.max(0, start - 1) : Math.min(val.length, start + 1);
              }
              try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) {} }
              if (typeof el.setSelectionRange === 'function') el.setSelectionRange(nextStart, nextEnd);
              try { document.dispatchEvent(new Event('selectionchange', { bubbles: true })); } catch (_) {}
              return true;
            }
            if (key === 'Enter') {
              if (tag === 'textarea') {
                var insert = '\\n';
                el.value = val.slice(0, start) + insert + val.slice(end);
                nextStart = nextEnd = start + 1;
                try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) {} }
                if (typeof el.setSelectionRange === 'function') el.setSelectionRange(nextStart, nextEnd);
                try {
                  el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertLineBreak', bubbles: true, cancelable: true }));
                } catch (_) {}
                el.dispatchEvent(new InputEvent('input', { inputType: 'insertLineBreak', bubbles: true }));
                try { document.dispatchEvent(new Event('selectionchange', { bubbles: true })); } catch (_) {}
                return true;
              }
              var form = typeof el.closest === 'function' ? el.closest('form') : null;
              if (form) {
                if (typeof form.requestSubmit === 'function') form.requestSubmit();
                else if (typeof form.submit === 'function') form.submit();
                return true;
              }
            }
            return false;
          }
          if (el.isContentEditable) {
            var sel = window.getSelection();
            if (!sel || !sel.rangeCount) return false;
            var range = sel.getRangeAt(0);
            if (key === 'Backspace') {
              if (!range.collapsed) {
                range.deleteContents();
              } else if (range.startOffset > 0) {
                range.setStart(range.startContainer, range.startOffset - 1);
                range.deleteContents();
              } else {
                return false;
              }
              try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) {} }
              el.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
              try { document.dispatchEvent(new Event('selectionchange', { bubbles: true })); } catch (_) {}
              return true;
            }
            if (key === 'ArrowLeft' || key === 'ArrowRight') {
              if (!sel.isCollapsed) {
                if (key === 'ArrowLeft') sel.collapseToStart();
                else sel.collapseToEnd();
              }
              try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) {} }
              try { document.dispatchEvent(new Event('selectionchange', { bubbles: true })); } catch (_) {}
              return true;
            }
            if (key === 'Enter') {
              try {
                if (document.execCommand('insertLineBreak')) {
                  try { document.dispatchEvent(new Event('selectionchange', { bubbles: true })); } catch (_) {}
                  return true;
                }
              } catch (_) {}
            }
          }
          return false;
        } catch (error) {
          return false;
        }
      })(${payload});`,
      true
    );
    return {
      ok: result === true,
      reason: result === true ? 'focused-frame-key-dom' : 'focused-frame-key-dom-false',
      ...(found.probeDetail ? { probeDetail: found.probeDetail } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

const restoreCaretInEditableFrame = async (wc: WebContents): Promise<boolean> => {
  try {
    const found = await findEditableFrame(wc);
    const frame = found.frame;
    if (!frame) return false;
    const result = await frame.executeJavaScript(
      `(function(){
        try {
          function ensureCaretVisible(el) {
            try {
              var tag = (el.tagName || '').toLowerCase();
              if (tag !== 'textarea' && tag !== 'input') return;
              var value = String(el.value || '');
              var start = typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
              var end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
              var pos = Math.max(start, end);
              var style = getComputedStyle(el);
              var padL = parseFloat(style.paddingLeft || '0') || 0;
              var padR = parseFloat(style.paddingRight || '0') || 0;
              var canvas = window.__mzrCaretCanvas || (window.__mzrCaretCanvas = document.createElement('canvas'));
              var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
              if (!ctx) return;
              var font = ((style.fontWeight || '') + ' ' + (style.fontSize || '') + ' ' + (style.fontFamily || '')).trim();
              if (font) ctx.font = font;
              var before = value.slice(0, pos);
              var measureText = tag === 'textarea' ? (before.split('\n').pop() || '') : before;
              var caretX = ctx.measureText(measureText).width;
              var visibleWidth = Math.max(0, el.clientWidth - padL - padR);
              var viewLeft = el.scrollLeft;
              var viewRight = viewLeft + visibleWidth;
              if (caretX <= 1) {
                el.scrollLeft = 0;
              } else if (caretX < viewLeft + 2) {
                el.scrollLeft = Math.max(0, caretX - 4);
              } else if (caretX > viewRight - 2) {
                el.scrollLeft = Math.max(0, caretX - visibleWidth + 4);
              }
              if (tag === 'textarea') {
                var padT = parseFloat(style.paddingTop || '0') || 0;
                var padB = parseFloat(style.paddingBottom || '0') || 0;
                var borderT = parseFloat(style.borderTopWidth || '0') || 0;
                var borderB = parseFloat(style.borderBottomWidth || '0') || 0;
                var lineHeight = parseFloat(style.lineHeight || '');
                if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
                  var fontSize = parseFloat(style.fontSize || '16') || 16;
                  lineHeight = Math.round(fontSize * 1.3);
                }
                var lineIndex = before.split('\n').length - 1;
                var caretTop = lineIndex * lineHeight + padT + borderT;
                var visibleHeight = el.clientHeight - padB - borderB;
                var viewTop = el.scrollTop;
                var viewBottom = viewTop + visibleHeight;
                if (caretTop < viewTop) {
                  el.scrollTop = Math.max(0, caretTop - 4);
                } else if (caretTop + lineHeight > viewBottom) {
                  el.scrollTop = Math.max(0, caretTop - visibleHeight + lineHeight + 4);
                }
              }
            } catch (_) {}
          }

          var el = document.activeElement;
          if (!el) return false;
          var tag = (el.tagName || '').toLowerCase();
          if (tag === 'textarea' || tag === 'input') {
            try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) {} }
            if (typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number' && typeof el.setSelectionRange === 'function') {
              el.setSelectionRange(el.selectionStart, el.selectionEnd);
            }
            ensureCaretVisible(el);
            try { document.dispatchEvent(new Event('selectionchange', { bubbles: true })); } catch (_) {}
            return true;
          }
          if (el.isContentEditable) {
            try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) {} }
            try { document.dispatchEvent(new Event('selectionchange', { bubbles: true })); } catch (_) {}
            return true;
          }
          return false;
        } catch (error) {
          return false;
        }
      })();`,
      true
    );
    return result === true;
  } catch {
    return false;
  }
};

const restoreCaretInTopDocument = async (wc: WebContents): Promise<boolean> => {
  try {
    const result = await wc.executeJavaScript(
      `(function(){
        try {
          function deepActive(startEl) {
            var current = startEl || document.activeElement;
            var depth = 0;
            while (current && depth < 8) {
              if (current.shadowRoot && current.shadowRoot.activeElement) {
                current = current.shadowRoot.activeElement;
                depth++;
                continue;
              }
              break;
            }
            return current;
          }
          function isEditable(el) {
            if (!el) return false;
            var tag = (el.tagName || '').toLowerCase();
            return !!el.isContentEditable || tag === 'textarea' || tag === 'input';
          }
          function ensureCaretVisible(el) {
            try {
              var tag = (el.tagName || '').toLowerCase();
              if (tag !== 'textarea' && tag !== 'input') return;
              var value = String(el.value || '');
              var start = typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
              var end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
              var pos = Math.max(start, end);
              var style = getComputedStyle(el);
              var padL = parseFloat(style.paddingLeft || '0') || 0;
              var padR = parseFloat(style.paddingRight || '0') || 0;
              var canvas = window.__mzrCaretCanvas || (window.__mzrCaretCanvas = document.createElement('canvas'));
              var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
              if (!ctx) return;
              var font = ((style.fontWeight || '') + ' ' + (style.fontSize || '') + ' ' + (style.fontFamily || '')).trim();
              if (font) ctx.font = font;
              var before = value.slice(0, pos);
              var measureText = tag === 'textarea' ? (before.split('\n').pop() || '') : before;
              var caretX = ctx.measureText(measureText).width;
              var visibleWidth = Math.max(0, el.clientWidth - padL - padR);
              var viewLeft = el.scrollLeft;
              var viewRight = viewLeft + visibleWidth;
              if (caretX <= 1) {
                el.scrollLeft = 0;
              } else if (caretX < viewLeft + 2) {
                el.scrollLeft = Math.max(0, caretX - 4);
              } else if (caretX > viewRight - 2) {
                el.scrollLeft = Math.max(0, caretX - visibleWidth + 4);
              }
              if (tag === 'textarea') {
                var padT = parseFloat(style.paddingTop || '0') || 0;
                var padB = parseFloat(style.paddingBottom || '0') || 0;
                var borderT = parseFloat(style.borderTopWidth || '0') || 0;
                var borderB = parseFloat(style.borderBottomWidth || '0') || 0;
                var lineHeight = parseFloat(style.lineHeight || '');
                if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
                  var fontSize = parseFloat(style.fontSize || '16') || 16;
                  lineHeight = Math.round(fontSize * 1.3);
                }
                var lineIndex = before.split('\n').length - 1;
                var caretTop = lineIndex * lineHeight + padT + borderT;
                var visibleHeight = el.clientHeight - padB - borderB;
                var viewTop = el.scrollTop;
                var viewBottom = viewTop + visibleHeight;
                if (caretTop < viewTop) {
                  el.scrollTop = Math.max(0, caretTop - 4);
                } else if (caretTop + lineHeight > viewBottom) {
                  el.scrollTop = Math.max(0, caretTop - visibleHeight + lineHeight + 4);
                }
              }
            } catch (_) {}
          }

          var el = deepActive(document.activeElement);
          if (!isEditable(el) && window.__mzrLastEditable && isEditable(window.__mzrLastEditable)) {
            el = window.__mzrLastEditable;
          }
          if (!isEditable(el)) return false;
          var tag = (el.tagName || '').toLowerCase();
          try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) {} }
          if ((tag === 'textarea' || tag === 'input') && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number' && typeof el.setSelectionRange === 'function') {
            el.setSelectionRange(el.selectionStart, el.selectionEnd);
            ensureCaretVisible(el);
          }
          try { document.dispatchEvent(new Event('selectionchange', { bubbles: true })); } catch (_) {}
          return true;
        } catch (error) {
          return false;
        }
      })();`,
      false
    );
    return result === true;
  } catch {
    return false;
  }
};

const scheduleCaretRestoreInTopDocument = async (wc: WebContents): Promise<void> => {
  try {
    await wc.executeJavaScript(
      `(function(){
        try {
          if (window.__mzrCaretRestoreTimerIds && Array.isArray(window.__mzrCaretRestoreTimerIds)) {
            for (var i = 0; i < window.__mzrCaretRestoreTimerIds.length; i++) {
              try { window.clearTimeout(window.__mzrCaretRestoreTimerIds[i]); } catch (_) {}
            }
          }
          window.__mzrCaretRestoreTimerIds = [];
          var delays = [0, 24, 80, 180];
          function isEditable(el) {
            if (!el) return false;
            if (el.isContentEditable) return true;
            var tag = (el.tagName || '').toLowerCase();
            return tag === 'textarea' || tag === 'input';
          }
          function deepActive(startEl) {
            var current = startEl || document.activeElement;
            var depth = 0;
            while (current && depth < 8) {
              if (current.shadowRoot && current.shadowRoot.activeElement) {
                current = current.shadowRoot.activeElement;
                depth++;
                continue;
              }
              break;
            }
            return current;
          }
          function restore() {
            try {
              function ensureCaretVisible(el) {
                try {
                  var tag = (el.tagName || '').toLowerCase();
                  if (tag !== 'textarea' && tag !== 'input') return;
                  var value = String(el.value || '');
                  var start = typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
                  var end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
                  var pos = Math.max(start, end);
                  var style = getComputedStyle(el);
                  var padL = parseFloat(style.paddingLeft || '0') || 0;
                  var padR = parseFloat(style.paddingRight || '0') || 0;
                  var canvas = window.__mzrCaretCanvas || (window.__mzrCaretCanvas = document.createElement('canvas'));
                  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
                  if (!ctx) return;
                  var font = ((style.fontWeight || '') + ' ' + (style.fontSize || '') + ' ' + (style.fontFamily || '')).trim();
                  if (font) ctx.font = font;
                  var before = value.slice(0, pos);
                  var measureText = tag === 'textarea' ? (before.split('\\n').pop() || '') : before;
                  var caretX = ctx.measureText(measureText).width;
                  var visibleWidth = Math.max(0, el.clientWidth - padL - padR);
                  var viewLeft = el.scrollLeft;
                  var viewRight = viewLeft + visibleWidth;
                  if (caretX <= 1) {
                    el.scrollLeft = 0;
                  } else if (caretX < viewLeft + 2) {
                    el.scrollLeft = Math.max(0, caretX - 4);
                  } else if (caretX > viewRight - 2) {
                    el.scrollLeft = Math.max(0, caretX - visibleWidth + 4);
                  }
                  if (tag === 'textarea') {
                    var padT = parseFloat(style.paddingTop || '0') || 0;
                    var padB = parseFloat(style.paddingBottom || '0') || 0;
                    var borderT = parseFloat(style.borderTopWidth || '0') || 0;
                    var borderB = parseFloat(style.borderBottomWidth || '0') || 0;
                    var lineHeight = parseFloat(style.lineHeight || '');
                    if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
                      var fontSize = parseFloat(style.fontSize || '16') || 16;
                      lineHeight = Math.round(fontSize * 1.3);
                    }
                    var lineIndex = before.split('\\n').length - 1;
                    var caretTop = lineIndex * lineHeight + padT + borderT;
                    var visibleHeight = el.clientHeight - padB - borderB;
                    var viewTop = el.scrollTop;
                    var viewBottom = viewTop + visibleHeight;
                    if (caretTop < viewTop) {
                      el.scrollTop = Math.max(0, caretTop - 4);
                    } else if (caretTop + lineHeight > viewBottom) {
                      el.scrollTop = Math.max(0, caretTop - visibleHeight + lineHeight + 4);
                    }
                  }
                } catch (_) {}
              }

              var el = deepActive(document.activeElement);
              if (!isEditable(el) && window.__mzrLastEditable && isEditable(window.__mzrLastEditable)) {
                el = window.__mzrLastEditable;
              }
              if (!isEditable(el)) return;
              try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) {} }
              var tag = (el.tagName || '').toLowerCase();
              if ((tag === 'textarea' || tag === 'input') && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number' && typeof el.setSelectionRange === 'function') {
                el.setSelectionRange(el.selectionStart, el.selectionEnd);
                ensureCaretVisible(el);
              }
              try { document.dispatchEvent(new Event('selectionchange', { bubbles: true })); } catch (_) {}
            } catch (_) {}
          }
          for (var d = 0; d < delays.length; d++) {
            var id = window.setTimeout(restore, delays[d]);
            window.__mzrCaretRestoreTimerIds.push(id);
          }
        } catch (_) {}
      })();`,
      false
    );
  } catch {
    // noop
  }
};

const getTorVersionCandidates = (): string[] => {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'app', 'resources', 'tor', 'version.txt'),
    path.join(cwd, 'resources', 'tor', 'version.txt'),
    path.join(process.resourcesPath ?? '', 'tor', 'version.txt')
  ];
  return Array.from(new Set(candidates));
};

const getTorVersion = async (): Promise<string | null> => {
  const candidates = getTorVersionCandidates();
  for (const candidate of candidates) {
    try {
      await fsp.access(candidate, fs.constants.R_OK);
      const data = await fsp.readFile(candidate, 'utf8');
      const trimmed = data.trim();
      if (trimmed.length > 0) return trimmed;
    } catch {
      // ignore
    }
  }
  return null;
};

const { DEFAULT_URL } = windows;

const normalizeBlockingModeValue = (mode: unknown): BlockingMode =>
  mode === 'strict' ? 'strict' : 'basic';

const ensureBlockingModeSaved = async (state: SettingsState | null | undefined): Promise<BlockingMode> => {
  const normalized = normalizeBlockingModeValue(state?.privacy?.blockingMode);
  if (!state || state.privacy?.blockingMode === normalized) return normalized;
  try {
    await writeSettingsState({ ...(state ?? {}), privacy: { ...(state.privacy ?? {}), blockingMode: normalized } });
  } catch (err) {
    console.warn('[merezhyvo] normalize blockingMode failed', err);
  }
  return normalized;
};

void (async () => {
  try {
    const state = await readSettingsState();
    if (state?.downloads) {
      downloads.setDefaultDir(state.downloads.defaultDir);
      downloads.setConcurrent(state.downloads.concurrent);
    }
    if (state?.ui?.theme === 'light') {
      setNativeThemeSource('light');
    } else {
      setNativeThemeSource('dark');
    }
    await ensureBlockingModeSaved(state);
    try {
      await initTrackerBlocker({
        sessions: [session.defaultSession],
        getSettings: () => readSettingsState(),
        onSettingsUpdated: async (settings) => {
          try {
            const current = await readSettingsState();
            await writeSettingsState({
              ...(current ?? {}),
              privacy: { ...(current?.privacy ?? {}), trackers: settings.trackers, ads: settings.ads, blockingMode: normalizeBlockingModeValue(settings.blockingMode) }
            });
          } catch (err) {
            console.warn('[merezhyvo] tracker-blocker settings sync failed', err);
          }
        }
      });
    } catch (err) {
      console.warn('[merezhyvo] tracker blocker init failed', err);
    }
  } catch {
    // noop
  }
})();

const SESSION_SCHEMA = 1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 5;

type ContextMenuMode = windows.Mode;

type ExtendedContextMenuParams = ContextMenuParams & {
  menuSourceType?: string;
  sourceType?: string;
};

type ContextMenuPayload = {
  id?: string;
};

type ContextMenuSizePayload = {
  width?: number;
  height?: number;
};

type LaunchConfig = {
  url: string;
  fullscreen: boolean;
  devtools: boolean;
  modeOverride: ContextMenuMode | null;
  forceDark: boolean;
  startProvided: boolean;
};

type SessionTab = {
  id: string;
  url: string;
  title: string;
  favicon: string;
  pinned: boolean;
  muted: boolean;
  discarded: boolean;
  lastUsedAt: number;
  zoomDesktop?: number;
  zoomMobile?: number;
};

type SessionState = {
  schema: typeof SESSION_SCHEMA;
  activeId: string;
  tabs: SessionTab[];
};

type SessionPayloadLike = {
  schema?: unknown;
  activeId?: unknown;
  tabs?: unknown;
};

type SessionTabLike = {
  id?: unknown;
  url?: unknown;
  title?: unknown;
  favicon?: unknown;
  pinned?: unknown;
  muted?: unknown;
  discarded?: unknown;
  lastUsedAt?: unknown;
  zoomDesktop?: unknown;
  zoomMobile?: unknown;
};

type ContextState = {
  wcId: number | null;
  params: ContextMenuParams | null;
  x: number;
  y: number;
  linkUrl: string;
};

type LastOpenSignature = {
  ts: number;
  x: number;
  y: number;
  ownerId: number;
};

type WebContentsWithHost = WebContents & { hostWebContents?: WebContents | null };

declare global {
  var lastCtx: ContextState | undefined;
}

let playbackBlockerId: number | null = null;

let ctxOpening = false;
let ctxMenuMode: ContextMenuMode = 'desktop';

global.lastCtx = global.lastCtx ?? {
  wcId: null,
  params: null,
  x: 0,
  y: 0,
  linkUrl: ''
};

app.setName('Merezhyvo');
app.setAppUserModelId('dev.naz.r.merezhyvo');

windows.installDesktopName();

Menu.setApplicationMenu(null);

const stopPlaybackBlocker = (id?: number | null): void => {
  const blockerId = typeof id === 'number' ? id : playbackBlockerId;
  if (typeof blockerId !== 'number') return;
  try {
    if (powerSaveBlocker.isStarted(blockerId)) {
      powerSaveBlocker.stop(blockerId);
    }
  } catch (err) {
    console.warn('[merezhyvo] power blocker stop failed:', err);
  }
  if (playbackBlockerId === blockerId) {
    playbackBlockerId = null;
  }
};

const makeSessionTabId = (): string =>
  `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createDefaultSessionState = (): SessionState => {
  const id = makeSessionTabId();
  const now = Date.now();
  return {
    schema: SESSION_SCHEMA,
    activeId: id,
    tabs: [
      {
        id,
        url: DEFAULT_URL,
        title: 'DuckDuckGo',
        favicon: '',
        pinned: false,
        muted: false,
        discarded: false,
        lastUsedAt: now
      }
    ]
  };
};

const redirectMailToGmail = (url: string): string =>
  url.startsWith('https://mail.google.com/')
    ? 'https://gmail.com'
    : url;

const sanitizeSessionPayload = (payload: unknown): SessionState => {
  const now = Date.now();
  const source = payload as SessionPayloadLike | null | undefined;
  if (!source || typeof source !== 'object' || source.schema !== SESSION_SCHEMA) {
    return createDefaultSessionState();
  }

  const sanitizeUrl = (value: string): string => {
    if (!value || !value.trim()) return DEFAULT_URL;
    const trimmed = value.trim();
    const lowered = trimmed.toLowerCase();
    if (
      lowered.includes('dist-electron/main.js') ||
      lowered.startsWith('data:text/html') ||
      lowered.startsWith('chrome-error://') ||
      lowered.includes('chromewebdata')
    ) {
      return DEFAULT_URL;
    }
    return redirectMailToGmail(trimmed);
  };

  const tabsSource = Array.isArray(source.tabs) ? (source.tabs as SessionTabLike[]) : [];
  const tabs: SessionTab[] = [];

  const clampZoom = (value: unknown): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
    return Math.round(clamped * 100) / 100;
  };

  for (const raw of tabsSource) {
    if (!raw || typeof raw !== 'object') continue;
    const id =
      typeof raw.id === 'string' && raw.id.trim().length ? raw.id.trim() : makeSessionTabId();
    const rawUrl =
      typeof raw.url === 'string' && raw.url.trim().length ? raw.url.trim() : DEFAULT_URL;
    const url = sanitizeUrl(rawUrl);
    const title = url === DEFAULT_URL ? '' : (typeof raw.title === 'string' ? raw.title : '');
    const favicon = url === DEFAULT_URL ? '' : (typeof raw.favicon === 'string' ? raw.favicon : '');
    const pinned = Boolean(raw.pinned);
    const muted = Boolean(raw.muted);
    const discarded = Boolean(raw.discarded);
    const lastUsedAt =
      typeof raw.lastUsedAt === 'number' && Number.isFinite(raw.lastUsedAt)
        ? raw.lastUsedAt
        : now;
    const zoomDesktop = clampZoom((raw as SessionTabLike).zoomDesktop);
    const zoomMobile = clampZoom((raw as SessionTabLike).zoomMobile);

    tabs.push({
      id,
      url,
      title,
      favicon,
      pinned,
      muted,
      discarded,
      lastUsedAt,
      zoomDesktop,
      zoomMobile
    });
  }

  if (!tabs.length) {
    return createDefaultSessionState();
  }

  const payloadActiveId = source.activeId;
  const activeId =
    typeof payloadActiveId === 'string' && tabs.some((tab) => tab.id === payloadActiveId)
      ? payloadActiveId
      : tabs[0]?.id ?? makeSessionTabId();

  const normalizedTabs = tabs.map((tab) => {
    if (tab.id === activeId) {
      if (!tab.discarded) return tab;
      return { ...tab, discarded: false };
    }
    if (tab.discarded) return tab;
    return { ...tab, discarded: true };
  });

  return {
    schema: SESSION_SCHEMA,
    activeId,
    tabs: normalizedTabs
  };
};

const normalizeAddress = (value: string | null | undefined): string => {
  if (!value || !value.trim()) return DEFAULT_URL;
  const trimmed = value.trim();
  const lowered = trimmed.replace(/\\/g, '/').toLowerCase();

  if (
    lowered.includes('dist-electron/main.js') ||
    lowered.endsWith('/main.js') ||
    lowered === 'main.js'
  ) {
    return DEFAULT_URL;
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed;

  if (trimmed.includes(' ')) {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
  if (!trimmed.includes('.') && trimmed.toLowerCase() !== 'localhost') {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
  try {
    const candidate = new URL(`https://${trimmed}`);
    return candidate.href;
  } catch {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
};

const isTouchSource = (params: ContextMenuParams | null | undefined): boolean => {
  const typed = params as ExtendedContextMenuParams | null | undefined;
  const src = String(typed?.menuSourceType ?? typed?.sourceType ?? '').toLowerCase();
  return [
    'touch',
    'longpress',
    'longtap',
    'touchmenu',
    'touchhandle',
    'stylus',
    'adjustselection',
    'adjustselectionreset'
  ].includes(src);
};

const resolveOwnerWindow = (wc: WebContents): BrowserWindow | null => {
  const withHost = wc as WebContentsWithHost;
  let owner: WebContents = wc;
  try {
    if (withHost.hostWebContents && !withHost.hostWebContents.isDestroyed()) {
      owner = withHost.hostWebContents;
    }
  } catch {
    // noop
  }
  return BrowserWindow.fromWebContents(owner) ?? BrowserWindow.getFocusedWindow() ?? null;
};

const getTargetWebContents = (contents?: WebContents | null): WebContents | null =>
  contents ?? BrowserWindow.getFocusedWindow()?.webContents ?? null;

let lastOpenSig: LastOpenSignature = { ts: 0, x: 0, y: 0, ownerId: 0 };
const shouldOpenCtxNow = (
  x: number | null | undefined,
  y: number | null | undefined,
  ownerId: number | null | undefined
): boolean => {
  const now = Date.now();
  const dt = now - lastOpenSig.ts;
  const dx = Math.abs((x ?? 0) - (lastOpenSig.x ?? 0));
  const dy = Math.abs((y ?? 0) - (lastOpenSig.y ?? 0));
  const sameOwner = ownerId && ownerId === lastOpenSig.ownerId;
  if (dt < 300 && sameOwner && dx < 8 && dy < 8) return false;
  lastOpenSig = { ts: now, x: x ?? 0, y: y ?? 0, ownerId: ownerId ?? 0 };
  return true;
};

const destroyCtxWindows = (): void => {
  // no separate windows anymore
};

const buildCtxMenuState = async (): Promise<{
  canBack: boolean;
  canForward: boolean;
  hasSelection: boolean;
  isEditable: boolean;
  canPaste: boolean;
  linkUrl: string;
  mediaType?: string;
  mediaSrc?: string;
  pageUrl?: string;
  autofill?: ReturnType<typeof getAutofillStateForWebContents>;
}> => {
  try {
    const ctx = global.lastCtx;
    const wc = ctx?.wcId != null ? webContents.fromId(ctx.wcId) : undefined;
    const canBack = wc?.navigationHistory.canGoBack?.() ?? false;
    const canForward = wc?.navigationHistory.canGoForward?.() ?? false;

    const params = ctx?.params ?? null;
    const selection = params?.selectionText ?? '';
    const hasSelection = Boolean(selection && selection.trim().length);
    const isEditable = Boolean(params?.isEditable);

    let canPaste = false;
    try {
      const text = clipboard.readText() ?? '';
      canPaste = Boolean(isEditable && text.length > 0);
    } catch {
      // noop
    }

    const linkUrl = ctx?.linkUrl ?? '';
    const mediaType = typeof params?.mediaType === 'string' ? params.mediaType : '';
    const mediaSrc = typeof params?.srcURL === 'string' ? params.srcURL : '';
    const pageUrl = typeof params?.pageURL === 'string' ? params.pageURL : '';
    const autofill = getAutofillStateForWebContents(ctx?.wcId ?? undefined);
    return {
      canBack,
      canForward,
      hasSelection,
      isEditable,
      canPaste,
      linkUrl,
      mediaType,
      mediaSrc,
      pageUrl,
      autofill
    };
  } catch {
    return {
      canBack: false,
      canForward: false,
      hasSelection: false,
      isEditable: false,
      canPaste: false,
      linkUrl: '',
      mediaType: '',
      mediaSrc: '',
      pageUrl: '',
      autofill: { available: false, locked: false, options: [], siteName: '' }
    };
  }
};

const notifyCtxHide = (): void => {
  try {
    const ctx = global.lastCtx;
    const wc = ctx?.wcId != null ? webContents.fromId(ctx.wcId) : null;
    const owner = wc ? resolveOwnerWindow(wc) : BrowserWindow.getFocusedWindow();
    if (owner && !owner.isDestroyed()) {
      owner.webContents.send('merezhyvo:ctxmenu:hide');
    }
  } catch {
    // noop
  }
};

const openCtxWindowFor = async (
  contents: WebContents | null,
  params: ContextMenuParams | null | undefined
): Promise<void> => {
  const rawMode = windows.getCurrentMode ? windows.getCurrentMode() : null;
  const normalizedMode: ContextMenuMode = rawMode === 'mobile' ? 'mobile' : 'desktop';
  let uiLanguage: string | undefined;
  let uiTheme: 'light' | 'dark' = 'dark';
  try {
    const st = await readSettingsState();
    const lang = st?.ui?.language;
    uiLanguage = isValidLocale(lang) ? lang : DEFAULT_LOCALE;
    uiTheme = st?.ui?.theme === 'light' ? 'light' : 'dark';
  } catch {
    uiLanguage = DEFAULT_LOCALE;
    uiTheme = 'dark';
  }

  if (isTouchSource(params) && normalizedMode !== 'mobile') {
    return;
  }

  ctxMenuMode = normalizedMode;

  if (ctxOpening) return;
  ctxOpening = true;
  setTimeout(() => {
    ctxOpening = false;
  }, 280);

  const targetWc = getTargetWebContents(contents);
  if (!targetWc || targetWc.isDestroyed()) return;

  try {
    const currentUrl = targetWc.getURL?.() ?? '';
    if (currentUrl && isCtxtExcludedSite(currentUrl, { isEditable: Boolean(params?.isEditable) })) {
      return;
    }
  } catch {
    // ignore URL resolution issues
  }

  const ownerWin = resolveOwnerWindow(targetWc);
  if (!ownerWin || ownerWin.isDestroyed()) return;

  const cursor = screen.getCursorScreenPoint();
  const ownerId = ownerWin.webContents.id;
  if (!shouldOpenCtxNow(cursor.x, cursor.y, ownerId)) return;

  global.lastCtx = {
    wcId: targetWc.id,
    params: params ?? null,
    x: cursor.x,
    y: cursor.y,
    linkUrl: params?.linkURL ?? ''
  };

  destroyCtxWindows();

  try {
    const state = await buildCtxMenuState();
    ownerWin.webContents.send('merezhyvo:ctxmenu:show', {
      mode: ctxMenuMode,
      language: uiLanguage,
      theme: uiTheme,
      state
    });
  } catch {
    // noop
  }

};

const parseMode = (raw: string | null | undefined): ContextMenuMode | null => {
  if (!raw) return null;
  const value = raw.toLowerCase();
  return value === 'desktop' || value === 'mobile' ? (value as ContextMenuMode) : null;
};

const isInternalLaunchArg = (raw: string | null | undefined): boolean => {
  if (!raw) return false;
  const normalized = raw.replace(/\\/g, '/').trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('dist-electron/main.js') ||
    normalized.endsWith('/main.js') ||
    normalized === 'main.js'
  );
};

const parseLaunchConfig = (): LaunchConfig => {
  const offset = process.defaultApp ? 2 : 1;
  const args = process.argv.slice(offset);
  let url = DEFAULT_URL;
  let startProvided = false;
  const envFullscreen = (process.env.MEREZHYVO_FULLSCREEN ?? '').toLowerCase();
  let fullscreen = ['1', 'true', 'yes'].includes(envFullscreen);
  let devtools = process.env.MZV_DEVTOOLS === '1';
  let modeOverride = parseMode(process.env.MZV_MODE ?? '');
  const envForceDark = (process.env.MZV_FORCE_DARK ?? '').toLowerCase();
  let forceDark = ['1', 'true', 'yes'].includes(envForceDark);

  for (const rawArg of args) {
    if (!rawArg) continue;
    if (isInternalLaunchArg(rawArg)) continue;
    if (rawArg === '--force-dark') {
      forceDark = true;
      continue;
    }
    if (rawArg === '--no-force-dark') {
      forceDark = false;
      continue;
    }
    if (rawArg === '--fullscreen') {
      fullscreen = true;
      continue;
    }
    if (rawArg === '--no-fullscreen') {
      fullscreen = false;
      continue;
    }
    if (rawArg === '--devtools') {
      devtools = true;
      continue;
    }
    const modeMatch = rawArg.match(/^--mode=(desktop|mobile)$/i);
    if (modeMatch) {
      const [, modeValue] = modeMatch;
      if (modeValue) {
        modeOverride = modeValue.toLowerCase() as ContextMenuMode;
      }
      continue;
    }

    if (/^-/.test(rawArg)) continue;

    if (url === DEFAULT_URL) {
      url = normalizeAddress(rawArg);
      startProvided = true;
    }
  }

  return { url, fullscreen, devtools, modeOverride, forceDark, startProvided };
};

const launchConfig = parseLaunchConfig();

const resolveStartupSecureDnsConfig = async (): Promise<SecureDnsResolvedConfig> => {
  try {
    const state = await readSettingsState();
    const settings = sanitizeSecureDnsSettings(state.network?.secureDns);
    return resolveSecureDnsConfig(settings, getTorState().enabled);
  } catch {
    return resolveSecureDnsConfig(sanitizeSecureDnsSettings(null), getTorState().enabled);
  }
};

const applySecureDnsCommandLine = (resolved: SecureDnsResolvedConfig): void => {
  app.commandLine.appendSwitch('dns-over-https-mode', resolved.mode);
  if (resolved.servers && resolved.servers.length > 0) {
    app.commandLine.appendSwitch('dns-over-https-servers', resolved.servers.join(','));
  }
};

const startApp = async (): Promise<void> => {
  windows.setLaunchConfig({
    url: launchConfig.url,
    fullscreen: launchConfig.fullscreen,
    devtools: launchConfig.devtools,
    modeOverride: launchConfig.modeOverride ?? undefined,
    startProvided: launchConfig.startProvided
  });

  const secureDnsResolved = await resolveStartupSecureDnsConfig();

  const featureFlags = new Set<string>();
  const existingFeatures = app.commandLine.getSwitchValue('enable-features');
  if (existingFeatures) {
    existingFeatures.split(',').map((value) => value.trim()).filter(Boolean).forEach((value) => featureFlags.add(value));
  }
  if (launchConfig.forceDark) {
    featureFlags.add('WebContentsForceDark');
  }
  if (secureDnsResolved.mode !== 'off') {
    featureFlags.add('DnsOverHttps');
    featureFlags.add('AsyncDns');
  }
  if (featureFlags.size > 0) {
    app.commandLine.appendSwitch('enable-features', Array.from(featureFlags).join(','));
  }

  applySecureDnsCommandLine(secureDnsResolved);

  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-gpu-sandbox');

  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-setuid-sandbox');

  app.commandLine.appendSwitch('use-gl', 'egl');
  app.commandLine.appendSwitch('enable-pinch');
  tor.registerTorHandlers(ipcMain);
  registerKeyboardSettingsIPC();
  registerMessengerSettingsIPC();
  registerHistoryIpc(ipcMain);
  registerBookmarksIpc(ipcMain);
  registerFaviconsIpc(ipcMain);
  registerFileDialogIpc(ipcMain);
  registerCookieSettingsIPC();
  registerSecureDnsIpc(ipcMain);
  registerPasswordsIpc(ipcMain);
  registerSiteDataIpc();

  app.whenReady().then(() => {
    // installPermissionHandlers();
    // installGeoHandlers();
    const initialMode = resolveMode();
    windows.setCurrentMode(initialMode);
    windows.installUserAgentOverride(session.defaultSession);
    installCookiePolicy(session.defaultSession);
    void applySecureDnsFromSettings(getTorState().enabled);
    windows.createMainWindow();

    screen.on('display-added', () => windows.rebalanceMainWindow());
    screen.on('display-removed', () => windows.rebalanceMainWindow());
    screen.on('display-metrics-changed', () => windows.rebalanceMainWindow());

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        windows.createMainWindow();
      }
    });
  });
};

void startApp();

app.on('browser-window-created', (_event: Event, win: BrowserWindow) => {
  windows.applyBrowserWindowPolicies(win);
  win.webContents.on('before-input-event', (_event, input) => {
    const button = (input as { button?: string }).button;
    if (input.type === 'mouseDown' && button === 'right') {
      const cursor = screen.getCursorScreenPoint();
      const ownerId = win.webContents.id;
      if (!shouldOpenCtxNow(cursor.x, cursor.y, ownerId)) return;
      void openCtxWindowFor(win.webContents, null);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void tor.stopTorAndProxy();
});

app.on('web-contents-created', (_event: Event, contents: WebContents) => {
  try {
    const contentsType = typeof contents.getType === 'function' ? (contents.getType() as string) : '';
    if (contentsType !== 'devtools') {
      windows.applyUserAgentToWebContents(contents, contents.getURL?.());
    }
  } catch {
    // noop
  }
  windows.installFileDialogHandler(contents);
  windows.setupSelectFileInterceptor(contents);
  if (typeof contents.getType === 'function' && contents.getType() === 'webview') {
    links.attachLinkPolicy(contents);
    attachCertificateTracking(contents);
  }
  if (typeof contents.getType !== 'function') {
    attachCertificateTracking(contents);
  }
  
  contents.on('context-menu', (event, params) => {
    const url = contents.getURL();
    if (isCtxtExcludedSite(url, { isEditable: Boolean(params?.isEditable) })) {
      event.preventDefault(); // Don't show our menu for Telegram Web
      return;
    }
    try {
      event.preventDefault();
    } catch {
      // noop
    }
    void openCtxWindowFor(contents, params);
  });
});

ipcMain.handle('mzr:ctxmenu:get-state', async () => {
  return buildCtxMenuState();
});

ipcMain.on('mzr:ctxmenu:click', (_event, payload: ContextMenuPayload) => {
  const id = payload?.id;
  if (!id) return;
  try {
    const ctx = global.lastCtx;
    const wc = ctx?.wcId != null ? webContents.fromId(ctx.wcId) : undefined;
    if (!wc || wc.isDestroyed()) return;

    const startDownloadFromCtx = (targetUrl?: string) => {
      const url = targetUrl?.trim();
      if (!url) return;
      try {
        windows.skipAutoCloseForDownload(wc.id);
        wc.downloadURL(url);
      } catch {
        // noop
      }
    };

    if (id.startsWith('pw-fill:')) {
        const entryId = id.slice('pw-fill:'.length);
        try {
          const secret = getEntrySecret(entryId);
          wc.send('merezhyvo:pw:fill', {
            entryId,
            username: secret.username,
            password: secret.password
          });
        } catch {
          // ignore
        }
        return;
      }
    if (id === 'pw-unlock') {
      const ctx = global.lastCtx;
      const pageUrl = ctx?.params?.pageURL ?? '';
      const siteName = (() => {
        try {
          const parsed = pageUrl ? new URL(pageUrl) : null;
          return parsed?.hostname ?? '';
        } catch {
          return '';
        }
      })();
      const origin = pageUrl || ctx?.linkUrl || '';
      requestUnlockDialog({ siteName: siteName || undefined, origin: origin || undefined });
      return;
    }

    if (id === 'back') return void wc.goBack?.();
    if (id === 'forward') return void wc.goForward?.();
    if (id === 'reload') return void wc.reload?.();
    if (id === 'copy-selection') {
      const readSelectionFromPage = async (): Promise<string> => {
        try {
          const script = `
            (function () {
              try {
                var sel = window.getSelection ? window.getSelection() : null;
                if (sel && sel.rangeCount && !sel.isCollapsed) {
                  return String(sel.toString() || '');
                }
                var el = document.activeElement;
                if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                  var start = typeof el.selectionStart === 'number' ? el.selectionStart : 0;
                  var end = typeof el.selectionEnd === 'number' ? el.selectionEnd : 0;
                  if (end > start) {
                    return String((el.value || '').slice(start, end));
                  }
                }
              } catch (err) {
                return '';
              }
              return '';
            })();
          `;
          const result = await wc.executeJavaScript(script, true);
          return typeof result === 'string' ? result : '';
        } catch {
          return '';
        }
      };

      void (async () => {
        const liveText = (await readSelectionFromPage()).trim();
        if (liveText) {
          clipboard.writeText(liveText);
          return;
        }
        const fallbackText = (ctx?.params?.selectionText ?? '').trim();
        if (fallbackText) {
          clipboard.writeText(fallbackText);
          return;
        }
        try {
          wc.copy();
        } catch {
          // noop
        }
      })();
      return;
    }
    if (id === 'open-link') {
      const url = ctx?.linkUrl;
      if (url) {
        const withHost = wc as WebContentsWithHost;
        const embedder = withHost.hostWebContents ?? wc;
        const ownerWin =
          BrowserWindow.fromWebContents(embedder) ?? BrowserWindow.getFocusedWindow();
        if (ownerWin && !ownerWin.isDestroyed()) {
          windows.sendOpenUrl(ownerWin, url, true);
        }
      }
      return;
    }
    if (id === 'copy-link') {
      const url = ctx?.linkUrl;
      if (url) clipboard.writeText(url);
      return;
    }
    if (id === 'download-link') {
      startDownloadFromCtx(ctx?.linkUrl);
      return;
    }
    if (id === 'download-image') {
      startDownloadFromCtx(ctx?.params?.srcURL);
      return;
    }
    if (id === 'copy-image') {
      const params = ctx?.params ?? null;
      const x = typeof params?.x === 'number' ? params.x : null;
      const y = typeof params?.y === 'number' ? params.y : null;
      let copied = false;
      if (Number.isFinite(x) && Number.isFinite(y) && typeof wc.copyImageAt === 'function') {
        try {
          wc.copyImageAt(Math.round(x ?? 0), Math.round(y ?? 0));
          copied = true;
        } catch {
          // noop
        }
      }
      if (copied) return;
      const src = typeof params?.srcURL === 'string' ? params.srcURL : '';
      if (!src) return;
      if (src.startsWith('data:')) {
        try {
          const image = nativeImage.createFromDataURL(src);
          if (!image.isEmpty()) clipboard.writeImage(image);
        } catch {
          // noop
        }
      }
      return;
    }
    if (id === 'download-video') {
      startDownloadFromCtx(ctx?.params?.srcURL);
      return;
    }
    if (id === 'download-audio') {
      startDownloadFromCtx(ctx?.params?.srcURL);
      return;
    }
    if (id === 'paste') {
      try {
        wc.focus();
      } catch {
        // noop
      }
      const text = clipboard.readText() ?? '';
      if (text) {
        try {
          wc.insertText(text);
          return;
        } catch {
          // fallback to paste
        }
      }
      try {
        wc.paste();
      } catch {
        try {
          const withHost = wc as WebContentsWithHost;
          const embedder = withHost.hostWebContents ?? wc;
          const ownerWin =
            BrowserWindow.fromWebContents(embedder) ?? BrowserWindow.getFocusedWindow();
          if (ownerWin && !ownerWin.isDestroyed()) {
            const menu = Menu.buildFromTemplate([{ role: 'paste' }]);
            menu.popup({ window: ownerWin });
          }
        } catch {
          // noop
        }
      }
      return;
    }
    if (id === 'inspect') {
      try {
        wc.openDevTools({ mode: 'detach' });
      } catch {
        // noop
      }
    }
  } catch {
    // ignore errors
  }
});

ipcMain.on('mzr:ctxmenu:close', () => {
  notifyCtxHide();
});

ipcMain.on('mzr:ctxmenu:autosize', (_event, { height: _height, width: _width }: ContextMenuSizePayload) => {
  // no-op with inline context menu
});

ipcMain.handle('merezhyvo:certs:get', (_event, payload) => {
  const wcIdRaw = payload && typeof payload === 'object' ? (payload as { wcId?: unknown }).wcId : undefined;
  const wcId = typeof wcIdRaw === 'number' ? wcIdRaw : Number(wcIdRaw);
  if (!Number.isFinite(wcId)) {
    return { state: 'unknown', updatedAt: Date.now() };
  }
  return getCertificateInfo(wcId);
});

ipcMain.handle('merezhyvo:certs:continue', (_event, payload) => {
  const wcIdRaw = payload && typeof payload === 'object' ? (payload as { wcId?: unknown }).wcId : undefined;
  const wcId = typeof wcIdRaw === 'number' ? wcIdRaw : Number(wcIdRaw);
  if (!Number.isFinite(wcId)) return { ok: false, error: 'Invalid webContents id' };
  const ok = allowCertificate(wcId);
  return ok ? { ok: true } : { ok: false, error: 'No pending certificate decision' };
});

ipcMain.handle('merezhyvo:session:load', async () => {
  try {
    const sessionFile = getSessionFilePath();
    let parsed: unknown = null;
    try {
      const raw = await fsp.readFile(sessionFile, 'utf8');
      parsed = JSON.parse(raw) as unknown;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        console.warn('[merezhyvo] session load: falling back after read failure', err);
      }
    }

    const sanitized = sanitizeSessionPayload(parsed);
    try {
      await fsp.writeFile(sessionFile, JSON.stringify(sanitized, null, 2), 'utf8');
    } catch (err) {
      console.error('[merezhyvo] session load: failed to write sanitized session', err);
    }
    return sanitized;
  } catch (err) {
    console.error('[merezhyvo] session load failed', err);
    const fallback = createDefaultSessionState();
    try {
      await fsp.writeFile(getSessionFilePath(), JSON.stringify(fallback, null, 2), 'utf8');
    } catch (writeErr) {
      console.error('[merezhyvo] unable to write fallback session', writeErr);
    }
    return fallback;
  }
});

ipcMain.handle('merezhyvo:session:save', async (_event: IpcMainInvokeEvent, payload: unknown) => {
  try {
    const sanitized = sanitizeSessionPayload(payload);
    const sessionFile = getSessionFilePath();
    await fsp.writeFile(sessionFile, JSON.stringify(sanitized, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    console.error('[merezhyvo] session save failed', err);
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('merezhyvo:settings:load', async () => {
  try {
    return await readSettingsState();
  } catch (err) {
    console.error('[merezhyvo] settings load failed', err);
    return createDefaultSettingsState();
  }
});

ipcMain.handle('merezhyvo:clipboard:read-text', () => {
  try {
    return clipboard.readText();
  } catch {
    return '';
  }
});

ipcMain.handle('merezhyvo:downloads:settings:get', async () => {
  try {
    const state = await readSettingsState();
    return state.downloads;
  } catch (err) {
    console.error('[merezhyvo] downloads settings load failed', err);
    return sanitizeDownloadsSettings({});
  }
});

  ipcMain.handle('merezhyvo:downloads:settings:set', async (_event, payload: unknown) => {
    try {
      const sanitized = sanitizeDownloadsSettings(payload);
      try {
        await fs.promises.mkdir(sanitized.defaultDir, { recursive: true });
      } catch {
        // ignore directory creation failures
      }
      const nextState = await writeSettingsState({ downloads: sanitized });
      downloads.setDefaultDir(nextState.downloads.defaultDir);
      downloads.setConcurrent(nextState.downloads.concurrent);
      return nextState.downloads;
    } catch (err) {
      console.error('[merezhyvo] downloads settings save failed', err);
      return sanitizeDownloadsSettings(payload);
    }
  });

ipcMain.handle('merezhyvo:settings:https:get', async () => {
  try {
    const state = await readSettingsState();
    return {
      httpsMode: sanitizeHttpsMode(state.httpsMode),
      sslExceptions: sanitizeSslExceptions(state.sslExceptions)
    };
  } catch (err) {
    console.error('[merezhyvo] https settings load failed', err);
    return {
      httpsMode: sanitizeHttpsMode(null),
      sslExceptions: sanitizeSslExceptions(null)
    };
  }
});

ipcMain.handle('merezhyvo:settings:https:set-mode', async (_event, payload: unknown) => {
  const mode =
    typeof payload === 'object' && payload && typeof (payload as { mode?: unknown }).mode !== 'undefined'
      ? sanitizeHttpsMode((payload as { mode?: unknown }).mode)
      : sanitizeHttpsMode(payload);
  try {
    const next = await writeSettingsState({ httpsMode: mode });
    return { ok: true, httpsMode: sanitizeHttpsMode(next.httpsMode) };
  } catch (err) {
    console.error('[merezhyvo] https mode update failed', err);
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('merezhyvo:settings:https:add-exception', async (_event, payload: unknown) => {
  const hostRaw: string =
    typeof payload === 'object' && payload && typeof (payload as { host?: unknown }).host === 'string'
      ? (payload as { host?: string }).host ?? ''
      : '';
  const errorTypeRaw: string =
    typeof payload === 'object' && payload && typeof (payload as { errorType?: unknown }).errorType === 'string'
      ? (payload as { errorType?: string }).errorType ?? ''
      : '';
  const host = hostRaw.trim().toLowerCase();
  const errorType = errorTypeRaw.trim();
  if (!host || !errorType) {
    return { ok: false, error: 'Invalid exception payload' };
  }
  try {
    const state = await readSettingsState();
    const current = sanitizeSslExceptions(state.sslExceptions);
    const key = `${host}__${errorType}`;
    const nextList = [...current];
    if (!current.find((item) => `${item.host}__${item.errorType}` === key)) {
      nextList.push({ host, errorType });
    }
    const nextState = await writeSettingsState({ sslExceptions: nextList });
    return { ok: true, sslExceptions: sanitizeSslExceptions(nextState.sslExceptions) };
  } catch (err) {
    console.error('[merezhyvo] add ssl exception failed', err);
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('merezhyvo:settings:https:remove-exception', async (_event, payload: unknown) => {
  const hostRaw: string =
    typeof payload === 'object' && payload && typeof (payload as { host?: unknown }).host === 'string'
      ? (payload as { host?: string }).host ?? ''
      : '';
  const errorTypeRaw: string =
    typeof payload === 'object' && payload && typeof (payload as { errorType?: unknown }).errorType === 'string'
      ? (payload as { errorType?: string }).errorType ?? ''
      : '';
  const host = hostRaw.trim().toLowerCase();
  const errorType = errorTypeRaw.trim();
  if (!host || !errorType) {
    return { ok: false, error: 'Invalid exception payload' };
  }
  try {
    const state = await readSettingsState();
    const current = sanitizeSslExceptions(state.sslExceptions);
    const nextList = current.filter(
      (item) => !(item.host === host && item.errorType === errorType)
    );
    const nextState = await writeSettingsState({ sslExceptions: nextList });
    return { ok: true, sslExceptions: sanitizeSslExceptions(nextState.sslExceptions) };
  } catch (err) {
    console.error('[merezhyvo] remove ssl exception failed', err);
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('merezhyvo:settings:trackers:get', async () => {
  try {
    const state = await readSettingsState();
    const trackers = state.privacy?.trackers;
    const ads = state.privacy?.ads;
    return {
      enabled: typeof trackers?.enabled === 'boolean' ? trackers.enabled : false,
      exceptions: Array.isArray(trackers?.exceptions) ? trackers.exceptions : [],
      ads: {
        enabled: typeof ads?.enabled === 'boolean' ? ads.enabled : false,
        exceptions: Array.isArray(ads?.exceptions) ? ads.exceptions : []
      }
    } as TrackerPrivacySettings & { ads: { enabled: boolean; exceptions: string[] } };
  } catch (err) {
    console.error('[merezhyvo] trackers settings get failed', err);
    return { enabled: false, exceptions: [] } as TrackerPrivacySettings;
  }
});

ipcMain.handle('merezhyvo:settings:trackers:set-enabled', async (_event, payload: unknown) => {
  const enabled = typeof payload === 'boolean' ? payload : Boolean((payload as { enabled?: unknown })?.enabled);
  try {
    const current = await readSettingsState();
    const nextTrackers: TrackerPrivacySettings = {
      enabled,
      exceptions: Array.isArray(current.privacy?.trackers?.exceptions) ? current.privacy!.trackers!.exceptions : []
    };
    await writeSettingsState({
      privacy: { ...(current.privacy ?? {}), trackers: nextTrackers }
    });
    setTrackersEnabledGlobal(enabled);
    return nextTrackers;
  } catch (err) {
    console.error('[merezhyvo] trackers set-enabled failed', err);
    return { enabled, exceptions: [] } as TrackerPrivacySettings;
  }
});

ipcMain.handle('merezhyvo:settings:trackers:add-exception', async (_event, payload: unknown) => {
  const host =
    typeof payload === 'string'
      ? payload
      : typeof payload === 'object' && payload && typeof (payload as { host?: unknown }).host === 'string'
        ? ((payload as { host?: string }).host ?? '')
        : '';
  const normalized = host.trim().toLowerCase();
  if (!normalized) return { enabled: true, exceptions: [] } as TrackerPrivacySettings;
  try {
    const current = await readSettingsState();
    const existing = Array.isArray(current.privacy?.trackers?.exceptions)
      ? current.privacy!.trackers!.exceptions
      : [];
    const next = Array.from(new Set([...existing, normalized]));
    const nextSettings: TrackerPrivacySettings = {
      enabled: typeof current.privacy?.trackers?.enabled === 'boolean'
        ? current.privacy!.trackers!.enabled
        : false,
      exceptions: next
    };
    await writeSettingsState({
      privacy: { ...(current.privacy ?? {}), trackers: nextSettings }
    });
    setTrackersSiteAllowed(normalized, true);
    return nextSettings;
  } catch (err) {
    console.error('[merezhyvo] trackers add-exception failed', err);
    return { enabled: true, exceptions: [normalized] } as TrackerPrivacySettings;
  }
});

ipcMain.handle('merezhyvo:settings:trackers:remove-exception', async (_event, payload: unknown) => {
  const host =
    typeof payload === 'string'
      ? payload
      : typeof payload === 'object' && payload && typeof (payload as { host?: unknown }).host === 'string'
        ? ((payload as { host?: string }).host ?? '')
        : '';
  const normalized = host.trim().toLowerCase();
  if (!normalized) return { enabled: true, exceptions: [] } as TrackerPrivacySettings;
  try {
    const current = await readSettingsState();
    const existing = Array.isArray(current.privacy?.trackers?.exceptions)
      ? current.privacy!.trackers!.exceptions
      : [];
    const next = existing.filter((item) => item !== normalized);
    const nextSettings: TrackerPrivacySettings = {
      enabled: typeof current.privacy?.trackers?.enabled === 'boolean'
        ? current.privacy!.trackers!.enabled
        : false,
      exceptions: next
    };
    await writeSettingsState({
      privacy: { ...(current.privacy ?? {}), trackers: nextSettings }
    });
    setTrackersSiteAllowed(normalized, false);
    return nextSettings;
  } catch (err) {
    console.error('[merezhyvo] trackers remove-exception failed', err);
    return { enabled: true, exceptions: [] } as TrackerPrivacySettings;
  }
});

ipcMain.handle('merezhyvo:settings:trackers:clear-exceptions', async () => {
  try {
    const current = await readSettingsState();
    const nextSettings: TrackerPrivacySettings = {
      enabled: typeof current.privacy?.trackers?.enabled === 'boolean'
        ? current.privacy!.trackers!.enabled
        : false,
      exceptions: []
    };
    await writeSettingsState({
      privacy: { ...(current.privacy ?? {}), trackers: nextSettings }
    });
    clearTrackerExceptions();
    return nextSettings;
  } catch (err) {
    console.error('[merezhyvo] trackers clear-exceptions failed', err);
    return { enabled: true, exceptions: [] } as TrackerPrivacySettings;
  }
});

ipcMain.handle('merezhyvo:settings:blocking:get', async () => {
  try {
    const state = await readSettingsState();
    const mode = await ensureBlockingModeSaved(state);
    return { mode };
  } catch (err) {
    console.error('[merezhyvo] blocking mode get failed', err);
    return { mode: 'basic' as BlockingMode };
  }
});

ipcMain.handle('merezhyvo:settings:blocking:set', async (_event, payload: unknown) => {
  const modeRaw =
    typeof payload === 'string'
      ? payload
      : typeof payload === 'object' && payload && typeof (payload as { mode?: unknown }).mode === 'string'
        ? ((payload as { mode?: string }).mode ?? '')
        : '';
  const normalized: BlockingMode = normalizeBlockingModeValue(modeRaw);
  try {
    const current = await readSettingsState();
    await writeSettingsState({
      ...(current ?? {}),
      privacy: { ...(current.privacy ?? {}), blockingMode: normalized }
    });
    setBlockingMode(normalized);
    return { mode: normalized };
  } catch (err) {
    console.error('[merezhyvo] blocking mode set failed', err);
    return { mode: normalized };
  }
});

ipcMain.handle('merezhyvo:settings:ads:get', async () => {
  try {
    const state = await readSettingsState();
    const ads = state.privacy?.ads;
    return {
      enabled: typeof ads?.enabled === 'boolean' ? ads.enabled : false,
      exceptions: Array.isArray(ads?.exceptions) ? ads.exceptions : []
    };
  } catch (err) {
    console.error('[merezhyvo] ads settings get failed', err);
    return { enabled: false, exceptions: [] };
  }
});

ipcMain.handle('merezhyvo:settings:ads:set-enabled', async (_event, payload: unknown) => {
  const enabled = typeof payload === 'boolean' ? payload : Boolean((payload as { enabled?: unknown })?.enabled);
  try {
    const current = await readSettingsState();
    const nextAds = {
      enabled,
      exceptions: Array.isArray(current.privacy?.ads?.exceptions) ? current.privacy!.ads!.exceptions : []
    };
    await writeSettingsState({
      privacy: { ...(current.privacy ?? {}), ads: nextAds }
    });
    setAdsEnabledGlobal(enabled);
    return nextAds;
  } catch (err) {
    console.error('[merezhyvo] ads set-enabled failed', err);
    return { enabled, exceptions: [] };
  }
});

ipcMain.handle('merezhyvo:settings:ads:add-exception', async (_event, payload: unknown) => {
  const host =
    typeof payload === 'string'
      ? payload
      : typeof payload === 'object' && payload && typeof (payload as { host?: unknown }).host === 'string'
        ? ((payload as { host?: string }).host ?? '')
        : '';
  const normalized = host.trim().toLowerCase();
  if (!normalized) return { enabled: false, exceptions: [] };
  try {
    const current = await readSettingsState();
    const existing = Array.isArray(current.privacy?.ads?.exceptions)
      ? current.privacy!.ads!.exceptions
      : [];
    const nextSettings = {
      enabled: typeof current.privacy?.ads?.enabled === 'boolean' ? current.privacy!.ads!.enabled : false,
      exceptions: Array.from(new Set([...existing, normalized]))
    };
    await writeSettingsState({
      privacy: { ...(current.privacy ?? {}), ads: nextSettings }
    });
    setAdsSiteAllowed(normalized, true);
    return nextSettings;
  } catch (err) {
    console.error('[merezhyvo] ads add-exception failed', err);
    return { enabled: false, exceptions: [normalized] };
  }
});

ipcMain.handle('merezhyvo:settings:ads:remove-exception', async (_event, payload: unknown) => {
  const host =
    typeof payload === 'string'
      ? payload
      : typeof payload === 'object' && payload && typeof (payload as { host?: unknown }).host === 'string'
        ? ((payload as { host?: string }).host ?? '')
        : '';
  const normalized = host.trim().toLowerCase();
  if (!normalized) return { enabled: false, exceptions: [] };
  try {
    const current = await readSettingsState();
    const existing = Array.isArray(current.privacy?.ads?.exceptions)
      ? current.privacy!.ads!.exceptions
      : [];
    const nextSettings = {
      enabled: typeof current.privacy?.ads?.enabled === 'boolean' ? current.privacy!.ads!.enabled : false,
      exceptions: existing.filter((item) => item !== normalized)
    };
    await writeSettingsState({
      privacy: { ...(current.privacy ?? {}), ads: nextSettings }
    });
    setAdsSiteAllowed(normalized, false);
    return nextSettings;
  } catch (err) {
    console.error('[merezhyvo] ads remove-exception failed', err);
    return { enabled: false, exceptions: [] };
  }
});

ipcMain.handle('merezhyvo:settings:ads:clear-exceptions', async () => {
  try {
    const current = await readSettingsState();
    const nextSettings = {
      enabled: typeof current.privacy?.ads?.enabled === 'boolean' ? current.privacy!.ads!.enabled : false,
      exceptions: []
    };
    await writeSettingsState({
      privacy: { ...(current.privacy ?? {}), ads: nextSettings }
    });
    clearAdsExceptions();
    return nextSettings;
  } catch (err) {
    console.error('[merezhyvo] ads clear-exceptions failed', err);
    return { enabled: false, exceptions: [] };
  }
});

ipcMain.handle('cookies:getStatus', (_event, payload: unknown) => {
  const wcId =
    typeof payload === 'object' &&
    payload &&
    typeof (payload as { webContentsId?: unknown }).webContentsId === 'number'
      ? ((payload as { webContentsId?: number }).webContentsId ?? null)
      : null;
  return getCookieStatus(wcId ?? null);
});

ipcMain.handle('trackers:getStatus', (_event, payload: unknown) => {
  const wcId = typeof payload === 'object' && payload && typeof (payload as { webContentsId?: unknown }).webContentsId === 'number'
    ? ((payload as { webContentsId?: number }).webContentsId ?? null)
    : null;
  return getTrackerStatus(wcId ?? null);
});

ipcMain.handle('trackers:setSiteAllowed', async (_event, payload: unknown) => {
  const host =
    typeof payload === 'string'
      ? payload
      : typeof payload === 'object' && payload && typeof (payload as { siteHost?: unknown }).siteHost === 'string'
        ? ((payload as { siteHost?: string }).siteHost ?? '')
        : '';
  const allowed =
    typeof payload === 'object' && payload && typeof (payload as { allowed?: unknown }).allowed === 'boolean'
      ? Boolean((payload as { allowed?: unknown }).allowed)
      : false;
  const normalized = host.trim().toLowerCase();
  if (!normalized) return getTrackerStatus(null);
  const siteKey = getSiteKey(normalized) ?? normalized;
  try {
    const current = await readSettingsState();
    const existing = Array.isArray(current.privacy?.trackers?.exceptions)
      ? current.privacy!.trackers!.exceptions
      : [];
    const nextExceptions = new Set(existing);
    if (allowed) {
      nextExceptions.add(siteKey);
    } else {
      nextExceptions.delete(siteKey);
    }
    const nextTrackers: TrackerPrivacySettings = {
      enabled: typeof current.privacy?.trackers?.enabled === 'boolean'
        ? current.privacy!.trackers!.enabled
        : false,
      exceptions: Array.from(nextExceptions)
    };
    await writeSettingsState({
      privacy: { ...(current.privacy ?? {}), trackers: nextTrackers }
    });
    setTrackersSiteAllowed(siteKey, allowed);
    return getTrackerStatus((payload as { webContentsId?: number })?.webContentsId ?? null);
  } catch (err) {
    console.error('[merezhyvo] trackers set-site-allowed failed', err);
    return getTrackerStatus((payload as { webContentsId?: number })?.webContentsId ?? null);
  }
});

ipcMain.handle('trackers:setEnabled', async (_event, payload: unknown) => {
  const enabled = typeof payload === 'boolean' ? payload : Boolean((payload as { enabled?: unknown })?.enabled);
  try {
    const current = await readSettingsState();
    const nextTrackers: TrackerPrivacySettings = {
      enabled,
      exceptions: Array.isArray(current.privacy?.trackers?.exceptions)
        ? current.privacy!.trackers!.exceptions
        : []
    };
    await writeSettingsState({
      privacy: { ...(current.privacy ?? {}), trackers: nextTrackers }
    });
    setTrackersEnabledGlobal(enabled);
    return nextTrackers;
  } catch (err) {
    console.error('[merezhyvo] trackers setEnabled failed', err);
    setTrackersEnabledGlobal(enabled);
    return { enabled, exceptions: [] } as TrackerPrivacySettings;
  }
});

ipcMain.handle('trackers:clearExceptions', async () => {
  try {
    const current = await readSettingsState();
    const nextTrackers: TrackerPrivacySettings = {
      enabled: typeof current.privacy?.trackers?.enabled === 'boolean'
        ? current.privacy!.trackers!.enabled
        : false,
      exceptions: []
    };
    await writeSettingsState({
      privacy: { ...(current.privacy ?? {}), trackers: nextTrackers }
    });
    clearTrackerExceptions();
    return nextTrackers;
  } catch (err) {
    console.error('[merezhyvo] trackers clear-exceptions failed', err);
    clearTrackerExceptions();
    return { enabled: false, exceptions: [] } as TrackerPrivacySettings;
  }
});

ipcMain.handle('trackers:setAdsEnabled', async (_event, payload: unknown) => {
  const enabled = typeof payload === 'boolean' ? payload : Boolean((payload as { enabled?: unknown })?.enabled);
  try {
    const current = await readSettingsState();
    const nextAds = {
      enabled,
      exceptions: Array.isArray(current.privacy?.ads?.exceptions)
        ? current.privacy!.ads!.exceptions
        : []
    };
    await writeSettingsState({
      privacy: { ...(current.privacy ?? {}), ads: nextAds }
    });
    setAdsEnabledGlobal(enabled);
    return nextAds;
  } catch (err) {
    console.error('[merezhyvo] ads setEnabled failed', err);
    setAdsEnabledGlobal(enabled);
    return { enabled, exceptions: [] };
  }
});

ipcMain.handle('trackers:setAdsAllowed', async (_event, payload: unknown) => {
  const host =
    typeof payload === 'string'
      ? payload
      : typeof payload === 'object' && payload && typeof (payload as { siteHost?: unknown }).siteHost === 'string'
        ? ((payload as { siteHost?: string }).siteHost ?? '')
        : '';
  const allowed =
    typeof payload === 'object' && payload && typeof (payload as { allowed?: unknown }).allowed === 'boolean'
      ? Boolean((payload as { allowed?: unknown }).allowed)
      : false;
  const normalized = host.trim().toLowerCase();
  if (!normalized) return getTrackerStatus(null);
  const siteKey = getSiteKey(normalized) ?? normalized;
  try {
    const current = await readSettingsState();
    const existing = Array.isArray(current.privacy?.ads?.exceptions)
      ? current.privacy!.ads!.exceptions
      : [];
    const nextExceptions = new Set(existing);
    if (allowed) {
      nextExceptions.add(siteKey);
    } else {
      nextExceptions.delete(siteKey);
    }
    const nextAds = {
      enabled: typeof current.privacy?.ads?.enabled === 'boolean'
        ? current.privacy!.ads!.enabled
        : false,
      exceptions: Array.from(nextExceptions)
    };
    await writeSettingsState({
      privacy: { ...(current.privacy ?? {}), ads: nextAds }
    });
    setAdsSiteAllowed(siteKey, allowed);
    return getTrackerStatus((payload as { webContentsId?: number })?.webContentsId ?? null);
  } catch (err) {
    console.error('[merezhyvo] ads set-site-allowed failed', err);
    return getTrackerStatus((payload as { webContentsId?: number })?.webContentsId ?? null);
  }
});

ipcMain.handle('trackers:setBlockingMode', async (_event, payload: unknown) => {
  const modeRaw =
    typeof payload === 'string'
      ? payload
      : typeof payload === 'object' && payload && typeof (payload as { mode?: unknown }).mode === 'string'
        ? ((payload as { mode?: string }).mode ?? '')
        : '';
  const normalized: BlockingMode = normalizeBlockingModeValue(modeRaw);
  try {
    const current = await readSettingsState();
    await writeSettingsState({
      ...(current ?? {}),
      privacy: { ...(current.privacy ?? {}), blockingMode: normalized }
    });
    setBlockingMode(normalized);
    return getTrackerStatus((payload as { webContentsId?: number })?.webContentsId ?? null);
  } catch (err) {
    console.error('[merezhyvo] trackers setBlockingMode failed', err);
    setBlockingMode(normalized);
    return getTrackerStatus((payload as { webContentsId?: number })?.webContentsId ?? null);
  }
});

ipcMain.handle('trackers:clearAdsExceptions', async () => {
  try {
    const current = await readSettingsState();
    const nextAds = {
      enabled: typeof current.privacy?.ads?.enabled === 'boolean'
        ? current.privacy!.ads!.enabled
        : false,
      exceptions: []
    };
    await writeSettingsState({
      privacy: { ...(current.privacy ?? {}), ads: nextAds }
    });
    clearAdsExceptions();
    return nextAds;
  } catch (err) {
    console.error('[merezhyvo] ads clear-exceptions failed', err);
    clearAdsExceptions();
    return { enabled: false, exceptions: [] };
  }
});

ipcMain.handle('merezhyvo:ui:getScale', async () => {
  try {
    const state = await readSettingsState();
    return {
      scale: state.ui?.scale ?? 1,
      hideFileDialogNote: state.ui?.hideFileDialogNote ?? false,
      language: state.ui?.language ?? DEFAULT_LOCALE,
      theme: state.ui?.theme ?? 'dark',
      webZoomMobile: state.ui?.webZoomMobile ?? 2.3,
      webZoomDesktop: state.ui?.webZoomDesktop ?? 1.0
    };
  } catch {
    return { scale: 1, hideFileDialogNote: false, language: DEFAULT_LOCALE, theme: 'dark', webZoomMobile: 2.3, webZoomDesktop: 1.0 };
  }
});

ipcMain.handle('merezhyvo:ui:setScale', async (_event, payload: unknown) => {
  try {
    const currentState = await readSettingsState();
    const existingUi = currentState?.ui ?? {};
  const patch =
    typeof payload === 'object' && payload && !Array.isArray(payload)
      ? (payload as Partial<UISettings>)
      : {};
  const mergedUi = sanitizeUiSettings({ ...existingUi, ...patch });
    setNativeThemeSource(mergedUi.theme ?? 'dark');
  const nextState = await writeSettingsState({ ui: mergedUi });
  return {
    ok: true,
    scale: nextState.ui?.scale ?? mergedUi.scale,
    hideFileDialogNote: nextState.ui?.hideFileDialogNote ?? mergedUi.hideFileDialogNote,
      language: nextState.ui?.language ?? mergedUi.language,
      theme: nextState.ui?.theme ?? mergedUi.theme,
      webZoomMobile: nextState.ui?.webZoomMobile ?? mergedUi.webZoomMobile,
      webZoomDesktop: nextState.ui?.webZoomDesktop ?? mergedUi.webZoomDesktop
    };
  } catch (err) {
    console.error('[merezhyvo] ui scale update failed', err);
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('merezhyvo:ui:getLanguage', async () => {
  try {
    const state = await readSettingsState();
    return state.ui?.language ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
});

ipcMain.handle('merezhyvo:ui:setLanguage', async (_event, payload: unknown) => {
  const language =
    typeof payload === 'string'
      ? payload
      : typeof payload === 'object' && payload && typeof (payload as { language?: unknown }).language === 'string'
      ? String((payload as { language?: unknown }).language)
      : '';
  if (!language.length) {
    return { ok: false, error: 'Invalid language' };
  }
  try {
    const currentState = await readSettingsState();
    const existingUi = currentState?.ui ?? {};
    const mergedUi = sanitizeUiSettings({ ...existingUi, language });
    const nextState = await writeSettingsState({ ui: mergedUi });
    return {
      ok: true,
      language: nextState.ui?.language ?? mergedUi.language
    };
  } catch (err) {
    console.error('[merezhyvo] ui language update failed', err);
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('merezhyvo:settings:webrtc:get', async () => {
  const policy = await getEffectiveWebrtcPolicy();
  return { mode: policy.mode, enabled: policy.enabled, torEnabled: policy.torEnabled };
});

ipcMain.handle('merezhyvo:settings:webrtc:set-mode', async (_event, payload: unknown) => {
  const modeRaw =
    typeof payload === 'object' && payload && typeof (payload as { mode?: unknown }).mode !== 'undefined'
      ? (payload as { mode?: unknown }).mode
      : payload;
  const normalized: WebrtcMode =
    modeRaw === 'always_off' || modeRaw === 'off_with_tor' ? (modeRaw as WebrtcMode) : 'always_on';
  try {
    const next = await setWebrtcMode(normalized);
    return { ok: true, mode: next };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.on('merezhyvo:webrtc:getEffectiveSync', (event) => {
  try {
    event.returnValue = getEffectiveWebrtcPolicySync();
  } catch {
    event.returnValue = { mode: 'always_on', enabled: true, torEnabled: false };
  }
});

ipcMain.on('merezhyvo:ui:getScaleSync', (event) => {
  try {
    const file = getSettingsFilePath();
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const state = sanitizeSettingsPayload(parsed);
    const scale = state?.ui?.scale;
    if (typeof scale === 'number' && Number.isFinite(scale)) {
      event.returnValue = scale;
      return;
    }
  } catch {
    /* ignore */
  }
  event.returnValue = 1;
});

ipcMain.handle('about:get-info', async () => {
  const torVersion = await getTorVersion();
  return {
    appVersion: app.getVersion(),
    chromiumVersion: process.versions.chrome ?? '',
    torVersion: torVersion ?? null
  };
});

ipcMain.handle('merezhyvo:settings:tor:set-keep', async (_event, payload: unknown) => {
  const keepEnabled =
    typeof payload === 'boolean'
      ? payload
      : typeof payload === 'object' && payload && typeof (payload as { keepEnabled?: unknown }).keepEnabled === 'boolean'
      ? Boolean((payload as { keepEnabled?: boolean }).keepEnabled)
      : null;
  if (typeof keepEnabled !== 'boolean') {
    return { ok: false, error: 'Invalid keepEnabled flag.' };
  }
  try {
      const torConfig = await updateTorConfig({ keepEnabled });
      return { ok: true, keepEnabled: torConfig.keepEnabled };
  } catch (err) {
    console.error('[merezhyvo] settings tor keep update failed', err);
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('merezhyvo:settings:savings:get', async () => {
  try {
    const state = await readSettingsState();
    return sanitizeSavingsSettings(state.savings);
  } catch (err) {
    console.error('[merezhyvo] settings savings get failed', err);
    return sanitizeSavingsSettings(null);
  }
});

ipcMain.handle('merezhyvo:settings:savings:update', async (_event, payload: unknown) => {
  try {
    const state = await readSettingsState();
    const current = sanitizeSavingsSettings(state.savings);
    const patch = (payload && typeof payload === 'object') ? payload as Partial<SavingsSettings> : {};
    const nextSavings = sanitizeSavingsSettings({ ...current, ...patch });
    const nextState = await writeSettingsState({ savings: nextSavings });
    return sanitizeSavingsSettings(nextState.savings);
  } catch (err) {
    console.error('[merezhyvo] settings savings update failed', err);
    return sanitizeSavingsSettings(payload);
  }
});

ipcMain.handle('merezhyvo:settings:start-page:get', async () => {
  try {
    const state = await readSettingsState();
    return sanitizeStartPageSettings(state.startPage);
  } catch (err) {
    console.error('[merezhyvo] settings start page get failed', err);
    return sanitizeStartPageSettings(null);
  }
});

ipcMain.handle('merezhyvo:settings:start-page:update', async (_event, payload: unknown) => {
  try {
    const state = await readSettingsState();
    const current = sanitizeStartPageSettings(state.startPage);
    const patch = (payload && typeof payload === 'object') ? payload as Partial<StartPageSettings> : {};
    const nextStartPage = sanitizeStartPageSettings({ ...current, ...patch });
    const nextState = await writeSettingsState({ startPage: nextStartPage });
    return sanitizeStartPageSettings(nextState.startPage);
  } catch (err) {
    console.error('[merezhyvo] settings start page update failed', err);
    return sanitizeStartPageSettings(payload);
  }
});

ipcMain.handle('merezhyvo:settings:network:update-detected', async (_event, payload: unknown) => {
  try {
    const state = await readSettingsState();
    const current = sanitizeNetworkSettings(state.network);
    const patch = (payload && typeof payload === 'object') ? payload as Partial<typeof current> : {};
    const nextNetwork = sanitizeNetworkSettings({ ...current, ...patch });
    const nextState = await writeSettingsState({ network: nextNetwork });
    return nextState.network ?? nextNetwork;
  } catch (err) {
    console.error('[merezhyvo] settings network update failed', err);
    return sanitizeNetworkSettings(payload);
  }
});

ipcMain.handle('merezhyvo:ua:set-mode', (_event, payload: unknown) => {
  let value: string | null = null;
  if (typeof payload === 'string') {
    value = payload;
  } else if (payload && typeof payload === 'object' && typeof (payload as { mode?: unknown }).mode === 'string') {
    value = String((payload as { mode?: unknown }).mode);
  }

  if (value === 'desktop' || value === 'mobile') {
    windows.setUserAgentOverride(value);
  } else {
    windows.setUserAgentOverride(null);
  }
  return { ok: true };
});

ipcMain.handle('merezhyvo:power:start', () => {
  try {
    if (typeof playbackBlockerId === 'number') {
      if (powerSaveBlocker.isStarted(playbackBlockerId)) {
        return playbackBlockerId;
      }
      stopPlaybackBlocker(playbackBlockerId);
    }
    playbackBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    return playbackBlockerId;
  } catch (err) {
    console.error('[merezhyvo] power blocker start failed:', err);
    playbackBlockerId = null;
    return null;
  }
});

ipcMain.handle('merezhyvo:power:stop', (_event, explicitId: number | null | undefined) => {
  stopPlaybackBlocker(explicitId ?? null);
  return true;
});

ipcMain.handle('merezhyvo:power:isStarted', (_event, explicitId: number | null | undefined) => {
  const id = typeof explicitId === 'number' ? explicitId : playbackBlockerId;
  return typeof id === 'number' && powerSaveBlocker.isStarted(id);
});

ipcMain.handle('merezhyvo:tabs:clean-data', async (_event, payload: unknown) => {
  const url =
    typeof payload === 'string'
      ? payload
      : typeof payload === 'object' && payload && typeof (payload as { url?: unknown }).url === 'string'
      ? ((payload as { url?: string }).url ?? '')
      : '';
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return { ok: false, error: 'URL is required.' };
  }

  const webContentsId =
    typeof payload === 'object' && payload && typeof (payload as { webContentsId?: unknown }).webContentsId === 'number'
      ? ((payload as { webContentsId?: number }).webContentsId ?? null)
      : null;

  let origin: string | null = null;
  try {
    const parsed = new URL(trimmedUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      origin = `${parsed.protocol}//${parsed.host}`;
    } else if (parsed.origin && parsed.origin !== 'null') {
      origin = parsed.origin;
    }
  } catch {
    origin = null;
  }

  try {
    const targetContents =
      typeof webContentsId === 'number' && Number.isFinite(webContentsId)
        ? webContents.fromId(webContentsId)
        : null;
    const targetSession = targetContents?.session ?? session.defaultSession;
    if (!targetSession) {
      return { ok: false, error: 'No session available.' };
    }

    const storages: Array<'cookies' | 'filesystem' | 'indexdb' | 'localstorage' | 'shadercache' | 'websql' | 'serviceworkers' | 'cachestorage'> = [
      'cookies',
      'filesystem',
      'indexdb',
      'localstorage',
      'shadercache',
      'websql',
      'serviceworkers',
      'cachestorage'
    ];
    const storageOptions = origin
      ? {
          origin,
          storages
        }
      : null;

    const tasks: Array<Promise<unknown>> = [];
    if (storageOptions) {
      tasks.push(targetSession.clearStorageData(storageOptions));
    }
    tasks.push(targetSession.clearCache());
    tasks.push(targetSession.clearHostResolverCache());
    tasks.push(targetSession.clearAuthCache());
    await Promise.allSettled(tasks);
    return { ok: true };
  } catch (err) {
    console.error('[merezhyvo] tabs clean data failed', err);
    return { ok: false, error: String(err) };
  }
});

ipcMain.on('tabs:ready', (event: IpcMainEvent) => {
  const win =
    BrowserWindow.fromWebContents(event.sender) ??
    windows.getMainWindow() ??
    null;
  windows.markTabsReady(win);
});

ipcMain.handle(
  'mzr:osk:char',
  async (_e, { wcId, text }: { wcId: number; text: string }) => {
    const wc = webContents.fromId(Number(wcId));
    if (!wc) return { ok: false, error: 'webContents not found' };
    const payload = String(text ?? '');
    if (!payload) return { ok: true };
    const before = await probeWebContentsActiveElement(wc);
    const graphemes = Array.from(payload);
    const active =
      before && typeof before === 'object' && before.active && typeof before.active === 'object'
        ? (before.active as Record<string, unknown>)
        : null;
    const activeTag = typeof active?.tag === 'string' ? active.tag : '';
    const hasFocus = before?.hasFocus === true;
    const preferInsertText = !hasFocus || activeTag === 'iframe';
    // Prefer direct DOM insertion into the actual focused frame when top-level focus
    // is parked on an iframe host. sendInputEvent('char') does not reach that field,
    // and wc.insertText() was unstable in this scenario on UT.
    if (preferInsertText) {
      const frameInsert = await insertTextIntoFocusedFrame(wc, payload);
      if (frameInsert.ok) {
        await restoreCaretInEditableFrame(wc);
        return { ok: true };
      }
    }
    // Keep complex Unicode sequences (emoji with ZWJ/VS/modifiers, flags, etc.) atomic.
    // Sending them as per-char input events can split sequences into stray symbols.
    if (graphemes.length > 1) {
      wc.insertText(payload);
      return { ok: true };
    }
    // Single printable character: use trusted 'char' input event.
    for (const ch of graphemes) {
      wc.sendInputEvent({ type: 'char', keyCode: ch });
    }
    return { ok: true };
  }
);

ipcMain.handle(
  'mzr:osk:key',
  async (
    _e,
    {
      wcId,
      key,
      modifiers,
    }: {
      wcId: number;
      key: string;
      modifiers?: KeyboardInputEvent['modifiers'];
    }
  ) => {
    const wc = webContents.fromId(Number(wcId));
    if (!wc) return { ok: false, error: 'webContents not found' };
    const before = await probeWebContentsActiveElement(wc);
    const active =
      before && typeof before === 'object' && before.active && typeof before.active === 'object'
        ? (before.active as Record<string, unknown>)
        : null;
    const activeTag = typeof active?.tag === 'string' ? active.tag : '';
    const hasFocus = before?.hasFocus === true;
    const preferFrameDom = !hasFocus || activeTag === 'iframe';

    if (preferFrameDom && (key === 'Backspace' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Enter')) {
      const frameKey = await handleKeyInEditableFrame(wc, key);
      if (frameKey.ok) {
        await restoreCaretInEditableFrame(wc);
        return { ok: true };
      }
    }

    // Map DOM-style keys to Chromium's keyCode strings for sendInputEvent
    const keyCodeMap: Record<string, string> = {
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      ArrowUp: 'Up',
      ArrowDown: 'Down',
    };
    const keyCode = keyCodeMap[key] ?? key;

    // Send real key press/release sequence (trusted)
    const down: KeyboardInputEvent = { type: 'keyDown', keyCode, modifiers };
    wc.sendInputEvent(down);
    wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers });

    return { ok: true };
  }
);
