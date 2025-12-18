/**
 * @fileoverview Application state management with reactive updates.
 * Provides a centralized store for application data with subscription support.
 */

import {
    COLOR_THEMES,
    DEFAULT_CALENDAR_SETTINGS,
    DEFAULT_RECORDING_TABS,
    DEFAULT_THEME_SETTINGS,
    STORAGE_KEYS,
} from '@/constants';
import { compareSemesters, debounce } from '@/utils';

import type {
    AppData,
    AppSettings,
    CalendarSettings,
    Course,
    HomeworkItem,
    Profile,
    RecordingTab,
    Semester,
} from '@/types';

// ============================================================================
// STATE TYPE DEFINITIONS
// ============================================================================

type Listener = () => void;
type Unsubscribe = () => void;

interface StoreState {
  data: AppData;
  profiles: Profile[];
  activeProfileId: string;
  currentSemesterId: string | null;
  timeInterval: ReturnType<typeof setInterval> | null;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const createInitialData = (): AppData => ({
  semesters: [],
  settings: { ...DEFAULT_THEME_SETTINGS },
  lastModified: new Date().toISOString(),
});

const initialState: StoreState = {
  data: createInitialData(),
  profiles: [],
  activeProfileId: 'default',
  currentSemesterId: null,
  timeInterval: null,
};

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

/**
 * Creates an application store with reactive state management.
 */
function createStore() {
  const state = { ...initialState };
  const listeners = new Set<Listener>();

  // Debounced save to prevent excessive writes
  const debouncedSave = debounce(() => {
    saveToStorage();
  }, 300);

  /**
   * Notifies all listeners of state changes.
   */
  const notify = (): void => {
    listeners.forEach(listener => listener());
  };

  /**
   * Saves current data to localStorage.
   */
  const saveToStorage = (): void => {
    const profileKey = STORAGE_KEYS.DATA_PREFIX + state.activeProfileId;
    try {
      state.data.lastModified = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, state.data.lastModified);
      localStorage.setItem(profileKey, JSON.stringify(state.data));
    } catch (error) {
      console.error('Failed to save data:', error);
      if ((error as Error).name === 'QuotaExceededError') {
        alert('Storage quota exceeded. Please export your data and clear some old profiles.');
      }
    }
  };

  /**
   * Saves profiles to localStorage.
   */
  const saveProfiles = (): void => {
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(state.profiles));
  };

  return {
    // ========================================================================
    // GETTERS
    // ========================================================================

    /**
     * Gets the current application data.
     */
    getData: (): AppData => state.data,

    /**
     * Gets the current settings.
     */
    getSettings: (): AppSettings => state.data.settings,

    /**
     * Gets all profiles.
     */
    getProfiles: (): Profile[] => state.profiles,

    /**
     * Gets the active profile ID.
     */
    getActiveProfileId: (): string => state.activeProfileId,

    /**
     * Gets the current semester ID.
     */
    getCurrentSemesterId: (): string | null => state.currentSemesterId,

    /**
     * Gets the current semester object.
     */
    getCurrentSemester: (): Semester | undefined => {
      return state.data.semesters.find(s => s.id === state.currentSemesterId);
    },

    /**
     * Gets a course by ID from the current semester.
     */
    getCourse: (courseId: string): Course | undefined => {
      const semester = state.data.semesters.find(s => s.id === state.currentSemesterId);
      return semester?.courses.find(c => c.id === courseId);
    },

    /**
     * Gets all semesters.
     */
    getSemesters: (): Semester[] => state.data.semesters,

    // ========================================================================
    // SETTERS
    // ========================================================================

    /**
     * Sets the current semester ID.
     */
    setCurrentSemesterId: (id: string | null): void => {
      state.currentSemesterId = id;
      notify();
    },

    /**
     * Updates application data and persists to storage.
     */
    updateData: (updater: (data: AppData) => void): void => {
      updater(state.data);
      debouncedSave();
      notify();
    },

    /**
     * Updates settings and persists to storage.
     */
    updateSettings: (updates: Partial<AppSettings>): void => {
      state.data.settings = { ...state.data.settings, ...updates };
      debouncedSave();
      notify();
    },

    /**
     * Saves data immediately (bypasses debounce).
     */
    saveNow: (): void => {
      saveToStorage();
    },

    // ========================================================================
    // PROFILE MANAGEMENT
    // ========================================================================

    /**
     * Switches to a different profile.
     */
    switchProfile: (profileId: string): void => {
      if (!state.profiles.some(p => p.id === profileId)) return;

      state.activeProfileId = profileId;
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, profileId);

      // Load profile data
      const profileKey = STORAGE_KEYS.DATA_PREFIX + profileId;
      const savedData = localStorage.getItem(profileKey);

      if (savedData) {
        state.data = migrateData(JSON.parse(savedData) as Partial<AppData>);
      } else {
        state.data = createInitialData();
      }

      // Initialize current semester
      if (state.data.semesters.length > 0) {
        const sorted = [...state.data.semesters].sort(compareSemesters);
        state.currentSemesterId = sorted[0].id;
      } else {
        state.currentSemesterId = null;
      }

      notify();
    },

    /**
     * Creates a new profile.
     */
    createProfile: (name: string): Profile => {
      const newProfile: Profile = {
        id: `profile_${Date.now()}`,
        name,
      };
      state.profiles.push(newProfile);
      saveProfiles();
      notify();
      return newProfile;
    },

    /**
     * Renames a profile.
     */
    renameProfile: (profileId: string, newName: string): void => {
      const profile = state.profiles.find(p => p.id === profileId);
      if (profile) {
        profile.name = newName;
        saveProfiles();
        notify();
      }
    },

    /**
     * Deletes a profile.
     */
    deleteProfile: (profileId: string): boolean => {
      if (profileId === 'default') return false;
      if (state.profiles.length <= 1) return false;

      state.profiles = state.profiles.filter(p => p.id !== profileId);
      localStorage.removeItem(STORAGE_KEYS.DATA_PREFIX + profileId);
      saveProfiles();

      // Switch to default if deleting active profile
      if (state.activeProfileId === profileId) {
        state.activeProfileId = 'default';
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, 'default');
      }

      notify();
      return true;
    },

    // ========================================================================
    // DATA LOADING
    // ========================================================================

    /**
     * Loads all data from localStorage.
     */
    load: (): void => {
      // Load profiles
      const profilesJson = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (profilesJson) {
        state.profiles = JSON.parse(profilesJson) as Profile[];
      } else {
        state.profiles = [{ id: 'default', name: 'Default Profile' }];
        saveProfiles();
      }

      // Load active profile
      const storedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
      if (storedActiveId && state.profiles.some(p => p.id === storedActiveId)) {
        state.activeProfileId = storedActiveId;
      } else {
        state.activeProfileId = 'default';
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, state.activeProfileId);
      }

      // Load profile data
      const profileKey = STORAGE_KEYS.DATA_PREFIX + state.activeProfileId;
      let savedData = localStorage.getItem(profileKey);

      // Migration: Check for legacy global data
      if (!savedData && state.activeProfileId === 'default') {
        const legacyData = localStorage.getItem(STORAGE_KEYS.LEGACY_DATA);
        if (legacyData) {
          savedData = legacyData;
          localStorage.setItem(profileKey, savedData);
        }
      }

      if (savedData) {
        state.data = migrateData(JSON.parse(savedData) as Partial<AppData>);
      } else {
        state.data = createInitialData();
      }

      // Initialize current semester
      if (state.data.semesters.length > 0) {
        const sorted = [...state.data.semesters].sort(compareSemesters);
        state.currentSemesterId = sorted[0].id;
      }

      notify();
    },

    /**
     * Replaces all data (used for import/sync).
     */
    replaceData: (newData: AppData): void => {
      state.data = migrateData(newData);

      // Update current semester
      if (state.data.semesters.length > 0) {
        const sorted = [...state.data.semesters].sort(compareSemesters);
        state.currentSemesterId = sorted[0].id;
      } else {
        state.currentSemesterId = null;
      }

      saveToStorage();
      notify();
    },

    // ========================================================================
    // SUBSCRIPTIONS
    // ========================================================================

    /**
     * Subscribes to state changes.
     */
    subscribe: (listener: Listener): Unsubscribe => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// ============================================================================
// DATA MIGRATION
// ============================================================================

/**
 * Migrates data to the current schema version.
 */
function migrateData(data: Partial<AppData>): AppData {
  const migrated: AppData = {
    semesters: data.semesters ?? [],
    settings: migrateSettings(data.settings),
    lastModified: data.lastModified ?? new Date().toISOString(),
  };

  migrated.semesters.forEach(migrateSemester);

  return migrated;
}

/**
 * Migrates settings to current schema.
 */
function migrateSettings(settings?: Partial<AppSettings>): AppSettings {
  return {
    theme: settings?.theme ?? DEFAULT_THEME_SETTINGS.theme,
    showCompleted: settings?.showCompleted ?? true,
    colorTheme: settings?.colorTheme ?? COLOR_THEMES.COLORFUL,
    baseColorHue: settings?.baseColorHue ?? 200,
  };
}

/**
 * Migrates a semester to current schema.
 */
function migrateSemester(semester: Semester): void {
  if (!semester.courses) semester.courses = [];
  if (!semester.calendarSettings) {
    semester.calendarSettings = { ...DEFAULT_CALENDAR_SETTINGS } as CalendarSettings;
  }
  semester.courses.forEach(migrateCourse);
}

/**
 * Migrates a course to current schema.
 */
function migrateCourse(course: Course): void {
  if (!course.homework) course.homework = [];
  if (!course.schedule) course.schedule = [];
  if (!course.exams) course.exams = { moedA: '', moedB: '' };
  if (!course.color) course.color = 'hsl(0, 45%, 50%)';

  migrateRecordings(course);
  course.homework.forEach(migrateHomework);
}

/**
 * Migrates recordings from legacy format to current schema.
 */
function migrateRecordings(course: Course): void {
  if (!course.recordings) {
    course.recordings = {
      tabs: DEFAULT_RECORDING_TABS.map(tab => ({ ...tab, items: [] })) as RecordingTab[],
    };

    // Migrate legacy lectures array if present
    const legacyCourse = course as Course & { lectures?: Array<{ name?: string; videoLink?: string; watched?: boolean; liked?: boolean }> };
    if (legacyCourse.lectures && legacyCourse.lectures.length > 0) {
      course.recordings.tabs[0].items = legacyCourse.lectures.map(l => ({
        name: l.name ?? '',
        videoLink: l.videoLink ?? '',
        slideLink: '',
        watched: l.watched ?? false,
        liked: l.liked ?? false,
      }));
      delete legacyCourse.lectures;
    }
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
 */
function migrateHomework(homework: HomeworkItem): void {
  if (typeof homework.completed === 'undefined') homework.completed = false;
  if (typeof homework.notes === 'undefined') homework.notes = '';
  if (!Array.isArray(homework.links)) homework.links = [];
}

// ============================================================================
// STORE INSTANCE
// ============================================================================

/**
 * Singleton store instance for the application.
 */
export const store = createStore();

// Export types for external use
export type { Listener, Unsubscribe };
