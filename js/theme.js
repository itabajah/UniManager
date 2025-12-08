/**
 * @fileoverview Theme management for the Uni Course Manager application.
 * Handles dark/light mode and course color themes.
 */

'use strict';

// ============================================================================
// DARK/LIGHT THEME
// ============================================================================

/**
 * Initializes the theme from saved settings.
 */
function initTheme() {
    const savedTheme = appData.settings.theme || 'light';
    applyTheme(savedTheme, false);
}

/**
 * Toggles between light and dark themes.
 */
function toggleTheme() {
    const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    applyTheme(newTheme, true);
}

/**
 * Applies the specified theme.
 * @param {string} theme - 'light' or 'dark'
 * @param {boolean} shouldSave - Whether to persist the change
 */
function applyTheme(theme, shouldSave) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    
    if (shouldSave) {
        appData.settings.theme = theme;
        saveData();
    }
}

// ============================================================================
// COLOR THEME MANAGEMENT
// ============================================================================

/**
 * Updates the base color preview element.
 */
function updateBaseColorPreview() {
    const hue = tempBaseColorHue ?? appData.settings.baseColorHue ?? 200;
    const preview = $('base-color-preview');
    if (preview) {
        preview.style.backgroundColor = `hsl(${hue}, 45%, 50%)`;
    }
}

/**
 * Resets all course colors based on the current theme settings.
 */
function resetAllColors() {
    const colorTheme = appData.settings.colorTheme || COLOR_THEMES.COLORFUL;
    const baseHue = appData.settings.baseColorHue || 200;
    
    appData.semesters.forEach(semester => {
        const totalCourses = semester.courses.length;
        semester.courses.forEach((course, index) => {
            course.color = generateCourseColor(index, totalCourses);
        });
    });
    
    saveData();
    renderAll();
    
    // Sync temp state with saved state
    tempColorTheme = originalColorTheme = appData.settings.colorTheme;
    tempBaseColorHue = originalBaseColorHue = appData.settings.baseColorHue;
    
    // Update UI
    const unsavedIndicator = $('theme-unsaved-indicator');
    const changedButtons = $('theme-changed-buttons');
    const resetBtn = $('reset-colors-btn');
    
    if (unsavedIndicator) unsavedIndicator.style.display = 'none';
    if (changedButtons) changedButtons.style.display = 'none';
    if (resetBtn) resetBtn.style.display = colorTheme === COLOR_THEMES.MONO ? 'none' : 'block';
}

/**
 * Updates the course color slider based on the current theme.
 */
function updateCourseColorSlider() {
    const colorTheme = appData.settings.colorTheme || COLOR_THEMES.COLORFUL;
    const colorHueInput = $('course-color-hue');
    if (!colorHueInput) return;
    
    const colorGroup = colorHueInput.closest('.form-group');
    if (!colorGroup) return;
    
    if (colorTheme === COLOR_THEMES.MONO) {
        colorGroup.style.display = 'none';
        return;
    }
    
    colorGroup.style.display = 'block';
    
    if (colorTheme === COLOR_THEMES.SINGLE) {
        const baseHue = appData.settings.baseColorHue || 200;
        const minHue = (baseHue - 30 + 360) % 360;
        const maxHue = (baseHue + 30) % 360;
        
        colorHueInput.min = minHue;
        colorHueInput.max = maxHue;
        colorHueInput.style.background = `linear-gradient(to right, 
            hsl(${minHue}, 45%, 50%), 
            hsl(${baseHue}, 45%, 50%), 
            hsl(${maxHue}, 45%, 50%))`;
        colorHueInput.classList.remove('full-spectrum');
    } else {
        colorHueInput.min = 0;
        colorHueInput.max = 360;
        colorHueInput.style.background = '';
        colorHueInput.classList.add('full-spectrum');
    }
}
