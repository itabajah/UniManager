/**
 * @fileoverview Input validation utilities for production-ready data handling.
 * Provides validation, sanitization, and type-checking utilities.
 */

'use strict';

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

/**
 * Validation constraints.
 * @const {Object}
 */
const VALIDATION_LIMITS = Object.freeze({
    /** Maximum course name length */
    COURSE_NAME_MAX: 100,
    /** Maximum homework title length */
    HOMEWORK_TITLE_MAX: 200,
    /** Maximum notes length */
    NOTES_MAX: 5000,
    /** Maximum URL length */
    URL_MAX: 2048,
    /** Maximum profile name length */
    PROFILE_NAME_MAX: 50,
    /** Maximum semester name length */
    SEMESTER_NAME_MAX: 50,
    /** Minimum year for semester */
    MIN_YEAR: 2000,
    /** Maximum year for semester */
    MAX_YEAR: 2100
});

/**
 * Regex patterns for validation.
 * @const {Object}
 */
const VALIDATION_PATTERNS = Object.freeze({
    /** Valid URL pattern (http/https) */
    URL: /^https?:\/\/[^\s<>'"]+$/i,
    /** YouTube URL pattern */
    YOUTUBE_URL: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i,
    /** Panopto URL pattern */
    PANOPTO_URL: /panopto/i,
    /** Course number pattern (alphanumeric) */
    COURSE_NUMBER: /^[A-Za-z0-9\-_.]{0,20}$/,
    /** Time format (HH:MM) */
    TIME_FORMAT: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    /** Date format (YYYY-MM-DD) */
    DATE_FORMAT: /^\d{4}-\d{2}-\d{2}$/,
    /** Safe filename characters */
    SAFE_FILENAME: /^[a-zA-Z0-9_\-. ]+$/,
    /** UUID pattern */
    UUID: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
});

// ============================================================================
// STRING VALIDATION
// ============================================================================

/**
 * Validates and sanitizes a string input.
 * @param {*} value - Value to validate
 * @param {Object} options - Validation options
 * @returns {{valid: boolean, value: string, error: string|null}} Validation result
 */
function validateString(value, options = {}) {
    const {
        required = false,
        maxLength = 1000,
        minLength = 0,
        trim = true,
        allowEmpty = !required,
        pattern = null,
        patternMessage = 'Invalid format'
    } = options;

    // Type coercion
    let str = value == null ? '' : String(value);
    
    // Trim if requested
    if (trim) str = str.trim();
    
    // Required check
    if (required && !str) {
        return { valid: false, value: str, error: 'This field is required' };
    }
    
    // Empty check
    if (!allowEmpty && !str) {
        return { valid: false, value: str, error: 'This field cannot be empty' };
    }
    
    // Skip further validation for empty optional fields
    if (!str && allowEmpty) {
        return { valid: true, value: str, error: null };
    }
    
    // Length checks
    if (str.length < minLength) {
        return { valid: false, value: str, error: `Must be at least ${minLength} characters` };
    }
    
    if (str.length > maxLength) {
        return { valid: false, value: str, error: `Must be no more than ${maxLength} characters` };
    }
    
    // Pattern check
    if (pattern && !pattern.test(str)) {
        return { valid: false, value: str, error: patternMessage };
    }
    
    return { valid: true, value: str, error: null };
}

/**
 * Validates a course name.
 * @param {*} name - Course name to validate
 * @returns {{valid: boolean, value: string, error: string|null}}
 */
function validateCourseName(name) {
    return validateString(name, {
        required: true,
        maxLength: VALIDATION_LIMITS.COURSE_NAME_MAX,
        minLength: 1
    });
}

/**
 * Validates a homework title.
 * @param {*} title - Title to validate
 * @returns {{valid: boolean, value: string, error: string|null}}
 */
function validateHomeworkTitle(title) {
    return validateString(title, {
        required: true,
        maxLength: VALIDATION_LIMITS.HOMEWORK_TITLE_MAX,
        minLength: 1
    });
}

/**
 * Validates a profile name.
 * @param {*} name - Profile name to validate
 * @param {Array<{name: string}>} existingProfiles - Existing profiles for uniqueness check
 * @param {string|null} currentProfileId - Current profile ID (for rename operations)
 * @returns {{valid: boolean, value: string, error: string|null}}
 */
function validateProfileName(name, existingProfiles = [], currentProfileId = null) {
    const result = validateString(name, {
        required: true,
        maxLength: VALIDATION_LIMITS.PROFILE_NAME_MAX,
        minLength: 1
    });
    
    if (!result.valid) return result;
    
    // Uniqueness check
    const isDuplicate = existingProfiles.some(p => 
        p.name.toLowerCase() === result.value.toLowerCase() && 
        p.id !== currentProfileId
    );
    
    if (isDuplicate) {
        return { valid: false, value: result.value, error: 'A profile with this name already exists' };
    }
    
    return result;
}

/**
 * Validates notes or description text.
 * @param {*} notes - Notes to validate
 * @returns {{valid: boolean, value: string, error: string|null}}
 */
function validateNotes(notes) {
    return validateString(notes, {
        required: false,
        maxLength: VALIDATION_LIMITS.NOTES_MAX,
        allowEmpty: true
    });
}

// ============================================================================
// URL VALIDATION
// ============================================================================

/**
 * Validates a URL.
 * @param {*} url - URL to validate
 * @param {Object} options - Validation options
 * @returns {{valid: boolean, value: string, error: string|null}}
 */
function validateUrl(url, options = {}) {
    const {
        required = false,
        allowedProtocols = ['http:', 'https:'],
        maxLength = VALIDATION_LIMITS.URL_MAX
    } = options;
    
    // Type coercion and trim
    let str = url == null ? '' : String(url).trim();
    
    // Required check
    if (required && !str) {
        return { valid: false, value: str, error: 'URL is required' };
    }
    
    // Empty is OK if not required
    if (!str) {
        return { valid: true, value: str, error: null };
    }
    
    // Length check
    if (str.length > maxLength) {
        return { valid: false, value: str, error: 'URL is too long' };
    }
    
    // URL format validation
    try {
        const parsed = new URL(str);
        
        // Protocol check
        if (!allowedProtocols.includes(parsed.protocol)) {
            return { valid: false, value: str, error: `URL must use ${allowedProtocols.join(' or ')}` };
        }
        
        return { valid: true, value: str, error: null };
    } catch (e) {
        return { valid: false, value: str, error: 'Invalid URL format' };
    }
}

/**
 * Validates a video URL (YouTube or Panopto).
 * @param {*} url - Video URL to validate
 * @returns {{valid: boolean, value: string, error: string|null, platform: string}}
 */
function validateVideoUrl(url) {
    const baseResult = validateUrl(url, { required: false });
    
    if (!baseResult.valid || !baseResult.value) {
        return { ...baseResult, platform: 'unknown' };
    }
    
    // Detect platform
    if (VALIDATION_PATTERNS.YOUTUBE_URL.test(baseResult.value)) {
        return { ...baseResult, platform: 'youtube' };
    }
    
    if (VALIDATION_PATTERNS.PANOPTO_URL.test(baseResult.value)) {
        return { ...baseResult, platform: 'panopto' };
    }
    
    // Allow other URLs but mark as unknown platform
    return { ...baseResult, platform: 'other' };
}

// ============================================================================
// NUMBER VALIDATION
// ============================================================================

/**
 * Validates a number input.
 * @param {*} value - Value to validate
 * @param {Object} options - Validation options
 * @returns {{valid: boolean, value: number|null, error: string|null}}
 */
function validateNumber(value, options = {}) {
    const {
        required = false,
        min = -Infinity,
        max = Infinity,
        integer = false,
        allowZero = true
    } = options;
    
    // Empty check
    if (value === '' || value == null) {
        if (required) {
            return { valid: false, value: null, error: 'This field is required' };
        }
        return { valid: true, value: null, error: null };
    }
    
    // Parse number
    const num = Number(value);
    
    // NaN check
    if (isNaN(num)) {
        return { valid: false, value: null, error: 'Must be a valid number' };
    }
    
    // Integer check
    if (integer && !Number.isInteger(num)) {
        return { valid: false, value: null, error: 'Must be a whole number' };
    }
    
    // Zero check
    if (!allowZero && num === 0) {
        return { valid: false, value: null, error: 'Cannot be zero' };
    }
    
    // Range checks
    if (num < min) {
        return { valid: false, value: null, error: `Must be at least ${min}` };
    }
    
    if (num > max) {
        return { valid: false, value: null, error: `Must be no more than ${max}` };
    }
    
    return { valid: true, value: num, error: null };
}

/**
 * Validates course points.
 * @param {*} points - Points value
 * @returns {{valid: boolean, value: number|null, error: string|null}}
 */
function validateCoursePoints(points) {
    return validateNumber(points, {
        required: false,
        min: 0,
        max: 100
    });
}

/**
 * Validates a grade percentage.
 * @param {*} grade - Grade value
 * @returns {{valid: boolean, value: number|null, error: string|null}}
 */
function validateGrade(grade) {
    return validateNumber(grade, {
        required: false,
        min: 0,
        max: 100,
        integer: true
    });
}

/**
 * Validates a calendar hour.
 * @param {*} hour - Hour value
 * @returns {{valid: boolean, value: number|null, error: string|null}}
 */
function validateCalendarHour(hour) {
    return validateNumber(hour, {
        required: true,
        min: 0,
        max: 23,
        integer: true
    });
}

// ============================================================================
// DATE VALIDATION
// ============================================================================

/**
 * Validates a date string.
 * @param {*} dateStr - Date string (YYYY-MM-DD)
 * @param {Object} options - Validation options
 * @returns {{valid: boolean, value: string, date: Date|null, error: string|null}}
 */
function validateDate(dateStr, options = {}) {
    const {
        required = false,
        minDate = null,
        maxDate = null,
        allowPast = true,
        allowFuture = true
    } = options;
    
    // Type coercion and trim
    let str = dateStr == null ? '' : String(dateStr).trim();
    
    // Required check
    if (required && !str) {
        return { valid: false, value: str, date: null, error: 'Date is required' };
    }
    
    // Empty is OK if not required
    if (!str) {
        return { valid: true, value: str, date: null, error: null };
    }
    
    // Format check
    if (!VALIDATION_PATTERNS.DATE_FORMAT.test(str)) {
        return { valid: false, value: str, date: null, error: 'Invalid date format (use YYYY-MM-DD)' };
    }
    
    // Parse date
    const date = new Date(str + 'T00:00:00');
    
    if (isNaN(date.getTime())) {
        return { valid: false, value: str, date: null, error: 'Invalid date' };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Past check
    if (!allowPast && date < today) {
        return { valid: false, value: str, date: null, error: 'Date cannot be in the past' };
    }
    
    // Future check
    if (!allowFuture && date > today) {
        return { valid: false, value: str, date: null, error: 'Date cannot be in the future' };
    }
    
    // Min date check
    if (minDate && date < new Date(minDate)) {
        return { valid: false, value: str, date: null, error: `Date must be on or after ${minDate}` };
    }
    
    // Max date check
    if (maxDate && date > new Date(maxDate)) {
        return { valid: false, value: str, date: null, error: `Date must be on or before ${maxDate}` };
    }
    
    return { valid: true, value: str, date, error: null };
}

/**
 * Validates a time string.
 * @param {*} timeStr - Time string (HH:MM)
 * @param {Object} options - Validation options
 * @returns {{valid: boolean, value: string, error: string|null}}
 */
function validateTime(timeStr, options = {}) {
    const { required = false } = options;
    
    let str = timeStr == null ? '' : String(timeStr).trim();
    
    if (required && !str) {
        return { valid: false, value: str, error: 'Time is required' };
    }
    
    if (!str) {
        return { valid: true, value: str, error: null };
    }
    
    if (!VALIDATION_PATTERNS.TIME_FORMAT.test(str)) {
        return { valid: false, value: str, error: 'Invalid time format (use HH:MM)' };
    }
    
    return { valid: true, value: str, error: null };
}

// ============================================================================
// DATA STRUCTURE VALIDATION
// ============================================================================

/**
 * Validates imported JSON data structure.
 * @param {*} data - Data to validate
 * @returns {{valid: boolean, error: string|null, warnings: string[]}}
 */
function validateImportedData(data) {
    const warnings = [];
    
    // Type check
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Invalid data format: expected an object', warnings };
    }
    
    // Check for required semesters array
    if (!Array.isArray(data.semesters)) {
        // Check if it's wrapped format
        if (data.data && Array.isArray(data.data.semesters)) {
            // It's the wrapped export format
            return validateImportedData(data.data);
        }
        return { valid: false, error: 'Invalid data format: missing semesters array', warnings };
    }
    
    // Validate each semester
    for (let i = 0; i < data.semesters.length; i++) {
        const sem = data.semesters[i];
        
        if (!sem || typeof sem !== 'object') {
            return { valid: false, error: `Invalid semester at index ${i}`, warnings };
        }
        
        if (!sem.id || !sem.name) {
            warnings.push(`Semester at index ${i} has missing id or name - will be auto-generated`);
        }
        
        // Validate courses if present
        if (sem.courses && !Array.isArray(sem.courses)) {
            return { valid: false, error: `Semester "${sem.name || i}" has invalid courses format`, warnings };
        }
    }
    
    // Validate settings if present
    if (data.settings && typeof data.settings !== 'object') {
        warnings.push('Settings format is invalid - will use defaults');
    }
    
    return { valid: true, error: null, warnings };
}

/**
 * Validates a schedule item.
 * @param {Object} item - Schedule item {day, start, end}
 * @returns {{valid: boolean, error: string|null}}
 */
function validateScheduleItem(item) {
    if (!item || typeof item !== 'object') {
        return { valid: false, error: 'Invalid schedule item' };
    }
    
    const dayResult = validateNumber(item.day, { required: true, min: 0, max: 6, integer: true });
    if (!dayResult.valid) {
        return { valid: false, error: 'Invalid day: ' + dayResult.error };
    }
    
    const startResult = validateTime(item.start, { required: true });
    if (!startResult.valid) {
        return { valid: false, error: 'Invalid start time: ' + startResult.error };
    }
    
    const endResult = validateTime(item.end, { required: true });
    if (!endResult.valid) {
        return { valid: false, error: 'Invalid end time: ' + endResult.error };
    }
    
    // Check that end is after start
    const [startH, startM] = item.start.split(':').map(Number);
    const [endH, endM] = item.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    
    if (endMinutes <= startMinutes) {
        return { valid: false, error: 'End time must be after start time' };
    }
    
    return { valid: true, error: null };
}

// ============================================================================
// SANITIZATION
// ============================================================================

/**
 * Sanitizes a string for safe display (removes control characters, normalizes whitespace).
 * @param {*} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
    if (str == null) return '';
    
    return String(str)
        // Remove control characters except newlines and tabs
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Normalize multiple spaces to single space
        .replace(/ +/g, ' ')
        // Normalize multiple newlines
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Sanitizes a filename to be safe for download.
 * @param {string} filename - Filename to sanitize
 * @returns {string} Safe filename
 */
function sanitizeFilename(filename) {
    if (!filename) return 'export';
    
    return String(filename)
        // Replace unsafe characters with underscores
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        // Replace multiple underscores with single
        .replace(/_+/g, '_')
        // Remove leading/trailing underscores
        .replace(/^_+|_+$/g, '')
        // Limit length
        .substring(0, 100)
        || 'export';
}

// Export for global access
window.VALIDATION_LIMITS = VALIDATION_LIMITS;
window.VALIDATION_PATTERNS = VALIDATION_PATTERNS;
window.validateString = validateString;
window.validateCourseName = validateCourseName;
window.validateHomeworkTitle = validateHomeworkTitle;
window.validateProfileName = validateProfileName;
window.validateNotes = validateNotes;
window.validateUrl = validateUrl;
window.validateVideoUrl = validateVideoUrl;
window.validateNumber = validateNumber;
window.validateCoursePoints = validateCoursePoints;
window.validateGrade = validateGrade;
window.validateCalendarHour = validateCalendarHour;
window.validateDate = validateDate;
window.validateTime = validateTime;
window.validateImportedData = validateImportedData;
window.validateScheduleItem = validateScheduleItem;
window.sanitizeString = sanitizeString;
window.sanitizeFilename = sanitizeFilename;
