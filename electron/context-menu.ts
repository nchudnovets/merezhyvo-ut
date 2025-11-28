'use strict';

import { ipcRenderer } from 'electron';
import en from '../src/i18n/translations/en';
import uk from '../src/i18n/translations/uk';
import de from '../src/i18n/translations/de';
import fr from '../src/i18n/translations/fr';
import { getI18n } from '../src/i18n/rendererI18n';

let renderLock = false;
let currentLanguage = 'en';
const dictionaries: Record<string, Record<string, string>> = {
  en: en as unknown as Record<string, string>,
  uk: uk as unknown as Record<string, string>,
  de: de as unknown as Record<string, string>,
  fr: fr as unknown as Record<string, string>
};

const t = (key: string): string => {
  const dict = dictionaries[currentLanguage] ?? dictionaries.en;
  return dict?.[key] ?? dictionaries.en?.[key] ?? key;
};

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
  mediaType?: string;
  mediaSrc?: string;
  pageUrl?: string;
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
    label
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
  menu.appendChild(fillLabel(t('ctx.autofill.header')));
  if (autofill.locked) {
    menu.appendChild(item(t('ctx.autofill.unlock'), 'pw-unlock'));
  } else if (autofill.options.length === 0) {
    menu.appendChild(fillLabel(t('ctx.autofill.none')));
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
    linkUrl: typeof source.linkUrl === 'string' ? source.linkUrl : '',
    mediaType: typeof source.mediaType === 'string' ? source.mediaType : undefined,
    mediaSrc: typeof source.mediaSrc === 'string' ? source.mediaSrc : undefined,
    pageUrl: typeof source.pageUrl === 'string' ? source.pageUrl : undefined,
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
          menu.appendChild(item(t('ctx.downloadLink'), 'download-link'));
          menu.appendChild(item(t('ctx.openLinkNewTab'), 'open-link'));
          menu.appendChild(item(t('ctx.copyLink'), 'copy-link'));
          menu.appendChild(sep());
        }

        if (normalized.mediaType === 'image' && normalized.mediaSrc) {
          menu.appendChild(item(t('ctx.downloadImage'), 'download-image'));
        }
        if ( 
          (normalized.mediaType === 'video' || normalized.mediaType === 'audio') &&
          normalized.mediaSrc
        ) {
          menu.appendChild(
            item(
              normalized.mediaType === 'video' ? t('ctx.downloadVideo') : t('ctx.downloadAudio'),
              normalized.mediaType === 'video' ? 'download-video' : 'download-audio'
            )
          );
        }

        menu.appendChild(
          item(t('ctx.back'), 'back', { disabled: !normalized.canBack, kbd: 'Alt+←' })
        );
        menu.appendChild(
          item(t('ctx.forward'), 'forward', { disabled: !normalized.canForward, kbd: 'Alt+→' })
        );
        menu.appendChild(item(t('ctx.reload'), 'reload', { kbd: 'Ctrl+R' }));

        if (normalized.isEditable || normalized.hasSelection) {
          menu.appendChild(sep());
          if (normalized.hasSelection) {
            menu.appendChild(
              item(t('ctx.copySelection'), 'copy-selection', { kbd: 'Ctrl+C' })
            );
          }
          if (normalized.isEditable) {
            menu.appendChild(
              item(t('ctx.paste'), 'paste', {
                kbd: 'Ctrl+V',
                disabled: !normalized.canPaste
              })
            );
          }
        }

        appendAutofillSection(menu, normalized.autofill);

        menu.appendChild(sep());
        menu.appendChild(item(t('ctx.devtools'), 'inspect'));

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

void ipcRenderer
  .invoke('merezhyvo:ui:getLanguage')
  .then((lang) => {
    if (typeof lang === 'string' && dictionaries[lang]) {
      currentLanguage = lang;
      if (typeof window.__mzr_render === 'function') {
        window.__mzr_render();
      }
    }
  })
  .catch(() => {
    // ignore language load errors
  });

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') ipcRenderer.send('mzr:ctxmenu:close');
});

document.addEventListener('contextmenu', (event) => event.preventDefault());
