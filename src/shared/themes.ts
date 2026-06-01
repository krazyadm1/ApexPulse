export type ThemeName = 'dark' | 'light';

export const THEMES: Record<ThemeName, Record<string, string>> = {
  dark: {
    '--bg-primary': '#050B14',
    '--bg-secondary': '#0A1628',
    '--bg-card': 'rgba(10,22,40,0.5)',
    '--text-primary': '#FFFFFF',
    '--text-secondary': 'rgba(255,255,255,0.6)',
    '--text-muted': 'rgba(255,255,255,0.3)',
    '--border': 'rgba(255,255,255,0.1)',
    '--accent': '#00E5FF',
    '--hover': 'rgba(0,229,255,0.04)',
  },
  light: {
    '--bg-primary': '#F0F2F5',
    '--bg-secondary': '#FFFFFF',
    '--bg-card': 'rgba(255,255,255,0.8)',
    '--text-primary': '#1A1A2E',
    '--text-secondary': 'rgba(0,0,0,0.6)',
    '--text-muted': 'rgba(0,0,0,0.3)',
    '--border': 'rgba(0,0,0,0.1)',
    '--accent': '#00B8D4',
    '--hover': 'rgba(0,184,212,0.06)',
  },
};

export function applyTheme(theme: ThemeName): void {
  const vars = THEMES[theme];
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  root.setAttribute('data-theme', theme);
}
