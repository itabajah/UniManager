/**
 * @fileoverview Application state management and data persistence.
 * Handles loading, saving, and migrating application data.
 */

'use strict';

// ============================================================================
// GLOBAL APPLICATION STATE
// ============================================================================

/**
 * Main application data structure.
 * @type {Object}
 */
let appData = {
    semesters: [],
    settings: { ...DEFAULT_THEME_SETTINGS },
    lastModified: new Date().toISOString()
};

/**
 * Currently selected semester ID.
 * @type {string|null}
 */
let currentSemesterId = null;

/**
 * List of user profiles.
 * @type {Array<{id: string, name: string}>}
 */
let profiles = [];

/**
 * Currently active profile ID.
 * @type {string}
 */
let activeProfileId = 'default';

/**
 * Gets the currently active profile ID.
 * @returns {string} The active profile ID
 */
function getActiveProfileId() {
    return activeProfileId;
}

/**
 * Interval ID for the current time line update.
 * @type {number|null}
 */
let timeInterval = null;

// ============================================================================
// TEMPORARY UI STATE (exposed globally for modal handlers)
// ============================================================================

/** @type {Array} Temporary schedule items being edited */
window.tempSchedule = [];

/** @type {string} Currently selected recordings tab ID */
window.currentRecordingsTab = 'lectures';

/** @type {Object|null} Temporary recording edit state */
window.tempRecordingEdit = null;

// ============================================================================
// DATA MIGRATION
// ============================================================================

/**
 * Migrates data to the current schema version.
 * Ensures backward compatibility with older data formats.
 * 
 * @param {Object} data - The data object to migrate
 * @returns {Object} The migrated data object
 */
function migrateData(data) {
    // Ensure top-level structure
    if (!data.semesters) data.semesters = [];
    if (!data.settings) data.settings = { ...DEFAULT_THEME_SETTINGS };
    if (!data.lastModified) data.lastModified = new Date().toISOString();
    
    // Migrate settings
    migrateSettings(data.settings);
    
    // Migrate each semester and its courses
    data.semesters.forEach(migrateSemester);
    
    return data;
}

/**
 * Migrates settings to current schema.
 * @param {Object} settings - Settings object to migrate
 */
function migrateSettings(settings) {
    if (typeof settings.showCompleted === 'undefined') {
        settings.showCompleted = true;
    }
    if (!settings.colorTheme) {
        settings.colorTheme = COLOR_THEMES.COLORFUL;
    }
    if (typeof settings.baseColorHue === 'undefined') {
        settings.baseColorHue = 200;
    }
}

/**
 * Migrates a semester to current schema.
 * @param {Object} semester - Semester object to migrate
 */
function migrateSemester(semester) {
    if (!semester.courses) semester.courses = [];
    if (!semester.calendarSettings) {
        semester.calendarSettings = { ...DEFAULT_CALENDAR_SETTINGS };
    }
    semester.courses.forEach(migrateCourse);
}

/**
 * Migrates a course to current schema.
 * @param {Object} course - Course object to migrate
 */
function migrateCourse(course) {
    // Ensure basic arrays exist
    if (!course.homework) course.homework = [];
    if (!course.schedule) course.schedule = [];
    if (!course.exams) course.exams = { moedA: '', moedB: '' };
    if (!course.color) course.color = 'hsl(0, 45%, 50%)';
    
    // Migrate recordings structure
    migrateRecordings(course);
    
    // Ensure homework structure
    course.homework.forEach(migrateHomework);
}

/**
 * Migrates recordings from legacy format to current schema.
 * @param {Object} course - Course object containing recordings
 */
function migrateRecordings(course) {
    if (!course.recordings) {
        course.recordings = {
            tabs: DEFAULT_RECORDING_TABS.map(tab => ({ ...tab, items: [] }))
        };
        
        // Migrate legacy lectures array if present
        if (course.lectures && course.lectures.length > 0) {
            course.recordings.tabs[0].items = course.lectures.map(l => ({
                name: l.name || '',
                videoLink: l.videoLink || '',
                slideLink: '',
                watched: l.watched || false,
                liked: l.liked || false
            }));
        }
        delete course.lectures;
    }
    
    // Ensure recording items have all required fields
    course.recordings.tabs.forEach(tab => {
        if (!tab.items) tab.items = [];
        tab.items.forEach(item => {
            if (typeof item.watched === 'undefined') item.watched = false;
            if (typeof item.liked === 'undefined') item.liked = false;
            if (!item.videoLink) item.videoLink = '';
            if (!item.slideLink) item.slideLink = '';
            if (!item.name) item.name = '';
        });
    });
}

/**
 * Migrates a homework item to current schema.
 * @param {Object} homework - Homework object to migrate
 */
function migrateHomework(homework) {
    if (typeof homework.completed === 'undefined') homework.completed = false;
    if (typeof homework.notes === 'undefined') homework.notes = '';
    if (!Array.isArray(homework.links)) homework.links = [];
}

// ============================================================================
// DATA LOADING & SAVING
// ============================================================================

/**
 * Loads application data from localStorage.
 * Handles profile switching and data migration.
 */
function loadData() {
    loadProfiles();
    loadActiveProfile();
    loadProfileData();
    initializeCurrentSemester();
    
    renderAll();
    startTimeUpdater();
}

/**
 * Loads the profiles list from localStorage.
 */
function loadProfiles() {
    const profilesJson = localStorage.getItem(STORAGE_KEYS.PROFILES);
    if (profilesJson) {
        profiles = JSON.parse(profilesJson);
    } else {
        profiles = [{ id: 'default', name: 'Default Profile' }];
        localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    }
}

/**
 * Loads the active profile ID from localStorage.
 */
function loadActiveProfile() {
    const storedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
    if (storedActiveId && profiles.some(p => p.id === storedActiveId)) {
        activeProfileId = storedActiveId;
    } else {
        activeProfileId = 'default';
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, activeProfileId);
    }
}

/**
 * Loads data for the active profile.
 */
function loadProfileData() {
    const profileKey = STORAGE_KEYS.DATA_PREFIX + activeProfileId;
    let savedData = localStorage.getItem(profileKey);
    
    // Migration: Check for legacy global data
    if (!savedData && activeProfileId === 'default') {
        const legacyData = localStorage.getItem(STORAGE_KEYS.LEGACY_DATA);
        if (legacyData) {
            savedData = legacyData;
            localStorage.setItem(profileKey, savedData);
        }
    }
    
    if (savedData) {
        appData = migrateData(JSON.parse(savedData));
    } else {
        appData = {
            semesters: [],
            settings: { ...DEFAULT_THEME_SETTINGS }
        };
    }
}

/**
 * Sets the current semester to the most recent one.
 */
function initializeCurrentSemester() {
    if (appData.semesters.length > 0) {
        const sorted = [...appData.semesters].sort(compareSemesters);
        currentSemesterId = sorted[0].id;
    } else {
        currentSemesterId = null;
    }
}

/**
 * Starts the interval for updating the current time line.
 */
function startTimeUpdater() {
    if (timeInterval) clearInterval(timeInterval);
    renderCurrentTime();
    timeInterval = setInterval(renderCurrentTime, TIME_UPDATE_INTERVAL);
}

/**
 * Saves the current application data to localStorage.
 */
function saveData() {
    const profileKey = STORAGE_KEYS.DATA_PREFIX + activeProfileId;
    try {
        // Update timestamp
        appData.lastModified = new Date().toISOString();
        localStorage.setItem('unimanager_last_sync', appData.lastModified);
        
        localStorage.setItem(profileKey, JSON.stringify(appData));
        
        // Auto-sync to Firebase if authenticated
        if (typeof autoSyncToFirebase === 'function') {
            Promise.resolve(autoSyncToFirebase()).catch(err => {
                console.error('Firebase sync failed:', err);
            });
        }
    } catch (error) {
        console.error('Failed to save data:', error);
        // Handle quota exceeded error
        if (error.name === 'QuotaExceededError') {
            alert('Storage quota exceeded. Please export your data and clear some old profiles.');
        }
    }
}

// Export functions and data for use in other modules
window.getActiveProfileId = getActiveProfileId;
window.saveData = saveData;
window.appData = appData;
