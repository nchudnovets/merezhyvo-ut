'use strict';

import { ipcRenderer } from 'electron';

let renderLock = false;

type ContextMode = 'desktop' | 'mobile';

type MenuItemOptions = {
  disabled?: boolean;
  kbd?: string;
};

type ContextMenuState = {
  canBack: boolean;
  canForward: boolean;
  hasSelection: boolean;
  isEditable: boolean;
  canPaste: boolean;
  linkUrl: string;
  autofill?: {
    available: boolean;
    locked: boolean;
    options: Array<{ id: string; username: string; siteName: string }>;
    siteName: string;
  };
};

type ElementAttributes = {
  class?: string;
  dataset?: Record<string, string>;
  on?: Record<string, (event: Event) => void>;
  disabled?: boolean;
} & Record<string, unknown>;

const MODE: ContextMode = (() => {
  try {
    const params = new URLSearchParams(window.location.search ?? '');
    return params.get('mode') === 'mobile' ? 'mobile' : 'desktop';
  } catch {
    return 'desktop';
  }
})();

try {
  document.documentElement.dataset.mode = MODE;
} catch {
  // ignore dataset errors
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: ElementAttributes = {},
  ...children: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    if (key === 'class') {
      node.className = String(value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value as Record<string, string>);
    } else if (key === 'on' && typeof value === 'object') {
      const listeners = value as Record<string, (event: Event) => void>;
      for (const [eventKey, handler] of Object.entries(listeners)) {
        node.addEventListener(eventKey, handler);
      }
    } else if (key === 'disabled') {
      if (value) node.setAttribute('disabled', '');
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function item(label: string, id: string, opts: MenuItemOptions = {}): HTMLDivElement {
  return el(
    'div',
    {
      class: 'item',
      disabled: opts.disabled,
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

function sep(): HTMLDivElement {
  return el('div', { class: 'sep' });
}

function fillLabel(text: string): HTMLDivElement {
  return el('div', { class: 'fill-label' }, text);
}

function appendAutofillSection(menu: HTMLElement, autofill?: ContextMenuState['autofill']): void {
  if (!autofill?.available) return;
  menu.appendChild(sep());
  menu.appendChild(fillLabel('Fill with password…'));
  if (autofill.locked) {
    menu.appendChild(item('Unlock to fill…', 'pw-unlock'));
  } else if (autofill.options.length === 0) {
    menu.appendChild(fillLabel('No matching passwords'));
  } else {
    autofill.options.forEach((option) => {
      const label = `${option.username} — ${option.siteName}`;
      menu.appendChild(item(label, `pw-fill:${option.id}`));
    });
  }
}

function normalizeState(raw: unknown): ContextMenuState {
  const source = (raw ?? {}) as Partial<ContextMenuState>;
  return {
    canBack: Boolean(source.canBack),
    canForward: Boolean(source.canForward),
    hasSelection: Boolean(source.hasSelection),
    isEditable: Boolean(source.isEditable),
    canPaste: Boolean(source.canPaste),
    linkUrl: typeof source.linkUrl === 'string' ? source.linkUrl : ''
    ,
    autofill: source.autofill
  };
}

function render(): void {
  if (renderLock) {
    return;
  }
  renderLock = true;

  const menu = document.getElementById('menu');
  if (!menu) {
    renderLock = false;
    return;
  }
  menu.innerHTML = '';

  void ipcRenderer
    .invoke('mzr:ctxmenu:get-state')
    .then((state) => {
      const normalized = normalizeState(state);
      try {
        if (normalized.linkUrl) {
          menu.appendChild(item('Open link in new tab', 'open-link'));
          menu.appendChild(item('Copy link address', 'copy-link'));
          menu.appendChild(sep());
        }

        menu.appendChild(
          item('Back', 'back', { disabled: !normalized.canBack, kbd: 'Alt+←' })
        );
        menu.appendChild(
          item('Forward', 'forward', { disabled: !normalized.canForward, kbd: 'Alt+→' })
        );
        menu.appendChild(item('Reload', 'reload', { kbd: 'Ctrl+R' }));

        if (normalized.isEditable || normalized.hasSelection) {
          menu.appendChild(sep());
          if (normalized.hasSelection) {
            menu.appendChild(
              item('Copy selection', 'copy-selection', { kbd: 'Ctrl+C' })
            );
          }
          if (normalized.isEditable) {
            menu.appendChild(
              item('Paste', 'paste', {
                kbd: 'Ctrl+V',
                disabled: !normalized.canPaste
              })
            );
          }
        }

        appendAutofillSection(menu, normalized.autofill);

        menu.appendChild(sep());
        menu.appendChild(item('Inspect element', 'inspect'));

        const raf =
          typeof window.requestAnimationFrame === 'function'
            ? window.requestAnimationFrame.bind(window)
            : (fn: FrameRequestCallback) => window.setTimeout(fn, 16);

        raf(() => {
          const rect = menu.getBoundingClientRect();
          const measuredHeight = Math.max(1, menu.offsetHeight || Math.ceil(rect.height));
          const contentWidth = Math.max(
            menu.scrollWidth || 0,
            menu.offsetWidth || 0,
            Math.ceil(rect.width) || 0
          );
          const measuredWidth = Math.max(1, contentWidth + 2);
          ipcRenderer.send('mzr:ctxmenu:autosize', {
            height: measuredHeight,
            width: measuredWidth
          });
          renderLock = false;
        });
      } catch {
        renderLock = false;
      }
    })
    .catch(() => {
      renderLock = false;
    });
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  render();
} else {
  window.addEventListener('DOMContentLoaded', () => render(), { once: true });
}

ipcRenderer.on('mzr:ctxmenu:render', () => {
  render();
});

declare global {
  interface Window {
    __mzr_render?: () => void;
  }
}

window.__mzr_render = render;

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') ipcRenderer.send('mzr:ctxmenu:close');
});

document.addEventListener('contextmenu', (event) => event.preventDefault());
