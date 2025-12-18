/**
 * @fileoverview Application constants and configuration values.
 * Centralized configuration for the UniManager application.
 */

import type { CalendarSettings, AppSettings, RecordingTab } from '@/types';

// ============================================================================
// CALENDAR SETTINGS
// ============================================================================

/**
 * Default calendar display settings.
 */
export const DEFAULT_CALENDAR_SETTINGS: Readonly<CalendarSettings> = Object.freeze({
  startHour: 8,
  endHour: 20,
  visibleDays: [0, 1, 2, 3, 4, 5], // Sunday through Friday
});

/**
 * Day names for display.
 */
export const DAY_NAMES = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const);

/**
 * Full day names for forms.
 */
export const DAY_NAMES_FULL = Object.freeze([
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const);

/**
 * Short day names for display.
 */
export const DAY_NAMES_SHORT = Object.freeze([
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const);

// ============================================================================
// STORAGE KEYS
// ============================================================================

/**
 * LocalStorage key prefixes and names.
 */
export const STORAGE_KEYS = Object.freeze({
  PROFILES: 'uniCourseManager_Profiles',
  ACTIVE_PROFILE: 'uniCourseManager_ActiveProfileId',
  DATA_PREFIX: 'uniCourseManager_Data_',
  LEGACY_DATA: 'uniCourseManagerData',
  LAST_SYNC: 'unimanager_last_sync',
  CALENDAR_TODAY_MODE: 'calendarShowOnlyToday',
} as const);

// ============================================================================
// THEME SETTINGS
// ============================================================================

/**
 * Available color themes for courses.
 */
export const COLOR_THEMES = Object.freeze({
  COLORFUL: 'colorful',
  SINGLE: 'single',
  MONO: 'mono',
} as const);

/**
 * Default theme settings.
 */
export const DEFAULT_THEME_SETTINGS: Readonly<AppSettings> = Object.freeze({
  theme: 'light',
  showCompleted: true,
  colorTheme: 'colorful',
  baseColorHue: 200,
});

/**
 * Golden angle for color distribution (in degrees).
 * Used for generating visually distinct course colors.
 */
export const GOLDEN_ANGLE = 137;

// ============================================================================
// RECORDINGS SETTINGS
// ============================================================================

/**
 * Default recording tabs for a new course.
 * Note: items array is added when creating new courses, not stored here.
 */
export const DEFAULT_RECORDING_TABS: readonly Omit<RecordingTab, 'items'>[] = Object.freeze([
  { id: 'lectures', name: 'Lectures' },
  { id: 'tutorials', name: 'Tutorials' },
]);

/**
 * Default tabs that cannot be deleted.
 */
export const PROTECTED_TAB_IDS = Object.freeze(new Set(['lectures', 'tutorials']));

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * CORS proxy URLs for fetching external content.
 * Ordered by reliability when running from file:// origin.
 */
export const CORS_PROXIES: readonly ((url: string) => string)[] = Object.freeze([
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.org/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
]);

/**
 * Technion SAP data fetcher base URL.
 */
export const TECHNION_SAP_BASE_URL =
  'https://raw.githubusercontent.com/michael-maltsev/technion-sap-info-fetcher/gh-pages/';

// ============================================================================
// SEMESTER SETTINGS
// ============================================================================

/**
 * Semester types/seasons.
 */
export const SEMESTER_SEASONS = Object.freeze(['Winter', 'Spring', 'Summer'] as const);

/**
 * Hebrew to English semester translations.
 */
export const SEMESTER_TRANSLATIONS: Readonly<Record<string, string>> = Object.freeze({
  אביב: 'Spring',
  חורף: 'Winter',
  קיץ: 'Summer',
});

// ============================================================================
// UI CONSTANTS
// ============================================================================

/**
 * Animation durations in milliseconds.
 */
export const ANIMATION_DURATIONS = Object.freeze({
  MODAL_TRANSITION: 300,
  HIGHLIGHT_PULSE: 1500,
  FETCH_SUCCESS_DELAY: 1500,
} as const);

/**
 * Time interval for updating the current time line (in milliseconds).
 */
export const TIME_UPDATE_INTERVAL = 60000; // 1 minute

/**
 * Maximum lengths for truncation.
 */
export const MAX_LENGTHS = Object.freeze({
  EVENT_CHIP_TITLE: 12,
  SIDEBAR_LINKS_DISPLAY: 3,
  SIDEBAR_LINKS_INITIAL: 2,
} as const);

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * HTML entities for escaping user input.
 */
export const HTML_ENTITIES: Readonly<Record<string, string>> = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
});

// ============================================================================
// EXPORT DATA
// ============================================================================

/**
 * Current export data version for migration handling.
 */
export const EXPORT_DATA_VERSION = 1;
