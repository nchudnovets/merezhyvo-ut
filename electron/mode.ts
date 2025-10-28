import { screen } from 'electron';

export function resolveMode() {
  const forced = (process.env.MZV_MODE || '').toLowerCase();
  if (forced === 'desktop' || forced === 'mobile') return forced;

  const displays = screen.getAllDisplays();
  if (displays.length > 1) return 'desktop';

  return 'mobile';
}

