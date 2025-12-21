/**
 * @fileoverview Utility functions for the Tollab application.
 * Pure helper functions with no side effects.
 */

// ============================================================================
// DOM HELPERS
// ============================================================================

/**
 * Gets an element by ID (shorthand).
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
function $(id) {
    return document.getElementById(id);
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {*} text - Text to escape
 * @returns {string} Escaped HTML string
 */
function escapeHtml(text) {
    if (text == null) return '';
    return String(text).replace(/[&<>"']/g, char => HTML_ENTITIES[char]);
}

// ============================================================================
// DATA ACCESSORS
// ============================================================================

/**
 * Gets the currently selected semester.
 * @returns {Object|undefined} The current semester object
 */
function getCurrentSemester() {
    return appData.semesters.find(s => s.id === currentSemesterId);
}

/**
 * Gets a course by ID from the current semester.
 * @param {string} courseId - The course ID to find
 * @returns {Object|undefined} The course object
 */
function getCourse(courseId) {
    const semester = getCurrentSemester();
    return semester?.courses.find(c => c.id === courseId);
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Converts date from dd-MM-yyyy to yyyy-MM-dd format.
 * @param {string} dateStr - Date string in dd-MM-yyyy format
 * @returns {string} Date string in yyyy-MM-dd format or original if invalid
 */
function convertDateFormat(dateStr) {
    if (!dateStr) return '';
    const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
        return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return dateStr;
}

/**
 * Parses an ICS date string into a JavaScript Date object.
 * @param {string} icsDate - ICS date format (e.g., 20241027T103000 or 20241027T103000Z)
 * @returns {Date} Parsed date object
 */
function parseICSDate(icsDate) {
    const year = parseInt(icsDate.substring(0, 4), 10);
    const month = parseInt(icsDate.substring(4, 6), 10) - 1;
    const day = parseInt(icsDate.substring(6, 8), 10);
    const hour = parseInt(icsDate.substring(9, 11), 10);
    const minute = parseInt(icsDate.substring(11, 13), 10);
    const second = parseInt(icsDate.substring(13, 15), 10);
    
    return new Date(year, month, day, hour, minute, second);
}

/**
 * Gets the start and end dates of the current week (Sunday to Saturday).
 * @returns {{start: Date, end: Date}} Week range object
 */
function getCurrentWeekRange() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return { start: startOfWeek, end: endOfWeek };
}

/**
 * Checks if a date string falls within the current week.
 * @param {string} dateStr - Date string in yyyy-MM-dd format
 * @returns {boolean} True if date is within current week
 */
function isDateInCurrentWeek(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const { start, end } = getCurrentWeekRange();
    return date >= start && date <= end;
}

/**
 * Gets the day of week (0-6) from a date string.
 * @param {string} dateStr - Date string in yyyy-MM-dd format
 * @returns {number} Day of week (0 = Sunday) or -1 if invalid
 */
function getDayOfWeekFromDate(dateStr) {
    if (!dateStr) return -1;
    return new Date(dateStr).getDay();
}

// ============================================================================
// SEMESTER UTILITIES
// ============================================================================

/**
 * Compares two semesters for sorting (newest first).
 * @param {Object} a - First semester
 * @param {Object} b - Second semester
 * @returns {number} Comparison result for sorting
 */
function compareSemesters(a, b) {
    const yearA = extractYear(a.name);
    const yearB = extractYear(b.name);
    
    if (yearA !== yearB) {
        return yearB - yearA; // Descending year
    }
    
    // Same year, compare seasons (Winter > Summer > Spring)
    return getSeasonValue(b.name) - getSeasonValue(a.name);
}

/**
 * Extracts the year from a semester name.
 * @param {string} name - Semester name
 * @returns {number} Year or 0 if not found
 */
function extractYear(name) {
    const match = name.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : 0;
}

/**
 * Gets a numeric value for semester season for sorting.
 * @param {string} name - Semester name
 * @returns {number} Season value (higher = later in academic year)
 */
function getSeasonValue(name) {
    const lower = name.toLowerCase();
    if (lower.includes('spring') || lower.includes('אביב')) return 1;
    if (lower.includes('summer') || lower.includes('קיץ')) return 2;
    if (lower.includes('winter') || lower.includes('חורף')) return 3;
    return 0;
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Extracts hue value from an HSL color string.
 * @param {string} color - HSL color string (e.g., "hsl(180, 45%, 50%)")
 * @returns {string} Hue value or '0' if not found
 */
function extractHueFromColor(color) {
    const match = color.match(/hsl\((\d+)/);
    return match ? match[1] : '0';
}

/**
 * Generates the next available hue for a new course.
 * Uses different strategies based on color theme.
 * @returns {number} Hue value (0-360)
 */
function getNextAvailableHue() {
    const semester = getCurrentSemester();
    if (!semester) return 0;
    
    const courseCount = semester.courses.length;
    const colorTheme = appData.settings.colorTheme || COLOR_THEMES.COLORFUL;
    
    switch (colorTheme) {
        case COLOR_THEMES.MONO:
            return 0;
            
        case COLOR_THEMES.SINGLE: {
            const baseHue = appData.settings.baseColorHue || 200;
            const totalCourses = courseCount + 1;
            const hueOffset = totalCourses > 1 
                ? (courseCount / (totalCourses - 1)) * 60 - 30 
                : 0;
            return ((baseHue + hueOffset) % 360 + 360) % 360;
        }
        
        default: // colorful
            return (courseCount * GOLDEN_ANGLE) % 360;
    }
}

/**
 * Generates a course color based on the current theme settings.
 * @param {number} index - Course index for color calculation
 * @param {number} totalCourses - Total number of courses
 * @returns {string} HSL color string
 */
function generateCourseColor(index, totalCourses) {
    const colorTheme = appData.settings.colorTheme || COLOR_THEMES.COLORFUL;
    const baseHue = appData.settings.baseColorHue || 200;
    
    switch (colorTheme) {
        case COLOR_THEMES.MONO:
            return 'hsl(0, 0%, 50%)';
            
        case COLOR_THEMES.SINGLE: {
            const hueOffset = totalCourses > 1 
                ? (index / (totalCourses - 1)) * 60 - 30 
                : 0;
            const hue = ((baseHue + hueOffset) % 360 + 360) % 360;
            return `hsl(${hue}, 45%, 50%)`;
        }
        
        default: // colorful
            return `hsl(${(index * GOLDEN_ANGLE) % 360}, 45%, 50%)`;
    }
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Truncates a string to a maximum length with ellipsis.
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
function truncate(str, maxLength) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength - 1) + '…';
}

/**
 * Generates a unique ID.
 * @returns {string} Unique ID string
 */
function generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 5);
}

// ============================================================================
// VIDEO EMBED UTILITIES
// ============================================================================

/**
 * Detects the video platform from a URL.
 * @param {string} url - Video URL
 * @returns {'youtube'|'panopto'|'unknown'} Platform type
 */
function detectVideoPlatform(url) {
    if (!url) return 'unknown';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('panopto')) return 'panopto';
    return 'unknown';
}

/**
 * Extracts video ID and generates embed URL for supported platforms.
 * @param {string} url - Video URL
 * @returns {{embedUrl: string|null, platform: string}} Embed info
 */
function getVideoEmbedInfo(url) {
    if (!url) return { embedUrl: null, platform: 'unknown' };
    
    const platform = detectVideoPlatform(url);
    
    if (platform === 'youtube') {
        // Extract YouTube video ID
        let videoId = null;
        if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
        } else if (url.includes('youtube.com')) {
            const match = url.match(/[?&]v=([^&#]+)/);
            videoId = match?.[1];
        }
        if (videoId) {
            // Use clean embed URL - no extra parameters to avoid Error 153
            return { embedUrl: `https://www.youtube.com/embed/${videoId}`, platform };
        }
    }
    
    if (platform === 'panopto') {
        // Extract Panopto video ID and domain
        const idMatch = url.match(/id=([a-f0-9-]{36})/i);
        const domainMatch = url.match(/(https?:\/\/[^\/]+)/);
        if (idMatch && domainMatch) {
            const videoId = idMatch[1];
            const domain = domainMatch[1];
            // Use Embed.aspx for iframe embedding
            return { embedUrl: `${domain}/Panopto/Pages/Embed.aspx?id=${videoId}&autoplay=false&offerviewer=true&showtitle=true&showbrand=false&captions=true&interactivity=all`, platform };
        }
    }
    
    return { embedUrl: null, platform };
}

/**
 * Checks if a video URL supports inline preview.
 * @param {string} url - Video URL
 * @returns {boolean} Whether inline preview is supported
 */
function supportsInlinePreview(url) {
    const { embedUrl } = getVideoEmbedInfo(url);
    return embedUrl !== null;
}
