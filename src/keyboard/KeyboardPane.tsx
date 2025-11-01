import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import Keyboard from 'react-simple-keyboard';

import {
  LayoutId,
  OskContext,
  resolveLayoutRows,
  longPressMap,
  humanLabel,
  isSymbols,
  nextLayoutId
} from './layouts';
import { ensureOskCssInjected } from './keyboardCss';

type Props = {
  visible: boolean;
  layoutId: LayoutId;
  enabledLayouts: LayoutId[];
  context?: OskContext;
  injectText: (text: string) => void;
  injectBackspace: () => void;
  injectEnter: () => void;
  injectArrow: (dir: 'ArrowLeft' | 'ArrowRight') => void;
  onCycleLayout?: () => void;
  onSetLayout?: (id: LayoutId) => void;
  onEnterShouldClose?: () => Promise<boolean> | boolean;
  onClose?: () => void;
};

const SPECIAL = new Set([
  '{bksp}','{enter}','{space}','{tab}','{shift}',
  '{arrowleft}','{arrowright}','{lang}','{symbols}',
  '{abc}','{sym12}'
]);

const BASE_DISPLAY: Record<string,string> = {
  '{bksp}': '⌫',
  '{enter}': '⏎',
  '{space}': '',
  '{arrowleft}': '←',
  '{arrowright}': '→',
  '{lang}': '🌐',
  '{symbols}': '?!#',
  '{abc}': 'ABC',
  '{sym12}': '1/2',
  '{shift}': '⇧'
};

const LONGPRESS_MS = 350;
const isLetter = (s: string) => s.length === 1 && s.toLowerCase() !== s.toUpperCase();

function toShiftRows(rows: string[]): string[] {
  return rows.map(row =>
    row
      .split(' ')
      .map(tok => {
        if (tok.startsWith('{') && tok.endsWith('}')) return tok;
        return tok.split('').map(ch => (isLetter(ch) ? ch.toUpperCase() : ch)).join('');
      })
      .join(' ')
  );
}

const ICON_TO_TOKEN: Record<string, string> = {
  '⌫': '{bksp}',
  '⏎': '{enter}',
  '←': '{arrowleft}',
  '→': '{arrowright}',
  '⇧': '{shift}',
  '⇪': '{shift}',
  '🌐': '{lang}',
  '?!#': '{symbols}',
  'ABC': '{abc}',
  '1/2': '{sym12}'
};

const KeyboardPane: React.FC<Props> = (p) => {
  const {
    visible, layoutId, enabledLayouts, context = 'text',
    injectText, injectBackspace, injectEnter, injectArrow,
    onCycleLayout, onSetLayout, onEnterShouldClose, onClose
  } = p;

  const kbRef = useRef<any>(null);

  const holdTimer = useRef<number | null>(null);
  const holdActivated = useRef<boolean>(false);
  const heldButton = useRef<string | null>(null);
  const capsFired = useRef<boolean>(false);
  const suppressNextPress = useRef<boolean>(false);

  const [popup, setPopup] = useState<{key: string; alts: string[]; x: number; y: number} | null>(null);
  const [shift, setShift] = useState(false);
  const [caps, setCaps]   = useState(false);

  useEffect(() => { ensureOskCssInjected(); }, []);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('.mzr-osk')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('contextmenu', handler, { capture: true });
    return () => window.removeEventListener('contextmenu', handler, { capture: true } as any);
  }, [visible]);

  const baseRows = useMemo(() => resolveLayoutRows(layoutId, context), [layoutId, context]);
  const layout = useMemo(() => {
    const rowsDefault = baseRows;
    const rowsShift   = toShiftRows(baseRows);
    return { layout: { default: rowsDefault, shift: rowsShift } };
  }, [baseRows]);

  const layoutName = shift || caps ? 'shift' : 'default';

  const display = useMemo(() => {
    const langLabel = humanLabel(isSymbols(layoutId) ? (enabledLayouts.find(l => !isSymbols(l)) || 'en') : layoutId);
    return {
      ...BASE_DISPLAY,
      '{space}': langLabel,
      '{shift}': caps ? '⇪' : '⇧'
    };
  }, [layoutId, enabledLayouts, caps]);

  const typeKey = useCallback(async (button: string) => {
    const b = button.toLowerCase();

    switch (b) {
      case '{bksp}': injectBackspace(); return;
      case '{enter}': {
        injectEnter();
        try {
          const shouldClose = await (onEnterShouldClose?.() ?? false);
          if (shouldClose) onClose?.();
        } catch {}
        return;
      }
      case '{space}': injectText(' '); return;
      case '{arrowleft}': injectArrow('ArrowLeft'); return;
      case '{arrowright}': injectArrow('ArrowRight'); return;

      case '{shift}': {
        if (capsFired.current) { capsFired.current = false; return; }
        setShift(v => !v);
        return;
      }

      case '{lang}': {
        const langsOnly = enabledLayouts.filter(id => !isSymbols(id));
        if (langsOnly.length <= 1) return;
        if (onCycleLayout) onCycleLayout();
        else onSetLayout?.(nextLayoutId(layoutId, langsOnly));
        return;
      }

      case '{symbols}': {
        // з літер → символи (сторінка 1)
        onSetLayout?.('symbols1');
        return;
      }

      case '{sym12}': {
        // 1/2 перемикає між двома наборами символів
        if (layoutId === 'symbols1') onSetLayout?.('symbols2');
        else if (layoutId === 'symbols2') onSetLayout?.('symbols1');
        return;
      }

      case '{abc}': {
        // повернутись до першої увімкненої мовної розкладки
        const firstLang = enabledLayouts.find(id => !isSymbols(id)) || 'en';
        onSetLayout?.(firstLang);
        return;
      }

      default: {
        if (SPECIAL.has(b)) return;
        let out = button;
        if (isLetter(out)) {
          const upper = caps ? !shift : shift;
          out = upper ? out.toUpperCase() : out.toLowerCase();
        }
        injectText(out);
        if (shift && !caps) setShift(false);
        return;
      }
    }
  }, [caps, shift, injectBackspace, injectEnter, injectText, injectArrow, layoutId, enabledLayouts, onCycleLayout, onSetLayout, onEnterShouldClose, onClose]);

  const onKeyPress = useCallback((button: string) => {
    if (suppressNextPress.current) {
      suppressNextPress.current = false;
      return;
    }
    if (popup) return;
    void typeKey(button);
  }, [popup, typeKey]);

  const clearHold = useCallback(() => {
    if (holdTimer.current != null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdActivated.current = false;
    heldButton.current = null;
  }, []);

  const extractButtonFromTarget = (target: EventTarget | null): { btn: string | null; rect: DOMRect | null } => {
    const el = (target as HTMLElement | null)?.closest('.hg-button') as HTMLElement | null;
    if (!el) return { btn: null, rect: null };
    const rect = el.getBoundingClientRect();
    const ds: any = (el as any).dataset || {};
    let btn: string | null = el.getAttribute('data-skbtn') || ds.skbtn || null;
    if (!btn) {
      const raw = (el.textContent || '').trim();
      btn = ICON_TO_TOKEN[raw] || (raw || null);
    }
    return { btn, rect };
  };

  const onPointerDownCapture = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!visible) return;
    e.preventDefault();

    const { btn, rect } = extractButtonFromTarget(e.target);
    if (!btn) return;

    heldButton.current = btn;
    holdActivated.current = false;

    // довге натискання Shift → Caps
    if (btn.toLowerCase() === '{shift}') {
      holdTimer.current = window.setTimeout(() => {
        setCaps(v => !v);
        setShift(false);               // <— важливо! гасимо звичайний Shift
        capsFired.current = true;
        holdActivated.current = true;
        suppressNextPress.current = true;
      }, LONGPRESS_MS);
      return;
    }

    // альтернативи для символів/літер
    const alts = longPressMap[btn];
    if (alts && alts.length && rect) {
      holdTimer.current = window.setTimeout(() => {
        holdActivated.current = true;
        suppressNextPress.current = true;
        setPopup({
          key: btn,
          alts,
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top - 10)
        });
      }, LONGPRESS_MS);
      return;
    }
  }, [visible]);

  const onPointerUpCapture = useCallback(() => {
    clearHold();
  }, [clearHold]);

  const onPointerCancel = useCallback(() => {
    clearHold();
  }, [clearHold]);

  const onPickAlt = useCallback((alt0: string) => {
    setPopup(null);
    let alt = alt0;
    // робимо upper-case для alt, якщо це буква і активний upper-режим
    const upper = caps ? !shift : shift;
    if (isLetter(alt) && upper) alt = alt.toUpperCase();
    injectText(alt);
    if (shift && !caps) setShift(false);
  }, [injectText, shift, caps]);

  const absorbContext = useCallback((e: any) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, []);

  if (!visible) return null;

  return (
    <div
      data-soft-keyboard="true"
      className="mzr-osk fixed-osk"
      onPointerDownCapture={onPointerDownCapture}
      onPointerUpCapture={onPointerUpCapture}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
      onContextMenu={absorbContext}
    >
      <Keyboard
        keyboardRef={r => (kbRef.current = r)}
        layout={layout.layout}
        layoutName={layoutName}
        display={display}
        theme="hg-theme-default hg-layout-default mzr-osk-theme"
        onKeyPress={onKeyPress}
        onRender={() => {}}
        preventMouseDownDefault={true}
        preventMouseUpDefault={true}
        stopMouseDownPropagation={true}
        stopMouseUpPropagation={true}
        buttonTheme={[
          { class: `osk-enter`,   buttons: '{enter}' },
          { class: `osk-bksp`,    buttons: '{bksp}' },
          { class: `osk-arrow`,   buttons: '{arrowleft} {arrowright}' },
          { class: `osk-space`,   buttons: '{space}' },
          { class: `osk-lang`,    buttons: '{lang}' },
          { class: `osk-symbols`, buttons: '{symbols} {sym12} {abc}' },
          { class: `osk-shift${(shift || caps) ? ' osk-active' : ''}`, buttons: '{shift}' }
        ]}
      />

      {popup && (
        <div className="mzr-osk-popup" style={{ left: popup.x, top: popup.y }}>
          {popup.alts.map((a) => (
            <button key={a} className="mzr-osk-popup-btn" onClick={() => onPickAlt(a)}>
              {a}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default KeyboardPane;
