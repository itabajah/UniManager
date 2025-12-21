/**
 * @fileoverview Application state management and data persistence.
 * Handles loading, saving, and optimized storage with compact serialization.
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
// STORAGE OPTIMIZATION: COMPACT & HYDRATE
// ============================================================================

/**
 * Compacts data for storage by removing empty/default values.
 * This significantly reduces storage size.
 * @param {Object} data - Full data object
 * @returns {Object} Compacted data
 */
function compactForStorage(data) {
    return {
        v: 2, // Storage version for future migrations
        t: data.lastModified,
        s: data.settings ? compactSettings(data.settings) : undefined,
        d: data.semesters.map(compactSemester).filter(s => s) // d = data (semesters)
    };
}

/**
 * Compacts settings, only storing non-default values.
 */
function compactSettings(settings) {
    const compact = {};
    if (settings.theme && settings.theme !== 'light') compact.th = settings.theme;
    if (settings.colorTheme && settings.colorTheme !== 'colorful') compact.ct = settings.colorTheme;
    if (settings.baseColorHue && settings.baseColorHue !== 200) compact.bh = settings.baseColorHue;
    if (settings.showCompleted === false) compact.sc = false;
    if (settings.showWatchedRecordings === false) compact.sw = false;
    return Object.keys(compact).length > 0 ? compact : undefined;
}

/**
 * Compacts a semester.
 */
function compactSemester(semester) {
    const compact = {
        i: semester.id,
        n: semester.name,
        c: semester.courses.map(compactCourse).filter(c => c)
    };
    
    // Only store calendar settings if different from default
    const cal = semester.calendarSettings;
    if (cal) {
        const calCompact = {};
        if (cal.startHour !== 8) calCompact.sh = cal.startHour;
        if (cal.endHour !== 20) calCompact.eh = cal.endHour;
        const defaultDays = [0, 1, 2, 3, 4, 5];
        if (JSON.stringify(cal.visibleDays) !== JSON.stringify(defaultDays)) {
            calCompact.vd = cal.visibleDays;
        }
        if (Object.keys(calCompact).length > 0) compact.cal = calCompact;
    }
    
    return compact;
}

/**
 * Compacts a course, removing empty/default values.
 */
function compactCourse(course) {
    const c = {
        i: course.id,
        n: course.name,
        cl: course.color
    };
    
    // Only include non-empty optional fields
    if (course.number) c.num = course.number;
    if (course.points) c.pts = course.points;
    if (course.lecturer) c.lec = course.lecturer;
    if (course.faculty) c.fac = course.faculty;
    if (course.location) c.loc = course.location;
    if (course.grade) c.gr = course.grade;
    if (course.syllabus) c.syl = course.syllabus;
    if (course.notes) c.nt = course.notes;
    
    // Exams - only if at least one date exists
    if (course.exams?.moedA || course.exams?.moedB) {
        c.ex = {};
        if (course.exams.moedA) c.ex.a = course.exams.moedA;
        if (course.exams.moedB) c.ex.b = course.exams.moedB;
    }
    
    // Schedule - only if not empty
    if (course.schedule?.length > 0) {
        c.sch = course.schedule.map(s => [s.day, s.start, s.end]); // Compact array format
    }
    
    // Homework - only if not empty
    if (course.homework?.length > 0) {
        c.hw = course.homework.map(compactHomework);
    }
    
    // Recordings - only include tabs with items
    if (course.recordings?.tabs) {
        const tabs = course.recordings.tabs
            .filter(t => t.items?.length > 0)
            .map(compactRecordingTab);
        if (tabs.length > 0) c.rec = tabs;
    }
    
    return c;
}

/**
 * Compacts a recording tab.
 */
function compactRecordingTab(tab) {
    return {
        i: tab.id,
        n: tab.name,
        it: tab.items.map(compactRecordingItem)
    };
}

/**
 * Compacts a recording item.
 */
function compactRecordingItem(item) {
    const r = { n: item.name };
    if (item.videoLink) r.v = item.videoLink;
    if (item.watched) r.w = 1;
    if (item.slideLink) r.s = item.slideLink;
    return r;
}

/**
 * Compacts a homework item.
 */
function compactHomework(hw) {
    const h = { t: hw.title };
    if (hw.dueDate) h.d = hw.dueDate;
    if (hw.completed) h.c = 1;
    if (hw.notes) h.n = hw.notes;
    if (hw.links?.length > 0) {
        h.l = hw.links.map(link => link.url ? [link.label || '', link.url] : null).filter(Boolean);
    }
    return h;
}

// ============================================================================
// HYDRATION: Restore full structure from compact storage
// ============================================================================

/**
 * Hydrates compact storage data to full application structure.
 * @param {Object} compact - Compact storage data
 * @returns {Object} Full data structure
 */
function hydrateFromStorage(compact) {
    // Handle legacy format (version 1 or no version)
    if (!compact.v || compact.v < 2) {
        return migrateData(compact);
    }
    
    return {
        lastModified: compact.t || new Date().toISOString(),
        settings: hydrateSettings(compact.s),
        semesters: (compact.d || []).map(hydrateSemester)
    };
}

/**
 * Hydrates settings with defaults.
 */
function hydrateSettings(s) {
    const settings = { ...DEFAULT_THEME_SETTINGS };
    if (s) {
        if (s.th) settings.theme = s.th;
        if (s.ct) settings.colorTheme = s.ct;
        if (s.bh !== undefined) settings.baseColorHue = s.bh;
        if (s.sc !== undefined) settings.showCompleted = s.sc;
        if (s.sw !== undefined) settings.showWatchedRecordings = s.sw;
    }
    return settings;
}

/**
 * Hydrates a semester.
 */
function hydrateSemester(s) {
    const semester = {
        id: s.i,
        name: s.n,
        courses: (s.c || []).map(hydrateCourse),
        calendarSettings: { ...DEFAULT_CALENDAR_SETTINGS }
    };
    
    if (s.cal) {
        if (s.cal.sh !== undefined) semester.calendarSettings.startHour = s.cal.sh;
        if (s.cal.eh !== undefined) semester.calendarSettings.endHour = s.cal.eh;
        if (s.cal.vd) semester.calendarSettings.visibleDays = s.cal.vd;
    }
    
    return semester;
}

/**
 * Hydrates a course.
 */
function hydrateCourse(c) {
    const course = {
        id: c.i,
        name: c.n,
        color: c.cl || 'hsl(0, 45%, 50%)',
        number: c.num || '',
        points: c.pts || '',
        lecturer: c.lec || '',
        faculty: c.fac || '',
        location: c.loc || '',
        grade: c.gr || '',
        syllabus: c.syl || '',
        notes: c.nt || '',
        exams: {
            moedA: c.ex?.a || '',
            moedB: c.ex?.b || ''
        },
        schedule: (c.sch || []).map(s => ({ day: s[0], start: s[1], end: s[2] })),
        homework: (c.hw || []).map(hydrateHomework),
        recordings: {
            tabs: hydrateRecordingTabs(c.rec)
        }
    };
    
    return course;
}

/**
 * Hydrates recording tabs, ensuring default tabs exist.
 */
function hydrateRecordingTabs(rec) {
    const tabs = (rec || []).map(t => ({
        id: t.i,
        name: t.n,
        items: (t.it || []).map(hydrateRecordingItem)
    }));
    
    // Ensure default tabs exist
    if (!tabs.find(t => t.id === 'lectures')) {
        tabs.unshift({ id: 'lectures', name: 'Lectures', items: [] });
    }
    if (!tabs.find(t => t.id === 'tutorials')) {
        const lecturesIndex = tabs.findIndex(t => t.id === 'lectures');
        tabs.splice(lecturesIndex + 1, 0, { id: 'tutorials', name: 'Tutorials', items: [] });
    }
    
    return tabs;
}

/**
 * Hydrates a recording item.
 */
function hydrateRecordingItem(r) {
    return {
        name: r.n || '',
        videoLink: r.v || '',
        slideLink: r.s || '',
        watched: !!r.w
    };
}

/**
 * Hydrates a homework item.
 */
function hydrateHomework(h) {
    return {
        title: h.t || '',
        dueDate: h.d || '',
        completed: !!h.c,
        notes: h.n || '',
        links: (h.l || []).map(l => ({ label: l[0] || '', url: l[1] || '' }))
    };
}

// ============================================================================
// LEGACY DATA MIGRATION (for pre-v2 format)
// ============================================================================

/**
 * Migrates legacy data to current schema.
 * @param {Object} data - Legacy data object
 * @returns {Object} Migrated data object
 */
function migrateData(data) {
    if (!data.semesters) data.semesters = [];
    if (!data.settings) data.settings = { ...DEFAULT_THEME_SETTINGS };
    if (!data.lastModified) data.lastModified = new Date().toISOString();
    
    // Migrate settings
    if (typeof data.settings.showCompleted === 'undefined') data.settings.showCompleted = true;
    if (typeof data.settings.showWatchedRecordings === 'undefined') data.settings.showWatchedRecordings = false;
    if (!data.settings.colorTheme) data.settings.colorTheme = COLOR_THEMES.COLORFUL;
    if (typeof data.settings.baseColorHue === 'undefined') data.settings.baseColorHue = 200;
    
    // Migrate each semester
    data.semesters.forEach(semester => {
        if (!semester.courses) semester.courses = [];
        if (!semester.calendarSettings) {
            semester.calendarSettings = { ...DEFAULT_CALENDAR_SETTINGS };
        }
        semester.courses.forEach(migrateCourse);
    });
    
    return data;
}

/**
 * Migrates a course to current schema.
 */
function migrateCourse(course) {
    if (!course.homework) course.homework = [];
    if (!course.schedule) course.schedule = [];
    if (!course.exams) course.exams = { moedA: '', moedB: '' };
    if (!course.color) course.color = 'hsl(0, 45%, 50%)';
    
    // Migrate recordings
    if (!course.recordings) {
        course.recordings = {
            tabs: DEFAULT_RECORDING_TABS.map(tab => ({ ...tab, items: [] }))
        };
        if (course.lectures?.length > 0) {
            course.recordings.tabs[0].items = course.lectures.map(l => ({
                name: l.name || '',
                videoLink: l.videoLink || '',
                slideLink: '',
                watched: l.watched || false
            }));
        }
        delete course.lectures;
    }
    
    // Ensure recording items have all fields
    course.recordings.tabs.forEach(tab => {
        if (!tab.items) tab.items = [];
        tab.items.forEach(item => {
            if (typeof item.watched === 'undefined') item.watched = false;
            if (!item.videoLink) item.videoLink = '';
            if (!item.slideLink) item.slideLink = '';
            if (!item.name) item.name = '';
        });
    });
    
    // Ensure homework structure
    course.homework.forEach(hw => {
        if (typeof hw.completed === 'undefined') hw.completed = false;
        if (typeof hw.notes === 'undefined') hw.notes = '';
        if (!Array.isArray(hw.links)) hw.links = [];
    });
}

// ============================================================================
// DATA LOADING & SAVING
// ============================================================================

/**
 * Loads application data from localStorage.
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
        activeProfileId = profiles[0]?.id || 'default';
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, activeProfileId);
    }
}

/**
 * Loads data for the active profile.
 */
function loadProfileData() {
    const profileKey = STORAGE_KEYS.DATA_PREFIX + activeProfileId;
    const savedData = localStorage.getItem(profileKey);
    
    if (savedData) {
        const parsed = JSON.parse(savedData);
        appData = hydrateFromStorage(parsed);
    } else {
        appData = {
            semesters: [],
            settings: { ...DEFAULT_THEME_SETTINGS },
            lastModified: new Date().toISOString()
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
        appData.lastModified = new Date().toISOString();
        
        // Save compact format
        const compact = compactForStorage(appData);
        localStorage.setItem(profileKey, JSON.stringify(compact));
        
        // Auto-sync to Firebase if authenticated
        if (typeof autoSyncToFirebase === 'function') {
            Promise.resolve(autoSyncToFirebase()).catch(err => {
                console.error('Firebase sync failed:', err);
            });
        }
    } catch (error) {
        console.error('Failed to save data:', error);
        if (error.name === 'QuotaExceededError') {
            alert('Storage quota exceeded. Please export your data and clear some old profiles.');
        }
    }
}

// Export functions for use in other modules
window.getActiveProfileId = getActiveProfileId;
window.saveData = saveData;
window.appData = appData;
window.compactForStorage = compactForStorage;
window.hydrateFromStorage = hydrateFromStorage;
window.migrateData = migrateData;
