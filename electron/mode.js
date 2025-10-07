const { screen } = require('electron');

function resolveMode() {
  const forced = (process.env.MZV_MODE || '').toLowerCase();
  if (forced === 'desktop' || forced === 'mobile') return forced;

  const isWayland = !!process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland';
  const isLomiri = ((process.env.XDG_CURRENT_DESKTOP || '').toLowerCase().includes('lomiri')) ||
                   ((process.env.DESKTOP_SESSION || '').toLowerCase().includes('lomiri'));

  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const { width, height, scaleFactor } = primary.size;

  const long = Math.max(width, height);
  const short = Math.min(width, height);
  const externalOrLarge = displays.length > 1 || long >= 1280;
  const phoneish = long <= 1280 && short <= 900 && scaleFactor >= 2;
  if (isWayland && isLomiri) {
    if (externalOrLarge) return 'desktop';
    if (phoneish) return 'mobile';
  }

  return externalOrLarge ? 'desktop' : 'mobile';
}

module.exports = { resolveMode };
