/**
 * @fileoverview Pure utility functions for the UniManager application.
 * These functions have no side effects and do not depend on application state.
 */

import { HTML_ENTITIES, GOLDEN_ANGLE, COLOR_THEMES } from '@/constants';

import type { AppSettings, ColorTheme } from '@/types';

// ============================================================================
// DOM HELPERS
// ============================================================================

/**
 * Gets an element by ID (shorthand).
 * @param id - Element ID
 * @returns The element or null if not found
 */
export function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param text - Text to escape
 * @returns Escaped HTML string
 */
export function escapeHtml(text: unknown): string {
  if (text == null) return '';
  return String(text).replace(/[&<>"']/g, char => HTML_ENTITIES[char] ?? char);
}

/**
 * Creates an element with text content (safe from XSS).
 * @param tag - HTML tag name
 * @param text - Text content
 * @param className - Optional CSS class
 * @returns The created element
 */
export function createTextElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text: string,
  className?: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Converts date from dd-MM-yyyy to yyyy-MM-dd format.
 * @param dateStr - Date string in dd-MM-yyyy format
 * @returns Date string in yyyy-MM-dd format or original if invalid
 */
export function convertDateFormat(dateStr: string): string {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return dateStr;
}

/**
 * Parses an ICS date string into a JavaScript Date object.
 * @param icsDate - ICS date format (e.g., 20241027T103000 or 20241027T103000Z)
 * @returns Parsed date object
 */
export function parseICSDate(icsDate: string): Date {
  const cleanStr = icsDate.replace(/Z$/, '');

  const year = parseInt(cleanStr.substring(0, 4), 10);
  const month = parseInt(cleanStr.substring(4, 6), 10) - 1;
  const day = parseInt(cleanStr.substring(6, 8), 10);
  const hour = parseInt(cleanStr.substring(9, 11), 10) || 0;
  const minute = parseInt(cleanStr.substring(11, 13), 10) || 0;
  const second = parseInt(cleanStr.substring(13, 15), 10) || 0;

  if (icsDate.endsWith('Z')) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  return new Date(year, month, day, hour, minute, second);
}

/**
 * Gets the start and end dates of the current week (Sunday to Saturday).
 * @returns Week range object with start and end dates
 */
export function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return { start: startOfWeek, end: endOfWeek };
}

/**
 * Checks if a date string falls within the current week.
 * @param dateStr - Date string in yyyy-MM-dd format
 * @returns True if date is within current week
 */
export function isDateInCurrentWeek(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const { start, end } = getCurrentWeekRange();
  return date >= start && date <= end;
}

/**
 * Gets the day of week (0-6) from a date string.
 * @param dateStr - Date string in yyyy-MM-dd format
 * @returns Day of week (0 = Sunday) or -1 if invalid
 */
export function getDayOfWeekFromDate(dateStr: string): number {
  if (!dateStr) return -1;
  return new Date(dateStr).getDay();
}

/**
 * Formats time from date object as HH:MM.
 * @param date - Date object
 * @returns Time string in HH:MM format
 */
export function formatTimeFromDate(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// ============================================================================
// SEMESTER UTILITIES
// ============================================================================

interface SemesterLike {
  name: string;
}

/**
 * Compares two semesters for sorting (newest first).
 * @param a - First semester
 * @param b - Second semester
 * @returns Comparison result for sorting
 */
export function compareSemesters(a: SemesterLike, b: SemesterLike): number {
  const yearA = extractYear(a.name);
  const yearB = extractYear(b.name);

  if (yearA !== yearB) {
    return yearB - yearA; // Descending year
  }

  // Same year, compare seasons (Winter > Summer > Spring)
  return getSeasonValue(b.name) - getSeasonValue(a.name);
}

/**
 * Extracts the year from a semester name.
 * @param name - Semester name
 * @returns Year or 0 if not found
 */
export function extractYear(name: string): number {
  const match = name.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Gets a numeric value for semester season for sorting.
 * @param name - Semester name
 * @returns Season value (higher = later in academic year)
 */
export function getSeasonValue(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes('spring') || lower.includes('אביב')) return 1;
  if (lower.includes('summer') || lower.includes('קיץ')) return 2;
  if (lower.includes('winter') || lower.includes('חורף')) return 3;
  return 0;
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Extracts hue value from an HSL color string.
 * @param color - HSL color string (e.g., "hsl(180, 45%, 50%)")
 * @returns Hue value or '0' if not found
 */
export function extractHueFromColor(color: string): string {
  const match = color.match(/hsl\((\d+)/);
  return match ? match[1] : '0';
}

/**
 * Generates the next available hue for a new course.
 * Uses different strategies based on color theme.
 * @param courseCount - Number of existing courses
 * @param settings - Application settings
 * @returns Hue value (0-360)
 */
export function getNextAvailableHue(courseCount: number, settings: AppSettings): number {
  const colorTheme = settings.colorTheme ?? COLOR_THEMES.COLORFUL;

  switch (colorTheme) {
    case COLOR_THEMES.MONO:
      return 0;

    case COLOR_THEMES.SINGLE: {
      const baseHue = settings.baseColorHue ?? 200;
      const totalCourses = courseCount + 1;
      const hueOffset = totalCourses > 1 ? (courseCount / (totalCourses - 1)) * 60 - 30 : 0;
      return ((baseHue + hueOffset) % 360 + 360) % 360;
    }

    default: // colorful
      return (courseCount * GOLDEN_ANGLE) % 360;
  }
}

/**
 * Generates a course color based on the current theme settings.
 * @param index - Course index for color calculation
 * @param totalCourses - Total number of courses
 * @param colorTheme - Color theme
 * @param baseHue - Base hue for single theme
 * @returns HSL color string
 */
export function generateCourseColor(
  index: number,
  totalCourses: number,
  colorTheme: ColorTheme = 'colorful',
  baseHue = 200
): string {
  switch (colorTheme) {
    case 'mono':
      return 'hsl(0, 0%, 50%)';

    case 'single': {
      const hueOffset = totalCourses > 1 ? (index / (totalCourses - 1)) * 60 - 30 : 0;
      const hue = ((baseHue + hueOffset) % 360 + 360) % 360;
      return `hsl(${hue}, 45%, 50%)`;
    }

    default: // colorful
      return `hsl(${(index * GOLDEN_ANGLE) % 360}, 45%, 50%)`;
  }
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Truncates a string to a maximum length with ellipsis.
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
export function truncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - 1) + '…';
}

/**
 * Generates a unique ID.
 * @returns Unique ID string
 */
export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 7);
}

// ============================================================================
// VIDEO EMBED UTILITIES
// ============================================================================

/** Video platform type */
export type VideoPlatform = 'youtube' | 'panopto' | 'unknown';

/** Video embed information */
export interface VideoEmbedInfo {
  embedUrl: string | null;
  platform: VideoPlatform;
}

/**
 * Detects the video platform from a URL.
 * @param url - Video URL
 * @returns Platform type
 */
export function detectVideoPlatform(url: string): VideoPlatform {
  if (!url) return 'unknown';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('panopto')) return 'panopto';
  return 'unknown';
}

/**
 * Extracts video ID and generates embed URL for supported platforms.
 * @param url - Video URL
 * @returns Embed information
 */
export function getVideoEmbedInfo(url: string): VideoEmbedInfo {
  if (!url) return { embedUrl: null, platform: 'unknown' };

  const platform = detectVideoPlatform(url);

  if (platform === 'youtube') {
    let videoId: string | null = null;
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split(/[?#]/)[0] ?? null;
    } else if (url.includes('youtube.com')) {
      const match = url.match(/[?&]v=([^&#]+)/);
      videoId = match?.[1] ?? null;
    }
    if (videoId) {
      return { embedUrl: `https://www.youtube.com/embed/${videoId}`, platform };
    }
  }

  if (platform === 'panopto') {
    const idMatch = url.match(/id=([a-f0-9-]{36})/i);
    const domainMatch = url.match(/(https?:\/\/[^/]+)/);
    if (idMatch && domainMatch) {
      const videoId = idMatch[1];
      const domain = domainMatch[1];
      return {
        embedUrl: `${domain}/Panopto/Pages/Embed.aspx?id=${videoId}&autoplay=false&offerviewer=true&showtitle=true&showbrand=false&captions=true&interactivity=all`,
        platform,
      };
    }
  }

  return { embedUrl: null, platform };
}

/**
 * Checks if a video URL supports inline preview.
 * @param url - Video URL
 * @returns Whether inline preview is supported
 */
export function supportsInlinePreview(url: string): boolean {
  const { embedUrl } = getVideoEmbedInfo(url);
  return embedUrl !== null;
}

// ============================================================================
// DEBOUNCE UTILITY
// ============================================================================

/**
 * Creates a debounced function that delays invoking fn until after wait ms.
 * @param fn - Function to debounce
 * @param wait - Milliseconds to wait
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: Parameters<T>): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Creates a throttled function that only invokes fn at most once per wait ms.
 * @param fn - Function to throttle
 * @param wait - Minimum milliseconds between invocations
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: Parameters<T>): void {
    const now = Date.now();

    if (now - lastTime >= wait) {
      lastTime = now;
      fn.apply(this, args);
    } else if (timeoutId === null) {
      timeoutId = setTimeout(
        () => {
          lastTime = Date.now();
          fn.apply(this, args);
          timeoutId = null;
        },
        wait - (now - lastTime)
      );
    }
  };
}
