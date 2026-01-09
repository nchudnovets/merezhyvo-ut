type ThemeName = 'light' | 'dark';

let styleEl: HTMLStyleElement | null = null;
let lastKey: string | null = null;

const pick = (vars: Record<string, string>, key: string, fallback: string): string =>
  (typeof vars?.[key] === 'string' && vars[key].trim().length > 0 ? vars[key] : fallback);

const buildCss = (vars: Record<string, string>, theme: ThemeName): string => {
  const bg = theme === 'light'
    ? 'rgba(255,255,255,0.92)'
    : pick(vars, 'surface-weak', '#1b2f55');
  const text = pick(vars, 'text-primary', theme === 'light' ? '#0F1525' : '#f8fafc');
  const muted = pick(vars, 'text-muted', theme === 'light' ? '#6B7A96' : 'rgba(248,250,252,0.7)');
  const border = pick(vars, 'border', theme === 'light' ? '#CBD5E4' : 'rgba(148, 163, 184, 0.45)');
  const hover = theme === 'light' ? '#94a3b833' : pick(vars, 'accent-tint', '#94a3b833');
  const sep = pick(vars, 'divider', theme === 'light' ? '#E2E8F3' : 'rgba(148,163,184,0.25)');
  const accent = pick(vars, 'accent-strong', '#3b82f6');
  const buttonBg = pick(vars, 'surface-muted', theme === 'light' ? 'rgba(248,250,252,0.9)' : 'rgba(255,255,255,0.08)');
  const popupBg = theme === 'light' ? 'rgba(248,250,252,0.98)' : 'rgba(15, 15, 15, 0.98)';
  const emojiBg = pick(vars, 'surface', theme === 'light' ? '#f8fafc' : '#0f172a');

  return `
  :root {
    --mzr-osk-bg: ${bg};
    --mzr-osk-text: ${text};
    --mzr-osk-muted: ${muted};
    --mzr-osk-border: ${border};
    --mzr-osk-hover: ${hover};
    --mzr-osk-sep: ${sep};
    --mzr-osk-accent: ${accent};
    --mzr-osk-btn-bg: ${buttonBg};
    --mzr-osk-popup-bg: ${popupBg};
    --mzr-osk-emoji-bg: ${emojiBg};
  }

  .mzr-osk.fixed-osk {
    position: fixed; left: 0; right: 0; bottom: 0;
    z-index: 100000;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }

  .mzr-osk-theme {
    position: relative;
    padding: 8px 6px calc(18px + 48px);
    background: var(--mzr-osk-bg);
    backdrop-filter: blur(6px);
    color: var(--mzr-osk-text);
  }
  .mzr-osk-close {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: transparent;
    border: none;
    color: var(--mzr-osk-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 65px;
    height: 50px;
    padding: 4px;
    cursor: pointer;
    transition: color 0.2s ease, transform 0.15s ease;
  }
  .mzr-osk-close:active {
    transform: translateX(-50%) translateY(2px);
  }
  .mzr-osk-close:hover {
    color: var(--mzr-osk-text);
  }

  .mzr-osk .hg-button {
    font-family: Roboto, Arial, "Helvetica Neue", Helvetica, system-ui, sans-serif !important;
    font-size: 65px !important;
    line-height: 1.05 !important;
    padding: 6px 6px !important;
    margin: 4px 3px !important;
    min-width: 0 !important;
    height: 88px !important;
    border-radius: 10px !important;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--mzr-osk-btn-bg) !important;
    color: var(--mzr-osk-text) !important;
    border: 1px solid var(--mzr-osk-border) !important;
  }
  .mzr-osk .hg-button.hg-button-emoji,
  .mzr-osk .hg-button[data-skbtn="{emoji}"],
  .mzr-osk .hg-button[data-skbtn="😊"] {
    min-width: 75px !important;
    max-width: 95px !important;
  }
  .mzr-osk .hg-button:active,
  .mzr-osk .hg-button.mzr-osk-pressed {
    filter: brightness(1.06);
    background: var(--mzr-osk-hover) !important;
    border-color: var(--mzr-osk-accent);
    transform: translateX(-2px) translateY(2px);
  }

  .mzr-osk .hg-button.hg-button-enter,
  .mzr-osk .hg-button.hg-button-bksp,
  .mzr-osk .hg-button.hg-button-lang,
  .mzr-osk .hg-button.hg-button-symbols {
    flex: 0 0 auto !important;
  }
  .mzr-osk .hg-button.hg-button-enter {
    min-width: 90px !important;
  }

  .mzr-osk .hg-button.hg-button-arrow,
  .mzr-osk .hg-button-arrowleft,
  .mzr-osk .hg-button-arrowright { flex: 0 0 auto !important; width: 60px }

  .mzr-osk .hg-button[data-skbtn="."],
  .mzr-osk .hg-button[data-skbtn=","] {
    max-width: 60px !important;
    min-width: 40px !important;
  }

  .mzr-osk .hg-button.hg-button-space {
    flex: 2 1 0 !important;
    min-width: 25vw !important;
  }

  .mzr-osk .hg-button.hg-button-shift.hg-button-active {
    background: var(--mzr-osk-accent) !important;
    color: #fff !important;
  }

  .mzr-osk-popup {
    position: fixed;
    transform: translateY(-100%);
    background: var(--mzr-osk-popup-bg);
    color: var(--mzr-osk-text);
    padding: 8px 10px;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.35);
    z-index: 100001;
    display: flex;
    gap: 6px;
    border: 1px solid var(--mzr-osk-border);
  }
  .mzr-osk-popup-btn {
    font-family: Roboto, Arial, "Helvetica Neue", Helvetica, system-ui, sans-serif;
    font-size: 52px;
    line-height: 1.05;
    padding: 8px 10px;
    min-width: 0;
    background: transparent;
    color: var(--mzr-osk-text);
    border: 0;
    border-radius: 10px;
    height: 88px;
  }
  .mzr-osk-popup-btn:active {
    background: var(--mzr-osk-hover);
  }

  .mzr-emoji-panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 70px;
    z-index: 100002;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--mzr-osk-border);
    background: var(--mzr-osk-emoji-bg);
    box-shadow: 0 12px 32px rgba(0,0,0,0.35);
    --epr-bg-color: var(--mzr-osk-emoji-bg);
    --epr-category-label-bg-color: var(--mzr-osk-emoji-bg);
  }
  .mzr-emoji-footer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 0 10px;
    height: 72px;
    background: var(--mzr-osk-emoji-bg);
    border-top: 1px solid var(--mzr-osk-border);
  }
  .mzr-emoji-close {
    background: var(--mzr-osk-btn-bg);
    color: var(--mzr-osk-text);
    border: 1px solid var(--mzr-osk-border);
    border-radius: 10px;
    padding: 6px 12px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 50px;
    min-width: 72px;
    height: 60px;
  }
  .mzr-emoji-panel .epr-header,
  .mzr-emoji-panel .epr-category-nav,
  .mzr-emoji-panel .epr-preview {
    display: none !important;
  }
  .mzr-emoji-panel .epr-body {
    padding-bottom: 72px;
  }
  .mzr-emoji-panel .EmojiPickerReact {
    width: 100% !important;
    background: var(--mzr-osk-emoji-bg) !important;
    border: none !important;
  }

  .mzr-osk .fill-label {
    color: var(--mzr-osk-muted);
  }
  .mzr-osk .item:hover {
    background: var(--mzr-osk-hover);
  }
  .mzr-osk .sep {
    background: var(--mzr-osk-sep);
  }

  @media (max-width: 400px) {
    .mzr-osk .hg-button { font-size: 48px !important; height: 80px !important; padding: 5px 7px !important; }
    .mzr-osk .hg-button.osk-space { min-width: 40vw !important; }
    .mzr-osk-popup-btn { font-size: 48px; padding: 6px 8px; }
    .mzr-emoji-panel { bottom: 130px; }
  }

  `;
};

export function ensureOskCssInjected(themeVars: Record<string, string> = {}, theme: ThemeName = 'dark') {
  const key = `${theme}:${JSON.stringify(themeVars)}`;
  if (styleEl && lastKey === key) return;

  const css = buildCss(themeVars, theme);

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.setAttribute('data-osk', '1');
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = css;
  lastKey = key;
}

export const KEYBOARD_CSS_RTL = `
  .mzr-osk[dir='rtl'] .hg-row {
    direction: rtl;
  }
  .mzr-osk[dir='rtl'] .hg-button {
    direction: rtl;
  }
  `;
