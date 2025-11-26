let injected = false;

export function ensureOskCssInjected() {
  if (injected) return;
  injected = true;

  const css = `
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
    background: rgba(24,24,24,0.95);
    backdrop-filter: blur(6px);
  }
  .mzr-osk-close {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: transparent;
    border: none;
    color: rgba(203, 213, 225, 0.85);
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
    color: rgba(241, 245, 249, 0.95);
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
  }
  .mzr-osk .hg-button:active,
  .mzr-osk .hg-button.mzr-osk-pressed { 
    filter: brightness(1.5);
    border-color: #f7e78f;
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

  .mzr-osk .hg-button.hg-button-space {
    flex: 2 1 0 !important;
    min-width: 30vw !important;
  }

  .mzr-osk .hg-button.hg-button-shift.hg-button-active {
    background: #3b82f6 !important;
    color: #fff !important;
  }

  .mzr-osk-popup {
    position: fixed;
    transform: translate(-50%, -100%);
    background: rgba(15, 15, 15, 0.98);
    color: #fff;
    padding: 8px 10px;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.35);
    z-index: 100001;
    display: flex;
    gap: 6px;
  }
  .mzr-osk-popup-btn {
    font-family: Roboto, Arial, "Helvetica Neue", Helvetica, system-ui, sans-serif;
    font-size: 52px;
    line-height: 1.05;
    padding: 8px 10px;
    min-width: 0;
    background: transparent;
    color: #fff;
    border: 0;
    border-radius: 10px;
    height: 88px;
  }
  .mzr-osk-popup-btn:active {
    background: rgba(255,255,255,0.12);
  }

  @media (max-width: 400px) {
    .mzr-osk .hg-button { font-size: 48px !important; height: 80px !important; padding: 5px 7px !important; }
    .mzr-osk .hg-button.osk-space { min-width: 40vw !important; }
    .mzr-osk-popup-btn { font-size: 48px; padding: 6px 8px; }
  }
  `;

  const style = document.createElement('style');
  style.setAttribute('data-osk', '1');
  style.textContent = css;
  document.head.appendChild(style);
}

export const KEYBOARD_CSS_RTL = `
  .mzr-osk[dir='rtl'] .hg-row {
    direction: rtl;
  }
  .mzr-osk[dir='rtl'] .hg-button {
    direction: rtl;
  }
  `;
