/**
 * @fileoverview Application constants and configuration values.
 * Centralized configuration for the Tollab application.
 */

'use strict';

// ============================================================================
// SORT ORDER OPTIONS
// ============================================================================

/** @type {Object} Sort order options for recordings and homework */
const SORT_ORDERS = Object.freeze({
    recordings: Object.freeze({
        DEFAULT: 'default',
        MANUAL: 'manual',
        NAME_ASC: 'name_asc',
        NAME_DESC: 'name_desc',
        WATCHED_FIRST: 'watched_first',
        UNWATCHED_FIRST: 'unwatched_first'
    }),
    homework: Object.freeze({
        MANUAL: 'manual',
        DATE_ASC: 'date_asc',
        DATE_DESC: 'date_desc',
        COMPLETED_FIRST: 'completed_first',
        INCOMPLETE_FIRST: 'incomplete_first',
        NAME_ASC: 'name_asc'
    })
});

// ============================================================================
// CALENDAR SETTINGS
// ============================================================================

/**
 * Default calendar display settings.
 * @const {Object}
 */
const DEFAULT_CALENDAR_SETTINGS = Object.freeze({
    startHour: 8,
    endHour: 20,
    visibleDays: [0, 1, 2, 3, 4, 5] // Sunday through Friday
});

/**
 * Day names for display.
 * @const {string[]}
 */
const DAY_NAMES = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

/**
 * Full day names for forms.
 * @const {string[]}
 */
const DAY_NAMES_FULL = Object.freeze([
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
]);

// ============================================================================
// STORAGE KEYS
// ============================================================================

/**
 * LocalStorage key prefixes and names.
 * @const {Object}
 */
const STORAGE_KEYS = Object.freeze({
    PROFILES: 'tollab_profiles',
    ACTIVE_PROFILE: 'tollab_active',
    DATA_PREFIX: 'tollab_',
    SETTINGS: 'tollab_settings'
});

/**
 * Short day names for display.
 * @const {string[]}
 */
const DAY_NAMES_SHORT = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

// ============================================================================
// THEME SETTINGS
// ============================================================================

/**
 * Available color themes for courses.
 * @const {Object}
 */
const COLOR_THEMES = Object.freeze({
    COLORFUL: 'colorful',
    SINGLE: 'single',
    MONO: 'mono'
});

/**
 * Default theme settings.
 * @const {Object}
 */
const DEFAULT_THEME_SETTINGS = Object.freeze({
    theme: 'light',
    showCompleted: true,
    showWatchedRecordings: false,
    colorTheme: COLOR_THEMES.COLORFUL,
    baseColorHue: 200
});

/**
 * Golden angle for color distribution (in degrees).
 * Used for generating visually distinct course colors.
 * @const {number}
 */
const GOLDEN_ANGLE = 137;

// ============================================================================
// RECORDINGS SETTINGS
// ============================================================================

/**
 * Default recording tabs for a new course.
 * @const {Object[]}
 */
const DEFAULT_RECORDING_TABS = Object.freeze([
    { id: 'lectures', name: 'Lectures' },
    { id: 'tutorials', name: 'Tutorials' }
]);

/**
 * Default tabs that cannot be deleted.
 * @const {Set<string>}
 */
const PROTECTED_TAB_IDS = Object.freeze(new Set(['lectures', 'tutorials']));

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * CORS proxy URLs for fetching external content.
 * Ordered by reliability when running from file:// origin.
 * @const {Function[]}
 */
const CORS_PROXIES = Object.freeze([
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.org/?${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
]);

/**
 * Technion SAP data fetcher base URL.
 * @const {string}
 */
const TECHNION_SAP_BASE_URL = 'https://raw.githubusercontent.com/michael-maltsev/technion-sap-info-fetcher/gh-pages/';

// ============================================================================
// SEMESTER SETTINGS
// ============================================================================

/**
 * Semester types/seasons.
 * @const {string[]}
 */
const SEMESTER_SEASONS = Object.freeze(['Winter', 'Spring', 'Summer']);

/**
 * Hebrew to English semester translations.
 * @const {Object}
 */
const SEMESTER_TRANSLATIONS = Object.freeze({
    'אביב': 'Spring',
    'חורף': 'Winter',
    'קיץ': 'Summer'
});

// ============================================================================
// UI CONSTANTS
// ============================================================================

/**
 * Animation durations in milliseconds.
 * @const {Object}
 */
const ANIMATION_DURATIONS = Object.freeze({
    MODAL_TRANSITION: 300,
    HIGHLIGHT_PULSE: 1500,
    FETCH_SUCCESS_DELAY: 1500
});

/**
 * Time interval for updating the current time line (in milliseconds).
 * @const {number}
 */
const TIME_UPDATE_INTERVAL = 60000; // 1 minute

/**
 * Maximum lengths for truncation.
 * @const {Object}
 */
const MAX_LENGTHS = Object.freeze({
    EVENT_CHIP_TITLE: 12,
    SIDEBAR_LINKS_DISPLAY: 3,
    SIDEBAR_LINKS_INITIAL: 2
});

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * HTML entities for escaping user input.
 * @const {Object}
 */
const HTML_ENTITIES = Object.freeze({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
});

// ============================================================================
// EXPORT DATA
// ============================================================================

/**
 * Current export data version for migration handling.
 * @const {number}
 */
const EXPORT_DATA_VERSION = 1;
