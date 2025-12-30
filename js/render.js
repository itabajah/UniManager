/**
 * @fileoverview Rendering functions for the UI components.
 * Handles rendering semesters, courses, calendar, recordings, homework, and profile UI.
 */

'use strict';

// ============================================================================
// MAIN RENDER FUNCTIONS
// ============================================================================

/**
 * Renders all UI components.
 */
function renderAll() {
    renderSemesters();
    renderCourses();
    renderCalendar();
    renderHomeworkSidebar();

    // Header ticker is implemented in js/header-ticker.js
    if (typeof renderHeaderTicker === 'function') {
        renderHeaderTicker();
    }
}

/**
 * Alias for renderCourses for backward compatibility.
 */
function renderCoursesList() {
    renderCourses();
}

// ============================================================================
// SEMESTER RENDERING
// ============================================================================

/**
 * Renders the semester dropdown selector.
 */
function renderSemesters() {
    const select = $('semester-select');
    if (!select) return;
    
    select.innerHTML = '';
    
    if (appData.semesters.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'No Semesters';
        select.appendChild(option);
        select.disabled = true;
        return;
    }
    
    select.disabled = false;
    
    // Sort semesters chronologically (newest first)
    const sortedSemesters = [...appData.semesters].sort(compareSemesters);
    
    sortedSemesters.forEach(sem => {
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
function renderCourses() {
    const container = $('course-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!currentSemesterId) {
        renderNoSemesterMessage(container);
        return;
    }
    
    const semester = getCurrentSemester();
    if (!semester) return;
    
    if (semester.courses.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-tertiary); padding: 20px;">No courses yet. Click + to add one.</div>';
        return;
    }
    
    semester.courses.forEach((course, index) => {
        const card = createCourseCard(course, index, semester.courses.length);
        container.appendChild(card);
    });
}

/**
 * Renders the "no semester" message with action buttons.
 * @param {HTMLElement} container - Container element
 */
function renderNoSemesterMessage(container) {
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

/**
 * Creates a course card element.
 * @param {Object} course - Course object
 * @param {number} index - Course index
 * @param {number} totalCourses - Total number of courses
 * @returns {HTMLElement} Course card element
 */
function createCourseCard(course, index, totalCourses) {
    const card = document.createElement('div');
    card.className = 'course-card';
    card.onclick = () => openCourseModal(course.id);
    
    if (course.color) {
        card.style.borderLeftColor = course.color;
        card.style.borderLeftWidth = '4px';
    }
    
    const progress = calculateCourseProgress(course);
    const metaParts = buildCourseMetaParts(course);
    const progressHtml = buildProgressHtml(progress);
    
    card.innerHTML = `
        <div class="course-reorder-buttons">
            <button class="reorder-btn" onclick="event.stopPropagation(); moveCourse(${index}, 'up')" ${index === 0 ? 'disabled' : ''} title="Move up">▲</button>
            <button class="reorder-btn" onclick="event.stopPropagation(); moveCourse(${index}, 'down')" ${index === totalCourses - 1 ? 'disabled' : ''} title="Move down">▼</button>
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
 * @param {Object} course - Course object
 * @returns {{lectures: {total: number, watched: number}, tutorials: {total: number, watched: number}, homework: {total: number, completed: number}}}
 */
function calculateCourseProgress(course) {
    let lecturesTotal = 0, lecturesWatched = 0;
    let tutorialsTotal = 0, tutorialsWatched = 0;
    
    if (course.recordings?.tabs) {
        const lecturesTab = course.recordings.tabs.find(t => t.id === 'lectures');
        const tutorialsTab = course.recordings.tabs.find(t => t.id === 'tutorials');
        
        if (lecturesTab?.items) {
            lecturesTotal = lecturesTab.items.length;
            lecturesWatched = lecturesTab.items.filter(i => i.watched).length;
        }
        if (tutorialsTab?.items) {
            tutorialsTotal = tutorialsTab.items.length;
            tutorialsWatched = tutorialsTab.items.filter(i => i.watched).length;
        }
    }
    
    const homeworkTotal = course.homework?.length || 0;
    const homeworkCompleted = course.homework?.filter(h => h.completed).length || 0;
    
    return {
        lectures: { total: lecturesTotal, watched: lecturesWatched },
        tutorials: { total: tutorialsTotal, watched: tutorialsWatched },
        homework: { total: homeworkTotal, completed: homeworkCompleted }
    };
}

/**
 * Builds course metadata parts string.
 * @param {Object} course - Course object
 * @returns {string} Formatted metadata
 */
function buildCourseMetaParts(course) {
    const parts = [];
    if (course.number) parts.push(`#${escapeHtml(course.number)}`);
    if (course.points) parts.push(`${escapeHtml(course.points)} pts`);
    if (course.grade) parts.push(`Grade: ${escapeHtml(course.grade)}%`);
    return parts.join(' • ');
}

/**
 * Builds progress HTML for course card.
 * @param {Object} progress - Progress stats object
 * @returns {string} HTML string
 */
function buildProgressHtml(progress) {
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
// RECORDINGS RENDERING
// ============================================================================

/**
 * Renders recording tabs for a course.
 * @param {Object} course - Course object
 */
function renderRecordingsTabs(course) {
    const container = $('recordings-tabs');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!course.recordings?.tabs) return;
    
    course.recordings.tabs.forEach(tab => {
        const tabBtn = document.createElement('button');
        tabBtn.className = `recordings-tab ${window.currentRecordingsTab === tab.id ? 'active' : ''}`;
        tabBtn.onclick = () => switchRecordingsTab(course.id, tab.id);
        
        const count = tab.items?.length || 0;
        tabBtn.innerHTML = `${escapeHtml(tab.name)}<span class="recordings-tab-count">${count}</span>`;
        container.appendChild(tabBtn);
    });
}

/**
 * Renders the recordings list for a course tab.
 * @param {Object} course - Course object
 * @param {number|null} editingIndex - Index of recording being edited
 */
function renderRecordingsList(course, editingIndex = null) {
    const container = $('recordings-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!course.recordings?.tabs) {
        container.innerHTML = '<div class="recordings-empty">No recordings yet.</div>';
        return;
    }
    
    const currentTab = course.recordings.tabs.find(t => t.id === window.currentRecordingsTab);
    if (!currentTab?.items?.length) {
        container.innerHTML = '<div class="recordings-empty">No recordings in this tab. Paste a video link below to add one.</div>';
        return;
    }
    
    // Add sort controls
    const sortOrder = getRecordingsSortOrder(course, currentTab.id);
    const sortControls = createRecordingsSortControls(course.id, currentTab.id, sortOrder);
    container.appendChild(sortControls);
    
    const showWatched = $('show-watched-toggle')?.checked !== false;
    let visibleCount = 0;
    
    // Sort recordings
    const sortedItems = sortRecordings(currentTab.items, sortOrder);
    
    sortedItems.forEach(({ item, originalIndex }, displayIndex) => {
        if (!showWatched && item.watched) return;
        visibleCount++;
        const div = createRecordingItem(item, originalIndex, course.id, currentTab.id, editingIndex === originalIndex, displayIndex, sortedItems.length, sortOrder);
        container.appendChild(div);
    });
    
    if (visibleCount === 0 && currentTab.items.length > 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'recordings-empty';
        emptyMsg.textContent = 'All recordings are done. Enable "Show Done" to see them.';
        container.appendChild(emptyMsg);
    }
}

/**
 * Creates sort controls for recordings list.
 * @param {string} courseId - Course ID
 * @param {string} tabId - Tab ID
 * @param {string} currentOrder - Current sort order
 * @returns {HTMLElement} Sort controls element
 */
function createRecordingsSortControls(courseId, tabId, currentOrder) {
    const div = document.createElement('div');
    div.className = 'list-sort-controls';
    div.innerHTML = `
        <span class="sort-label">Sort:</span>
        <select class="sort-select" onchange="setRecordingsSortOrder('${courseId}', '${tabId}', this.value)">
            <option value="${SORT_ORDERS.recordings.DEFAULT}" ${currentOrder === SORT_ORDERS.recordings.DEFAULT ? 'selected' : ''}>Default (by #)</option>
            <option value="${SORT_ORDERS.recordings.MANUAL}" ${currentOrder === SORT_ORDERS.recordings.MANUAL ? 'selected' : ''}>Manual</option>
            <option value="${SORT_ORDERS.recordings.NAME_ASC}" ${currentOrder === SORT_ORDERS.recordings.NAME_ASC ? 'selected' : ''}>Name (A-Z)</option>
            <option value="${SORT_ORDERS.recordings.NAME_DESC}" ${currentOrder === SORT_ORDERS.recordings.NAME_DESC ? 'selected' : ''}>Name (Z-A)</option>
            <option value="${SORT_ORDERS.recordings.UNWATCHED_FIRST}" ${currentOrder === SORT_ORDERS.recordings.UNWATCHED_FIRST ? 'selected' : ''}>Unwatched First</option>
            <option value="${SORT_ORDERS.recordings.WATCHED_FIRST}" ${currentOrder === SORT_ORDERS.recordings.WATCHED_FIRST ? 'selected' : ''}>Watched First</option>
        </select>
    `;
    return div;
}

/**
 * Creates a recording item element.
 * @param {Object} item - Recording item
 * @param {number} index - Item index (original index in array)
 * @param {string} courseId - Course ID
 * @param {string} tabId - Tab ID
 * @param {boolean} isEditing - Whether item is being edited
 * @param {number} displayIndex - Display position in sorted list
 * @param {number} totalItems - Total number of items
 * @param {string} sortOrder - Current sort order
 * @returns {HTMLElement} Recording item element
 */
function createRecordingItem(item, index, courseId, tabId, isEditing, displayIndex = 0, totalItems = 1, sortOrder = 'manual') {
    const div = document.createElement('div');
    div.className = `recording-item ${item.watched ? 'watched' : ''}`;
    div.id = `recording-item-${index}`;
    
    // Show reorder buttons only in manual mode
    const isManualSort = sortOrder === SORT_ORDERS.recordings.MANUAL;
    const reorderButtonsHtml = isManualSort ? `
        <div class="item-reorder-buttons">
            <button class="reorder-btn" onclick="event.stopPropagation(); moveRecording('${courseId}', '${tabId}', ${index}, 'up')" ${displayIndex === 0 ? 'disabled' : ''} title="Move up">▲</button>
            <button class="reorder-btn" onclick="event.stopPropagation(); moveRecording('${courseId}', '${tabId}', ${index}, 'down')" ${displayIndex === totalItems - 1 ? 'disabled' : ''} title="Move down">▼</button>
        </div>
    ` : '';
    
    const slidesHtml = item.slideLink 
        ? `<a href="${escapeHtml(item.slideLink)}" target="_blank" class="recording-link recording-link-slides" onclick="event.stopPropagation()">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            Slides
        </a>` 
        : '';
    
    const hasVideo = !!item.videoLink;
    const videoUrl = hasVideo ? escapeHtml(item.videoLink) : '#';
    const embedInfo = hasVideo ? getVideoEmbedInfo(item.videoLink) : { embedUrl: null, platform: 'unknown' };
    const canEmbed = embedInfo.embedUrl !== null;
    
    // If can embed, clicking toggles preview; otherwise opens in new tab
    const contentClickable = hasVideo 
        ? (canEmbed 
            ? `onclick="toggleVideoPreview(${index}, '${escapeHtml(embedInfo.embedUrl)}')"`
            : `onclick="window.open('${videoUrl}', '_blank')"`)
        : '';
    const contentClass = hasVideo ? 'recording-content recording-content-clickable' : 'recording-content';
    
    // Build platform-specific preview icon
    const previewIcon = canEmbed 
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="recording-play-icon recording-preview-icon"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
        : (hasVideo ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="recording-play-icon"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' : '');
    
    // External link button (always show for videos that can embed, as alternative to preview)
    const externalLinkBtn = hasVideo 
        ? `<a href="${videoUrl}" target="_blank" class="recording-action-btn recording-external-link" onclick="event.stopPropagation()" title="Open in new tab">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>`
        : '';

    div.innerHTML = `
        ${reorderButtonsHtml}
        <div class="recording-header">
            <input type="checkbox" class="recording-checkbox" ${item.watched ? 'checked' : ''} 
                onchange="toggleRecordingStatus('${courseId}', '${tabId}', ${index})">
            <div class="${contentClass}" ${contentClickable}>
                <div class="recording-name">
                    ${previewIcon}
                    ${escapeHtml(item.name) || '<span style="color: var(--text-tertiary); font-style: italic;">Untitled Recording</span>'}
                    ${canEmbed ? '<span class="recording-preview-hint">(click to preview)</span>' : ''}
                </div>
                ${slidesHtml ? `<div class="recording-meta">${slidesHtml}</div>` : ''}
            </div>
        </div>
        <div class="recording-actions">
            ${externalLinkBtn}
            <button class="recording-action-btn" 
                onclick="toggleRecordingEdit('${courseId}', '${tabId}', ${index})" title="Edit">
                Edit
            </button>
            <button class="recording-action-btn recording-action-btn-danger" 
                onclick="deleteRecording('${courseId}', '${tabId}', ${index})" title="Delete">
                ×
            </button>
        </div>
        <div id="recording-preview-${index}" class="recording-preview-container hidden"></div>
        <div id="recording-edit-section-${index}" class="recording-edit-section ${isEditing ? '' : 'hidden'}">
            <div class="recording-edit-row">
                <label class="recording-edit-label">Name</label>
                <input type="text" id="recording-edit-name-${index}" class="recording-edit-input" 
                    value="${escapeHtml(item.name)}" placeholder="Recording title...">
            </div>
            <div class="recording-edit-row">
                <label class="recording-edit-label">Video</label>
                <input type="text" id="recording-edit-video-${index}" class="recording-edit-input" 
                    value="${escapeHtml(item.videoLink)}" placeholder="Video URL (YouTube, Panopto, etc.)">
            </div>
            <div class="recording-edit-row">
                <label class="recording-edit-label">Slides</label>
                <input type="text" id="recording-edit-slides-${index}" class="recording-edit-input" 
                    value="${escapeHtml(item.slideLink)}" placeholder="Slides URL (optional)">
            </div>
            <div class="recording-edit-actions">
                <button class="recording-edit-save-btn" 
                    onclick="saveRecordingEdit('${courseId}', '${tabId}', ${index})">Save</button>
                <button class="recording-edit-cancel-btn" 
                    onclick="cancelRecordingEdit('${courseId}')">Cancel</button>
            </div>
        </div>
    `;
    
    return div;
}

// ============================================================================
// HOMEWORK RENDERING
// ============================================================================

/**
 * Renders the homework list in the homework modal.
 * @param {Object} course - Course object
 * @param {number|null} openLinksIndex - Index of homework with open links section
 */
function renderHomeworkList(course, openLinksIndex = null) {
    const container = $('homework-modal-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!course.homework) course.homework = [];
    
    // Add sort controls if there are homework items
    if (course.homework.length > 0) {
        const sortOrder = getHomeworkSortOrder(course);
        const showCompleted = course.showCompletedHomework !== false;
        const sortControls = createHomeworkSortControls(course.id, sortOrder, showCompleted);
        container.appendChild(sortControls);
        
        // Sort homework
        const sortedItems = sortHomework(course.homework, sortOrder);
        
        let visibleCount = 0;
        sortedItems.forEach(({ item, originalIndex }, displayIndex) => {
            // Filter out completed items if showCompleted is false
            if (!showCompleted && item.completed) return;
            visibleCount++;
            const hwItem = createHomeworkItem(item, originalIndex, course.id, openLinksIndex === originalIndex, displayIndex, sortedItems.length, sortOrder);
            container.appendChild(hwItem);
        });
        
        // Show message if all items are filtered out
        if (visibleCount === 0 && course.homework.length > 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'hw-empty-msg';
            emptyMsg.textContent = 'All assignments are done! Enable "Show Done" to see them.';
            container.appendChild(emptyMsg);
        }
    }
}

/**
 * Creates sort controls for homework list.
 * @param {string} courseId - Course ID
 * @param {string} currentOrder - Current sort order
 * @param {boolean} showCompleted - Whether to show completed items
 * @returns {HTMLElement} Sort controls element
 */
function createHomeworkSortControls(courseId, currentOrder, showCompleted) {
    const div = document.createElement('div');
    div.className = 'list-sort-controls';
    div.innerHTML = `
        <span class="sort-label">Sort:</span>
        <select class="sort-select" onchange="setHomeworkSortOrder('${courseId}', this.value)">
            <option value="${SORT_ORDERS.homework.DATE_ASC}" ${currentOrder === SORT_ORDERS.homework.DATE_ASC ? 'selected' : ''}>Date (Earliest)</option>
            <option value="${SORT_ORDERS.homework.DATE_DESC}" ${currentOrder === SORT_ORDERS.homework.DATE_DESC ? 'selected' : ''}>Date (Latest)</option>
            <option value="${SORT_ORDERS.homework.INCOMPLETE_FIRST}" ${currentOrder === SORT_ORDERS.homework.INCOMPLETE_FIRST ? 'selected' : ''}>Incomplete First</option>
            <option value="${SORT_ORDERS.homework.COMPLETED_FIRST}" ${currentOrder === SORT_ORDERS.homework.COMPLETED_FIRST ? 'selected' : ''}>Completed First</option>
            <option value="${SORT_ORDERS.homework.NAME_ASC}" ${currentOrder === SORT_ORDERS.homework.NAME_ASC ? 'selected' : ''}>Name (A-Z)</option>
            <option value="${SORT_ORDERS.homework.MANUAL}" ${currentOrder === SORT_ORDERS.homework.MANUAL ? 'selected' : ''}>Manual</option>
        </select>
        <label class="recordings-show-watched-toggle" style="margin-top: 0;">
            <input type="checkbox" id="show-completed-hw-toggle" ${showCompleted ? 'checked' : ''} onchange="toggleShowCompletedHomework('${courseId}')">
            <span>Show Done</span>
        </label>
    `;
    return div;
}

/**
 * Creates a homework list item element.
 * @param {Object} hw - Homework object
 * @param {number} index - Item index (original index in array)
 * @param {string} courseId - Course ID
 * @param {boolean} isOpen - Whether edit section is open
 * @param {number} displayIndex - Display position in sorted list
 * @param {number} totalItems - Total number of items
 * @param {string} sortOrder - Current sort order
 * @returns {HTMLElement} Homework item element
 */
function createHomeworkItem(hw, index, courseId, isOpen, displayIndex = 0, totalItems = 1, sortOrder = 'manual') {
    const item = document.createElement('li');
    item.className = `homework-item ${hw.completed ? 'completed' : ''}`;
    
    const links = hw.links || [];
    const linksDisplayHtml = buildLinksDisplay(links);
    const linksEditHtml = buildLinksEdit(links, index, courseId);
    
    // Show reorder buttons only in manual mode
    const isManualSort = sortOrder === SORT_ORDERS.homework.MANUAL;
    const reorderButtonsHtml = isManualSort ? `
        <div class="item-reorder-buttons hw-reorder-buttons">
            <button class="reorder-btn" onclick="event.stopPropagation(); moveHomework('${courseId}', ${index}, 'up')" ${displayIndex === 0 ? 'disabled' : ''} title="Move up">▲</button>
            <button class="reorder-btn" onclick="event.stopPropagation(); moveHomework('${courseId}', ${index}, 'down')" ${displayIndex === totalItems - 1 ? 'disabled' : ''} title="Move down">▼</button>
        </div>
    ` : '';
    
    item.innerHTML = `
        <div class="hw-main-row">
            ${reorderButtonsHtml}
            <input type="checkbox" class="hw-checkbox" ${hw.completed ? 'checked' : ''} onchange="toggleHomeworkStatus('${courseId}', ${index})">
            <div class="hw-title-row">
                <span class="hw-title">${escapeHtml(hw.title)}</span>
                ${hw.dueDate ? `<span class="hw-due-date">Due: ${escapeHtml(hw.dueDate)}</span>` : '<span class="hw-due-date hw-no-date">No date</span>'}
            </div>
            <div class="hw-actions">
                <button class="hw-action-btn" onclick="toggleHomeworkEdit('${courseId}', ${index})">Edit</button>
                <button class="hw-action-btn hw-action-btn-danger" onclick="deleteHomework('${courseId}', ${index})">Delete</button>
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
            <div class="hw-edit-row">
                <label class="hw-edit-label">Links:</label>
            </div>
            <div id="hw-edit-links-container-${index}">${linksEditHtml}</div>
            <div class="hw-add-link-row">
                <input type="text" id="hw-link-url-${index}" placeholder="Paste URL..." class="hw-link-input">
                <input type="text" id="hw-link-label-${index}" placeholder="Label (auto)" class="hw-link-input hw-link-label">
                <button class="hw-add-link-btn" onclick="addHomeworkLink('${courseId}', ${index})">Add</button>
            </div>
            <div class="hw-edit-actions">
                <button class="hw-edit-save-btn" onclick="saveHomeworkEdit('${courseId}', ${index})">Save</button>
                <button class="hw-edit-cancel-btn" onclick="cancelHomeworkEdit('${courseId}', ${index})">Cancel</button>
            </div>
        </div>
        <textarea class="hw-notes" placeholder="Add notes..." onchange="updateHomeworkNotes('${courseId}', ${index}, this.value)">${escapeHtml(hw.notes || '')}</textarea>
    `;
    
    return item;
}

/**
 * Builds links display HTML.
 * @param {Array} links - Array of link objects
 * @returns {string} HTML string
 */
function buildLinksDisplay(links) {
    if (links.length === 0) return '';
    
    return '<div class="hw-links-display">' + 
        links.map(link => 
            `<a href="${escapeHtml(link.url)}" target="_blank" class="hw-link-chip">${escapeHtml(link.label)}</a>`
        ).join('') + 
        '</div>';
}

/**
 * Builds links edit HTML.
 * @param {Array} links - Array of link objects
 * @param {number} hwIndex - Homework index
 * @param {string} courseId - Course ID
 * @returns {string} HTML string
 */
function buildLinksEdit(links, hwIndex, courseId) {
    if (links.length === 0) return '';
    
    return '<div class="hw-links-edit">' + 
        links.map((link, linkIdx) => 
            `<div class="hw-link-edit-row" id="hw-link-row-${hwIndex}-${linkIdx}">
                <span class="hw-link-edit-label">${escapeHtml(link.label)}</span>
                <span class="hw-link-edit-url">${escapeHtml(link.url)}</span>
                <button class="hw-link-edit-btn" onclick="startEditHomeworkLink('${courseId}', ${hwIndex}, ${linkIdx})">&#9998;</button>
                <button class="hw-link-remove-btn" onclick="removeHomeworkLink('${courseId}', ${hwIndex}, ${linkIdx})">&times;</button>
            </div>`
        ).join('') + 
        '</div>';
}

// ============================================================================
// SCHEDULE RENDERING
// ============================================================================

/**
 * Renders the schedule list in the course modal.
 */
function renderScheduleList() {
    const container = $('schedule-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    window.tempSchedule.forEach((item, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; gap: 10px; font-size: 13px; margin-bottom: 4px;';
        div.innerHTML = `
            <span>${DAY_NAMES_SHORT[item.day]} ${item.start}-${item.end}</span>
            <button onclick="removeScheduleItem(${index})" style="border:none; background:none; color:var(--error-border); cursor:pointer;">&times;</button>
        `;
        container.appendChild(div);
    });
}

// ============================================================================
// CALENDAR RENDERING
// ============================================================================

/**
 * Renders the weekly calendar grid with courses, homework and exams.
 * Handles calendar settings from semester or defaults.
 */
function renderCalendar() {
    const grid = $('weekly-schedule');
    if (!grid) return;
    
    grid.innerHTML = '';

    const semester = getCurrentSemester();
    const calendarSettings = getCalendarSettings(semester);
    const { startHour, endHour } = calendarSettings;
    
    // Use temp filter if active, otherwise use settings
    const visibleDays = window.tempCalendarDayFilter || calendarSettings.visibleDays;
    const allDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Collect week events first to determine if we need the events row
    const weekEvents = semester ? collectWeekEvents(semester, visibleDays) : {};
    const hasEvents = Object.keys(weekEvents).length > 0;

    // Update Grid Columns
    grid.style.gridTemplateColumns = `40px repeat(${visibleDays.length}, 1fr)`;

    let html = '';

    // Headers
    html += `<div class="schedule-header"></div>`; // Corner
    visibleDays.forEach(dIndex => {
        html += `<div class="schedule-header">${allDays[dIndex]}</div>`;
    });

    // All-day events row (only if there are events this week)
    if (hasEvents) {
        html += `<div class="schedule-events-label">Events</div>`;
        visibleDays.forEach(dIndex => {
            html += `<div class="schedule-events-cell" data-day="${dIndex}"></div>`;
        });
    }

    // Time Rows
    for (let h = startHour; h <= endHour; h++) {
        // Time Label
        html += `<div class="schedule-time-col">${h}:00</div>`;
        // Day Cells
        visibleDays.forEach(dIndex => {
            html += `<div class="schedule-cell" data-day="${dIndex}" data-hour="${h}"></div>`;
        });
    }
    
    grid.innerHTML = html;

    // Place Courses (only if semester exists)
    if (semester) {
        semester.courses.forEach(course => {
        if (course.schedule) {
            course.schedule.forEach(slot => {
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
                    block.title = `${course.name}\n${slot.start} - ${slot.end}\n${course.location || ''}`;
                    block.onclick = () => openCourseModal(course.id);
                    if (course.color) {
                        block.style.backgroundColor = course.color;
                    }
                    
                    // Adjust height based on duration
                    // 1 hour = 30px (min-height of cell)
                    const durationHours = (endH + endM/60) - (startH + startM/60);
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

        // Place homework and exams for the current week in the events row
        if (hasEvents) {
            renderWeekEvents(grid, weekEvents);
        }
    }
    renderCurrentTime();
}

/**
 * Gets calendar settings from semester or UI defaults.
 * @param {Object|null} semester - Current semester object
 * @returns {Object} Calendar settings with startHour, endHour, visibleDays
 */
function getCalendarSettings(semester) {
    if (semester) {
        if (!semester.calendarSettings) {
            semester.calendarSettings = { ...DEFAULT_CALENDAR_SETTINGS };
        }
        return semester.calendarSettings;
    }
    
    // Read from UI settings (with fallback to defaults)
    const startHourEl = $('cal-start-hour');
    const endHourEl = $('cal-end-hour');
    const daysContainer = $('cal-days-container');
    const days = daysContainer 
        ? [...daysContainer.querySelectorAll('input:checked')].map(cb => parseInt(cb.value))
        : DEFAULT_CALENDAR_SETTINGS.visibleDays;
    
    return {
        startHour: startHourEl?.value ? parseInt(startHourEl.value) : DEFAULT_CALENDAR_SETTINGS.startHour,
        endHour: endHourEl?.value ? parseInt(endHourEl.value) : DEFAULT_CALENDAR_SETTINGS.endHour,
        visibleDays: days.length > 0 ? days : DEFAULT_CALENDAR_SETTINGS.visibleDays
    };
}

/**
 * Collects homework and exams that fall within the current week.
 * @param {Object} semester - Semester object
 * @param {number[]} visibleDays - Array of visible day indices
 * @returns {Object} Events grouped by day number
 */
function collectWeekEvents(semester, visibleDays) {
    if (!semester) return {};

    const events = [];

    // Collect homework due this week
    semester.courses.forEach(course => {
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
                        completed: hw.completed
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
                    color: course.color
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
                    color: course.color
                });
            }
        }
    });

    // Group events by day (only for visible days)
    const eventsByDay = {};
    events.forEach(event => {
        if (!visibleDays.includes(event.day)) return;
        if (!eventsByDay[event.day]) eventsByDay[event.day] = [];
        eventsByDay[event.day].push(event);
    });

    return eventsByDay;
}

/**
 * Renders week events (homework/exams) in the dedicated events row.
 * @param {HTMLElement} grid - Calendar grid element
 * @param {Object} eventsByDay - Events grouped by day number
 */
function renderWeekEvents(grid, eventsByDay) {
    Object.keys(eventsByDay).forEach(day => {
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
            if (event.type === 'homework') {
                chip.dataset.homeworkIndex = event.hwIndex;
            } else if (event.type === 'exam') {
                chip.dataset.examType = event.examType; // 'moedA' or 'moedB'
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
            
            // Click handler - navigate to specific event
            chip.onclick = (e) => {
                e.stopPropagation();
                handleCalendarEventClick(event.courseId, event.type, event.hwIndex, event.examType);
            };
            
            cell.appendChild(chip);
        });
    });
}

// ============================================================================
// CURRENT TIME INDICATOR
// ============================================================================

/**
 * Renders the current time indicator line on the calendar.
 * Shows a red line at the current time position if the day/hour is visible.
 */
function renderCurrentTime() {
    // Remove old lines
    document.querySelectorAll('.current-time-line').forEach(el => el.remove());

    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const min = now.getMinutes();

    const semester = getCurrentSemester();
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

/**
 * Renders the homework sidebar with all homework items from the current semester.
 * Items are sorted by completion status, then by due date.
 */
function renderHomeworkSidebar() {
    const container = $('homework-sidebar-list');
    if (!container) return;
    
    container.innerHTML = '';

    const showCompleted = appData.settings.showCompleted !== false;
    const toggle = $('show-completed-toggle');
    if (toggle) toggle.checked = showCompleted;

    const semester = getCurrentSemester();
    if (!semester) {
        container.innerHTML = '<div style="color:var(--text-tertiary); font-style:italic;">No active semester.</div>';
        return;
    }

    // Collect and flatten homework from all courses
    const homeworks = semester.courses.flatMap(c => 
        (c.homework || []).map((h, index) => ({
            ...h,
            course: c.name,
            courseId: c.id,
            index,
            color: c.color || 'hsl(0, 45%, 50%)',
            dateObj: h.dueDate ? new Date(h.dueDate) : null
        }))
    ).filter(h => showCompleted || !h.completed);

    // Sort by completion status first (incomplete first), then by date
    homeworks.sort((a, b) => {
        // Completed items go after incomplete ones
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        // Then sort by date
        if (!a.dateObj) return 1;
        if (!b.dateObj) return -1;
        return a.dateObj - b.dateObj;
    });

    if (homeworks.length === 0) {
        container.innerHTML = '<div style="color:var(--text-tertiary); font-style:italic;">No homework found.</div>';
        return;
    }

    const dateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    homeworks.forEach(h => {
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
            const diffTime = dueDate - today;
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
        
        const hasNotes = h.notes && h.notes.trim();
        const notesIndicator = hasNotes ? `<span class="hw-indicators">has notes</span>` : '';
        
        // Build links chips for sidebar
        const links = h.links || [];
        let linksHtml = '';
        if (links.length > 0) {
            if (links.length <= 3) {
                // Show all links if 3 or fewer
                linksHtml = '<div class="sidebar-hw-links">' + 
                    links.map((link) => 
                        `<a href="${escapeHtml(link.url)}" target="_blank" class="sidebar-hw-link" onclick="event.stopPropagation()">${escapeHtml(link.label)}</a>`
                    ).join('') + 
                    '</div>';
            } else {
                // Show first 2 links + "more" indicator
                const displayLinks = links.slice(0, 2);
                const remainingCount = links.length - 2;
                linksHtml = '<div class="sidebar-hw-links">' + 
                    displayLinks.map((link) => 
                        `<a href="${escapeHtml(link.url)}" target="_blank" class="sidebar-hw-link" onclick="event.stopPropagation()">${escapeHtml(link.label)}</a>`
                    ).join('') + 
                    `<span class="sidebar-hw-more">+${remainingCount} more</span>` +
                    '</div>';
            }
        }
        
        div.innerHTML = `
            <div class="sidebar-hw-row">
                <input type="checkbox" class="sidebar-hw-checkbox" 
                    ${h.completed ? 'checked' : ''} 
                    onclick="event.stopPropagation()" 
                    onchange="toggleHomeworkStatus('${h.courseId}', ${h.index})">
                <div class="sidebar-hw-content" style="${h.completed ? 'text-decoration: line-through;' : ''}">
                    <div class="event-date">${escapeHtml(dateStr)} ${daysLeftStr}</div>
                    <div class="event-title">${escapeHtml(h.title)}${notesIndicator}</div>
                    <div class="event-course">${escapeHtml(h.course)}</div>
                </div>
                ${linksHtml}
            </div>
        `;
        
        div.onclick = () => openHomeworkFromSidebar(h.courseId, h.index);
        
        container.appendChild(div);
    });
}

// ============================================================================
// PROFILE UI
// ============================================================================

/**
 * Renders the profile select dropdown with all available profiles.
 */
function renderProfileUI() {
    const select = $('profile-select');
    if (!select) return;
    
    select.innerHTML = '';
    profiles.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        if (p.id === activeProfileId) option.selected = true;
        select.appendChild(option);
    });
}
