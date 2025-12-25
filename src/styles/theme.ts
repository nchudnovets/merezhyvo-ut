export type ThemeName = 'dark' | 'light';

export type ThemeVars = Record<string, string>;

const baseDark: ThemeVars = {
  'color-scheme': 'dark',
  'bg': '#0F1525',
  'surface': '#121826',
  'surface-elevated': '#0E1629',
  'surface-muted': '#0b1020',
  'surface-weak': 'rgba(15, 23, 42, 0.85)',
  'surface-transparent': 'rgba(15, 23, 42, 0.65)',
  'border': 'rgba(148, 163, 184, 0.25)',
  'border-strong': '#3E4D6A',
  'divider': 'rgba(148, 163, 184, 0.2)',
  'text-primary': '#EAF0FF',
  'text-secondary': '#B9C3D8',
  'text-muted': '#7F8AA3',
  'text-disabled': '#6B7280',
  'accent': '#235CDC',
  'accent-strong': '#1d4ed8',
  'accent-tint': 'rgba(37, 99, 235, 0.12)',
  'link': '#8CBBF1',
  'warning': '#B48D25',
  'warning-tint': 'rgba(180, 141, 37, 0.16)',
  'danger': '#D05A5A',
  'danger-tint': 'rgba(208, 90, 90, 0.16)',
  'overlay': 'rgba(0, 0, 0, 0.45)',
  'scrollbar-track': '#111827',
  'scrollbar-thumb': '#2563eb',
  'scrollbar-thumb-hover': '#1d4ed8',
  'input-bg': '#213e6dff',
  'input-border': '#3E4D6A',
  'selection-bg': 'rgba(125,211,252,.3)',
  'selection-fg': '#0a0f1f',
  'focus-ring': '#93c5fd'
};

const baseLight: ThemeVars = {
  'color-scheme': 'light',
  'bg': '#F6F8FC',
  'surface': '#FFFFFF',
  'surface-elevated': '#FFFFFF',
  'surface-muted': '#F2F6FC',
  'surface-weak': '#F6F8FC',
  'surface-transparent': 'rgba(242, 246, 252, 0.82)',
  'border': '#D6DDEA',
  'border-strong': '#CBD5E4',
  'divider': '#E2E8F3',
  'text-primary': '#0F1525',
  'text-secondary': '#3B4A66',
  'text-muted': '#6B7A96',
  'text-disabled': '#95A2B8',
  'accent': '#235CDC',
  'accent-strong': '#1F52C8',
  'accent-tint': '#E6EEFF',
  'link': '#1F5FD9',
  'warning': '#B48D25',
  'warning-tint': '#FFF6DE',
  'danger': '#C94B4B',
  'danger-tint': '#FFE8E8',
  'overlay': 'rgba(0, 0, 0, 0.35)',
  'scrollbar-track': '#E2E8F3',
  'scrollbar-thumb': '#235CDC',
  'scrollbar-thumb-hover': '#1F52C8',
  'input-bg': '#E9EFF9',
  'input-border': '#CBD5E4',
  'selection-bg': '#E6EEFF',
  'selection-fg': '#0F1525',
  'focus-ring': '#235CDC'
};

const VAR_PREFIX = '--mzr-';

const themeVars: Record<ThemeName, ThemeVars> = {
  dark: baseDark,
  light: baseLight
};

export const applyTheme = (theme: ThemeName): ThemeName => {
  const vars = themeVars[theme] ?? themeVars.dark;
  const root = document.documentElement;
  root.dataset.mzrTheme = theme;
  try {
    root.style.colorScheme = vars['color-scheme'] ?? 'dark';
    root.style.setProperty('--mzr-color-scheme', vars['color-scheme'] ?? 'dark');
  } catch {
    // noop
  }
  Object.entries(vars).forEach(([key, value]) => {
    try {
      root.style.setProperty(`${VAR_PREFIX}${key}`, value);
    } catch {
      // noop
    }
  });
  return theme;
};

export const getThemeVars = (theme: ThemeName): ThemeVars => themeVars[theme] ?? themeVars.dark;
