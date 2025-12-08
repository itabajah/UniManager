/**
 * @fileoverview Cheesefork import, ICS parsing, and Technion data fetching.
 * Handles importing course data from external sources.
 */

'use strict';

// ============================================================================
// CHEESEFORK IMPORT LOGIC
// ============================================================================

/**
 * Processes imported course data and adds to the app.
 * @param {Array<Object>} courses - Array of imported course objects
 * @param {string} semesterName - Name of the target semester
 */
function processImportedData(courses, semesterName) {
    let targetSemesterId = currentSemesterId;
    
    if (semesterName) {
        // Translate Hebrew to English if needed
        semesterName = translateSemesterName(semesterName);
        
        // Find or create semester
        let existingSem = appData.semesters.find(s => s.name === semesterName);
        if (!existingSem) {
            existingSem = {
                id: generateId(),
                name: semesterName,
                courses: [],
                calendarSettings: { ...DEFAULT_CALENDAR_SETTINGS }
            };
            appData.semesters.push(existingSem);
        }
        targetSemesterId = existingSem.id;
        currentSemesterId = targetSemesterId;
    }
    
    const semester = appData.semesters.find(s => s.id === targetSemesterId);
    if (!semester) return;
    
    const startingCourseCount = semester.courses.length;
    
    courses.forEach((importedCourse, importIndex) => {
        const existingCourse = findExistingCourse(semester, importedCourse);
        
        if (existingCourse) {
            updateExistingCourseExams(existingCourse, importedCourse);
        } else {
            const courseIndex = startingCourseCount + importIndex;
            const totalCourses = startingCourseCount + courses.length;
            const newCourse = createImportedCourse(importedCourse, courseIndex, totalCourses);
            semester.courses.push(newCourse);
        }
    });
    
    saveData();
    renderAll();
}

/**
 * Translates Hebrew semester names to English.
 * @param {string} name - Semester name
 * @returns {string} Translated name
 */
function translateSemesterName(name) {
    return name
        .replace('אביב', 'Spring')
        .replace('חורף', 'Winter')
        .replace('קיץ', 'Summer');
}

/**
 * Finds an existing course matching the imported course.
 * @param {Object} semester - Semester object
 * @param {Object} importedCourse - Imported course data
 * @returns {Object|null} Existing course or null
 */
function findExistingCourse(semester, importedCourse) {
    // Try matching by course number first
    if (importedCourse.number) {
        const byNumber = semester.courses.find(c => 
            c.name.includes(importedCourse.number) || c.number === importedCourse.number
        );
        if (byNumber) return byNumber;
    }
    
    // Try matching by name
    return semester.courses.find(c => 
        c.name.includes(importedCourse.name) || c.name === importedCourse.name
    );
}

/**
 * Updates exam dates on existing course if missing.
 * @param {Object} existingCourse - Existing course object
 * @param {Object} importedCourse - Imported course data
 */
function updateExistingCourseExams(existingCourse, importedCourse) {
    if (!existingCourse.exams) {
        existingCourse.exams = { moedA: '', moedB: '' };
    }
    if (!existingCourse.exams.moedA && importedCourse.moedA) {
        existingCourse.exams.moedA = importedCourse.moedA;
    }
    if (!existingCourse.exams.moedB && importedCourse.moedB) {
        existingCourse.exams.moedB = importedCourse.moedB;
    }
}

/**
 * Creates a new course object from imported data.
 * @param {Object} importedCourse - Imported course data
 * @param {number} courseIndex - Index of this course
 * @param {number} totalCourses - Total number of courses
 * @returns {Object} New course object
 */
function createImportedCourse(importedCourse, courseIndex, totalCourses) {
    // Try to extract number from name if not provided
    let number = importedCourse.number || '';
    let name = importedCourse.name;
    
    if (!number && name.match(/^\d{6,8}\s*[-–]/)) {
        const parts = name.match(/^(\d{6,8})\s*[-–]\s*(.+)/);
        if (parts) {
            number = parts[1];
            name = parts[2];
        }
    }
    
    return {
        id: generateId(),
        name: name,
        color: generateCourseColor(courseIndex, totalCourses),
        number: number,
        points: importedCourse.points || '',
        lecturer: importedCourse.lecturer || '',
        location: importedCourse.location || '',
        grade: '',
        notes: '',
        recordings: {
            tabs: JSON.parse(JSON.stringify(DEFAULT_RECORDING_TABS))
        },
        homework: [],
        schedule: importedCourse.schedule || [],
        exams: {
            moedA: importedCourse.moedA || '',
            moedB: importedCourse.moedB || ''
        }
    };
}

/**
 * Generates a course color based on theme settings.
 * @param {number} courseIndex - Index of the course
 * @param {number} totalCourses - Total number of courses
 * @returns {string} HSL color string
 */
function generateCourseColor(courseIndex, totalCourses) {
    const colorTheme = appData.settings?.colorTheme || COLOR_THEMES.COLORFUL;
    const baseHue = appData.settings?.baseColorHue || 200;
    
    if (colorTheme === COLOR_THEMES.MONO) {
        return 'hsl(0, 0%, 50%)';
    }
    
    if (colorTheme === COLOR_THEMES.SINGLE) {
        // Spread evenly within ±30 degrees of base hue
        const hueOffset = totalCourses > 1 
            ? (courseIndex / (totalCourses - 1)) * 60 - 30 
            : 0;
        const hue = ((baseHue + hueOffset) % 360 + 360) % 360;
        return `hsl(${hue}, 45%, 50%)`;
    }
    
    // Colorful - golden angle distribution
    const hue = (courseIndex * GOLDEN_ANGLE) % 360;
    return `hsl(${hue}, 45%, 50%)`;
}

// ============================================================================
// CORS PROXY HELPER
// ============================================================================

/**
 * Fetches a URL through CORS proxies with fallback.
 * @param {string} url - URL to fetch
 * @returns {Promise<Response>} Fetch response
 * @throws {Error} If all proxies fail
 */
async function fetchWithCorsProxy(url) {
    let lastError = null;
    
    for (const makeProxyUrl of CORS_PROXIES) {
        try {
            const proxyUrl = makeProxyUrl(url);
            const response = await fetch(proxyUrl);
            if (response.ok) {
                return response;
            }
        } catch (e) {
            lastError = e;
        }
    }
    
    throw lastError || new Error('All CORS proxies failed');
}

// ============================================================================
// ICS IMPORT FROM URL
// ============================================================================

/**
 * Imports course data from an ICS URL (Cheesefork format).
 * @param {string} url - ICS file URL
 * @param {string|null} semesterNameOverride - Optional semester name override
 * @returns {Promise<{semesterName: string, count: number}>} Import result
 */
async function importICSFromUrl(url, semesterNameOverride = null) {
    // Try to fetch JSON version first (Cheesefork specific) for full metadata
    const jsonUrl = url.replace(/\.ics$/i, '.json');
    
    try {
        const response = await fetchWithCorsProxy(jsonUrl);
        if (response.ok) {
            const data = await response.json();
            if (data.courses || Array.isArray(data)) {
                const courses = Array.isArray(data) ? data : data.courses;
                const semesterName = semesterNameOverride || data.semester || 'Imported Semester';
                
                if (courses && courses.length > 0) {
                    processImportedData(courses, semesterName);
                    return { semesterName, count: courses.length };
                }
            }
        }
    } catch (e) {
        // JSON fetch failed, proceed to ICS fallback
    }
    
    // Fallback: Fetch ICS file
    const response = await fetchWithCorsProxy(url);
    if (!response.ok) throw new Error('Failed to fetch calendar file.');
    
    const text = await response.text();
    let semesterName = semesterNameOverride;
    
    if (!semesterName) {
        semesterName = extractSemesterFromUrl(url);
    }
    
    const courses = parseICS(text);
    if (courses.length === 0) {
        throw new Error('No courses found in the calendar file.');
    }
    
    processImportedData(courses, semesterName);
    return { semesterName, count: courses.length };
}

/**
 * Extracts semester name from URL.
 * @param {string} url - ICS URL
 * @returns {string} Semester name
 */
function extractSemesterFromUrl(url) {
    const filenameMatch = url.match(/\/([^\/]+)\.ics$/);
    if (filenameMatch) {
        // e.g., "winter-2024-2025" → "Winter 2024-2025"
        return filenameMatch[1]
            .replace(/^([a-z]+)-/, (_, season) => 
                season.charAt(0).toUpperCase() + season.slice(1) + ' '
            );
    }
    return 'Imported Semester';
}

// ============================================================================
// ICS PARSING
// ============================================================================

/**
 * Parses ICS content into course objects.
 * @param {string} icsContent - Raw ICS file content
 * @returns {Array<Object>} Array of course objects
 */
function parseICS(icsContent) {
    const courseMap = new Map();
    const examDates = [];
    const events = icsContent.split('BEGIN:VEVENT');
    
    // First pass: collect all events
    for (const eventBlock of events) {
        if (!eventBlock.includes('END:VEVENT')) continue;
        
        const data = parseICSEventBlock(eventBlock);
        if (!data.SUMMARY || !data.DTSTART) continue;
        
        // Check for exam events
        const examInfo = parseExamEvent(data);
        if (examInfo) {
            examDates.push(examInfo);
            continue;
        }
        
        // Regular schedule event - requires DTEND
        if (!data.DTEND) continue;
        
        processScheduleEvent(courseMap, data);
    }
    
    // Second pass: apply exam dates to matching courses
    applyExamDates(courseMap, examDates);
    
    return formatCourseMap(courseMap);
}

/**
 * Parses an ICS event block into key-value pairs.
 * @param {string} eventBlock - Event block text
 * @returns {Object} Parsed event data
 */
function parseICSEventBlock(eventBlock) {
    const lines = eventBlock.split(/\r\n|\n|\r/);
    const data = {};
    
    for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        
        const key = line.substring(0, colonIdx).split(';')[0];
        const value = line.substring(colonIdx + 1).trim();
        
        if (['SUMMARY', 'DESCRIPTION', 'LOCATION', 'DTSTART', 'DTEND'].includes(key)) {
            data[key] = value;
        }
    }
    
    return data;
}

/**
 * Parses exam event information.
 * @param {Object} data - Event data
 * @returns {{courseName: string, examType: string, date: string}|null}
 */
function parseExamEvent(data) {
    const examAMatch = data.SUMMARY.match(/מועד א['׳]?\s*[-–]?\s*(.+)/);
    const examBMatch = data.SUMMARY.match(/מועד ב['׳]?\s*[-–]?\s*(.+)/);
    
    if (!examAMatch && !examBMatch) return null;
    
    const courseName = (examAMatch || examBMatch)[1].trim();
    const examType = examAMatch ? 'moedA' : 'moedB';
    
    // Parse date (format: YYYYMMDD -> yyyy-MM-dd)
    const dateMatch = data.DTSTART.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!dateMatch) return null;
    
    return {
        courseName,
        examType,
        date: `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
    };
}

/**
 * Processes a schedule event and adds to course map.
 * @param {Map} courseMap - Course map
 * @param {Object} data - Event data
 */
function processScheduleEvent(courseMap, data) {
    // Extract course name from summary
    const separatorIndex = data.SUMMARY.indexOf(' - ');
    const name = separatorIndex !== -1 
        ? data.SUMMARY.substring(separatorIndex + 3).trim() 
        : data.SUMMARY.trim();
    
    if (!courseMap.has(name)) {
        courseMap.set(name, {
            name,
            number: '',
            lecturers: new Set(),
            locations: new Set(),
            schedule: [],
            moedA: '',
            moedB: ''
        });
    }
    
    const course = courseMap.get(name);
    if (data.DESCRIPTION) course.lecturers.add(data.DESCRIPTION);
    if (data.LOCATION) course.locations.add(data.LOCATION);
    
    try {
        const scheduleEntry = parseScheduleEntry(data);
        if (scheduleEntry && !isDuplicateSchedule(course.schedule, scheduleEntry)) {
            course.schedule.push(scheduleEntry);
        }
    } catch (e) {
        console.warn('Failed to parse date for event', data.SUMMARY, e);
    }
}

/**
 * Parses schedule entry from event data.
 * @param {Object} data - Event data
 * @returns {{day: number, start: string, end: string}}
 */
function parseScheduleEntry(data) {
    const startDate = parseICSDate(data.DTSTART);
    const endDate = parseICSDate(data.DTEND);
    
    return {
        day: startDate.getDay(),
        start: formatTimeFromDate(startDate),
        end: formatTimeFromDate(endDate)
    };
}

/**
 * Formats time from date object as HH:MM.
 * @param {Date} date - Date object
 * @returns {string} Time string
 */
function formatTimeFromDate(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Checks if schedule entry is a duplicate.
 * @param {Array} schedule - Existing schedule
 * @param {Object} entry - New entry
 * @returns {boolean} True if duplicate
 */
function isDuplicateSchedule(schedule, entry) {
    return schedule.some(s => 
        s.day === entry.day && s.start === entry.start && s.end === entry.end
    );
}

/**
 * Applies exam dates to matching courses.
 * @param {Map} courseMap - Course map
 * @param {Array} examDates - Exam date entries
 */
function applyExamDates(courseMap, examDates) {
    for (const exam of examDates) {
        let course = courseMap.get(exam.courseName);
        
        // Try partial match if exact match fails
        if (!course) {
            for (const [name, c] of courseMap) {
                if (name.includes(exam.courseName) || exam.courseName.includes(name)) {
                    course = c;
                    break;
                }
            }
        }
        
        if (course) {
            course[exam.examType] = exam.date;
        }
    }
}

/**
 * Formats course map to array of course objects.
 * @param {Map} courseMap - Course map
 * @returns {Array<Object>} Course objects
 */
function formatCourseMap(courseMap) {
    return Array.from(courseMap.values()).map(c => ({
        name: c.name,
        number: c.number,
        lecturer: Array.from(c.lecturers).join(', '),
        location: Array.from(c.locations).join(', '),
        schedule: c.schedule,
        moedA: c.moedA,
        moedB: c.moedB
    }));
}

/**
 * Parses ICS date string to Date object.
 * @param {string} dateStr - ICS date string (YYYYMMDDTHHMMSS)
 * @returns {Date} Parsed date
 */
function parseICSDate(dateStr) {
    const cleanStr = dateStr.replace(/Z$/, '');
    
    const year = parseInt(cleanStr.substring(0, 4));
    const month = parseInt(cleanStr.substring(4, 6)) - 1;
    const day = parseInt(cleanStr.substring(6, 8));
    const hour = parseInt(cleanStr.substring(9, 11)) || 0;
    const minute = parseInt(cleanStr.substring(11, 13)) || 0;
    const second = parseInt(cleanStr.substring(13, 15)) || 0;
    
    if (dateStr.endsWith('Z')) {
        return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    
    return new Date(year, month, day, hour, minute, second);
}

// ============================================================================
// TECHNION DATA FETCHER
// ============================================================================

/** @type {string} Base URL for Technion SAP data */
const TECHNION_SAP_DATA_URL = 'https://raw.githubusercontent.com/michael-maltsev/technion-sap-info-fetcher/gh-pages/';

/**
 * Fetches Technion course data and updates local courses.
 */
async function fetchTechnionData() {
    const statusDiv = $('technion-fetch-status');
    if (!statusDiv) return;
    
    statusDiv.textContent = 'Fetching semester list...';
    statusDiv.style.color = 'var(--text-tertiary)';
    
    try {
        // Fetch last_semesters.json
        const response = await fetch(TECHNION_SAP_DATA_URL + 'last_semesters.json');
        if (!response.ok) throw new Error('Failed to fetch semester list.');
        
        const semesters = await response.json();
        if (!semesters || semesters.length === 0) {
            throw new Error('No semester data found.');
        }
        
        // Fetch course data for each semester
        const catalog = await buildCourseCatalog(semesters, statusDiv);
        
        // Update local courses
        statusDiv.textContent = 'Updating local courses...';
        const updatedCount = updateCoursesWithCatalog(catalog);
        
        statusDiv.innerHTML = `Done! Updated ${updatedCount} courses.<br>Catalog size: ${Object.keys(catalog).length} courses.`;
        statusDiv.style.color = 'var(--success-text)';
        
    } catch (err) {
        console.error('Technion fetch error:', err);
        statusDiv.textContent = 'Error: ' + err.message;
        statusDiv.style.color = 'var(--error-border)';
    }
}

/**
 * Builds course catalog from Technion semesters.
 * @param {Array} semesters - Semester list
 * @param {HTMLElement} statusDiv - Status element
 * @returns {Promise<Object>} Course catalog
 */
async function buildCourseCatalog(semesters, statusDiv) {
    const catalog = {};
    
    for (const sem of semesters) {
        const filename = `courses_${sem.year}_${sem.semester}.json`;
        statusDiv.textContent = `Fetching data for ${sem.year}-${sem.semester}...`;
        
        try {
            const courseRes = await fetch(TECHNION_SAP_DATA_URL + filename);
            if (courseRes.ok) {
                const courses = await courseRes.json();
                courses.forEach(c => {
                    if (c.general && c.general['מספר מקצוע']) {
                        catalog[c.general['מספר מקצוע']] = c;
                    }
                });
            }
        } catch (e) {
            console.warn(`Failed to fetch ${filename}`, e);
        }
    }
    
    return catalog;
}

/**
 * Updates local courses with Technion catalog data.
 * @param {Object} catalog - Course catalog
 * @returns {number} Number of updated courses
 */
function updateCoursesWithCatalog(catalog) {
    let updatedCount = 0;
    
    appData.semesters.forEach(semester => {
        semester.courses.forEach(course => {
            const match = findCatalogMatch(course, catalog);
            
            if (match) {
                const changed = applyCatalogData(course, match);
                if (changed) updatedCount++;
            }
        });
    });
    
    if (updatedCount > 0) {
        saveData();
        renderAll();
    }
    
    return updatedCount;
}

/**
 * Finds a matching course in the catalog.
 * @param {Object} course - Local course
 * @param {Object} catalog - Course catalog
 * @returns {Object|null} Matching catalog entry
 */
function findCatalogMatch(course, catalog) {
    const localNum = (course.number || '').replace(/\D/g, '');
    
    // Try exact match with local number
    if (localNum && catalog[localNum]) {
        return catalog[localNum];
    }
    
    // Try finding a catalog key that ends with or contains the local number
    if (localNum && localNum.length >= 5) {
        const catalogKey = Object.keys(catalog).find(k => 
            k.endsWith(localNum) || k.includes(localNum)
        );
        if (catalogKey) return catalog[catalogKey];
    }
    
    // Fallback: try to match by name
    if (course.name) {
        const localName = course.name.toLowerCase().trim();
        const catalogKey = Object.keys(catalog).find(k => {
            const catName = catalog[k].general['שם מקצוע'];
            return catName && catName.toLowerCase().includes(localName);
        });
        if (catalogKey) return catalog[catalogKey];
    }
    
    return null;
}

/**
 * Applies catalog data to a course.
 * @param {Object} course - Local course
 * @param {Object} match - Catalog entry
 * @returns {boolean} True if changes were made
 */
function applyCatalogData(course, match) {
    let changed = false;
    const gen = match.general;
    
    // Update fields if missing or empty
    if (!course.points && gen['נקודות']) {
        course.points = gen['נקודות'];
        changed = true;
    }
    if (!course.lecturer && gen['אחראים']) {
        course.lecturer = gen['אחראים'];
        changed = true;
    }
    if (!course.faculty && gen['פקולטה']) {
        course.faculty = gen['פקולטה'];
        changed = true;
    }
    if (!course.syllabus && gen['סילבוס']) {
        course.syllabus = gen['סילבוס'];
        changed = true;
    }
    
    // If matched by name but didn't have a number, save it
    if (!course.number && gen['מספר מקצוע']) {
        course.number = gen['מספר מקצוע'];
        changed = true;
    }
    
    // Extract exam dates
    if (!course.exams) course.exams = { moedA: '', moedB: '' };
    
    if (!course.exams.moedA && gen['מועד א']) {
        course.exams.moedA = convertDateFormat(gen['מועד א']);
        changed = true;
    }
    if (!course.exams.moedB && gen['מועד ב']) {
        course.exams.moedB = convertDateFormat(gen['מועד ב']);
        changed = true;
    }
    
    return changed;
}

/**
 * Converts date from dd-MM-yyyy to yyyy-MM-dd format.
 * @param {string} dateStr - Date in dd-MM-yyyy format
 * @returns {string} Date in yyyy-MM-dd format
 */
function convertDateFormat(dateStr) {
    if (!dateStr) return '';
    
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}
