export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'glory_theme';

export function storedTheme(): ThemeMode {
  const t = localStorage.getItem(KEY);
  return t === 'light' || t === 'dark' ? t : 'system';
}

export function applyTheme(mode: ThemeMode): void {
  if (mode === 'system') {
    delete document.documentElement.dataset.theme;
    localStorage.removeItem(KEY);
  } else {
    document.documentElement.dataset.theme = mode;
    localStorage.setItem(KEY, mode);
  }
}

export function nextTheme(mode: ThemeMode): ThemeMode {
  // system → dark → light → system
  return mode === 'system' ? 'dark' : mode === 'dark' ? 'light' : 'system';
}
