/**
 * @fileoverview Modal dialog management for the Uni Course Manager application.
 * Handles opening, closing, and populating modal dialogs.
 */

'use strict';

// ============================================================================
// MODAL STATE
// ============================================================================

/** @type {string|null} Currently editing course ID */
let editingCourseId = null;

/** @type {string|null} Original color theme before editing */
let originalColorTheme = null;

/** @type {number|null} Original base color hue before editing */
let originalBaseColorHue = null;

/** @type {string|null} Temporary color theme during editing */
let tempColorTheme = null;

/** @type {number|null} Temporary base color hue during editing */
let tempBaseColorHue = null;

// ============================================================================
// GENERIC MODAL FUNCTIONS
// ============================================================================

/**
 * Resets the scroll position of a modal.
 * @param {HTMLElement} modal - Modal overlay element
 */
function resetModalScroll(modal) {
    const modalElement = modal.querySelector('.modal');
    if (modalElement) {
        modalElement.scrollTop = 0;
    }
}

/**
 * Opens a modal by ID.
 * @param {string} modalId - The ID of the modal to open
 */
function openModal(modalId) {
    const modal = $(modalId);
    if (modal) {
        modal.classList.add('active');
        resetModalScroll(modal);
    }
}

/**
 * Closes a modal by ID.
 * @param {string} modalId - The ID of the modal to close
 */
function closeModal(modalId) {
    const modal = $(modalId);
    if (modal) {
        modal.classList.remove('active');
        resetModalScroll(modal);
    }
}

// ============================================================================
// COURSE MODAL
// ============================================================================

/**
 * Opens the course modal for adding or editing a course.
 * @param {string|null} courseId - Course ID to edit, or null to add new
 * @param {string} [initialTab='details'] - Which tab to show initially ('details', 'recordings', 'homework')
 */
function openCourseModal(courseId, initialTab = 'recordings') {
    editingCourseId = courseId;
    
    // Clear schedule list and temp state
    const scheduleList = $('schedule-list');
    if (scheduleList) scheduleList.innerHTML = '';
    window.tempSchedule = [];

    const colorTheme = appData.settings.colorTheme || COLOR_THEMES.COLORFUL;
    const course = courseId ? getCourse(courseId) : null;

    if (course) {
        populateCourseEditForm(course, colorTheme);
        // For existing courses, also load recordings and homework tabs
        loadRecordingsTab(course);
        renderHomeworkList(course);
    } else {
        populateCourseAddForm(colorTheme);
        // For new courses, show details tab since there are no recordings/homework yet
        initialTab = 'details';
    }
    
    // Show/hide tabs based on whether it's a new course or existing
    const recordingsTab = document.querySelector('.course-modal-tab[data-tab="recordings"]');
    const homeworkTab = document.querySelector('.course-modal-tab[data-tab="homework"]');
    if (recordingsTab) recordingsTab.style.display = course ? '' : 'none';
    if (homeworkTab) homeworkTab.style.display = course ? '' : 'none';
    
    updateCourseColorSlider();
    switchCourseModalTab(initialTab);
    openModal('course-modal');
}

/**
 * Populates the course form for editing an existing course.
 * @param {Object} course - Course object to edit
 * @param {string} colorTheme - Current color theme
 */
function populateCourseEditForm(course, colorTheme) {
    $('course-modal-title').textContent = course.name || 'Edit Course';
    $('course-name').value = course.name;
    
    const hue = extractHueFromColor(course.color || 'hsl(0, 45%, 50%)');
    $('course-color-hue').value = hue;
    $('course-color-preview').style.backgroundColor = `hsl(${hue}, 45%, 50%)`;
    
    $('course-number').value = course.number || '';
    $('course-points').value = course.points || '';
    $('course-lecturer').value = course.lecturer || '';
    $('course-faculty').value = course.faculty || '';
    $('course-location').value = course.location || '';
    $('course-grade').value = course.grade || '';
    $('course-syllabus').value = course.syllabus || '';
    $('course-notes').value = course.notes || '';
    $('course-exam-a').value = course.exams?.moedA || '';
    $('course-exam-b').value = course.exams?.moedB || '';
    
    window.tempSchedule = course.schedule ? [...course.schedule] : [];
    renderScheduleList();
    
    $('delete-course-btn').classList.remove('hidden');
}

/**
 * Populates the course form for adding a new course.
 * @param {string} colorTheme - Current color theme
 */
function populateCourseAddForm(colorTheme) {
    $('course-modal-title').textContent = 'Add Course';
    
    // Clear all fields
    const fieldsToClear = [
        'course-name', 'course-number', 'course-points', 'course-lecturer',
        'course-faculty', 'course-location', 'course-grade', 'course-syllabus',
        'course-notes', 'course-exam-a', 'course-exam-b'
    ];
    fieldsToClear.forEach(id => {
        const el = $(id);
        if (el) el.value = '';
    });
    
    // Set default color
    const nextHue = getNextAvailableHue();
    if (colorTheme === COLOR_THEMES.MONO) {
        $('course-color-hue').value = 0;
        $('course-color-preview').style.backgroundColor = 'hsl(0, 0%, 50%)';
    } else {
        $('course-color-hue').value = nextHue;
        $('course-color-preview').style.backgroundColor = `hsl(${nextHue}, 45%, 50%)`;
    }
    
    renderScheduleList();
    $('delete-course-btn').classList.add('hidden');
}

// ============================================================================
// COURSE MODAL TAB SWITCHING
// ============================================================================

/**
 * Switches to a specific tab in the course modal.
 * @param {string} tabName - Tab name ('details', 'recordings', 'homework')
 */
function switchCourseModalTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.course-modal-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab panels
    document.querySelectorAll('.course-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });
}

/**
 * Loads the recordings tab content for a course.
 * @param {Object} course - Course object
 */
function loadRecordingsTab(course) {
    // Reset tab state
    window.currentRecordingsTab = 'lectures';
    window.tempRecordingEdit = null;
    
    // Configure tab action buttons
    const deleteBtn = $('delete-tab-btn');
    const clearBtn = $('clear-tab-btn');
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'inline-block';
    
    // Setup show watched toggle
    const showWatchedToggle = $('show-watched-toggle');
    if (showWatchedToggle) {
        showWatchedToggle.onchange = () => renderRecordingsList(course);
    }
    
    renderRecordingsTabs(course);
    renderRecordingsList(course);
}

// ============================================================================
// RECORDINGS MODAL (Legacy - now opens course modal with recordings tab)
// ============================================================================

/**
 * Opens the course modal with the recordings tab active.
 * @param {string} courseId - Course ID to show recordings for
 */
function openRecordingsModal(courseId) {
    openCourseModal(courseId, 'recordings');
}

// ============================================================================
// HOMEWORK MODAL (Legacy - now opens course modal with homework tab)
// ============================================================================

/**
 * Opens the course modal with the homework tab active.
 * @param {string} courseId - Course ID to show homework for
 */
function openHomeworkModal(courseId) {
    openCourseModal(courseId, 'homework');
}
