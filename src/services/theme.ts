/**
 * @fileoverview Theme management for the UniManager application.
 * Handles light/dark theme switching and persistence.
 */

import { store } from '@/state';

import type { UITheme } from '@/types';

// ============================================================================
// THEME INITIALIZATION
// ============================================================================

/**
 * Initializes the theme based on stored preference or system preference.
 */
export function initTheme(): void {
  const settings = store.getSettings();
  const savedTheme = settings.theme;

  // Use saved theme or fall back to system preference
  const theme: UITheme =
    savedTheme ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  applyTheme(theme);
}

/**
 * Applies a theme to the document.
 */
export function applyTheme(theme: UITheme): void {
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

/**
 * Toggles between light and dark themes.
 */
export function toggleTheme(): void {
  const currentTheme = store.getSettings().theme;
  const newTheme: UITheme = currentTheme === 'dark' ? 'light' : 'dark';

  store.updateSettings({ theme: newTheme });
  applyTheme(newTheme);
}

/**
 * Updates the theme toggle button icon.
 */
function updateThemeIcon(theme: UITheme): void {
  const sunIcon = document.querySelector('.theme-icon-sun');
  const moonIcon = document.querySelector('.theme-icon-moon');

  if (sunIcon && moonIcon && sunIcon instanceof HTMLElement && moonIcon instanceof HTMLElement) {
    if (theme === 'dark') {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    } else {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    }
  }
}

// ============================================================================
// COLOR THEME PREVIEW
// ============================================================================

/**
 * Updates the base color preview in settings.
 */
export function updateBaseColorPreview(): void {
  const slider = document.getElementById('base-color-hue');
  const preview = document.getElementById('base-color-preview');

  if (slider instanceof HTMLInputElement && preview instanceof HTMLElement) {
    const hue = slider.value;
    preview.style.backgroundColor = `hsl(${hue}, 45%, 50%)`;
  }
}

/**
 * Updates the course color slider UI.
 */
export function updateCourseColorSlider(): void {
  const slider = document.getElementById('course-color-hue');
  const preview = document.getElementById('course-color-preview');
  const settings = store.getSettings();

  if (!(slider instanceof HTMLInputElement) || !(preview instanceof HTMLElement)) return;

  const colorTheme = settings.colorTheme ?? 'colorful';

  if (colorTheme === 'mono') {
    slider.disabled = true;
    preview.style.backgroundColor = 'hsl(0, 0%, 50%)';
  } else {
    slider.disabled = false;
    const hue = slider.value;
    preview.style.backgroundColor = `hsl(${hue}, 45%, 50%)`;
  }
}
