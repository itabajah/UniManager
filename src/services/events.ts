/**
 * @fileoverview Event handlers setup for the application.
 * Sets up all event listeners using event delegation.
 */

import * as render from '@/render';
import { store } from '@/state';
import type { ColorTheme } from '@/types';
import { $, generateCourseColor } from '@/utils';
import * as courseService from './courses';
import * as homeworkService from './homework';
import * as modals from './modals';
import * as recordingService from './recordings';
import { toggleTheme, updateBaseColorPreview } from './theme';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Safely gets a dataset property from an element.
 * Accepts Element | null because closest() returns Element, not HTMLElement.
 */
function getDataset(element: Element | null, key: string): string | undefined {
  if (!element || !(element instanceof HTMLElement)) return undefined;
  return element.dataset[key];
}

/**
 * Safely gets a numeric dataset property from an element.
 * Accepts Element | null because closest() returns Element, not HTMLElement.
 */
function getDatasetInt(element: Element | null, key: string, defaultValue = 0): number {
  if (!element || !(element instanceof HTMLElement)) return defaultValue;
  const value = element.dataset[key];
  return value !== undefined ? parseInt(value, 10) : defaultValue;
}

// ============================================================================
// MAIN SETUP
// ============================================================================

/**
 * Sets up all event listeners for the application.
 */
export function setupEventListeners(): void {
  setupSemesterEvents();
  setupCourseEvents();
  setupRecordingsEvents();
  setupHomeworkEvents();
  setupSettingsEvents();
  setupProfileEvents();
  setupColorThemeEvents();
  setupModalCloseEvents();
  setupCalendarEvents();
  setupHomeworkSidebarEvents();
}

// ============================================================================
// SEMESTER EVENTS
// ============================================================================

function setupSemesterEvents(): void {
  const semesterSelect = $('semester-select');
  semesterSelect?.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    store.setCurrentSemesterId(target.value);
    render.renderAll();
  });

  const addSemesterBtn = $('add-semester-btn');
  addSemesterBtn?.addEventListener('click', () => {
    modals.populateSemesterOptions();
    modals.openModal('add-semester-modal');
  });

  const newSemesterSelect = $('new-semester-select');
  newSemesterSelect?.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    const customGroup = $('custom-semester-group');
    if (customGroup) {
      customGroup.classList.toggle('hidden', target.value !== 'custom');
    }
  });

  const saveSemesterBtn = $('save-semester-btn');
  saveSemesterBtn?.addEventListener('click', saveSemester);

  const deleteSemesterBtn = $('delete-semester-btn');
  deleteSemesterBtn?.addEventListener('click', deleteSemester);
}

function saveSemester(): void {
  const select = $('new-semester-select') as HTMLSelectElement | null;
  if (!select) return;

  let name = select.options[select.selectedIndex].text;

  if (select.value === 'custom') {
    const customInput = $('new-semester-custom') as HTMLInputElement | null;
    name = customInput?.value ?? '';
  }

  if (!name) return;

  const data = store.getData();
  if (data.semesters.some((s) => s.name === name)) {
    alert('Semester already exists!');
    return;
  }

  const newSemId = courseService.createSemester(name);
  if (newSemId) {
    store.setCurrentSemesterId(newSemId);
  }
  render.renderAll();
  modals.closeModal('add-semester-modal');

  const customInput = $('new-semester-custom') as HTMLInputElement | null;
  if (customInput) customInput.value = '';
}

function deleteSemester(): void {
  const currentId = store.getCurrentSemesterId();
  if (!currentId) return;

  const semester = store.getCurrentSemester();
  if (!semester) return;

  if (!confirm(`Are you sure you want to delete "${semester.name}" and all its courses?`)) return;

  courseService.deleteSemester(currentId);

  const data = store.getData();
  const newCurrentId = data.semesters.length > 0 ? data.semesters[data.semesters.length - 1].id : null;
  store.setCurrentSemesterId(newCurrentId);

  render.renderAll();
}

// ============================================================================
// COURSE EVENTS
// ============================================================================

function setupCourseEvents(): void {
  const addCourseFab = $('add-course-fab');
  addCourseFab?.addEventListener('click', () => {
    if (!store.getCurrentSemesterId()) {
      modals.populateSemesterOptions();
      modals.openModal('add-semester-modal');
      return;
    }
    modals.openCourseModal(null);
  });

  const saveCourseBtn = $('save-course-btn');
  saveCourseBtn?.addEventListener('click', saveCourse);

  const deleteCourseBtn = $('delete-course-btn');
  deleteCourseBtn?.addEventListener('click', deleteCourse);

  const courseColorHue = $('course-color-hue');
  courseColorHue?.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    const hue = target.value;
    const settings = store.getSettings();
    const colorTheme = settings.colorTheme ?? 'colorful';
    const color = colorTheme === 'mono' ? 'hsl(0, 0%, 50%)' : `hsl(${hue}, 45%, 50%)`;
    const preview = $('course-color-preview');
    if (preview) preview.style.backgroundColor = color;
  });

  const addScheduleBtn = $('add-schedule-btn');
  addScheduleBtn?.addEventListener('click', modals.addScheduleItem);

  // Course modal tab switching
  document.querySelectorAll('.course-modal-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabName = (tab as HTMLElement).dataset.tab;
      if (tabName) modals.switchCourseModalTab(tabName);
    });
  });

  // Course list click delegation
  const courseList = $('course-list');
  courseList?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle reorder buttons
    const reorderBtn = target.closest('.reorder-btn');
    if (reorderBtn) {
      e.stopPropagation();
      const action = getDataset(reorderBtn, 'action');
      const index = getDatasetInt(reorderBtn, 'index');
      if (action === 'move-up') {
        courseService.moveCourse(index, 'up');
        render.renderCourses();
      } else if (action === 'move-down') {
        courseService.moveCourse(index, 'down');
        render.renderCourses();
      }
      return;
    }

    // Handle course card click
    const courseCard = target.closest('.course-card');
    const courseId = getDataset(courseCard, 'courseId');
    if (courseId) {
      modals.openCourseModal(courseId);
    }
  });

  // Schedule list click delegation
  const scheduleList = $('schedule-list');
  scheduleList?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('[data-action="remove-schedule"]');
    if (btn) {
      const index = getDatasetInt(btn, 'index');
      modals.removeScheduleItem(index);
    }
  });
}

function saveCourse(): void {
  const editingId = modals.getEditingCourseId();
  const settings = store.getSettings();
  const colorTheme = settings.colorTheme ?? 'colorful';

  const nameEl = $('course-name') as HTMLInputElement | null;
  const name = nameEl?.value.trim();
  if (!name) {
    alert('Please enter a course name.');
    return;
  }

  const hueEl = $('course-color-hue') as HTMLInputElement | null;
  const hue = hueEl?.value ?? '0';
  const color = colorTheme === 'mono' ? 'hsl(0, 0%, 50%)' : `hsl(${hue}, 45%, 50%)`;

  const courseData = {
    name,
    color,
    number: ($('course-number') as HTMLInputElement | null)?.value ?? '',
    points: ($('course-points') as HTMLInputElement | null)?.value ?? '',
    lecturer: ($('course-lecturer') as HTMLInputElement | null)?.value ?? '',
    faculty: ($('course-faculty') as HTMLInputElement | null)?.value ?? '',
    location: ($('course-location') as HTMLInputElement | null)?.value ?? '',
    grade: ($('course-grade') as HTMLInputElement | null)?.value ?? '',
    syllabus: ($('course-syllabus') as HTMLInputElement | null)?.value ?? '',
    notes: ($('course-notes') as HTMLTextAreaElement | null)?.value ?? '',
    exams: {
      moedA: ($('course-exam-a') as HTMLInputElement | null)?.value ?? '',
      moedB: ($('course-exam-b') as HTMLInputElement | null)?.value ?? '',
    },
    schedule: modals.getTempSchedule(),
  };

  if (editingId) {
    courseService.updateCourse(editingId, courseData);
  } else {
    courseService.createCourse(courseData);
  }

  modals.closeModal('course-modal');
  render.renderAll();
}

function deleteCourse(): void {
  const editingId = modals.getEditingCourseId();
  if (!editingId) return;

  if (!confirm('Are you sure you want to delete this course?')) return;

  courseService.deleteCourse(editingId);
  modals.closeModal('course-modal');
  render.renderAll();
}

// ============================================================================
// RECORDINGS EVENTS
// ============================================================================

function setupRecordingsEvents(): void {
  const addRecordingBtn = $('add-recording-btn');
  addRecordingBtn?.addEventListener('click', addRecording);

  const newRecordingLink = $('new-recording-link');
  newRecordingLink?.addEventListener('keypress', (e) => {
    if ((e).key === 'Enter') addRecording();
  });

  const addTabBtn = $('add-recordings-tab-btn');
  addTabBtn?.addEventListener('click', addRecordingsTab);

  const renameTabBtn = $('rename-tab-btn');
  renameTabBtn?.addEventListener('click', renameRecordingsTab);

  const clearTabBtn = $('clear-tab-btn');
  clearTabBtn?.addEventListener('click', clearRecordingsTab);

  const deleteTabBtn = $('delete-tab-btn');
  deleteTabBtn?.addEventListener('click', deleteRecordingsTab);

  // Recordings tabs click delegation
  const recordingsTabs = $('recordings-tabs');
  recordingsTabs?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const tabBtn = target.closest('.recordings-tab');
    const tabId = getDataset(tabBtn, 'tabId');
    const courseId = getDataset(tabBtn, 'courseId');
    if (tabId && courseId) {
      switchRecordingsTab(courseId, tabId);
    }
  });

  // Recordings list click delegation
  const recordingsList = $('recordings-list');
  recordingsList?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const recordingItem = target.closest('.recording-item');
    if (!recordingItem) return;

    const courseId = getDataset(recordingItem, 'courseId');
    const tabId = getDataset(recordingItem, 'tabId');
    const index = getDatasetInt(recordingItem, 'index');

    if (!courseId || !tabId) return;

    const actionBtn = target.closest('[data-action]');
    if (actionBtn) {
      const action = getDataset(actionBtn, 'action');
      e.stopPropagation();

      if (action === 'toggle-watched') {
        recordingService.toggleRecordingStatus(courseId, tabId, index);
        const course = store.getCourse(courseId);
        if (course) modals.renderRecordingsList(course);
        render.renderCourses();
      } else if (action === 'edit') {
        toggleRecordingEdit(index);
      } else if (action === 'delete') {
        if (confirm('Delete this recording?')) {
          recordingService.deleteRecording(courseId, tabId, index);
          const course = store.getCourse(courseId);
          if (course) {
            modals.renderRecordingsTabs(course);
            modals.renderRecordingsList(course);
          }
          render.renderCourses();
        }
      } else if (action === 'save-edit') {
        saveRecordingEdit(courseId, tabId, index);
      } else if (action === 'cancel-edit') {
        const course = store.getCourse(courseId);
        if (course) modals.renderRecordingsList(course);
      }
    }
  });

  // Show watched toggle
  const showWatchedToggle = $('show-watched-toggle');
  showWatchedToggle?.addEventListener('change', () => {
    const courseId = modals.getEditingCourseId();
    if (courseId) {
      const course = store.getCourse(courseId);
      if (course) modals.renderRecordingsList(course);
    }
  });
}

function addRecording(): void {
  const courseId = modals.getEditingCourseId();
  if (!courseId) return;

  const input = $('new-recording-link') as HTMLInputElement | null;
  const link = input?.value.trim();
  if (!link) return;

  const tabId = modals.getCurrentRecordingsTab();
  recordingService.addRecording(courseId, tabId, { videoLink: link });

  if (input) input.value = '';

  const course = store.getCourse(courseId);
  if (course) {
    modals.renderRecordingsTabs(course);
    modals.renderRecordingsList(course);
  }
  render.renderCourses();
}

function switchRecordingsTab(courseId: string, tabId: string): void {
  modals.setCurrentRecordingsTab(tabId);

  const course = store.getCourse(courseId);
  if (!course) return;

  modals.renderRecordingsTabs(course);
  modals.renderRecordingsList(course);

  const isDefaultTab = tabId === 'lectures' || tabId === 'tutorials';
  const deleteBtn = $('delete-tab-btn');
  const clearBtn = $('clear-tab-btn');

  if (deleteBtn) deleteBtn.style.display = isDefaultTab ? 'none' : 'inline-block';
  if (clearBtn) clearBtn.style.display = 'inline-block';
}

function toggleRecordingEdit(index: number): void {
  const section = $(`recording-edit-section-${index}`);
  if (!section) return;

  document.querySelectorAll('.recording-edit-section').forEach((s) => {
    s.classList.add('hidden');
  });

  section.classList.toggle('hidden');

  const nameInput = $(`recording-edit-name-${index}`) as HTMLInputElement | null;
  if (nameInput && !section.classList.contains('hidden')) {
    nameInput.focus();
  }
}

function saveRecordingEdit(courseId: string, tabId: string, index: number): void {
  const nameInput = $(`recording-edit-name-${index}`) as HTMLInputElement | null;
  const videoInput = $(`recording-edit-video-${index}`) as HTMLInputElement | null;
  const slidesInput = $(`recording-edit-slides-${index}`) as HTMLInputElement | null;

  recordingService.updateRecording(courseId, tabId, index, {
    name: nameInput?.value.trim() ?? '',
    videoLink: videoInput?.value.trim() ?? '',
    slideLink: slidesInput?.value.trim() ?? '',
  });

  const course = store.getCourse(courseId);
  if (course) modals.renderRecordingsList(course);
  render.renderCourses();
}

function addRecordingsTab(): void {
  const courseId = modals.getEditingCourseId();
  if (!courseId) return;

  const name = prompt('Enter tab name:', 'Custom');
  if (!name?.trim()) return;

  const newTabId = recordingService.addRecordingsTab(courseId, name.trim());
  if (newTabId) {
    modals.setCurrentRecordingsTab(newTabId);

    const course = store.getCourse(courseId);
    if (course) {
      modals.renderRecordingsTabs(course);
      modals.renderRecordingsList(course);
    }

    const deleteBtn = $('delete-tab-btn');
    if (deleteBtn) deleteBtn.style.display = 'inline-block';
  }
}

function renameRecordingsTab(): void {
  const courseId = modals.getEditingCourseId();
  if (!courseId) return;

  const tabId = modals.getCurrentRecordingsTab();
  const course = store.getCourse(courseId);
  const tab = course?.recordings?.tabs.find((t) => t.id === tabId);
  if (!tab) return;

  const newName = prompt('Rename tab:', tab.name);
  if (!newName?.trim()) return;

  recordingService.renameRecordingsTab(courseId, tabId, newName.trim());

  const updatedCourse = store.getCourse(courseId);
  if (updatedCourse) modals.renderRecordingsTabs(updatedCourse);
}

function clearRecordingsTab(): void {
  const courseId = modals.getEditingCourseId();
  if (!courseId) return;

  const tabId = modals.getCurrentRecordingsTab();
  const course = store.getCourse(courseId);
  const tab = course?.recordings?.tabs.find((t) => t.id === tabId);

  if (!tab?.items?.length) {
    alert('This tab is already empty.');
    return;
  }

  if (!confirm(`Clear all ${tab.items.length} recordings from "${tab.name}"?`)) return;

  recordingService.clearRecordingsTab(courseId, tabId);

  const updatedCourse = store.getCourse(courseId);
  if (updatedCourse) modals.renderRecordingsList(updatedCourse);
  render.renderCourses();
}

function deleteRecordingsTab(): void {
  const courseId = modals.getEditingCourseId();
  if (!courseId) return;

  const tabId = modals.getCurrentRecordingsTab();

  if (tabId === 'lectures' || tabId === 'tutorials') {
    alert('Cannot delete default tabs.');
    return;
  }

  const course = store.getCourse(courseId);
  const tab = course?.recordings?.tabs.find((t) => t.id === tabId);

  if (tab?.items?.length) {
    if (!confirm(`Delete "${tab.name}" tab and all ${tab.items.length} recordings in it?`)) return;
  }

  recordingService.deleteRecordingsTab(courseId, tabId);
  modals.setCurrentRecordingsTab('lectures');

  const updatedCourse = store.getCourse(courseId);
  if (updatedCourse) {
    modals.renderRecordingsTabs(updatedCourse);
    modals.renderRecordingsList(updatedCourse);
  }
  render.renderCourses();

  const deleteBtn = $('delete-tab-btn');
  if (deleteBtn) deleteBtn.style.display = 'none';
}

// ============================================================================
// HOMEWORK EVENTS
// ============================================================================

function setupHomeworkEvents(): void {
  const addHomeworkBtn = $('add-homework-btn-modal');
  addHomeworkBtn?.addEventListener('click', addHomework);

  const showCompletedToggle = $('show-completed-toggle');
  showCompletedToggle?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    store.updateSettings({ showCompleted: target.checked });
    render.renderHomeworkSidebar();
  });

  // Homework list click delegation
  const homeworkList = $('homework-modal-list');
  homeworkList?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const homeworkItem = target.closest('.homework-item');
    if (!homeworkItem) return;

    const courseId = getDataset(homeworkItem, 'courseId');
    const index = getDatasetInt(homeworkItem, 'index');

    if (!courseId) return;

    const actionEl = target.closest('[data-action]');
    if (actionEl) {
      const action = getDataset(actionEl, 'action');

      if (action === 'toggle-completed') {
        homeworkService.toggleHomeworkStatus(courseId, index);
        const course = store.getCourse(courseId);
        if (course) modals.renderHomeworkList(course);
        render.renderHomeworkSidebar();
        render.renderCalendar();
        render.renderCourses();
      } else if (action === 'edit') {
        toggleHomeworkEdit(index);
      } else if (action === 'delete') {
        if (confirm('Delete this assignment?')) {
          homeworkService.deleteHomework(courseId, index);
          const course = store.getCourse(courseId);
          if (course) modals.renderHomeworkList(course);
          render.renderHomeworkSidebar();
          render.renderCalendar();
          render.renderCourses();
        }
      } else if (action === 'save-edit') {
        saveHomeworkEdit(courseId, index);
      } else if (action === 'cancel-edit') {
        const course = store.getCourse(courseId);
        if (course) modals.renderHomeworkList(course);
      }
    }
  });

  // Homework notes change
  homeworkList?.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('hw-notes')) {
      const homeworkItem = target.closest('.homework-item');
      if (!homeworkItem) return;

      const courseId = getDataset(homeworkItem, 'courseId');
      const index = getDatasetInt(homeworkItem, 'index');
      if (!courseId) return;

      const textarea = target as HTMLTextAreaElement;
      homeworkService.updateHomework(courseId, index, { notes: textarea.value });
      render.renderHomeworkSidebar();
    }
  });
}

function addHomework(): void {
  const courseId = modals.getEditingCourseId();
  if (!courseId) return;

  const nameInput = $('new-homework-name-modal') as HTMLInputElement | null;
  const dateInput = $('new-homework-date-modal') as HTMLInputElement | null;

  const title = nameInput?.value.trim();
  const dueDate = dateInput?.value ?? '';

  if (!title) return;

  homeworkService.addHomework(courseId, { title, dueDate });

  if (nameInput) nameInput.value = '';
  if (dateInput) dateInput.value = '';

  const course = store.getCourse(courseId);
  if (course) modals.renderHomeworkList(course);
  render.renderHomeworkSidebar();
  render.renderCalendar();
  render.renderCourses();
}

function toggleHomeworkEdit(index: number): void {
  const section = $(`hw-edit-section-${index}`);
  if (section) {
    section.classList.toggle('hidden');
  }
}

function saveHomeworkEdit(courseId: string, index: number): void {
  const titleInput = $(`hw-edit-title-${index}`) as HTMLInputElement | null;
  const dateInput = $(`hw-edit-date-${index}`) as HTMLInputElement | null;

  homeworkService.updateHomework(courseId, index, {
    title: titleInput?.value.trim() ?? '',
    dueDate: dateInput?.value ?? '',
  });

  const course = store.getCourse(courseId);
  if (course) modals.renderHomeworkList(course);
  render.renderHomeworkSidebar();
  render.renderCalendar();
}

// ============================================================================
// SETTINGS EVENTS
// ============================================================================

function setupSettingsEvents(): void {
  const settingsBtn = $('settings-btn');
  settingsBtn?.addEventListener('click', modals.openSettingsModal);

  // Settings tab switching
  document.querySelectorAll('.settings-modal-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabName = (tab as HTMLElement).dataset.tab;
      if (tabName) modals.switchSettingsTab(tabName);
    });
  });

  // Calendar settings
  const calStartHour = $('cal-start-hour');
  const calEndHour = $('cal-end-hour');
  calStartHour?.addEventListener('change', updateCalendarSettings);
  calEndHour?.addEventListener('change', updateCalendarSettings);

  document.querySelectorAll('#cal-days-container input').forEach((cb) => {
    cb.addEventListener('change', updateCalendarSettings);
  });

  // Reset colors
  const resetColorsBtn = $('reset-colors-btn');
  resetColorsBtn?.addEventListener('click', resetAllColors);

  // Toggle calendar visibility
  const toggleCalendarBtn = $('toggle-calendar-btn');
  toggleCalendarBtn?.addEventListener('click', toggleCalendarVisibility);

  // Theme toggle
  const themeToggleBtn = $('theme-toggle-btn');
  themeToggleBtn?.addEventListener('click', toggleTheme);
}

function updateCalendarSettings(): void {
  const start = parseInt(($('cal-start-hour') as HTMLInputElement | null)?.value ?? '8');
  const end = parseInt(($('cal-end-hour') as HTMLInputElement | null)?.value ?? '20');
  const days = [...document.querySelectorAll<HTMLInputElement>('#cal-days-container input:checked')].map((cb) =>
    parseInt(cb.value)
  );

  if (days.length === 0) {
    alert('Please select at least one visible day.');
    return;
  }

  if (start >= end) {
    alert('Start time must be before end time');
    return;
  }

  const semester = store.getCurrentSemester();
  if (semester) {
    courseService.updateSemester(semester.id, {
      calendarSettings: {
        startHour: start,
        endHour: end,
        visibleDays: days.sort((a, b) => a - b),
      },
    });
  }

  render.renderCalendar();
}

function resetAllColors(): void {
  const settings = store.getSettings();
  const colorTheme = settings.colorTheme ?? 'colorful';
  const baseHue = settings.baseColorHue ?? 200;

  // Reset colors for all courses in all semesters
  store.updateData(data => {
    data.semesters.forEach(semester => {
      const totalCourses = semester.courses.length;
      semester.courses.forEach((course, index) => {
        course.color = generateCourseColor(index, totalCourses, colorTheme, baseHue);
      });
    });
  });

  render.renderAll();
}

function toggleCalendarVisibility(): void {
  const calendar = $('weekly-schedule');
  const btn = $('toggle-calendar-btn');
  if (!calendar || !btn) return;

  const isHidden = calendar.classList.toggle('hidden');

  btn.innerHTML = isHidden
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>';
}

// ============================================================================
// PROFILE EVENTS
// ============================================================================

function setupProfileEvents(): void {
  const exportBtn = $('export-data-btn');
  exportBtn?.addEventListener('click', exportProfile);

  const importBtn = $('import-data-btn');
  importBtn?.addEventListener('click', () => {
    ($('import-file-input') as HTMLInputElement | null)?.click();
  });

  const importFileInput = $('import-file-input');
  importFileInput?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.files?.length) {
      importProfile(target.files[0]);
      target.value = '';
    }
  });

  const profileSelect = $('profile-select');
  profileSelect?.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    store.switchProfile(target.value);
    render.renderAll();
    render.renderProfileUI();
  });

  const addProfileBtn = $('add-profile-btn');
  addProfileBtn?.addEventListener('click', createProfile);

  const editProfileBtn = $('edit-profile-btn');
  editProfileBtn?.addEventListener('click', renameProfile);

  const deleteProfileBtn = $('delete-profile-btn');
  deleteProfileBtn?.addEventListener('click', deleteProfile);
}

function exportProfile(): void {
  const data = store.getData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const profiles = store.getProfiles();
  const activeId = store.getActiveProfileId();
  const profile = profiles.find((p) => p.id === activeId);
  const filename = `unimanager-${profile?.name ?? 'export'}-${new Date().toISOString().split('T')[0]}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function importProfile(file: File): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string) as unknown;
      if (!data || typeof data !== 'object' || !('semesters' in data)) {
        alert('Invalid data file.');
        return;
      }

      if (confirm('This will replace your current data. Continue?')) {
        store.replaceData(data as Parameters<typeof store.replaceData>[0]);
        render.renderAll();
        render.renderProfileUI();
      }
    } catch {
      alert('Error reading file. Please make sure it\'s a valid JSON file.');
    }
  };
  reader.readAsText(file);
}

function createProfile(): void {
  const name = prompt('Enter profile name:');
  if (!name?.trim()) return;

  store.createProfile(name.trim());
  render.renderProfileUI();
}

function renameProfile(): void {
  const profiles = store.getProfiles();
  const activeId = store.getActiveProfileId();
  const profile = profiles.find((p) => p.id === activeId);
  if (!profile) return;

  const newName = prompt('Rename profile:', profile.name);
  if (!newName?.trim()) return;

  store.renameProfile(activeId, newName.trim());
  render.renderProfileUI();
}

function deleteProfile(): void {
  const profiles = store.getProfiles();
  if (profiles.length <= 1) {
    alert('Cannot delete the only profile.');
    return;
  }

  const activeId = store.getActiveProfileId();
  const profile = profiles.find((p) => p.id === activeId);
  if (!profile) return;

  if (!confirm(`Delete profile "${profile.name}"?`)) return;

  store.deleteProfile(activeId);
  render.renderAll();
  render.renderProfileUI();
}

// ============================================================================
// COLOR THEME EVENTS
// ============================================================================

function setupColorThemeEvents(): void {
  const colorThemeSelect = $('color-theme-select');
  colorThemeSelect?.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    const value = target.value;

    const baseColorContainer = $('base-color-container');
    const unsavedIndicator = $('theme-unsaved-indicator');
    const resetBtn = $('reset-colors-btn');
    const changedButtons = $('theme-changed-buttons');

    if (baseColorContainer) {
      baseColorContainer.style.display = value === 'single' ? 'block' : 'none';
    }
    if (value === 'single') updateBaseColorPreview();

    if (unsavedIndicator) unsavedIndicator.style.display = 'inline';
    if (resetBtn) resetBtn.style.display = 'none';
    if (changedButtons) changedButtons.style.display = 'flex';
  });

  const baseColorHue = $('base-color-hue');
  baseColorHue?.addEventListener('input', () => {
    updateBaseColorPreview();

    const unsavedIndicator = $('theme-unsaved-indicator');
    const resetBtn = $('reset-colors-btn');
    const changedButtons = $('theme-changed-buttons');

    if (unsavedIndicator) unsavedIndicator.style.display = 'inline';
    if (resetBtn) resetBtn.style.display = 'none';
    if (changedButtons) changedButtons.style.display = 'flex';
  });

  const applyThemeBtn = $('apply-theme-btn');
  applyThemeBtn?.addEventListener('click', () => {
    const colorTheme = (($('color-theme-select') as HTMLSelectElement | null)?.value ?? 'colorful') as ColorTheme;
    const baseColorHue = parseInt(($('base-color-hue') as HTMLInputElement | null)?.value ?? '200');

    store.updateSettings({ colorTheme, baseColorHue });
    resetAllColors();
  });

  const cancelThemeBtn = $('cancel-theme-btn');
  cancelThemeBtn?.addEventListener('click', () => {
    const settings = store.getSettings();

    const colorThemeSelect = $('color-theme-select') as HTMLSelectElement | null;
    const baseColorHueInput = $('base-color-hue') as HTMLInputElement | null;

    if (colorThemeSelect) colorThemeSelect.value = settings.colorTheme ?? 'colorful';
    if (baseColorHueInput) baseColorHueInput.value = String(settings.baseColorHue ?? 200);

    const baseColorContainer = $('base-color-container');
    if (baseColorContainer) {
      baseColorContainer.style.display = settings.colorTheme === 'single' ? 'block' : 'none';
    }
    if (settings.colorTheme === 'single') updateBaseColorPreview();

    const unsavedIndicator = $('theme-unsaved-indicator');
    const changedButtons = $('theme-changed-buttons');
    const resetBtn = $('reset-colors-btn');

    if (unsavedIndicator) unsavedIndicator.style.display = 'none';
    if (changedButtons) changedButtons.style.display = 'none';
    if (resetBtn) resetBtn.style.display = settings.colorTheme === 'mono' ? 'none' : 'block';
  });
}

// ============================================================================
// MODAL CLOSE EVENTS
// ============================================================================

function setupModalCloseEvents(): void {
  // Close buttons
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modalId = (btn as HTMLElement).dataset.closeModal;
      if (modalId) modals.closeModal(modalId);
    });
  });

  // Click outside modal to close
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });

  // Escape key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal-overlay.active');
      if (activeModal) {
        activeModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }
  });
}

// ============================================================================
// CALENDAR EVENTS
// ============================================================================

function setupCalendarEvents(): void {
  const calendar = $('weekly-schedule');
  calendar?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle schedule block clicks
    const scheduleBlock = target.closest('.schedule-block');
    const blockCourseId = getDataset(scheduleBlock, 'courseId');
    if (blockCourseId) {
      modals.openCourseModal(blockCourseId);
      return;
    }

    // Handle event chip clicks
    const eventChip = target.closest('.schedule-event-chip');
    if (eventChip) {
      e.stopPropagation();
      const courseId = getDataset(eventChip, 'courseId');
      const eventType = getDataset(eventChip, 'eventType');
      const homeworkIndex = getDataset(eventChip, 'homeworkIndex');
      const examType = getDataset(eventChip, 'examType');

      if (courseId && eventType === 'homework' && homeworkIndex !== undefined) {
        modals.openCourseModal(courseId, 'homework', {
          type: 'homework',
          index: parseInt(homeworkIndex),
        });
      } else if (courseId && eventType === 'exam' && examType) {
        modals.openCourseModal(courseId, 'details', {
          type: 'exam',
          examType,
        });
      } else if (courseId) {
        modals.openCourseModal(courseId);
      }
    }
  });

  // Mobile day toggle
  setupMobileDayToggle();
}

function setupMobileDayToggle(): void {
  const toggleBtn = $('mobile-day-toggle');
  if (!toggleBtn) return;

  const isMobile = window.innerWidth <= 768;
  const storedValue = localStorage.getItem('calendarShowOnlyToday');
  const showOnlyToday = storedValue === null ? isMobile : storedValue === 'true';
  const textSpan = toggleBtn.querySelector('span');

  if (showOnlyToday) {
    toggleBtn.classList.add('active');
    if (textSpan) textSpan.textContent = 'Today';
  } else {
    toggleBtn.classList.remove('active');
    if (textSpan) textSpan.textContent = 'All Days';
  }

  toggleBtn.addEventListener('click', () => {
    const isActive = toggleBtn.classList.toggle('active');
    localStorage.setItem('calendarShowOnlyToday', String(isActive));

    const textSpan = toggleBtn.querySelector('span');
    if (textSpan) textSpan.textContent = isActive ? 'Today' : 'All Days';

    applySingleDayFilter(isActive);
  });

  if (isMobile) {
    applySingleDayFilter(showOnlyToday);
  }

  let resizeTimeout: number;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(() => {
      const nowMobile = window.innerWidth <= 768;
      const storedValue = localStorage.getItem('calendarShowOnlyToday');
      const showOnlyToday = storedValue === null ? nowMobile : storedValue === 'true';

      if (nowMobile) {
        applySingleDayFilter(showOnlyToday);
      } else {
        applySingleDayFilter(false);
      }
    }, 250);
  });
}

function applySingleDayFilter(showOnlyToday: boolean): void {
  const today = new Date().getDay();
  const wrapper = document.querySelector('.calendar-scroll-wrapper');

  const win = window as unknown as { tempCalendarDayFilter?: number[] | null };

  if (showOnlyToday) {
    win.tempCalendarDayFilter = [today];
    wrapper?.classList.add('single-day-mode');
  } else {
    win.tempCalendarDayFilter = null;
    wrapper?.classList.remove('single-day-mode');
  }

  render.renderCalendar();
}

// ============================================================================
// HOMEWORK SIDEBAR EVENTS
// ============================================================================

function setupHomeworkSidebarEvents(): void {
  const container = $('homework-sidebar-list');
  container?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle checkbox clicks
    const checkbox = target.closest('.sidebar-hw-checkbox');
    if (checkbox) {
      e.stopPropagation();
      const courseId = getDataset(checkbox, 'courseId');
      const hwIndex = getDataset(checkbox, 'hwIndex');
      if (courseId && hwIndex !== undefined) {
        homeworkService.toggleHomeworkStatus(courseId, parseInt(hwIndex));
        render.renderHomeworkSidebar();
        render.renderCalendar();
        render.renderCourses();
      }
      return;
    }

    // Handle card clicks
    const card = target.closest('.event-card');
    const cardCourseId = getDataset(card, 'courseId');
    const cardHwIndex = getDataset(card, 'hwIndex');
    if (cardCourseId && cardHwIndex !== undefined) {
      modals.openCourseModal(cardCourseId, 'homework', {
        type: 'homework',
        index: parseInt(cardHwIndex),
      });
    }
  });
}
