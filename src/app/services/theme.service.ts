import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private darkModeKey = 'prefers-dark';

  constructor() {
    const saved = localStorage.getItem(this.darkModeKey);
    const prefersDark = saved
      ? saved === 'true'
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? false: true

    this.setDarkMode(prefersDark);
  }

  toggleTheme(): void {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    this.setDarkMode(!isDark);
  }

  setDarkMode(enable: boolean): void {
    const root = document.documentElement;
    if (enable) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
    localStorage.setItem(this.darkModeKey, enable.toString());
  }
}
