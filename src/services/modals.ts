/**
 * @fileoverview Modal dialog management.
 * Handles opening, closing, and populating modal dialogs.
 */

import { store } from '@/state';
import { $ } from '@/utils';
import { COLOR_THEMES, DEFAULT_CALENDAR_SETTINGS } from '@/constants';
import { updateCourseColorSlider, updateBaseColorPreview } from './theme';

import type { Course, ScheduleItem } from '@/types';

// ============================================================================
// MODAL STATE
// ============================================================================

/** Currently editing course ID */
let editingCourseId: string | null = null;

/** Original color theme before editing */
let originalColorTheme: string | null = null;

/** Original base color hue before editing */
let originalBaseColorHue: number | null = null;

/** Temporary color theme during editing */
let tempColorTheme: string | null = null;

/** Temporary base color hue during editing */
let tempBaseColorHue: number | null = null;

/** Temporary schedule during editing */
let tempSchedule: ScheduleItem[] = [];

/** Current recordings tab being viewed */
let currentRecordingsTab = 'lectures';

// ============================================================================
// STATE GETTERS/SETTERS
// ============================================================================

export function getEditingCourseId(): string | null {
  return editingCourseId;
}

export function setEditingCourseId(id: string | null): void {
  editingCourseId = id;
}

export function getTempSchedule(): ScheduleItem[] {
  return tempSchedule;
}

export function setTempSchedule(schedule: ScheduleItem[]): void {
  tempSchedule = schedule;
}

export function getCurrentRecordingsTab(): string {
  return currentRecordingsTab;
}

export function setCurrentRecordingsTab(tabId: string): void {
  currentRecordingsTab = tabId;
}

// ============================================================================
// GENERIC MODAL FUNCTIONS
// ============================================================================

/**
 * Resets the scroll position of a modal.
 */
function resetModalScroll(modal: Element): void {
  const modalElement = modal.querySelector('.modal');
  if (modalElement) {
    modalElement.scrollTop = 0;
  }
}

/**
 * Opens a modal by ID.
 */
export function openModal(modalId: string): void {
  const modal = $(modalId);
  if (modal) {
    modal.classList.add('active');
    resetModalScroll(modal);
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Closes a modal by ID.
 */
export function closeModal(modalId: string): void {
  const modal = $(modalId);
  if (modal) {
    modal.classList.remove('active');
    resetModalScroll(modal);
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    if (activeModals.length === 0) {
      document.body.style.overflow = '';
    }
  }
}

// ============================================================================
// COURSE MODAL
// ============================================================================

/**
 * Highlight configuration for course modal.
 */
interface HighlightConfig {
  type: 'homework' | 'exam';
  index?: number;
  examType?: string;
}

/**
 * Opens the course modal for adding or editing a course.
 */
export function openCourseModal(
  courseId: string | null,
  initialTab = 'recordings',
  highlight: HighlightConfig | null = null
): void {
  editingCourseId = courseId;

  // Clear schedule list and temp state
  const scheduleList = $('schedule-list');
  if (scheduleList) scheduleList.innerHTML = '';
  tempSchedule = [];

  const settings = store.getSettings();
  const colorTheme = settings.colorTheme ?? COLOR_THEMES.COLORFUL;
  const course = courseId ? store.getCourse(courseId) : null;

  if (course) {
    populateCourseEditForm(course, colorTheme);
    loadRecordingsTab(course);
    renderHomeworkList(course);
  } else {
    populateCourseAddForm(colorTheme);
    initialTab = 'details';
  }

  // Show/hide tabs based on whether it's a new course or existing
  const recordingsTab: HTMLElement | null = document.querySelector(
    '.course-modal-tab[data-tab="recordings"]'
  );
  const homeworkTab: HTMLElement | null = document.querySelector(
    '.course-modal-tab[data-tab="homework"]'
  );
  if (recordingsTab) recordingsTab.style.display = course ? '' : 'none';
  if (homeworkTab) homeworkTab.style.display = course ? '' : 'none';

  updateCourseColorSlider();
  switchCourseModalTab(initialTab);
  openModal('course-modal');

  // Highlight specific element if requested
  if (highlight) {
    setTimeout(() => {
      if (highlight.type === 'homework' && highlight.index !== undefined) {
        highlightHomeworkItem(highlight.index);
      } else if (highlight.type === 'exam' && highlight.examType) {
        highlightExamField(highlight.examType);
      }
    }, 300);
  }
}

/**
 * Populates the course form for editing an existing course.
 */
function populateCourseEditForm(course: Course, _colorTheme: string): void {
  const titleEl = $('course-modal-title');
  if (titleEl) titleEl.textContent = course.name || 'Edit Course';

  setInputValue('course-name', course.name);

  const hue = extractHueFromColor(course.color ?? 'hsl(0, 45%, 50%)');
  setInputValue('course-color-hue', String(hue));

  const preview = $('course-color-preview');
  if (preview) preview.style.backgroundColor = `hsl(${hue}, 45%, 50%)`;

  setInputValue('course-number', course.number ?? '');
  setInputValue('course-points', course.points ? String(course.points) : '');
  setInputValue('course-lecturer', course.lecturer ?? '');
  setInputValue('course-faculty', course.faculty ?? '');
  setInputValue('course-location', course.location ?? '');
  setInputValue('course-grade', course.grade ? String(course.grade) : '');
  setInputValue('course-syllabus', course.syllabus ?? '');
  setInputValue('course-notes', course.notes ?? '');
  setInputValue('course-exam-a', course.exams?.moedA ?? '');
  setInputValue('course-exam-b', course.exams?.moedB ?? '');

  tempSchedule = course.schedule ? [...course.schedule] : [];
  renderScheduleList();

  const deleteBtn = $('delete-course-btn');
  if (deleteBtn) deleteBtn.classList.remove('hidden');
}

/**
 * Populates the course form for adding a new course.
 */
function populateCourseAddForm(colorTheme: string): void {
  const titleEl = $('course-modal-title');
  if (titleEl) titleEl.textContent = 'Add Course';

  const fieldsToClear = [
    'course-name',
    'course-number',
    'course-points',
    'course-lecturer',
    'course-faculty',
    'course-location',
    'course-grade',
    'course-syllabus',
    'course-notes',
    'course-exam-a',
    'course-exam-b',
  ];
  fieldsToClear.forEach((id) => setInputValue(id, ''));

  // Set default color
  const nextHue = getNextAvailableHue();
  if (colorTheme === COLOR_THEMES.MONO) {
    setInputValue('course-color-hue', '0');
    const preview = $('course-color-preview');
    if (preview) preview.style.backgroundColor = 'hsl(0, 0%, 50%)';
  } else {
    setInputValue('course-color-hue', String(nextHue));
    const preview = $('course-color-preview');
    if (preview) preview.style.backgroundColor = `hsl(${nextHue}, 45%, 50%)`;
  }

  tempSchedule = [];
  renderScheduleList();

  const deleteBtn = $('delete-course-btn');
  if (deleteBtn) deleteBtn.classList.add('hidden');
}

// ============================================================================
// COURSE MODAL TABS
// ============================================================================

/**
 * Switches to a specific tab in the course modal.
 */
export function switchCourseModalTab(tabName: string): void {
  document.querySelectorAll('.course-modal-tab').forEach((tab) => {
    tab.classList.toggle('active', (tab as HTMLElement).dataset.tab === tabName);
  });

  document.querySelectorAll('.course-tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
}

/**
 * Loads the recordings tab content for a course.
 */
function loadRecordingsTab(course: Course): void {
  currentRecordingsTab = 'lectures';

  const deleteBtn = $('delete-tab-btn');
  const clearBtn = $('clear-tab-btn');
  if (deleteBtn) (deleteBtn).style.display = 'none';
  if (clearBtn) (clearBtn).style.display = 'inline-block';

  renderRecordingsTabs(course);
  renderRecordingsList(course);
}

// ============================================================================
// RECORDINGS RENDERING (for modal)
// ============================================================================

/**
 * Renders recording tabs for a course.
 */
export function renderRecordingsTabs(course: Course): void {
  const container = $('recordings-tabs');
  if (!container) return;

  container.innerHTML = '';

  if (!course.recordings?.tabs) return;

  course.recordings.tabs.forEach((tab) => {
    const tabBtn = document.createElement('button');
    tabBtn.className = `recordings-tab ${currentRecordingsTab === tab.id ? 'active' : ''}`;
    tabBtn.dataset.tabId = tab.id;
    tabBtn.dataset.courseId = course.id;

    const count = tab.items?.length ?? 0;
    tabBtn.innerHTML = `${escapeHtml(tab.name)}<span class="recordings-tab-count">${count}</span>`;
    container.appendChild(tabBtn);
  });
}

/**
 * Renders the recordings list for a course tab.
 */
export function renderRecordingsList(course: Course, editingIndex: number | null = null): void {
  const container = $('recordings-list');
  if (!container) return;

  container.innerHTML = '';

  if (!course.recordings?.tabs) {
    container.innerHTML = '<div class="recordings-empty">No recordings yet.</div>';
    return;
  }

  const currentTab = course.recordings.tabs.find((t) => t.id === currentRecordingsTab);
  if (!currentTab?.items?.length) {
    container.innerHTML =
      '<div class="recordings-empty">No recordings in this tab. Paste a video link below to add one.</div>';
    return;
  }

  const showWatchedEl = $('show-watched-toggle') as HTMLInputElement | null;
  const showWatched = showWatchedEl?.checked !== false;
  let visibleCount = 0;

  currentTab.items.forEach((item, index) => {
    if (!showWatched && item.watched) return;
    visibleCount++;
    const div = createRecordingItem(item, index, course.id, currentTab.id, editingIndex === index);
    container.appendChild(div);
  });

  if (visibleCount === 0 && currentTab.items.length > 0) {
    container.innerHTML =
      '<div class="recordings-empty">All recordings are done. Enable "Show Done" to see them.</div>';
  }
}

/**
 * Creates a recording item element.
 */
function createRecordingItem(
  item: { name: string; videoLink: string; slideLink: string; watched: boolean },
  index: number,
  courseId: string,
  tabId: string,
  isEditing: boolean
): HTMLElement {
  const div = document.createElement('div');
  div.className = `recording-item ${item.watched ? 'watched' : ''}`;
  div.id = `recording-item-${index}`;
  div.dataset.index = String(index);
  div.dataset.courseId = courseId;
  div.dataset.tabId = tabId;

  const hasVideo = !!item.videoLink;

  div.innerHTML = `
    <div class="recording-header">
      <input type="checkbox" class="recording-checkbox" ${item.watched ? 'checked' : ''} 
        data-action="toggle-watched" data-index="${index}">
      <div class="recording-content ${hasVideo ? 'recording-content-clickable' : ''}">
        <div class="recording-name">
          ${escapeHtml(item.name) || '<span style="color: var(--text-tertiary); font-style: italic;">Untitled Recording</span>'}
        </div>
        ${item.slideLink ? `<div class="recording-meta"><a href="${escapeHtml(item.slideLink)}" target="_blank" class="recording-link recording-link-slides" onclick="event.stopPropagation()">Slides</a></div>` : ''}
      </div>
    </div>
    <div class="recording-actions">
      ${hasVideo ? `<a href="${escapeHtml(item.videoLink)}" target="_blank" class="recording-action-btn recording-external-link" onclick="event.stopPropagation()" title="Open in new tab">↗</a>` : ''}
      <button class="recording-action-btn" data-action="edit" data-index="${index}">Edit</button>
      <button class="recording-action-btn recording-action-btn-danger" data-action="delete" data-index="${index}">×</button>
    </div>
    <div id="recording-edit-section-${index}" class="recording-edit-section ${isEditing ? '' : 'hidden'}">
      <div class="recording-edit-row">
        <label class="recording-edit-label">Name</label>
        <input type="text" id="recording-edit-name-${index}" class="recording-edit-input" 
          value="${escapeHtml(item.name)}" placeholder="Recording title...">
      </div>
      <div class="recording-edit-row">
        <label class="recording-edit-label">Video</label>
        <input type="text" id="recording-edit-video-${index}" class="recording-edit-input" 
          value="${escapeHtml(item.videoLink)}" placeholder="Video URL">
      </div>
      <div class="recording-edit-row">
        <label class="recording-edit-label">Slides</label>
        <input type="text" id="recording-edit-slides-${index}" class="recording-edit-input" 
          value="${escapeHtml(item.slideLink)}" placeholder="Slides URL (optional)">
      </div>
      <div class="recording-edit-actions">
        <button class="recording-edit-save-btn" data-action="save-edit" data-index="${index}">Save</button>
        <button class="recording-edit-cancel-btn" data-action="cancel-edit">Cancel</button>
      </div>
    </div>
  `;

  return div;
}

// ============================================================================
// HOMEWORK RENDERING (for modal)
// ============================================================================

/**
 * Renders the homework list in the course modal.
 */
export function renderHomeworkList(course: Course, openLinksIndex: number | null = null): void {
  const container = $('homework-modal-list');
  if (!container) return;

  container.innerHTML = '';

  if (!course.homework) return;

  course.homework.forEach((hw, index) => {
    const item = createHomeworkItem(hw, index, course.id, openLinksIndex === index);
    container.appendChild(item);
  });
}

/**
 * Creates a homework list item element.
 */
function createHomeworkItem(
  hw: { title: string; dueDate: string; completed: boolean; notes: string; links: Array<{ label: string; url: string }> },
  index: number,
  courseId: string,
  isOpen: boolean
): HTMLElement {
  const item = document.createElement('li');
  item.className = `homework-item ${hw.completed ? 'completed' : ''}`;
  item.dataset.index = String(index);
  item.dataset.courseId = courseId;

  const links = hw.links ?? [];
  const linksDisplayHtml = buildLinksDisplay(links);

  item.innerHTML = `
    <div class="hw-header">
      <input type="checkbox" class="hw-checkbox" ${hw.completed ? 'checked' : ''} data-action="toggle-completed" data-index="${index}">
      <div class="hw-title-row">
        <span class="hw-title">${escapeHtml(hw.title)}</span>
        ${hw.dueDate ? `<span class="hw-due-date">Due: ${escapeHtml(hw.dueDate)}</span>` : '<span class="hw-due-date hw-no-date">No date</span>'}
      </div>
      <div class="hw-actions">
        <button class="hw-action-btn" data-action="edit" data-index="${index}">Edit</button>
        <button class="hw-action-btn hw-action-btn-danger" data-action="delete" data-index="${index}">Delete</button>
      </div>
    </div>
    ${linksDisplayHtml}
    <div id="hw-edit-section-${index}" class="hw-edit-section ${isOpen ? '' : 'hidden'}">
      <div class="hw-edit-row">
        <label class="hw-edit-label">Title:</label>
        <input type="text" id="hw-edit-title-${index}" class="hw-edit-input" value="${escapeHtml(hw.title)}">
      </div>
      <div class="hw-edit-row">
        <label class="hw-edit-label">Due:</label>
        <input type="date" id="hw-edit-date-${index}" class="hw-edit-input hw-edit-date" value="${hw.dueDate || ''}">
      </div>
      <div class="hw-edit-actions">
        <button class="hw-edit-save-btn" data-action="save-edit" data-index="${index}">Save</button>
        <button class="hw-edit-cancel-btn" data-action="cancel-edit">Cancel</button>
      </div>
    </div>
    <textarea class="hw-notes" placeholder="Add notes..." data-action="update-notes" data-index="${index}">${escapeHtml(hw.notes || '')}</textarea>
  `;

  return item;
}

/**
 * Builds links display HTML.
 */
function buildLinksDisplay(links: Array<{ label: string; url: string }>): string {
  if (links.length === 0) return '';

  return (
    '<div class="hw-links-display">' +
    links
      .map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" class="hw-link-chip">${escapeHtml(link.label)}</a>`)
      .join('') +
    '</div>'
  );
}

// ============================================================================
// SCHEDULE RENDERING
// ============================================================================

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Renders the schedule list in the course modal.
 */
export function renderScheduleList(): void {
  const container = $('schedule-list');
  if (!container) return;

  container.innerHTML = '';

  tempSchedule.forEach((item, index) => {
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; align-items: center; gap: 10px; font-size: 13px; margin-bottom: 4px;';
    div.innerHTML = `
      <span>${DAY_NAMES_SHORT[item.day]} ${item.start}-${item.end}</span>
      <button data-action="remove-schedule" data-index="${index}" style="border:none; background:none; color:var(--error-border); cursor:pointer;">×</button>
    `;
    container.appendChild(div);
  });
}

/**
 * Adds a schedule item from the course modal inputs.
 */
export function addScheduleItem(): void {
  const dayEl = $('new-schedule-day') as HTMLSelectElement | null;
  const startEl = $('new-schedule-start') as HTMLInputElement | null;
  const endEl = $('new-schedule-end') as HTMLInputElement | null;

  const day = dayEl?.value;
  const start = startEl?.value;
  const end = endEl?.value;

  if (!start || !end) return;

  tempSchedule.push({
    day: parseInt(day ?? '0'),
    start,
    end,
  });

  renderScheduleList();

  if (startEl) startEl.value = '';
  if (endEl) endEl.value = '';
}

/**
 * Removes a schedule item by index.
 */
export function removeScheduleItem(index: number): void {
  tempSchedule.splice(index, 1);
  renderScheduleList();
}

// ============================================================================
// HIGHLIGHT HELPERS
// ============================================================================

/**
 * Highlights a specific homework item in the modal.
 */
function highlightHomeworkItem(homeworkIndex: number): void {
  const homeworkItems = document.querySelectorAll('.homework-item');
  const item = homeworkItems[homeworkIndex] as HTMLElement | undefined;
  if (item) {
    item.style.transition = 'background-color 0.3s ease';
    item.style.backgroundColor = 'var(--success-bg)';
    item.style.borderLeft = '3px solid var(--success-border)';

    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    setTimeout(() => {
      item.style.backgroundColor = '';
      item.style.borderLeft = '';
    }, 2000);
  }
}

/**
 * Highlights a specific exam field in the details tab.
 */
function highlightExamField(examType: string): void {
  switchCourseModalTab('details');

  setTimeout(() => {
    const fieldId = examType === 'moedA' ? 'course-exam-a' : 'course-exam-b';
    const field = $(fieldId) as HTMLInputElement | null;

    if (field) {
      field.style.transition = 'all 0.3s ease';
      field.style.backgroundColor = 'var(--error-bg)';
      field.style.borderColor = 'var(--error-border)';
      field.style.borderWidth = '2px';

      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field.focus();

      setTimeout(() => {
        field.style.backgroundColor = '';
        field.style.borderColor = '';
        field.style.borderWidth = '';
      }, 2000);
    }
  }, 100);
}

// ============================================================================
// SETTINGS MODAL
// ============================================================================

/**
 * Opens the settings modal and populates current values.
 */
export function openSettingsModal(): void {
  const settings = store.getSettings();

  originalColorTheme = settings.colorTheme ?? 'colorful';
  originalBaseColorHue = settings.baseColorHue ?? 200;
  tempColorTheme = originalColorTheme;
  tempBaseColorHue = originalBaseColorHue;

  const unsavedIndicator = $('theme-unsaved-indicator');
  const changedButtons = $('theme-changed-buttons');
  if (unsavedIndicator) unsavedIndicator.style.display = 'none';
  if (changedButtons) changedButtons.style.display = 'none';

  // Populate Calendar Settings
  const semester = store.getCurrentSemester();
  const calendarSettings = semester?.calendarSettings ?? DEFAULT_CALENDAR_SETTINGS;

  setInputValue('cal-start-hour', String(calendarSettings.startHour));
  setInputValue('cal-end-hour', String(calendarSettings.endHour));

  document.querySelectorAll<HTMLInputElement>('#cal-days-container input').forEach((cb) => {
    cb.checked = calendarSettings.visibleDays.includes(parseInt(cb.value));
  });

  // Populate Color Theme
  setInputValue('color-theme-select', settings.colorTheme ?? 'colorful');

  const baseColorContainer = $('base-color-container');
  const resetBtn = $('reset-colors-btn');

  if (settings.colorTheme === 'single' && baseColorContainer) {
    baseColorContainer.style.display = 'block';
    setInputValue('base-color-hue', String(settings.baseColorHue ?? 200));
    updateBaseColorPreview();
  } else if (baseColorContainer) {
    baseColorContainer.style.display = 'none';
  }

  if (resetBtn) {
    resetBtn.style.display = settings.colorTheme === 'mono' ? 'none' : 'block';
  }

  openModal('settings-modal');
}

/**
 * Switches to a specific tab in the settings modal.
 */
export function switchSettingsTab(tabName: string): void {
  document.querySelectorAll('.settings-modal-tab').forEach((tab) => {
    tab.classList.toggle('active', (tab as HTMLElement).dataset.tab === tabName);
  });

  document.querySelectorAll('.settings-tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `settings-tab-${tabName}`);
  });
}

// ============================================================================
// COLOR HELPERS
// ============================================================================

/**
 * Extracts hue from an HSL color string.
 */
function extractHueFromColor(color: string): number {
  const match = color.match(/hsl\((\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Gets the next available hue for a new course.
 */
function getNextAvailableHue(): number {
  const semester = store.getCurrentSemester();
  if (!semester?.courses.length) return 200;

  const usedHues = semester.courses
    .map((c) => extractHueFromColor(c.color ?? ''))
    .filter((h) => h > 0);

  // Find a hue that's at least 30 degrees away from existing ones
  for (let hue = 0; hue < 360; hue += 30) {
    const isUsed = usedHues.some((h) => Math.abs(h - hue) < 30 || Math.abs(h - hue) > 330);
    if (!isUsed) return hue;
  }

  return Math.floor(Math.random() * 360);
}

// ============================================================================
// UTILITY HELPERS
// ============================================================================

/**
 * Sets the value of an input element by ID.
 */
function setInputValue(id: string, value: string): void {
  const el = $(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  if (el) el.value = value;
}

/**
 * Escapes HTML entities in a string.
 */
function escapeHtml(text: unknown): string {
  if (text == null) return '';
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (char) => entities[char] ?? char);
}

// ============================================================================
// SEMESTER MODAL
// ============================================================================

/**
 * Populates the semester options dropdown.
 */
export function populateSemesterOptions(): void {
  const select = $('new-semester-select') as HTMLSelectElement | null;
  if (!select) return;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Determine current semester
  let suggestedSemester: string;
  if (currentMonth >= 9 || currentMonth <= 1) {
    suggestedSemester = `Winter ${currentYear}-${currentYear + 1}`;
  } else if (currentMonth >= 2 && currentMonth <= 5) {
    suggestedSemester = `Spring ${currentYear}`;
  } else {
    suggestedSemester = `Summer ${currentYear}`;
  }

  // Generate options for 2 years back and 2 years forward
  const options: string[] = [];
  for (let year = currentYear - 2; year <= currentYear + 2; year++) {
    options.push(`Winter ${year}-${year + 1}`);
    options.push(`Spring ${year}`);
    options.push(`Summer ${year}`);
  }

  select.innerHTML = options
    .map(
      (opt) =>
        `<option value="${opt}" ${opt === suggestedSemester ? 'selected' : ''}>${opt}</option>`
    )
    .join('');

  // Add custom option
  select.innerHTML += '<option value="custom">Custom...</option>';
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  tempColorTheme,
  tempBaseColorHue,
  originalColorTheme,
  originalBaseColorHue,
};
