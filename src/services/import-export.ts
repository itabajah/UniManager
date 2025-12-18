/**
 * @fileoverview Import and export functionality for calendar data.
 * Handles ICS parsing, Cheesefork import, and data export.
 */

import { store } from '@/state';
import * as courseService from './courses';
import * as recordingService from './recordings';
import type { Course, ScheduleItem } from '@/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

const CHEESEFORK_SCHEDULE_URL =
  'https://cheesefork.cf/courses/?semester={semester}&internal_faculty=1&list-timetable=1';

const DAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  ראשון: 0,
  שני: 1,
  שלישי: 2,
  רביעי: 3,
  חמישי: 4,
  שישי: 5,
  שבת: 6,
};

const HEBREW_DAY_TO_NUMBER: Record<string, number> = {
  א: 0,
  ב: 1,
  ג: 2,
  ד: 3,
  ה: 4,
  ו: 5,
  ש: 6,
};

// ============================================================================
// ICS PARSING
// ============================================================================

interface ICSEvent {
  summary: string;
  dtstart: string;
  dtend: string;
  rrule?: string;
  byday?: string[];
  location?: string;
}

/**
 * Parses an ICS file and extracts events.
 */
export function parseICSFile(icsContent: string): ICSEvent[] {
  const events: ICSEvent[] = [];
  const lines = icsContent.split(/\r?\n/);
  let currentEvent: Partial<ICSEvent> | null = null;
  let inEvent = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Handle line continuations (lines starting with space or tab)
    while (i + 1 < lines.length && /^[ \t]/.test(lines[i + 1])) {
      line += lines[++i].substring(1);
    }

    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      currentEvent = {};
    } else if (line.startsWith('END:VEVENT') && currentEvent) {
      inEvent = false;
      if (currentEvent.summary && currentEvent.dtstart) {
        events.push(currentEvent as ICSEvent);
      }
      currentEvent = null;
    } else if (inEvent && currentEvent) {
      // Parse SUMMARY
      if (line.startsWith('SUMMARY')) {
        const match = line.match(/SUMMARY[;:](.+)/);
        currentEvent.summary = match?.[1]?.trim() ?? '';
      }
      // Parse DTSTART
      else if (line.startsWith('DTSTART')) {
        const match = line.match(/DTSTART[;:][^:]*:?(\d+T?\d*Z?)/);
        currentEvent.dtstart = match?.[1] ?? '';
      }
      // Parse DTEND
      else if (line.startsWith('DTEND')) {
        const match = line.match(/DTEND[;:][^:]*:?(\d+T?\d*Z?)/);
        currentEvent.dtend = match?.[1] ?? '';
      }
      // Parse RRULE
      else if (line.startsWith('RRULE')) {
        currentEvent.rrule = line.substring(6);
        const bydayMatch = currentEvent.rrule.match(/BYDAY=([^;]+)/);
        if (bydayMatch) {
          currentEvent.byday = bydayMatch[1].split(',');
        }
      }
      // Parse LOCATION
      else if (line.startsWith('LOCATION')) {
        const match = line.match(/LOCATION[;:](.+)/);
        currentEvent.location = match?.[1]?.trim() ?? '';
      }
    }
  }

  return events;
}

/**
 * Converts ICS time format (HHMMSS or HHMM) to HH:MM format.
 */
function parseICSTime(dtValue: string): string {
  const tIndex = dtValue.indexOf('T');
  if (tIndex === -1) return '00:00';

  const timeStr = dtValue.substring(tIndex + 1).replace('Z', '');
  const hours = timeStr.substring(0, 2);
  const minutes = timeStr.substring(2, 4) || '00';

  return `${hours}:${minutes}`;
}

/**
 * Gets the day of week from an ICS date string.
 */
function getDayFromICSDate(dtValue: string): number {
  // Format: YYYYMMDD or YYYYMMDDTHHMMSS
  const dateStr = dtValue.substring(0, 8);
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));

  const date = new Date(year, month, day);
  return date.getDay();
}

/**
 * Imports courses from an ICS file.
 */
export function importFromICS(icsContent: string): number {
  const events = parseICSFile(icsContent);

  // Group events by course name (SUMMARY)
  const courseMap = new Map<string, ICSEvent[]>();

  for (const event of events) {
    const courseName = event.summary;
    if (!courseMap.has(courseName)) {
      courseMap.set(courseName, []);
    }
    courseMap.get(courseName)!.push(event);
  }

  let coursesImported = 0;
  const usedHues: number[] = [];

  for (const [courseName, courseEvents] of courseMap) {
    // Check if course already exists
    const semester = store.getCurrentSemester();
    if (!semester) continue;

    const existingCourse = semester.courses.find(
      (c) => c.name.toLowerCase() === courseName.toLowerCase()
    );

    if (existingCourse) {
      // Merge schedule into existing course
      const newSchedule = extractScheduleFromEvents(courseEvents);
      const mergedSchedule = mergeSchedules(existingCourse.schedule, newSchedule);
      courseService.updateCourse(existingCourse.id, { schedule: mergedSchedule });
    } else {
      // Create new course
      const schedule = extractScheduleFromEvents(courseEvents);
      const location = courseEvents.find((e) => e.location)?.location ?? '';
      const hue = getNextAvailableHue(usedHues);
      usedHues.push(hue);

      courseService.createCourse({
        name: courseName,
        color: `hsl(${hue}, 45%, 50%)`,
        schedule,
        location,
      });

      coursesImported++;
    }
  }

  return coursesImported;
}

function extractScheduleFromEvents(events: ICSEvent[]): ScheduleItem[] {
  const schedule: ScheduleItem[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    // Determine day(s)
    let days: number[] = [];

    if (event.byday?.length) {
      days = event.byday.map((d) => DAY_MAP[d.replace(/[0-9+-]/g, '').toUpperCase()] ?? 0);
    } else {
      days = [getDayFromICSDate(event.dtstart)];
    }

    const startTime = parseICSTime(event.dtstart);
    const endTime = parseICSTime(event.dtend);

    for (const day of days) {
      const key = `${day}-${startTime}-${endTime}`;
      if (!seen.has(key)) {
        seen.add(key);
        schedule.push({
          day,
          start: startTime,
          end: endTime,
        });
      }
    }
  }

  return schedule;
}

function mergeSchedules(
  existing: ScheduleItem[],
  incoming: ScheduleItem[]
): ScheduleItem[] {
  const merged = [...existing];
  const seen = new Set(existing.map((s) => `${s.day}-${s.start}-${s.end}`));

  for (const slot of incoming) {
    const key = `${slot.day}-${slot.start}-${slot.end}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(slot);
    }
  }

  return merged;
}

function getNextAvailableHue(usedHues: number[]): number {
  const startHue = 200;
  const hueStep = 47;
  let hue = startHue;

  while (usedHues.includes(hue)) {
    hue = (hue + hueStep) % 360;
    if (hue === startHue) break; // Full cycle
  }

  return hue;
}

// ============================================================================
// CHEESEFORK IMPORT
// ============================================================================

interface CheeseforkCourse {
  name: string;
  number: string;
  faculty: string;
  points: string;
  schedule: ScheduleItem[];
}

/**
 * Imports schedule from Cheesefork.
 */
export async function importFromCheesefork(semesterCode: string): Promise<number> {
  const url = CHEESEFORK_SCHEDULE_URL.replace('{semester}', semesterCode);

  try {
    const response = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!response.ok) throw new Error('Failed to fetch Cheesefork data');

    const html = await response.text();
    const courses = parseCheeseforkHTML(html);

    let coursesImported = 0;
    const usedHues: number[] = [];

    for (const course of courses) {
      const semester = store.getCurrentSemester();
      if (!semester) continue;

      const existingCourse = semester.courses.find(
        (c) =>
          c.number === course.number ||
          c.name.toLowerCase() === course.name.toLowerCase()
      );

      if (existingCourse) {
        const mergedSchedule = mergeSchedules(
          existingCourse.schedule,
          course.schedule
        );
        courseService.updateCourse(existingCourse.id, {
          schedule: mergedSchedule,
          faculty: course.faculty || existingCourse.faculty,
          points: course.points || existingCourse.points,
        });
      } else {
        const hue = getNextAvailableHue(usedHues);
        usedHues.push(hue);

        courseService.createCourse({
          name: course.name,
          number: course.number,
          faculty: course.faculty,
          points: course.points,
          color: `hsl(${hue}, 45%, 50%)`,
          schedule: course.schedule,
        });

        coursesImported++;
      }
    }

    return coursesImported;
  } catch (error) {
    console.error('Cheesefork import error:', error);
    throw new Error('Failed to import from Cheesefork. Please try again.');
  }
}

function parseCheeseforkHTML(html: string): CheeseforkCourse[] {
  const courses: CheeseforkCourse[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find course entries in the timetable
  const courseEntries = doc.querySelectorAll('.course-entry, .timetable-course');

  for (const entry of courseEntries) {
    const nameEl = entry.querySelector('.course-name, .name');
    const numberEl = entry.querySelector('.course-number, .number');
    const facultyEl = entry.querySelector('.faculty');
    const pointsEl = entry.querySelector('.points');
    const scheduleEls = entry.querySelectorAll('.schedule-item, .time-slot');

    const name = nameEl?.textContent?.trim() ?? '';
    const number = numberEl?.textContent?.trim() ?? '';
    const faculty = facultyEl?.textContent?.trim() ?? '';
    const points = pointsEl?.textContent?.trim() ?? '';

    if (!name) continue;

    const schedule: ScheduleItem[] = [];

    for (const scheduleEl of scheduleEls) {
      const dayEl = scheduleEl.querySelector('.day');
      const timeEl = scheduleEl.querySelector('.time');

      const dayText = dayEl?.textContent?.trim() ?? '';
      const timeText = timeEl?.textContent?.trim() ?? '';

      const day = parseHebrewDay(dayText);
      const { start, end } = parseTimeRange(timeText);

      if (day !== -1 && start && end) {
        schedule.push({
          day,
          start,
          end,
        });
      }
    }

    courses.push({ name, number, faculty, points, schedule });
  }

  return courses;
}

function parseHebrewDay(dayText: string): number {
  // Try single Hebrew letter
  const letter = dayText.charAt(0);
  if (HEBREW_DAY_TO_NUMBER[letter] !== undefined) {
    return HEBREW_DAY_TO_NUMBER[letter];
  }

  // Try full Hebrew word
  for (const [word, num] of Object.entries(DAY_MAP)) {
    if (dayText.includes(word)) return num;
  }

  return -1;
}

function parseTimeRange(timeText: string): { start: string; end: string } {
  // Format: "10:00-12:00" or "10:00 - 12:00"
  const match = timeText.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (match) {
    return { start: match[1], end: match[2] };
  }

  return { start: '', end: '' };
}

// ============================================================================
// TECHNION DATA IMPORT
// ============================================================================

/**
 * Fetches course information from Technion course catalog.
 */
export async function fetchTechnionCourseInfo(
  courseNumber: string
): Promise<Partial<Course> | null> {
  const url = `https://ug3.technion.ac.il/rishum/course/${courseNumber}`;

  try {
    const response = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!response.ok) return null;

    const html = await response.text();
    return parseTechnionCourseHTML(html);
  } catch (error) {
    console.error('Technion fetch error:', error);
    return null;
  }
}

function parseTechnionCourseHTML(html: string): Partial<Course> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const name = doc.querySelector('.course-name, h1')?.textContent?.trim() ?? '';
  const points = doc.querySelector('.points, .credit')?.textContent?.trim() ?? '';
  const faculty = doc.querySelector('.faculty')?.textContent?.trim() ?? '';

  return { name, points, faculty };
}

// ============================================================================
// RECORDINGS IMPORT
// ============================================================================

interface VideoInfo {
  title: string;
  videoLink: string;
  slideLink?: string;
}

/**
 * Parses a list of video URLs and extracts video information.
 */
export async function parseVideoList(input: string): Promise<VideoInfo[]> {
  const lines = input
    .split(/[\n,]/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const videos: VideoInfo[] = [];

  for (const line of lines) {
    // Check if it's a URL
    const urlMatch = line.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      const url = urlMatch[0];
      const title = await fetchVideoTitle(url);
      videos.push({
        title: title || `Recording ${videos.length + 1}`,
        videoLink: url,
      });
    }
  }

  return videos;
}

/**
 * Fetches the title of a video from its URL.
 */
async function fetchVideoTitle(url: string): Promise<string> {
  // Try to extract title from URL
  if (url.includes('panopto')) {
    const match = url.match(/id=([a-f0-9-]+)/i);
    if (match) return `Panopto Recording ${match[1].substring(0, 8)}`;
  }

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    try {
      const response = await fetch(CORS_PROXY + encodeURIComponent(url));
      const html = await response.text();
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        return titleMatch[1].replace(' - YouTube', '').trim();
      }
    } catch {
      // Ignore fetch errors
    }
  }

  return '';
}

/**
 * Bulk imports recordings into a course.
 */
export function bulkImportRecordings(
  courseId: string,
  tabId: string,
  recordings: Array<{ title: string; url: string }>
): void {
  recordingService.importRecordings(courseId, tabId, recordings, true);
}

// ============================================================================
// DATA EXPORT
// ============================================================================

/**
 * Exports data as JSON file.
 */
export function exportAsJSON(filename?: string): void {
  const data = store.getData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  downloadBlob(blob, filename ?? `unimanager-export-${getDateString()}.json`);
}

/**
 * Exports current semester as ICS file.
 */
export function exportAsICS(filename?: string): void {
  const semester = store.getCurrentSemester();
  if (!semester) {
    alert('No semester selected.');
    return;
  }

  const icsContent = generateICS(semester.courses);
  const blob = new Blob([icsContent], { type: 'text/calendar' });

  downloadBlob(
    blob,
    filename ?? `unimanager-${semester.name}-${getDateString()}.ics`
  );
}

function generateICS(courses: Course[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UniManager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const now = new Date();
  const uid = () => `${Date.now()}-${Math.random().toString(36).substring(2)}`;

  for (const course of courses) {
    for (const slot of course.schedule) {
      const dtstart = getNextOccurrence(slot.day, slot.start);
      const dtend = getNextOccurrence(slot.day, slot.end);
      const byday = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][slot.day];

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid()}@unimanager`,
        `DTSTAMP:${formatICSDate(now)}`,
        `DTSTART:${formatICSDate(dtstart)}`,
        `DTEND:${formatICSDate(dtend)}`,
        `SUMMARY:${escapeICSValue(course.name)}`,
        `LOCATION:${escapeICSValue(course.location ?? '')}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
        'END:VEVENT'
      );
    }

    // Export exams
    if (course.exams?.moedA) {
      const examDate = new Date(course.exams.moedA);
      if (!isNaN(examDate.getTime())) {
        lines.push(
          'BEGIN:VEVENT',
          `UID:${uid()}@unimanager`,
          `DTSTAMP:${formatICSDate(now)}`,
          `DTSTART;VALUE=DATE:${formatICSDateOnly(examDate)}`,
          `SUMMARY:${escapeICSValue(course.name)} - Exam A`,
          'END:VEVENT'
        );
      }
    }

    if (course.exams?.moedB) {
      const examDate = new Date(course.exams.moedB);
      if (!isNaN(examDate.getTime())) {
        lines.push(
          'BEGIN:VEVENT',
          `UID:${uid()}@unimanager`,
          `DTSTAMP:${formatICSDate(now)}`,
          `DTSTART;VALUE=DATE:${formatICSDateOnly(examDate)}`,
          `SUMMARY:${escapeICSValue(course.name)} - Exam B`,
          'END:VEVENT'
        );
      }
    }
  }

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

function getNextOccurrence(dayOfWeek: number, time: string): Date {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);

  const date = new Date(now);
  const diff = (dayOfWeek - now.getDay() + 7) % 7;
  date.setDate(date.getDate() + diff);
  date.setHours(hours, minutes, 0, 0);

  return date;
}

function formatICSDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    '00'
  );
}

function formatICSDateOnly(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate())
  );
}

function escapeICSValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// ============================================================================
// UTILITIES
// ============================================================================

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Reads a file and returns its content as text.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
