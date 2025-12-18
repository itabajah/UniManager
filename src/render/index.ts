/**
 * @fileoverview Rendering functions for the UI components.
 * Provides type-safe rendering of semesters, courses, calendar, recordings, homework, and profile UI.
 */

import { DEFAULT_CALENDAR_SETTINGS } from '@/constants';
import { store } from '@/state';
import { $, compareSemesters, escapeHtml } from '@/utils';

import type {
    CalendarEvent,
    CalendarSettings,
    Course,
    HomeworkItem,
    Semester,
} from '@/types';

// ============================================================================
// MAIN RENDER FUNCTIONS
// ============================================================================

/**
 * Renders all UI components.
 */
export function renderAll(): void {
  renderSemesters();
  renderCourses();
  renderCalendar();
  renderHomeworkSidebar();
}

/**
 * Alias for renderCourses for backward compatibility.
 */
export function renderCoursesList(): void {
  renderCourses();
}

// ============================================================================
// SEMESTER RENDERING
// ============================================================================

/**
 * Renders the semester dropdown selector.
 */
export function renderSemesters(): void {
  const select = $('semester-select') as HTMLSelectElement | null;
  if (!select) return;

  select.innerHTML = '';

  const data = store.getData();
  const currentSemesterId = store.getCurrentSemesterId();

  if (data.semesters.length === 0) {
    const option = document.createElement('option');
    option.textContent = 'No Semesters';
    select.appendChild(option);
    select.disabled = true;
    return;
  }

  select.disabled = false;

  // Sort semesters chronologically (newest first)
  const sortedSemesters = [...data.semesters].sort(compareSemesters);

  sortedSemesters.forEach((sem) => {
    const option = document.createElement('option');
    option.value = sem.id;
    option.textContent = sem.name;
    if (sem.id === currentSemesterId) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

// ============================================================================
// COURSE LIST RENDERING
// ============================================================================

/**
 * Renders the course list for the current semester.
 */
export function renderCourses(): void {
  const container = $('course-list');
  if (!container) return;

  container.innerHTML = '';

  const currentSemesterId = store.getCurrentSemesterId();
  if (!currentSemesterId) {
    renderNoSemesterMessage(container);
    return;
  }

  const semester = store.getCurrentSemester();
  if (!semester) return;

  if (semester.courses.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; color:var(--text-tertiary); padding: 20px;">No courses yet. Click + to add one.</div>';
    return;
  }

  semester.courses.forEach((course, index) => {
    const card = createCourseCard(course, index, semester.courses.length);
    container.appendChild(card);
  });
}

/**
 * Renders the "no semester" message with action buttons.
 */
function renderNoSemesterMessage(container: HTMLElement): void {
  container.innerHTML = `
    <div style="text-align:center; color:var(--text-tertiary); padding: 40px 20px;">
      <div style="margin-bottom: 20px; font-size: 16px;">No semester selected.</div>
      <div style="display: flex; gap: 12px; justify-content: center; align-items: stretch; max-width: 500px; margin: 0 auto;">
        <button onclick="document.getElementById('add-semester-btn').click()" class="btn-secondary" style="flex: 1; padding: 10px 24px; font-size: 14px;">
          <div style="font-weight: 600; margin-bottom: 4px;">Create Semester</div>
          <div style="font-size: 11px; opacity: 0.7;">Start from scratch</div>
        </button>
        <button onclick="document.getElementById('settings-btn').click(); setTimeout(() => document.getElementById('ics-link-input').scrollIntoView({behavior: 'smooth', block: 'center'}), 100)" class="btn-primary" style="flex: 1; padding: 10px 24px; font-size: 14px;">
          <div style="font-weight: 600; margin-bottom: 4px;">Import Schedule</div>
          <div style="font-size: 11px; opacity: 0.8;">From Cheesefork</div>
        </button>
      </div>
    </div>
  `;
}

// ============================================================================
// COURSE CARD
// ============================================================================

interface CourseProgress {
  lectures: { total: number; watched: number };
  tutorials: { total: number; watched: number };
  homework: { total: number; completed: number };
}

/**
 * Creates a course card element.
 */
function createCourseCard(course: Course, index: number, totalCourses: number): HTMLElement {
  const card = document.createElement('div');
  card.className = 'course-card';

  // Use data attribute instead of inline onclick for better CSP compatibility
  card.dataset.courseId = course.id;

  if (course.color) {
    card.style.borderLeftColor = course.color;
    card.style.borderLeftWidth = '4px';
  }

  const progress = calculateCourseProgress(course);
  const metaParts = buildCourseMetaParts(course);
  const progressHtml = buildProgressHtml(progress);

  card.innerHTML = `
    <div class="course-reorder-buttons">
      <button class="reorder-btn" data-action="move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''} title="Move up">▲</button>
      <button class="reorder-btn" data-action="move-down" data-index="${index}" ${index === totalCourses - 1 ? 'disabled' : ''} title="Move down">▼</button>
    </div>
    <div class="course-left-col">
      <div class="course-title">${escapeHtml(course.name)}</div>
      <div class="course-info">
        ${course.faculty ? `<div class="course-detail-row">Faculty: ${escapeHtml(course.faculty)}</div>` : ''}
        ${course.lecturer ? `<div class="course-detail-row">Lecturer: ${escapeHtml(course.lecturer)}</div>` : ''}
        ${course.location ? `<div class="course-detail-row">Location: ${escapeHtml(course.location)}</div>` : ''}
        ${course.notes ? `<div class="course-notes">${escapeHtml(course.notes)}</div>` : ''}
      </div>
      ${metaParts ? `<div class="course-meta-info-mobile">${metaParts}</div>` : ''}
    </div>
    <div class="course-progress-section">
      ${metaParts ? `<div class="course-meta-right">${metaParts}</div>` : ''}
      ${progressHtml}
    </div>
  `;

  return card;
}

/**
 * Calculates progress stats for a course.
 */
function calculateCourseProgress(course: Course): CourseProgress {
  let lecturesTotal = 0,
    lecturesWatched = 0;
  let tutorialsTotal = 0,
    tutorialsWatched = 0;

  if (course.recordings?.tabs) {
    const lecturesTab = course.recordings.tabs.find((t) => t.id === 'lectures');
    const tutorialsTab = course.recordings.tabs.find((t) => t.id === 'tutorials');

    if (lecturesTab?.items) {
      lecturesTotal = lecturesTab.items.length;
      lecturesWatched = lecturesTab.items.filter((i) => i.watched).length;
    }
    if (tutorialsTab?.items) {
      tutorialsTotal = tutorialsTab.items.length;
      tutorialsWatched = tutorialsTab.items.filter((i) => i.watched).length;
    }
  }

  const homeworkTotal = course.homework?.length ?? 0;
  const homeworkCompleted = course.homework?.filter((h) => h.completed).length ?? 0;

  return {
    lectures: { total: lecturesTotal, watched: lecturesWatched },
    tutorials: { total: tutorialsTotal, watched: tutorialsWatched },
    homework: { total: homeworkTotal, completed: homeworkCompleted },
  };
}

/**
 * Builds course metadata parts string.
 */
function buildCourseMetaParts(course: Course): string {
  const parts: string[] = [];
  if (course.number) parts.push(`#${escapeHtml(course.number)}`);
  if (course.points) parts.push(`${escapeHtml(String(course.points))} pts`);
  if (course.grade) parts.push(`Grade: ${escapeHtml(String(course.grade))}%`);
  return parts.join(' • ');
}

/**
 * Builds progress HTML for course card.
 */
function buildProgressHtml(progress: CourseProgress): string {
  let html = '';

  if (progress.lectures.total > 0) {
    html += `<div class="course-progress-row"><span class="progress-text" title="Lectures watched">${progress.lectures.watched}/${progress.lectures.total} <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 14" fill="currentColor"><circle cx="5" cy="4" r="2.5"/><path d="M5 7c-2.5 0-4 1.2-4 3v3h8v-3c0-1.8-1.5-3-4-3z"/><rect x="12" y="2" width="10" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="14" y1="5" x2="20" y2="5" stroke="currentColor" stroke-width="1"/><line x1="14" y1="8" x2="18" y2="8" stroke="currentColor" stroke-width="1"/><line x1="8" y1="8" x2="13" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="13" cy="4" r="1" fill="currentColor"/></svg></span></div>`;
  }

  if (progress.tutorials.total > 0) {
    html += `<div class="course-progress-row"><span class="progress-text" title="Tutorials watched">${progress.tutorials.watched}/${progress.tutorials.total} <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2.5"/><path d="M12 8c-2 0-3 0.5-3 1.5v1.5h6v-1.5c0-1-1-1.5-3-1.5z"/><path d="M6 12h12l1 3H5l1-3z"/><rect x="7" y="15" width="10" height="7" rx="0.5"/></svg></span></div>`;
  }

  if (progress.homework.total > 0) {
    html += `<div class="course-progress-row"><span class="progress-text" title="Homework completed">${progress.homework.completed}/${progress.homework.total} <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg></span></div>`;
  }

  return html;
}

// ============================================================================
// CALENDAR RENDERING
// ============================================================================

/**
 * Renders the weekly calendar grid with courses, homework and exams.
 */
export function renderCalendar(): void {
  const grid = $('weekly-schedule');
  if (!grid) return;

  grid.innerHTML = '';

  const semester = store.getCurrentSemester() ?? null;
  const calendarSettings = getCalendarSettings(semester);
  const { startHour, endHour } = calendarSettings;

  // Use temp filter if active, otherwise use settings
  const tempFilter = (window as unknown as { tempCalendarDayFilter?: number[] }).tempCalendarDayFilter;
  const visibleDays = tempFilter ?? calendarSettings.visibleDays;
  const allDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Collect week events first to determine if we need the events row
  const weekEvents = semester ? collectWeekEvents(semester, visibleDays) : {};
  const hasEvents = Object.keys(weekEvents).length > 0;

  // Update Grid Columns
  (grid).style.gridTemplateColumns = `40px repeat(${visibleDays.length}, 1fr)`;

  let html = '';

  // Headers
  html += `<div class="schedule-header"></div>`; // Corner
  visibleDays.forEach((dIndex) => {
    html += `<div class="schedule-header">${allDays[dIndex]}</div>`;
  });

  // All-day events row (only if there are events this week)
  if (hasEvents) {
    html += `<div class="schedule-events-label">Events</div>`;
    visibleDays.forEach((dIndex) => {
      html += `<div class="schedule-events-cell" data-day="${dIndex}"></div>`;
    });
  }

  // Time Rows
  for (let h = startHour; h <= endHour; h++) {
    // Time Label
    html += `<div class="schedule-time-col">${h}:00</div>`;
    // Day Cells
    visibleDays.forEach((dIndex) => {
      html += `<div class="schedule-cell" data-day="${dIndex}" data-hour="${h}"></div>`;
    });
  }

  grid.innerHTML = html;

  // Place Courses (only if semester exists)
  if (semester) {
    placeCourseBlocks(grid, semester, visibleDays, startHour, endHour);

    // Place homework and exams for the current week in the events row
    if (hasEvents) {
      renderWeekEvents(grid, weekEvents);
    }
  }

  renderCurrentTime();
}

/**
 * Places course blocks on the calendar grid.
 */
function placeCourseBlocks(
  grid: Element,
  semester: Semester,
  visibleDays: number[],
  startHour: number,
  endHour: number
): void {
  semester.courses.forEach((course) => {
    if (course.schedule) {
      course.schedule.forEach((slot) => {
        // Only show if day is visible
        if (!visibleDays.includes(slot.day)) return;

        const [startH, startM] = slot.start.split(':').map(Number);
        const [endH, endM] = slot.end.split(':').map(Number);

        if (startH < startHour || startH > endHour) return;

        // Find the specific cell element
        const cell = grid.querySelector(`.schedule-cell[data-day="${slot.day}"][data-hour="${startH}"]`);
        if (cell) {
          const block = document.createElement('div');
          block.className = 'schedule-block';
          block.textContent = course.name;
          block.title = `${course.name}\n${slot.start} - ${slot.end}\n${course.location ?? ''}`;
          block.dataset.courseId = course.id;

          if (course.color) {
            block.style.backgroundColor = course.color;
          }

          // Adjust height based on duration
          // 1 hour = 30px (min-height of cell)
          const durationHours = endH + endM / 60 - (startH + startM / 60);
          const height = durationHours * 30;
          block.style.height = `${height - 4}px`; // -4 for padding/gap

          // Adjust top offset for minutes
          const topOffset = (startM / 60) * 30;
          block.style.top = `${topOffset + 2}px`;

          cell.appendChild(block);
        }
      });
    }
  });
}

/**
 * Gets calendar settings from semester or UI defaults.
 */
function getCalendarSettings(semester: Semester | null): CalendarSettings {
  if (semester?.calendarSettings) {
    return semester.calendarSettings;
  }

  // Read from UI settings (with fallback to defaults)
  const startHourEl = $('cal-start-hour') as HTMLInputElement | null;
  const endHourEl = $('cal-end-hour') as HTMLInputElement | null;
  const daysContainer = $('cal-days-container');
  const days = daysContainer
    ? [...daysContainer.querySelectorAll<HTMLInputElement>('input:checked')].map((cb) => parseInt(cb.value))
    : DEFAULT_CALENDAR_SETTINGS.visibleDays;

  return {
    startHour: startHourEl?.value ? parseInt(startHourEl.value) : DEFAULT_CALENDAR_SETTINGS.startHour,
    endHour: endHourEl?.value ? parseInt(endHourEl.value) : DEFAULT_CALENDAR_SETTINGS.endHour,
    visibleDays: days.length > 0 ? days : DEFAULT_CALENDAR_SETTINGS.visibleDays,
  };
}

/**
 * Collects homework and exams that fall within the current week.
 */
function collectWeekEvents(
  semester: Semester,
  visibleDays: number[]
): Record<number, CalendarEvent[]> {
  const events: CalendarEvent[] = [];

  // Collect homework due this week
  semester.courses.forEach((course) => {
    if (course.homework) {
      course.homework.forEach((hw, index) => {
        if (hw.dueDate && isDateInCurrentWeek(hw.dueDate)) {
          events.push({
            type: 'homework',
            title: hw.title,
            courseName: course.name,
            courseId: course.id,
            hwIndex: index,
            date: hw.dueDate,
            day: getDayOfWeekFromDate(hw.dueDate),
            color: course.color,
            completed: hw.completed,
          });
        }
      });
    }

    // Collect exams this week
    if (course.exams) {
      if (course.exams.moedA && isDateInCurrentWeek(course.exams.moedA)) {
        events.push({
          type: 'exam',
          examType: 'A',
          title: course.name,
          courseName: course.name,
          courseId: course.id,
          date: course.exams.moedA,
          day: getDayOfWeekFromDate(course.exams.moedA),
          color: course.color,
        });
      }
      if (course.exams.moedB && isDateInCurrentWeek(course.exams.moedB)) {
        events.push({
          type: 'exam',
          examType: 'B',
          title: course.name,
          courseName: course.name,
          courseId: course.id,
          date: course.exams.moedB,
          day: getDayOfWeekFromDate(course.exams.moedB),
          color: course.color,
        });
      }
    }
  });

  // Group events by day (only for visible days)
  const eventsByDay: Record<number, CalendarEvent[]> = {};
  events.forEach((event) => {
    if (!visibleDays.includes(event.day)) return;
    if (!eventsByDay[event.day]) eventsByDay[event.day] = [];
    eventsByDay[event.day].push(event);
  });

  return eventsByDay;
}

/**
 * Checks if a date string is in the current week.
 */
function isDateInCurrentWeek(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();

  // Get start of current week (Sunday)
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  // Get end of current week (Saturday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return date >= startOfWeek && date <= endOfWeek;
}

/**
 * Gets the day of week (0-6) from a date string.
 */
function getDayOfWeekFromDate(dateStr: string): number {
  return new Date(dateStr).getDay();
}

/**
 * Renders week events (homework/exams) in the dedicated events row.
 */
function renderWeekEvents(grid: Element, eventsByDay: Record<number, CalendarEvent[]>): void {
  Object.keys(eventsByDay).forEach((day) => {
    const dayNum = parseInt(day);
    const dayEvents = eventsByDay[dayNum];

    // Find the events cell for this day
    const cell = grid.querySelector(`.schedule-events-cell[data-day="${dayNum}"]`);
    if (!cell) return;

    // Create event chips
    dayEvents.forEach((event) => {
      const chip = document.createElement('div');
      chip.className = `schedule-event-chip schedule-event-${event.type}`;
      if (event.completed) chip.classList.add('schedule-event-completed');

      // Add data attributes for navigation
      chip.dataset.courseId = event.courseId;
      chip.dataset.eventType = event.type;
      if (event.type === 'homework' && event.hwIndex !== undefined) {
        chip.dataset.homeworkIndex = String(event.hwIndex);
      } else if (event.type === 'exam' && event.examType) {
        chip.dataset.examType = event.examType;
      }

      // Use simple text symbol for exams only
      const shortTitle = event.title.length > 12 ? event.title.substring(0, 11) + '…' : event.title;
      if (event.type === 'exam') {
        chip.innerHTML = `<span class="event-chip-icon">!</span><span class="event-chip-title">${escapeHtml(shortTitle)}</span>`;
      } else {
        chip.innerHTML = `<span class="event-chip-title">${escapeHtml(shortTitle)}</span>`;
      }

      const dateObj = new Date(event.date);
      const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const typeLabel = event.type === 'exam' ? `Exam ${event.examType}` : 'Homework';
      chip.title = `${typeLabel}: ${event.title}\nCourse: ${event.courseName}\nDate: ${dateStr}`;

      if (event.color) {
        chip.style.borderLeftColor = event.color;
      }

      cell.appendChild(chip);
    });
  });
}

// ============================================================================
// CURRENT TIME INDICATOR
// ============================================================================

/**
 * Renders the current time indicator line on the calendar.
 */
export function renderCurrentTime(): void {
  // Remove old lines
  document.querySelectorAll('.current-time-line').forEach((el) => el.remove());

  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const min = now.getMinutes();

  const semester = store.getCurrentSemester();
  if (!semester?.calendarSettings) return;

  const { startHour, endHour, visibleDays } = semester.calendarSettings;

  if (!visibleDays.includes(day) || hour < startHour || hour > endHour) return;

  const cell = document.querySelector(`#weekly-schedule .schedule-cell[data-day="${day}"][data-hour="${hour}"]`);
  if (cell) {
    const line = document.createElement('div');
    line.className = 'current-time-line';
    line.style.top = `${(min / 60) * 100}%`;
    cell.appendChild(line);
  }
}

// ============================================================================
// HOMEWORK SIDEBAR
// ============================================================================

interface ExtendedHomework extends HomeworkItem {
  course: string;
  courseId: string;
  index: number;
  color: string;
  dateObj: Date | null;
}

/**
 * Renders the homework sidebar with all homework items from the current semester.
 */
export function renderHomeworkSidebar(): void {
  const container = $('homework-sidebar-list');
  if (!container) return;

  container.innerHTML = '';

  const settings = store.getSettings();
  const showCompleted = settings.showCompleted !== false;
  const toggle = $('show-completed-toggle') as HTMLInputElement | null;
  if (toggle) toggle.checked = showCompleted;

  const semester = store.getCurrentSemester();
  if (!semester) {
    container.innerHTML = '<div style="color:var(--text-tertiary); font-style:italic;">No active semester.</div>';
    return;
  }

  // Collect and flatten homework from all courses
  const homeworks: ExtendedHomework[] = semester.courses
    .flatMap((c) =>
      (c.homework ?? []).map((h, index) => ({
        ...h,
        course: c.name,
        courseId: c.id,
        index,
        color: c.color ?? 'hsl(0, 45%, 50%)',
        dateObj: h.dueDate ? new Date(h.dueDate) : null,
      }))
    )
    .filter((h) => showCompleted || !h.completed);

  // Sort by completion status first (incomplete first), then by date
  homeworks.sort((a, b) => {
    // Completed items go after incomplete ones
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    // Then sort by date
    if (!a.dateObj) return 1;
    if (!b.dateObj) return -1;
    return a.dateObj.getTime() - b.dateObj.getTime();
  });

  if (homeworks.length === 0) {
    container.innerHTML = '<div style="color:var(--text-tertiary); font-style:italic;">No homework found.</div>';
    return;
  }

  const dateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  homeworks.forEach((h) => {
    const div = document.createElement('div');
    div.className = 'event-card homework';
    div.style.cursor = 'pointer';
    if (h.completed) div.style.opacity = '0.6';
    if (h.color) div.style.borderLeftColor = h.color;

    const dateStr = h.dateObj ? dateFormatter.format(h.dateObj) : 'No Date';

    // Calculate days left
    let daysLeftStr = '';
    if (h.dateObj && !h.completed) {
      const dueDate = new Date(h.dateObj);
      dueDate.setHours(0, 0, 0, 0);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        daysLeftStr = `<span class="hw-days-left overdue">[${Math.abs(diffDays)}d overdue]</span>`;
      } else if (diffDays === 0) {
        daysLeftStr = `<span class="hw-days-left today">[Today]</span>`;
      } else if (diffDays === 1) {
        daysLeftStr = `<span class="hw-days-left tomorrow">[Tomorrow]</span>`;
      } else {
        daysLeftStr = `<span class="hw-days-left">[${diffDays}d left]</span>`;
      }
    }

    const hasNotes = h.notes?.trim();
    const notesIndicator = hasNotes ? `<span class="hw-indicators">has notes</span>` : '';

    // Build links chips for sidebar
    const links = h.links ?? [];
    let linksHtml = '';
    if (links.length > 0) {
      if (links.length <= 3) {
        // Show all links if 3 or fewer
        linksHtml =
          '<div class="sidebar-hw-links">' +
          links
            .map(
              (link) =>
                `<a href="${escapeHtml(link.url)}" target="_blank" class="sidebar-hw-link" onclick="event.stopPropagation()">${escapeHtml(link.label)}</a>`
            )
            .join('') +
          '</div>';
      } else {
        // Show first 2 links + "more" indicator
        const displayLinks = links.slice(0, 2);
        const remainingCount = links.length - 2;
        linksHtml =
          '<div class="sidebar-hw-links">' +
          displayLinks
            .map(
              (link) =>
                `<a href="${escapeHtml(link.url)}" target="_blank" class="sidebar-hw-link" onclick="event.stopPropagation()">${escapeHtml(link.label)}</a>`
            )
            .join('') +
          `<span class="sidebar-hw-more">+${remainingCount} more</span>` +
          '</div>';
      }
    }

    div.innerHTML = `
      <div class="sidebar-hw-row">
        <input type="checkbox" class="sidebar-hw-checkbox" 
          ${h.completed ? 'checked' : ''} 
          data-course-id="${h.courseId}"
          data-hw-index="${h.index}">
        <div class="sidebar-hw-content" style="${h.completed ? 'text-decoration: line-through;' : ''}">
          <div class="event-date">${escapeHtml(dateStr)} ${daysLeftStr}</div>
          <div class="event-title">${escapeHtml(h.title)}${notesIndicator}</div>
          <div class="event-course">${escapeHtml(h.course)}</div>
        </div>
        ${linksHtml}
      </div>
    `;

    // Store data for event handling
    div.dataset.courseId = h.courseId;
    div.dataset.hwIndex = String(h.index);

    container.appendChild(div);
  });
}

// ============================================================================
// PROFILE UI
// ============================================================================

/**
 * Renders the profile select dropdown with all available profiles.
 */
export function renderProfileUI(): void {
  const select = $('profile-select') as HTMLSelectElement | null;
  if (!select) return;

  select.innerHTML = '';

  const profiles = store.getProfiles();
  const activeProfileId = store.getActiveProfileId();

  profiles.forEach((p) => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.name;
    if (p.id === activeProfileId) option.selected = true;
    select.appendChild(option);
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    buildCourseMetaParts, calculateCourseProgress, collectWeekEvents, getCalendarSettings, getDayOfWeekFromDate, isDateInCurrentWeek
};

