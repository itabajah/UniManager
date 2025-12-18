/**
 * @fileoverview Core type definitions for UniManager application.
 * Defines all data structures used throughout the application.
 */

// ============================================================================
// RECORDING TYPES
// ============================================================================

/**
 * A single recording item (lecture, tutorial, etc.)
 */
export interface RecordingItem {
  /** Display name of the recording */
  name: string;
  /** URL to the video (YouTube, Panopto, etc.) */
  videoLink: string;
  /** Optional URL to slides */
  slideLink: string;
  /** Whether the recording has been watched */
  watched: boolean;
  /** Whether the recording is marked as liked/favorite */
  liked: boolean;
}

/**
 * A tab containing recordings (e.g., "Lectures", "Tutorials", custom tabs)
 */
export interface RecordingTab {
  /** Unique identifier for the tab */
  id: string;
  /** Display name of the tab */
  name: string;
  /** Array of recording items in this tab */
  items: RecordingItem[];
}

/**
 * Container for all recordings in a course
 */
export interface CourseRecordings {
  /** Array of recording tabs */
  tabs: RecordingTab[];
}

// ============================================================================
// HOMEWORK TYPES
// ============================================================================

/**
 * A link attached to a homework item
 */
export interface HomeworkLink {
  /** Display label for the link */
  label: string;
  /** URL of the link */
  url: string;
}

/**
 * A homework/assignment item
 */
export interface HomeworkItem {
  /** Title of the assignment */
  title: string;
  /** Due date in yyyy-MM-dd format */
  dueDate: string;
  /** Whether the homework has been completed */
  completed: boolean;
  /** Optional notes about the homework */
  notes: string;
  /** Array of attached links */
  links: HomeworkLink[];
}

// ============================================================================
// SCHEDULE TYPES
// ============================================================================

/**
 * A scheduled class slot
 */
export interface ScheduleItem {
  /** Day of week (0 = Sunday, 6 = Saturday) */
  day: number;
  /** Start time in HH:MM format */
  start: string;
  /** End time in HH:MM format */
  end: string;
}

/**
 * Exam dates for a course
 */
export interface ExamDates {
  /** Date of first exam (Moed A) in yyyy-MM-dd format */
  moedA: string;
  /** Date of second exam (Moed B) in yyyy-MM-dd format */
  moedB: string;
}

// ============================================================================
// COURSE TYPES
// ============================================================================

/**
 * A course in a semester
 */
export interface Course {
  /** Unique identifier */
  id: string;
  /** Course name */
  name: string;
  /** HSL color string for visual identification */
  color: string;
  /** Course number/code */
  number: string;
  /** Credit points */
  points: string;
  /** Lecturer name(s) */
  lecturer: string;
  /** Faculty/department */
  faculty: string;
  /** Physical location */
  location: string;
  /** Final grade (optional) */
  grade: string;
  /** Course syllabus/description */
  syllabus: string;
  /** User notes */
  notes: string;
  /** Recordings organized by tabs */
  recordings: CourseRecordings;
  /** Homework assignments */
  homework: HomeworkItem[];
  /** Weekly class schedule */
  schedule: ScheduleItem[];
  /** Exam dates */
  exams: ExamDates;
}

// ============================================================================
// SEMESTER TYPES
// ============================================================================

/**
 * Calendar display settings
 */
export interface CalendarSettings {
  /** First hour to display (0-23) */
  startHour: number;
  /** Last hour to display (0-23) */
  endHour: number;
  /** Array of visible day indices (0 = Sunday) */
  visibleDays: number[];
}

/**
 * A semester containing courses
 */
export interface Semester {
  /** Unique identifier */
  id: string;
  /** Semester name (e.g., "Winter 2024-2025") */
  name: string;
  /** Courses in this semester */
  courses: Course[];
  /** Calendar display settings */
  calendarSettings: CalendarSettings;
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

/** Color theme options */
export type ColorTheme = 'colorful' | 'single' | 'mono';

/** UI theme options */
export type UITheme = 'light' | 'dark';

/**
 * Application settings
 */
export interface AppSettings {
  /** UI theme (light/dark) */
  theme: UITheme;
  /** Whether to show completed homework in sidebar */
  showCompleted: boolean;
  /** Course color theme */
  colorTheme: ColorTheme;
  /** Base hue for 'single' color theme (0-360) */
  baseColorHue: number;
}

// ============================================================================
// APPLICATION DATA TYPES
// ============================================================================

/**
 * Main application data structure
 */
export interface AppData {
  /** All semesters */
  semesters: Semester[];
  /** Application settings */
  settings: AppSettings;
  /** ISO timestamp of last modification */
  lastModified: string;
}

/**
 * User profile
 */
export interface Profile {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
}

// ============================================================================
// CALENDAR EVENT TYPES
// ============================================================================

/** Event type for calendar display */
export type CalendarEventType = 'homework' | 'exam';

/**
 * Calendar event for display
 */
export interface CalendarEvent {
  /** Type of event */
  type: CalendarEventType;
  /** Display title */
  title: string;
  /** Associated course name */
  courseName: string;
  /** Associated course ID */
  courseId: string;
  /** Event date in yyyy-MM-dd format */
  date: string;
  /** Day of week (0-6) */
  day: number;
  /** Course color */
  color: string;
  /** Homework index (for homework events) */
  hwIndex?: number;
  /** Exam type (for exam events) */
  examType?: 'A' | 'B';
  /** Whether completed (for homework) */
  completed?: boolean;
}

// ============================================================================
// IMPORT/EXPORT TYPES
// ============================================================================

/**
 * Imported course data from ICS or external source
 */
export interface ImportedCourse {
  /** Course name */
  name: string;
  /** Course number */
  number?: string;
  /** Credit points */
  points?: string;
  /** Lecturer name */
  lecturer?: string;
  /** Location */
  location?: string;
  /** Schedule items */
  schedule?: ScheduleItem[];
  /** First exam date */
  moedA?: string;
  /** Second exam date */
  moedB?: string;
}

/**
 * Video import source
 */
export interface ExtractedVideo {
  /** Video title */
  title: string;
  /** Video URL */
  url: string;
  /** Video ID (platform-specific) */
  id: string;
  /** Whether selected for import */
  selected: boolean;
}

// ============================================================================
// PROGRESS TYPES
// ============================================================================

/**
 * Progress statistics for a course
 */
export interface CourseProgress {
  /** Lecture progress */
  lectures: { total: number; watched: number };
  /** Tutorial progress */
  tutorials: { total: number; watched: number };
  /** Homework progress */
  homework: { total: number; completed: number };
}

// ============================================================================
// FIREBASE TYPES
// ============================================================================

/**
 * Firebase configuration
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL: string;
  measurementId?: string;
}

/**
 * Firebase sync state
 */
export interface SyncState {
  /** Whether currently syncing */
  isSyncing: boolean;
  /** Last successful sync timestamp */
  lastSync: string | null;
  /** Any sync error message */
  error: string | null;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/**
 * Modal state
 */
export interface ModalState {
  /** Currently editing course ID */
  editingCourseId: string | null;
  /** Original color theme (for cancel) */
  originalColorTheme: ColorTheme | null;
  /** Original base hue (for cancel) */
  originalBaseColorHue: number | null;
  /** Temporary color theme during editing */
  tempColorTheme: ColorTheme | null;
  /** Temporary base hue during editing */
  tempBaseColorHue: number | null;
}

/**
 * Recordings tab state
 */
export interface RecordingsTabState {
  /** Currently selected tab ID */
  currentTab: string;
  /** Currently editing recording index */
  editingIndex: number | null;
  /** Currently previewing video index */
  previewIndex: number | null;
}

/**
 * Homework edit state
 */
export interface HomeworkEditState {
  /** Course ID being edited */
  courseId: string | null;
  /** Homework index being edited */
  hwIndex: number | null;
  /** Temporary links during editing */
  tempLinks: HomeworkLink[] | null;
}
