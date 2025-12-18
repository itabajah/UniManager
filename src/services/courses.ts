/**
 * @fileoverview Course CRUD operations and management.
 */

import { store } from '@/state';
import { generateId, generateCourseColor, getNextAvailableHue, $ } from '@/utils';
import { DEFAULT_RECORDING_TABS } from '@/constants';

import type { Course, ScheduleItem, ExamDates, CourseRecordings } from '@/types';

// ============================================================================
// COURSE DATA BUILDING
// ============================================================================

/**
 * Builds course data object from modal inputs.
 */
export function buildCourseData(name: string): Partial<Course> {
  const settings = store.getSettings();
  const colorTheme = settings.colorTheme ?? 'colorful';
  const hueInput = $('course-color-hue') as HTMLInputElement | null;
  const hue = hueInput?.value ?? '0';
  const color = colorTheme === 'mono' ? 'hsl(0, 0%, 50%)' : `hsl(${hue}, 45%, 50%)`;

  return {
    name,
    color,
    number: ($('course-number') as HTMLInputElement | null)?.value ?? '',
    points: ($('course-points') as HTMLInputElement | null)?.value ?? '',
    lecturer: ($('course-lecturer') as HTMLInputElement | null)?.value ?? '',
    faculty: ($('course-faculty') as HTMLInputElement | null)?.value ?? '',
    location: ($('course-location') as HTMLInputElement | null)?.value ?? '',
    grade: ($('course-grade') as HTMLInputElement | null)?.value ?? '',
    syllabus: ($('course-syllabus') as HTMLTextAreaElement | null)?.value ?? '',
    notes: ($('course-notes') as HTMLTextAreaElement | null)?.value ?? '',
    exams: {
      moedA: ($('course-exam-a') as HTMLInputElement | null)?.value ?? '',
      moedB: ($('course-exam-b') as HTMLInputElement | null)?.value ?? '',
    } as ExamDates,
  };
}

/**
 * Creates default recordings structure for a course.
 */
export function createDefaultRecordings(): CourseRecordings {
  return {
    tabs: DEFAULT_RECORDING_TABS.map(tab => ({ ...tab, items: [] })),
  };
}

// ============================================================================
// COURSE CRUD OPERATIONS
// ============================================================================

/**
 * Creates a new course in the current semester.
 */
export function createCourse(
  courseData: Partial<Course>,
  schedule: ScheduleItem[] = []
): Course | null {
  const semester = store.getCurrentSemester();
  if (!semester) return null;

  const settings = store.getSettings();
  const courseCount = semester.courses.length;

  const newCourse: Course = {
    id: generateId(),
    name: courseData.name ?? '',
    color:
      courseData.color ??
      generateCourseColor(courseCount, courseCount + 1, settings.colorTheme, settings.baseColorHue),
    number: courseData.number ?? '',
    points: courseData.points ?? '',
    lecturer: courseData.lecturer ?? '',
    faculty: courseData.faculty ?? '',
    location: courseData.location ?? '',
    grade: courseData.grade ?? '',
    syllabus: courseData.syllabus ?? '',
    notes: courseData.notes ?? '',
    recordings: createDefaultRecordings(),
    homework: [],
    schedule,
    exams: courseData.exams ?? { moedA: '', moedB: '' },
  };

  store.updateData(data => {
    const sem = data.semesters.find(s => s.id === semester.id);
    if (sem) {
      sem.courses.push(newCourse);
    }
  });

  return newCourse;
}

/**
 * Updates an existing course.
 */
export function updateCourse(
  courseId: string,
  updates: Partial<Course>,
  schedule?: ScheduleItem[]
): boolean {
  const semester = store.getCurrentSemester();
  if (!semester) return false;

  store.updateData(data => {
    const sem = data.semesters.find(s => s.id === semester.id);
    const course = sem?.courses.find(c => c.id === courseId);
    if (course) {
      Object.assign(course, updates);
      if (schedule) {
        course.schedule = schedule;
      }
      // Ensure required structures exist
      if (!course.homework) course.homework = [];
      if (!course.recordings) {
        course.recordings = createDefaultRecordings();
      }
    }
  });

  return true;
}

/**
 * Deletes a course from the current semester.
 */
export function deleteCourse(courseId: string): boolean {
  const semester = store.getCurrentSemester();
  if (!semester) return false;

  store.updateData(data => {
    const sem = data.semesters.find(s => s.id === semester.id);
    if (sem) {
      sem.courses = sem.courses.filter(c => c.id !== courseId);
    }
  });

  return true;
}

/**
 * Moves a course up or down in the list.
 */
export function moveCourse(index: number, direction: 'up' | 'down'): boolean {
  const semester = store.getCurrentSemester();
  if (!semester) return false;

  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= semester.courses.length) return false;

  store.updateData(data => {
    const sem = data.semesters.find(s => s.id === semester.id);
    if (sem) {
      [sem.courses[index], sem.courses[newIndex]] = [sem.courses[newIndex], sem.courses[index]];
    }
  });

  return true;
}

// ============================================================================
// SEMESTER OPERATIONS
// ============================================================================

/**
 * Creates a new semester.
 */
export function createSemester(name: string): string | null {
  const data = store.getData();

  if (data.semesters.some(s => s.name === name)) {
    return null; // Already exists
  }

  const newId = generateId();

  store.updateData(data => {
    data.semesters.push({
      id: newId,
      name,
      courses: [],
      calendarSettings: {
        startHour: 8,
        endHour: 20,
        visibleDays: [0, 1, 2, 3, 4, 5],
      },
    });
  });

  store.setCurrentSemesterId(newId);

  return newId;
}

/**
 * Deletes a semester.
 */
export function deleteSemester(semesterId: string): boolean {
  store.updateData(data => {
    data.semesters = data.semesters.filter(s => s.id !== semesterId);
  });

  // Switch to another semester if available
  const semesters = store.getSemesters();
  if (semesters.length > 0) {
    store.setCurrentSemesterId(semesters[semesters.length - 1].id);
  } else {
    store.setCurrentSemesterId(null);
  }

  return true;
}

/**
 * Updates a semester's properties.
 */
export function updateSemester(
  semesterId: string,
  updates: { name?: string; calendarSettings?: { startHour: number; endHour: number; visibleDays: number[] } }
): boolean {
  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === semesterId);
    if (semester) {
      if (updates.name !== undefined) {
        semester.name = updates.name;
      }
      if (updates.calendarSettings) {
        semester.calendarSettings = updates.calendarSettings;
      }
    }
  });

  return true;
}

/**
 * Gets the next available hue for a new course.
 */
export function getNextCourseHue(): number {
  const semester = store.getCurrentSemester();
  const courseCount = semester?.courses.length ?? 0;
  return getNextAvailableHue(courseCount, store.getSettings());
}

/**
 * Generates semester options for the add semester modal.
 */
export function generateSemesterOptions(): { value: string; text: string }[] {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const seasons = ['Winter', 'Spring', 'Summer'];
  const options: { value: string; text: string }[] = [];

  years.forEach(year => {
    seasons.forEach(season => {
      const name = season === 'Winter' ? `${season} ${year}-${year + 1}` : `${season} ${year}`;
      options.push({ value: name, text: name });
    });
  });

  options.push({ value: 'custom', text: 'Custom...' });

  return options;
}
