/**
 * @fileoverview Recording management operations.
 */

import { store } from '@/state';
import { generateId } from '@/utils';

import type { Course, RecordingItem, RecordingTab } from '@/types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets a recording tab from a course.
 */
export function getRecordingTab(course: Course, tabId: string): RecordingTab | undefined {
  return course.recordings?.tabs.find(t => t.id === tabId);
}

/**
 * Generates a default name for a recording based on link type.
 */
export function generateRecordingName(link: string, tabName: string, count: number): string {
  if (link.includes('youtube.com') || link.includes('youtu.be')) {
    return `Video ${count}`;
  } else if (link.includes('panopto')) {
    return `Recording ${count}`;
  }
  return `${tabName.replace(/s$/, '')} ${count}`;
}

// ============================================================================
// RECORDING CRUD
// ============================================================================

/**
 * Adds a new recording to a course tab.
 */
export function addRecording(
  courseId: string,
  tabId: string,
  recording: Partial<RecordingItem>
): boolean {
  const course = store.getCourse(courseId);
  if (!course) return false;

  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const c = semester?.courses.find(c => c.id === courseId);
    const tab = c?.recordings?.tabs.find(t => t.id === tabId);

    if (tab) {
      const count = tab.items.length + 1;
      tab.items.push({
        name: recording.name ?? generateRecordingName(recording.videoLink ?? '', tab.name, count),
        videoLink: recording.videoLink ?? '',
        slideLink: recording.slideLink ?? '',
        watched: recording.watched ?? false,
        liked: recording.liked ?? false,
      });
    }
  });

  return true;
}

/**
 * Updates a recording in a course tab.
 */
export function updateRecording(
  courseId: string,
  tabId: string,
  index: number,
  updates: Partial<RecordingItem>
): boolean {
  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const course = semester?.courses.find(c => c.id === courseId);
    const tab = course?.recordings?.tabs.find(t => t.id === tabId);

    if (tab?.items[index]) {
      Object.assign(tab.items[index], updates);
    }
  });

  return true;
}

/**
 * Toggles the watched status of a recording.
 */
export function toggleRecordingStatus(courseId: string, tabId: string, index: number): boolean {
  const course = store.getCourse(courseId);
  if (!course) return false;

  const tab = getRecordingTab(course, tabId);
  if (!tab?.items[index]) return false;

  const newStatus = !tab.items[index].watched;

  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const c = semester?.courses.find(c => c.id === courseId);
    const t = c?.recordings?.tabs.find(t => t.id === tabId);

    if (t?.items[index]) {
      t.items[index].watched = newStatus;
    }
  });

  return true;
}

/**
 * Toggles the liked status of a recording.
 */
export function toggleRecordingLike(courseId: string, tabId: string, index: number): boolean {
  const course = store.getCourse(courseId);
  if (!course) return false;

  const tab = getRecordingTab(course, tabId);
  if (!tab?.items[index]) return false;

  const newStatus = !tab.items[index].liked;

  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const c = semester?.courses.find(c => c.id === courseId);
    const t = c?.recordings?.tabs.find(t => t.id === tabId);

    if (t?.items[index]) {
      t.items[index].liked = newStatus;
    }
  });

  return true;
}

/**
 * Deletes a recording from a course tab.
 */
export function deleteRecording(courseId: string, tabId: string, index: number): boolean {
  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const course = semester?.courses.find(c => c.id === courseId);
    const tab = course?.recordings?.tabs.find(t => t.id === tabId);

    if (tab) {
      tab.items.splice(index, 1);
    }
  });

  return true;
}

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

/**
 * Adds a new custom recordings tab.
 */
export function addRecordingsTab(courseId: string, name: string): string | null {
  const tabId = `custom_${generateId()}`;

  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const course = semester?.courses.find(c => c.id === courseId);

    if (course?.recordings) {
      course.recordings.tabs.push({
        id: tabId,
        name,
        items: [],
      });
    }
  });

  return tabId;
}

/**
 * Renames a recordings tab.
 */
export function renameRecordingsTab(courseId: string, tabId: string, newName: string): boolean {
  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const course = semester?.courses.find(c => c.id === courseId);
    const tab = course?.recordings?.tabs.find(t => t.id === tabId);

    if (tab) {
      tab.name = newName;
    }
  });

  return true;
}

/**
 * Deletes a recordings tab (custom tabs only).
 */
export function deleteRecordingsTab(courseId: string, tabId: string): boolean {
  // Cannot delete default tabs
  if (tabId === 'lectures' || tabId === 'tutorials') {
    return false;
  }

  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const course = semester?.courses.find(c => c.id === courseId);

    if (course?.recordings) {
      course.recordings.tabs = course.recordings.tabs.filter(t => t.id !== tabId);
    }
  });

  return true;
}

/**
 * Clears all recordings from a tab.
 */
export function clearRecordingsTab(courseId: string, tabId: string): boolean {
  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const course = semester?.courses.find(c => c.id === courseId);
    const tab = course?.recordings?.tabs.find(t => t.id === tabId);

    if (tab) {
      tab.items = [];
    }
  });

  return true;
}

/**
 * Imports multiple recordings at once.
 */
export function importRecordings(
  courseId: string,
  tabId: string,
  recordings: Array<{ title: string; url: string }>,
  useOriginalNames: boolean
): number {
  const course = store.getCourse(courseId);
  if (!course) return 0;

  const tab = getRecordingTab(course, tabId);
  if (!tab) return 0;

  let imported = 0;

  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const c = semester?.courses.find(c => c.id === courseId);
    const t = c?.recordings?.tabs.find(t => t.id === tabId);

    if (t) {
      recordings.forEach((rec) => {
        const count = t.items.length + 1;
        t.items.push({
          name: useOriginalNames ? rec.title : generateRecordingName(rec.url, t.name, count),
          videoLink: rec.url,
          slideLink: '',
          watched: false,
          liked: false,
        });
        imported++;
      });
    }
  });

  return imported;
}
