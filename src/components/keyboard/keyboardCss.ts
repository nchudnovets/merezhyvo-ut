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
    padding: 8px 6px calc(10px + 50px);
    background: rgba(24,24,24,0.95);
    backdrop-filter: blur(6px);
  }

  .mzr-osk .hg-button {
    font-family: Roboto, Arial, "Helvetica Neue", Helvetica, system-ui, sans-serif !important;
    font-size: 52px !important; 
    line-height: 1.05 !important;
    padding: 6px 8px !important;
    margin: 4px 3px !important;
    min-width: 0 !important;
    height: 88px !important; 
    border-radius: 10px !important;
    display: inline-flex; align-items: center; justify-content: center;
  }

  /* робимо службові кнопки вужчими на вузьких екранах */
  .mzr-osk .hg-button.osk-enter,
  .mzr-osk .hg-button.osk-bksp,
  .mzr-osk .hg-button.osk-lang,
  .mzr-osk .hg-button.osk-symbols {
    flex: 0 0 auto !important;
  }
  .mzr-osk .hg-button.osk-enter {
    min-width: 80px !important;
  }

  /* стрілки поруч */
  .mzr-osk .hg-button.osk-arrow { flex: 0 0 auto !important; }

  /* ширший пробіл у 2 рази */
  .mzr-osk .hg-button.osk-space {
    flex: 2 1 0 !important;
    min-width: 30vw !important;
  }

  /* активний Shift/Caps */
  .mzr-osk .hg-button.osk-shift.osk-active {
    background: #3b82f6 !important;
    color: #fff !important;
  }

  /* попап альтернатив */
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

  /* невелика адаптація для дуже вузьких екранів */
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
