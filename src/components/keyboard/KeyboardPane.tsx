import React, {
  useMemo,
  useRef,
  useCallback,
  useState,
  useEffect,
} from 'react';
import Keyboard from 'react-simple-keyboard';

import {
  type LayoutId,
  humanLabel,
  isSymbols,
  nextLayoutId,
  isRTL,
  longPressMap,
  type LanguageId,
  resolveLayoutRows,
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
  onHeightChange?: (height: number) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

const SPECIAL = new Set([
  '{bksp}',
  '{enter}',
  '{space}',
  '{tab}',
  '{shift}',
  '{arrowleft}',
  '{arrowright}',
  '{lang}',
  '{symbols}',
  '{abc}',
  '{sym12}',
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
  '{shift}': '⇧',
};

const LONGPRESS_MS = 350;
const REPEAT_INITIAL_MS = 350;
const REPEAT_INTERVAL_MS = 33;

const isLetter = (s: string) =>
  s.length === 1 && s.toLowerCase() !== s.toUpperCase();

// Keep rows as array-of-keys per row
type Rows = string[][];

/** Only these keys repeat on hold */
type RepeatableKey = '{bksp}' | '{arrowleft}' | '{arrowright}';

const REPEATABLE = new Set<RepeatableKey>([
  '{bksp}',
  '{arrowleft}',
  '{arrowright}',
]);

const ICON_TO_TOKEN: Record<string, string> = {
  '⌫': '{bksp}',
  '⏎': '{enter}',
  '←': '{arrowleft}',
  '→': '{arrowright}',
  '⇧': '{shift}',
  '⇪': '{shift}',
  '🌐': '{lang}',
  '?!#': '{symbols}',
  ABC: '{abc}',
  '1/2': '{sym12}',
};

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
function addServiceRows(
  layoutId: LayoutId,
  alphaRows: Rows,
  showLangKey: boolean
): Rows {
  const rows: Rows = alphaRows.map((r) => [...r]); // shallow clone per row

  if (isSymbols(layoutId)) {
    // symbols: append bksp to 3rd row, add bottom row with ABC/sym12/lang/space/arrows/enter
    if (rows.length >= 3 && rows[2]) {
      rows[2] = [...rows[2], '{bksp}'];
    } else {
      rows.push(['{bksp}']);
    }
    rows.push([
      '{abc}',
      '{sym12}',
      ...(showLangKey ? ['{lang}'] : []),
      '{space}',
      '.',
      ',',
      '{arrowleft}',
      '{arrowright}',
      '{enter}',
    ]);
  } else {
    // language: add shift/bksp on 3rd row, and bottom service row
    if (rows.length >= 3 && rows[2]) {
      rows[2] = ['{shift}', ...rows[2], '{bksp}'];
    } else if (rows.length === 2) {
      rows.push(['{shift}', '{bksp}']);
    } else {
      rows.push(['{shift}', '{bksp}']);
    }
    rows.push([
      '{symbols}',
      ...(showLangKey ? ['{lang}'] : []),
      '{space}',
      '.',
      ',',
      '{arrowleft}',
      '{arrowright}',
      '{enter}',
    ]);
  }
  return rows;
}

/** Extract a keyboard token from an event target */
function extractButtonFromTarget(
  target: EventTarget | null
): { btn: string | null; rect: DOMRect | null; element: HTMLElement | null } {
  const root =
    target instanceof HTMLElement ? target.closest('.hg-button') : null;
  if (!root) return { btn: null, rect: null, element: null };
  const el = root as HTMLElement;
  const rect = el.getBoundingClientRect();

  const dataAttr = el.getAttribute('data-skbtn');
  const ds = el.dataset;
  const dsBtn = ds ? ds['skbtn'] : undefined;

  let btn: string | null = dataAttr ?? dsBtn ?? null;
  if (!btn) {
    const raw = (el.textContent || '').trim();
    btn = ICON_TO_TOKEN[raw] || (raw || null);
  }
  return { btn, rect, element: el };
}

const KeyboardPane: React.FC<Props> = (p) => {
  const {
    visible,
    layoutId,
    enabledLayouts,
    injectText,
    injectBackspace,
    injectEnter,
    injectArrow,
    onCycleLayout,
    onSetLayout,
    onEnterShouldClose,
    onClose,
    onHeightChange,
    onInteractionStart,
    onInteractionEnd,
  } = p;

  // We keep a ref for compatibility; not used directly here
  const kbRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  // Long-press / pointer-state
  const holdTimer = useRef<number | null>(null);
  const holdActivated = useRef<boolean>(false);
  const heldButton = useRef<string | null>(null);
  const capsFired = useRef<boolean>(false);
  const isPressing = useRef<boolean>(false); // block library onKeyPress while pointer is down
  const activeButtonRef = useRef<HTMLElement | null>(null);

  // Auto-repeat timers for repeatable keys
  const repeatStartTimer = useRef<number | null>(null);
  const repeatInterval = useRef<number | null>(null);

  const [popup, setPopup] = useState<{
    key: string;
    alts: string[];
    x: number;
    y: number;
  } | null>(null);
  const [shift, setShift] = useState(false);
  const [caps, setCaps] = useState(false);

   // Keep the webview focused while interacting with the OSK.
  const interactionEndTimer = useRef<number | null>(null);

  const startInteraction = useCallback(() => {
    if (interactionEndTimer.current !== null) {
      window.clearTimeout(interactionEndTimer.current);
      interactionEndTimer.current = null;
    }
    onInteractionStart?.();
  }, [onInteractionStart]);

  const endInteraction = useCallback(() => {
    if (interactionEndTimer.current !== null) {
      window.clearTimeout(interactionEndTimer.current);
    }
    interactionEndTimer.current = window.setTimeout(() => {
      interactionEndTimer.current = null;
      onInteractionEnd?.();
    }, 150);
  }, [onInteractionEnd]);

  useEffect(() => {
    ensureOskCssInjected();
  }, []);

  useEffect(() => {
    if (!onHeightChange) return;
    if (!visible) {
      onHeightChange(0);
      return;
    }
    const node = containerRef.current;
    if (!node) {
      onHeightChange(0);
      return;
    }
    const notify = () => {
      try {
        onHeightChange(node.getBoundingClientRect().height);
      } catch {
        onHeightChange(0);
      }
    };
    notify();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => notify());
      observer.observe(node);
      return () => {
        observer.disconnect();
        onHeightChange(0);
      };
    }
    const id = window.setInterval(() => notify(), 200);
    return () => {
      window.clearInterval(id);
      onHeightChange(0);
    };
  }, [visible, onHeightChange]);

  // Block context-menu while interacting with OSK (prevents UT bubble)
  useEffect(() => {
    if (!visible) return;
    const options: AddEventListenerOptions = { capture: true };
    const handler = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && t.closest('.mzr-osk')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('contextmenu', handler, options);
    return () => window.removeEventListener('contextmenu', handler, options);
  }, [visible]);

  // Base alphabet/symbols rows (no service keys here)
  const baseAlphaRows = useMemo<Rows>(
    () => resolveLayoutRows(layoutId, false),
    [layoutId]
  );

  // Full rows with service keys for default & shift
  const showLanguageToggle = useMemo(
    () => enabledLayouts.filter((id) => !isSymbols(id)).length > 1,
    [enabledLayouts]
  );

  const fullDefaultRows = useMemo<Rows>(
    () => addServiceRows(layoutId, baseAlphaRows, showLanguageToggle),
    [layoutId, baseAlphaRows, showLanguageToggle]
  );
  const fullShiftRows = useMemo<Rows>(
    () => addServiceRows(layoutId, toShiftRows(baseAlphaRows), showLanguageToggle),
    [layoutId, baseAlphaRows, showLanguageToggle]
  );

  // Build keyboard layout object expected by react-simple-keyboard (string[] per layer)
  const layout = useMemo(() => {
    const rowsDefault = rowsToStrings(fullDefaultRows);
    const rowsShift = rowsToStrings(fullShiftRows);
    return { layout: { default: rowsDefault, shift: rowsShift } };
  }, [fullDefaultRows, fullShiftRows]);

  const display = useMemo(() => {
    const langLabel = humanLabel(
      isSymbols(layoutId)
        ? (enabledLayouts.find((l) => !isSymbols(l)) || 'en')
        : layoutId
    );
    return {
      ...BASE_DISPLAY,
      '{space}': showLanguageToggle ? langLabel : ' ',
      '{shift}': caps ? '⇪' : '⇧',
    };
  }, [layoutId, enabledLayouts, caps, showLanguageToggle]);

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
          } catch {
            /* ignore */
          }
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
          const firstLang =
            enabledLayouts.find((id) => !isSymbols(id)) || 'en';
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
    [caps, shift, layoutId, injectBackspace, injectText, injectArrow, injectEnter, onEnterShouldClose, onClose, enabledLayouts, onCycleLayout, onSetLayout]
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

  const activeClearTimerRef = useRef<number | null>(null);

  const setActiveButton = useCallback((next: HTMLElement | null, lingerMs = 0) => {
    const prev = activeButtonRef.current;
    if (prev && prev !== next) {
      if (activeClearTimerRef.current) {
        window.clearTimeout(activeClearTimerRef.current);
        activeClearTimerRef.current = null;
      }
      if (lingerMs > 0 && next === null) {
        // keep previous highlighted briefly for tap feedback
        activeClearTimerRef.current = window.setTimeout(() => {
          prev.classList.remove('mzr-osk-pressed');
          activeClearTimerRef.current = null;
        }, lingerMs);
      } else {
        prev.classList.remove('mzr-osk-pressed');
      }
    }
    if (next) {
      next.classList.add('mzr-osk-pressed');
      activeButtonRef.current = next;
    } else {
      activeButtonRef.current = null;
    }
  }, []);

  const clearRepeat = useCallback(() => {
    if (repeatStartTimer.current !== null) {
      window.clearTimeout(repeatStartTimer.current);
      repeatStartTimer.current = null;
    }
    if (repeatInterval.current !== null) {
      window.clearInterval(repeatInterval.current);
      repeatInterval.current = null;
    }
  }, []);

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    clearRepeat();
    holdActivated.current = false;
    heldButton.current = null;
    setActiveButton(null, 90);
  }, [clearRepeat, setActiveButton]);

  const onPointerDownCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!visible) return;
      startInteraction();

      // Prevent OSK UI from stealing focus from the <webview>.
      e.preventDefault();
      e.stopPropagation();
      try { (e.currentTarget as any).setPointerCapture?.(e.pointerId); } catch {}

      isPressing.current = true;

      const { btn, rect, element } = extractButtonFromTarget(e.target);
      if (!btn) {
        setActiveButton(null);
        return;
      }

      setActiveButton(element);

      heldButton.current = btn;
      holdActivated.current = false;

      // Auto-repeat for repeatable keys: immediate action + repeat after delay
      if (REPEATABLE.has(btn.toLowerCase() as RepeatableKey)) {
        // Immediate single action
        void typeKey(btn);
        // Mark as "handled" to avoid extra on release
        holdActivated.current = true;

        repeatStartTimer.current = window.setTimeout(() => {
          repeatInterval.current = window.setInterval(() => {
            if (heldButton.current) void typeKey(heldButton.current);
          }, REPEAT_INTERVAL_MS);
        }, REPEAT_INITIAL_MS);

        return;
      }

      // Long-press Shift => Caps
      if (btn.toLowerCase() === '{shift}') {
        holdTimer.current = window.setTimeout(() => {
          setCaps((v) => !v);
          setShift(false);
          capsFired.current = true;
          holdActivated.current = true;
          setActiveButton(null);
        }, LONGPRESS_MS);
        return;
      }

      // Long-press alternates (language-specific)
      const btnLower = btn.toLowerCase();
      const alts =
        lpMap[btn] || lpMap[btnLower] || lpMap[btn.toUpperCase()] || [];
      if (alts.length && rect) {
        const scale = parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--ui-scale') || '1'
        );
        const inv = scale && Number.isFinite(scale) && scale > 0 ? 1 / scale : 1;
        holdTimer.current = window.setTimeout(() => {
          holdActivated.current = true;
          setActiveButton(null);
          const viewportW = (typeof window !== 'undefined' ? window.innerWidth : 0) * inv;
          const minX = 24;
          const maxX = viewportW ? Math.max(minX, viewportW - 24) : undefined;
          const rawX = Math.round((rect.left + rect.width / 2) * inv);
          setPopup({
            key: btn,
            alts,
            x: maxX ? Math.min(maxX, Math.max(minX, rawX)) : rawX,
            y: Math.round((rect.top - 10) * inv),
          });
        }, LONGPRESS_MS);
        return;
      }
    },
    [visible, startInteraction, setActiveButton, lpMap, typeKey]
  );

  const onPointerUpCapture = useCallback(() => {
    // If no long-press happened and we have a button — treat as a tap
    if (!holdActivated.current && heldButton.current) {
      void typeKey(heldButton.current);
    }
    clearHold();
    isPressing.current = false;
    endInteraction();
  }, [clearHold, endInteraction, typeKey]);

  const onPointerCancel = useCallback(() => {
    clearHold();
    isPressing.current = false;
    endInteraction();
  }, [clearHold, endInteraction]);

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

  const absorbContext = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    },
    []
  );

  useEffect(() => {
    if (!popup) return;
    const handleOutside = (e: PointerEvent) => {
      if (popupRef.current && e.target instanceof Node && popupRef.current.contains(e.target)) {
        return;
      }
      setPopup(null);
    };
    window.addEventListener('pointerdown', handleOutside, true);
    return () => window.removeEventListener('pointerdown', handleOutside, true);
  }, [popup]);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      data-soft-keyboard="true"
      className="mzr-osk fixed-osk"
      dir={isRTL(layoutId) ? 'rtl' : 'ltr'}
      tabIndex={-1}
      role="application"
      aria-label="On-screen keyboard"
      // Keep focus in the webview / never focus the keyboard UI
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
      }}
      onFocus={(e: React.FocusEvent<HTMLDivElement>) => {
        e.currentTarget.blur();
      }}
      onFocusCapture={(e: React.FocusEvent<HTMLDivElement>) => {
        const t = e.target as HTMLElement | null;
        // If any OSK child gets focus (e.g. .hg-button), immediately blur it.
        if (t && t.closest && t.closest('.mzr-osk')) {
          try { (t as any).blur?.(); } catch {}
          e.stopPropagation();
        }
      }}
      onClickCapture={(e: React.MouseEvent<HTMLDivElement>) => {
        const t = e.target as HTMLElement | null;
        // Block react-simple-keyboard's internal click handling for key buttons
        // (it can steal focus and trigger blur in the webview).
        if (t && t.closest && t.closest('.hg-button')) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      // Our pointer handlers (capture) control long-press/hold logic
      onPointerDownCapture={onPointerDownCapture}
      onPointerUpCapture={onPointerUpCapture}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
      onContextMenu={absorbContext}
      style={{
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Keyboard
        keyboardRef={(r) => {
          kbRef.current = r;
        }}
        layout={layout.layout}
        layoutName={shift || caps ? 'shift' : 'default'}
        display={display}
        theme="hg-theme-default hg-layout-default mzr-osk-theme"
        onKeyPress={onKeyPress}
      />
      {onClose && (
        <button
          type="button"
          className="mzr-osk-close"
          aria-label="Hide keyboard"
          title="Hide keyboard"
          onClick={() => onClose?.()}
        >
          <svg
            viewBox="0 0 24 24"
            width="50"
            height="50"
            aria-hidden="true"
          >
            <path
              d="M6.7 9.3a1 1 0 0 1 1.4 0L12 13.17l3.9-3.87a1 1 0 1 1 1.4 1.43l-4.6 4.56a1 1 0 0 1-1.4 0L6.7 10.73a1 1 0 0 1 0-1.43Z"
              fill="currentColor"
            />
          </svg>
        </button>
      )}

      {popup && (
        <div
          ref={popupRef}
          className="mzr-osk-popup"
          style={{ left: popup.x, top: popup.y }}
        >
          {popup.alts.map((a) => (
            <button
              key={a}
              className="mzr-osk-popup-btn"
              onClick={() => onPickAlt(a)}
              type="button"
            >
              {a}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default KeyboardPane;
