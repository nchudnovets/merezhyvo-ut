/* global window, document */
const { ipcRenderer } = require('electron');

// Set to true only while debugging
const DEBUG = false;

let RENDER_LOCK = false;

const MODE = (() => {
  try {
    const params = new URLSearchParams(window.location.search || '');
    return params.get('mode') === 'mobile' ? 'mobile' : 'desktop';
  } catch {
    return 'desktop';
  }
})();

try {
  document.documentElement.dataset.mode = MODE;
} catch (_) {}

function log(...args) {
  if (!DEBUG) return;
  try {
    // mirror to main (optional) and devtools console
    ipcRenderer.send('mzr:ctxmenu:log', args.map(String).join(' '));
  } catch (_) {}
}

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k === 'on') {
      for (const [ek, fn] of Object.entries(v)) n.addEventListener(ek, fn);
    } else if (k === 'disabled') {
      if (v) n.setAttribute('disabled', '');
    } else {
      n.setAttribute(k, String(v));
    }
  }
  for (const c of children) {
    if (c == null) continue;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}

function item(label, id, opts = {}) {
  return el(
    'div',
    {
      class: 'item',
      disabled: !!opts.disabled,
      on: {
        click: () => {
          if (opts.disabled) return;
          ipcRenderer.send('mzr:ctxmenu:click', { id });
          ipcRenderer.send('mzr:ctxmenu:close');
        }
      }
    },
    label,
    opts.kbd ? el('span', { class: 'kbd' }, opts.kbd) : null
  );
}

function sep() { return el('div', { class: 'sep' }); }

function render() {
  if (RENDER_LOCK) {
    log('render skipped (lock)');
    return;
  }
  RENDER_LOCK = true;

  const menu = document.getElementById('menu');
  if (!menu) {
    RENDER_LOCK = false;
    return;
  }
  menu.innerHTML = '';

  ipcRenderer.invoke('mzr:ctxmenu:get-state').then((state) => {
    try {
      if (state.linkUrl) {
        menu.appendChild(item('Open link in new tab', 'open-link'));
        menu.appendChild(item('Copy link address', 'copy-link'));
        menu.appendChild(sep());
      }

      menu.appendChild(item('Back', 'back',    { disabled: !state.canBack,    kbd: 'Alt+←' }));
      menu.appendChild(item('Forward', 'forward', { disabled: !state.canForward, kbd: 'Alt+→' }));
      menu.appendChild(item('Reload', 'reload', { kbd: 'Ctrl+R' }));

      // Edit ops
      if (state.isEditable || state.hasSelection) {
        menu.appendChild(sep());
        if (state.hasSelection) {
          menu.appendChild(item('Copy selection', 'copy-selection', { kbd: 'Ctrl+C' }));
        }
        if (state.isEditable) {
          menu.appendChild(item('Paste', 'paste', { kbd: 'Ctrl+V', disabled: !state.canPaste }));
        }
      }

      menu.appendChild(sep());
      menu.appendChild(item('Inspect element', 'inspect'));

      const raf = (window && window.requestAnimationFrame)
        ? window.requestAnimationFrame.bind(window)
        : (fn) => setTimeout(fn, 16);

      raf(() => {
        const rect = menu.getBoundingClientRect();
        const h = Math.max(1, menu.offsetHeight || Math.ceil(rect.height));
        const contentWidth = Math.max(
          menu.scrollWidth || 0,
          menu.offsetWidth || 0,
          Math.ceil(rect.width) || 0
        );
        const w = Math.max(1, contentWidth + 2); // +2 for borders
        log('measured size:', `${w}x${h}`);
        ipcRenderer.send('mzr:ctxmenu:autosize', { height: h, width: w });
        RENDER_LOCK = false;
      });
    } catch (e) {
      RENDER_LOCK = false;
    }
  }).catch(() => {
    RENDER_LOCK = false;
  });
}

// Initial load
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  render();
} else {
  window.addEventListener('DOMContentLoaded', render, { once: true });
}

// Re-render on each open
ipcRenderer.on('mzr:ctxmenu:render', () => {
  render();
});

// Fallback so main can force render via executeJavaScript
window.__mzr_render = render;

// Close handlers
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') ipcRenderer.send('mzr:ctxmenu:close');
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
