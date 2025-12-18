/**
 * @fileoverview Homework management operations.
 */

import { store } from '@/state';

import type { HomeworkItem, HomeworkLink } from '@/types';

// ============================================================================
// HOMEWORK CRUD
// ============================================================================

/**
 * Adds a new homework item to a course.
 */
export function addHomework(courseId: string, homework: Partial<HomeworkItem>): boolean {
  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const course = semester?.courses.find(c => c.id === courseId);

    if (course) {
      if (!course.homework) course.homework = [];
      course.homework.push({
        title: homework.title ?? '',
        dueDate: homework.dueDate ?? '',
        completed: homework.completed ?? false,
        notes: homework.notes ?? '',
        links: homework.links ?? [],
      });
    }
  });

  return true;
}

/**
 * Updates a homework item.
 */
export function updateHomework(
  courseId: string,
  index: number,
  updates: Partial<HomeworkItem>
): boolean {
  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const course = semester?.courses.find(c => c.id === courseId);

    if (course?.homework[index]) {
      Object.assign(course.homework[index], updates);
    }
  });

  return true;
}

/**
 * Toggles homework completion status.
 */
export function toggleHomeworkStatus(courseId: string, index: number): boolean {
  const course = store.getCourse(courseId);
  if (!course?.homework[index]) return false;

  const newStatus = !course.homework[index].completed;

  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const c = semester?.courses.find(c => c.id === courseId);

    if (c?.homework[index]) {
      c.homework[index].completed = newStatus;
    }
  });

  return true;
}

/**
 * Updates homework notes.
 */
export function updateHomeworkNotes(courseId: string, index: number, notes: string): boolean {
  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const course = semester?.courses.find(c => c.id === courseId);

    if (course?.homework[index]) {
      course.homework[index].notes = notes;
    }
  });

  return true;
}

/**
 * Deletes a homework item.
 */
export function deleteHomework(courseId: string, index: number): boolean {
  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const course = semester?.courses.find(c => c.id === courseId);

    if (course?.homework) {
      course.homework.splice(index, 1);
    }
  });

  return true;
}

// ============================================================================
// HOMEWORK LINKS
// ============================================================================

/**
 * Adds a link to a homework item.
 */
export function addHomeworkLink(courseId: string, hwIndex: number, link: HomeworkLink): boolean {
  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const course = semester?.courses.find(c => c.id === courseId);

    if (course?.homework[hwIndex]) {
      if (!course.homework[hwIndex].links) {
        course.homework[hwIndex].links = [];
      }
      course.homework[hwIndex].links.push(link);
    }
  });

  return true;
}

/**
 * Updates a link on a homework item.
 */
export function updateHomeworkLink(
  courseId: string,
  hwIndex: number,
  linkIndex: number,
  updates: Partial<HomeworkLink>
): boolean {
  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const course = semester?.courses.find(c => c.id === courseId);
    const link = course?.homework[hwIndex]?.links[linkIndex];

    if (link) {
      Object.assign(link, updates);
    }
  });

  return true;
}

/**
 * Removes a link from a homework item.
 */
export function removeHomeworkLink(
  courseId: string,
  hwIndex: number,
  linkIndex: number
): boolean {
  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const course = semester?.courses.find(c => c.id === courseId);

    if (course?.homework[hwIndex]?.links) {
      course.homework[hwIndex].links.splice(linkIndex, 1);
    }
  });

  return true;
}

/**
 * Replaces all links on a homework item.
 */
export function setHomeworkLinks(
  courseId: string,
  hwIndex: number,
  links: HomeworkLink[]
): boolean {
  store.updateData(data => {
    const semester = data.semesters.find(s => s.id === store.getCurrentSemesterId());
    const course = semester?.courses.find(c => c.id === courseId);

    if (course?.homework[hwIndex]) {
      course.homework[hwIndex].links = links;
    }
  });

  return true;
}

// ============================================================================
// HOMEWORK QUERIES
// ============================================================================

/**
 * Gets all homework items from the current semester, flattened with course info.
 */
export interface FlattenedHomework extends HomeworkItem {
  course: string;
  courseId: string;
  index: number;
  color: string;
  dateObj: Date | null;
}

export function getAllHomework(showCompleted: boolean): FlattenedHomework[] {
  const semester = store.getCurrentSemester();
  if (!semester) return [];

  const homeworks: FlattenedHomework[] = semester.courses.flatMap(course =>
    (course.homework ?? []).map((h, index) => ({
      ...h,
      course: course.name,
      courseId: course.id,
      index,
      color: course.color ?? 'hsl(0, 45%, 50%)',
      dateObj: h.dueDate ? new Date(h.dueDate) : null,
    }))
  );

  // Filter by completion status
  const filtered = homeworks.filter(h => showCompleted || !h.completed);

  // Sort by completion status first (incomplete first), then by date
  filtered.sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    if (!a.dateObj) return 1;
    if (!b.dateObj) return -1;
    return a.dateObj.getTime() - b.dateObj.getTime();
  });

  return filtered;
}
