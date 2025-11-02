// src/keyboard/KeyboardPane.tsx
import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import Keyboard from 'react-simple-keyboard';

import {
  type LayoutId,
  humanLabel,
  isSymbols,
  nextLayoutId,
  isRTL,
  longPressMap,
  type LanguageId,
  resolveLayoutRows
} from './layouts';
import { ensureOskCssInjected } from './keyboardCss';

type Props = {
  visible: boolean;
  layoutId: LayoutId;
  enabledLayouts: LayoutId[];
  // Placeholder for future context-specific tweaks
  context?: 'text' | 'email';
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

const BASE_DISPLAY: Record<string, string> = {
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

// Keep rows as array-of-keys per row
type Rows = string[][];

// Uppercase letters inside Rows; keep tokens like {shift} intact.
function toShiftRows(rows: Rows): Rows {
  return rows.map((row) =>
    row.map((tok) => {
      if (tok.startsWith('{') && tok.endsWith('}')) return tok;
      return tok
        .split('')
        .map((ch) => (isLetter(ch) ? ch.toUpperCase() : ch))
        .join('');
    })
  );
}

// Convert Rows (string[][]) to react-simple-keyboard expected string[] (space-separated)
function rowsToStrings(rows: Rows): string[] {
  return rows.map((r) => r.join(' '));
}

// Build full rows with service keys depending on current layout type
function addServiceRows(layoutId: LayoutId, alphaRows: Rows): Rows {
  const rows: Rows = alphaRows.map((r) => [...r]); // shallow clone per row

  if (isSymbols(layoutId)) {
    // symbols: append bksp to 3rd row, add bottom row with ABC/sym12/lang/space/arrows/enter
    if (rows.length >= 3 && rows[2]) {
      rows[2] = [...rows[2], '{bksp}'];
    } else {
      rows.push(['{bksp}']);
    }
    rows.push(['{abc}', '{sym12}', '{lang}', '{space}', '{arrowleft}', '{arrowright}', '{enter}']);
  } else {
    // language: add shift/bksp on 3rd row, and bottom service row
    if (rows.length >= 3 && rows[2]) {
      rows[2] = ['{shift}', ...rows[2], '{bksp}'];
    } else if (rows.length === 2) {
      rows.push(['{shift}', '{bksp}']);
    } else {
      rows.push(['{shift}', '{bksp}']);
    }
    rows.push(['{symbols}', '{lang}', '{space}', '{arrowleft}', '{arrowright}', '{enter}']);
  }
  return rows;
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
    visible, layoutId, enabledLayouts,
    injectText, injectBackspace, injectEnter, injectArrow,
    onCycleLayout, onSetLayout, onEnterShouldClose, onClose
  } = p;

  const kbRef = useRef<any>(null);

  // Long-press / pointer-state
  const holdTimer = useRef<number | null>(null);
  const holdActivated = useRef<boolean>(false);
  const heldButton = useRef<string | null>(null);
  const capsFired = useRef<boolean>(false);
  const isPressing = useRef<boolean>(false); // ignore onKeyPress while pointer is down

  const [popup, setPopup] = useState<{ key: string; alts: string[]; x: number; y: number } | null>(null);
  const [shift, setShift] = useState(false);
  const [caps, setCaps] = useState(false);

  useEffect(() => { ensureOskCssInjected(); }, []);

  // Block context-menu while interacting with OSK (prevents UT bubble)
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
    return () => window.removeEventListener('contextmenu', handler as any, { capture: true } as any);
  }, [visible]);

  // Base alphabet/symbols rows (no service keys here)
  const baseAlphaRows = useMemo<Rows>(() => resolveLayoutRows(layoutId, false), [layoutId]);

  // Full rows with service keys for default & shift
  const fullDefaultRows = useMemo<Rows>(() => addServiceRows(layoutId, baseAlphaRows), [layoutId, baseAlphaRows]);
  const fullShiftRows = useMemo<Rows>(() => addServiceRows(layoutId, toShiftRows(baseAlphaRows)), [layoutId, baseAlphaRows]);

  // Build keyboard layout object expected by react-simple-keyboard (string[] per layer)
  const layout = useMemo(() => {
    const rowsDefault = rowsToStrings(fullDefaultRows);
    const rowsShift = rowsToStrings(fullShiftRows);
    return { layout: { default: rowsDefault, shift: rowsShift } };
  }, [fullDefaultRows, fullShiftRows]);

  const display = useMemo(() => {
    const langLabel = humanLabel(
      isSymbols(layoutId) ? (enabledLayouts.find((l) => !isSymbols(l)) || 'en') : layoutId
    );
    return {
      ...BASE_DISPLAY,
      '{space}': langLabel,
      '{shift}': caps ? '⇪' : '⇧'
    };
  }, [layoutId, enabledLayouts, caps]);

  // Language-specific long-press map for current layout
  const lpMap = useMemo<Record<string, string[]>>(() => {
    if (isSymbols(layoutId)) return {};
    const lang = layoutId as LanguageId;
    return longPressMap[lang] ?? {};
  }, [layoutId]);

  const typeKey = useCallback(
    async (button: string) => {
      const b = button.toLowerCase();

      switch (b) {
        case '{bksp}':
          injectBackspace();
          return;
        case '{enter}': {
          injectEnter();
          try {
            const shouldClose = await (onEnterShouldClose?.() ?? false);
            if (shouldClose) onClose?.();
          } catch {}
          return;
        }
        case '{space}':
          injectText(' ');
          return;
        case '{arrowleft}':
          injectArrow('ArrowLeft');
          return;
        case '{arrowright}':
          injectArrow('ArrowRight');
          return;

        case '{shift}': {
          if (capsFired.current) {
            capsFired.current = false;
            return;
          }
          setShift((v) => !v);
          return;
        }

        case '{lang}': {
          const langsOnly = enabledLayouts.filter((id) => !isSymbols(id));
          if (langsOnly.length <= 1) return;
          if (onCycleLayout) onCycleLayout();
          else onSetLayout?.(nextLayoutId(layoutId, langsOnly));
          return;
        }

        case '{symbols}': {
          onSetLayout?.('symbols1');
          return;
        }

        case '{sym12}': {
          if (layoutId === 'symbols1') onSetLayout?.('symbols2');
          else if (layoutId === 'symbols2') onSetLayout?.('symbols1');
          return;
        }

        case '{abc}': {
          const firstLang = enabledLayouts.find((id) => !isSymbols(id)) || 'en';
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
    },
    [
      caps,
      shift,
      injectBackspace,
      injectEnter,
      injectText,
      injectArrow,
      layoutId,
      enabledLayouts,
      onCycleLayout,
      onSetLayout,
      onEnterShouldClose,
      onClose
    ]
  );

  // Ignore library's onKeyPress while the pointer is held down.
  const onKeyPress = useCallback(
    (button: string) => {
      if (isPressing.current) return;
      if (popup) return;
      void typeKey(button);
    },
    [popup, typeKey]
  );

  const clearHold = useCallback(() => {
    if (holdTimer.current != null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdActivated.current = false;
    heldButton.current = null;
  }, []);

  const extractButtonFromTarget = (
    target: EventTarget | null
  ): { btn: string | null; rect: DOMRect | null } => {
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

  const onPointerDownCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!visible) return;
      e.preventDefault();

      isPressing.current = true;

      const { btn, rect } = extractButtonFromTarget(e.target);
      if (!btn) return;

      heldButton.current = btn;
      holdActivated.current = false;

      // Long-press Shift => Caps
      if (btn.toLowerCase() === '{shift}') {
        holdTimer.current = window.setTimeout(() => {
          setCaps((v) => !v);
          setShift(false);
          capsFired.current = true;
          holdActivated.current = true;
        }, LONGPRESS_MS);
        return;
      }

      // Long-press alternates (language-specific)
      const alts =
        lpMap[btn] || lpMap[btn.toLowerCase?.() ?? ''] || lpMap[btn.toUpperCase?.() ?? ''];
      if (alts && alts.length && rect) {
        holdTimer.current = window.setTimeout(() => {
          holdActivated.current = true;
          setPopup({
            key: btn,
            alts,
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top - 10)
          });
        }, LONGPRESS_MS);
        return;
      }
    },
    [visible, lpMap]
  );

  const onPointerUpCapture = useCallback(() => {
    // If no long-press happened and we have a button — treat as a tap
    if (!holdActivated.current && heldButton.current) {
      void typeKey(heldButton.current);
    }
    clearHold();
    isPressing.current = false;
  }, [typeKey, clearHold]);

  const onPointerCancel = useCallback(() => {
    clearHold();
    isPressing.current = false;
  }, [clearHold]);

  const onPickAlt = useCallback(
    (alt0: string) => {
      setPopup(null);
      let alt = alt0;
      const upper = caps ? !shift : shift;
      if (isLetter(alt) && upper) alt = alt.toUpperCase();
      injectText(alt);
      if (shift && !caps) setShift(false);
    },
    [injectText, shift, caps]
  );

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
      dir={isRTL(layoutId) ? 'rtl' : 'ltr'}
      onPointerDownCapture={onPointerDownCapture}
      onPointerUpCapture={onPointerUpCapture}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
      onContextMenu={absorbContext}
    >
      <Keyboard
        keyboardRef={(r) => (kbRef.current = r)}
        layout={layout.layout}
        layoutName={shift || caps ? 'shift' : 'default'}
        display={display}
        theme="hg-theme-default hg-layout-default mzr-osk-theme"
        onKeyPress={onKeyPress}
        onRender={() => {}}
        preventMouseDownDefault={true}
        preventMouseUpDefault={true}
        stopMouseDownPropagation={true}
        stopMouseUpPropagation={true}
        buttonTheme={[
          { class: `osk-enter`, buttons: '{enter}' },
          { class: `osk-bksp`, buttons: '{bksp}' },
          { class: `osk-arrow`, buttons: '{arrowleft} {arrowright}' },
          { class: `osk-space`, buttons: '{space}' },
          { class: `osk-lang`, buttons: '{lang}' },
          { class: `osk-symbols`, buttons: '{symbols} {sym12} {abc}' },
          { class: `osk-shift${shift || caps ? ' osk-active' : ''}`, buttons: '{shift}' }
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
