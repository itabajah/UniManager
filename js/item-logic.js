/**
 * @file item-logic.js
 * @description Logic for managing recordings, homework, and schedule items
 */

// ============================================================================
// TEMP EDIT STATE
// ============================================================================

/** @type {Array|null} Temporary storage for homework links during editing */
let tempEditLinks = null;

/** @type {number|null} Index of homework being edited */
let tempEditHwIndex = null;

/** @type {string|null} Course ID of homework being edited */
let tempEditCourseId = null;

/** @type {number|null} Index of currently open video preview */
let currentPreviewIndex = null;

// ============================================================================
// VIDEO PREVIEW
// ============================================================================

/**
 * Toggles inline video preview for a recording.
 * @param {number} index - Recording index
 * @param {string} embedUrl - URL for the iframe embed
 */
function toggleVideoPreview(index, embedUrl) {
    const container = $(`recording-preview-${index}`);
    if (!container) return;
    
    // If clicking on the same video that's already open, close it
    if (currentPreviewIndex === index && !container.classList.contains('hidden')) {
        closeVideoPreview(index);
        return;
    }
    
    // Close any other open preview
    if (currentPreviewIndex !== null && currentPreviewIndex !== index) {
        closeVideoPreview(currentPreviewIndex);
    }
    
    // Open this preview
    container.innerHTML = `
        <div class="recording-preview-header">
            <span>Video Preview</span>
            <button class="recording-preview-close" onclick="closeVideoPreview(${index})" title="Close preview">×</button>
        </div>
        <iframe 
            src="${embedUrl}" 
            title="Video player"
            class="recording-preview-iframe"
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
        ></iframe>
    `;
    container.classList.remove('hidden');
    currentPreviewIndex = index;
    
    // Scroll the preview into view
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Closes an open video preview.
 * @param {number} index - Recording index
 */
function closeVideoPreview(index) {
    const container = $(`recording-preview-${index}`);
    if (container) {
        container.classList.add('hidden');
        container.innerHTML = '';
    }
    if (currentPreviewIndex === index) {
        currentPreviewIndex = null;
    }
}

// ============================================================================
// RECORDING TAB HELPERS
// ============================================================================

/**
 * Gets a recording tab from a course.
 * @param {Object} course - Course object
 * @param {string} tabId - Tab ID to find
 * @returns {Object|null} Tab object or null
 */
function getRecordingTab(course, tabId) {
    if (!course.recordings?.tabs) return null;
    return course.recordings.tabs.find(t => t.id === tabId);
}

// ============================================================================
// RECORDING CRUD
// ============================================================================

/**
 * Adds a new recording from the input field.
 */
function addRecording() {
    if (!editingCourseId) return;
    
    const input = $('new-recording-link');
    const link = input.value.trim();
    if (!link) return;

    const course = getCourse(editingCourseId);
    if (!course) return;
    
    const tab = getRecordingTab(course, window.currentRecordingsTab);
    if (!tab) return;
    
    const count = tab.items.length + 1;
    const defaultName = generateRecordingName(link, tab.name, count);
    
    tab.items.push({ 
        name: defaultName, 
        videoLink: link, 
        slideLink: '',
        watched: false
    });

    input.value = '';
    saveData();
    renderRecordingsTabs(course);
    renderRecordingsList(course);
    renderCourses(); // Update course card progress
}

/**
 * Generates a default name for a recording based on link type.
 * @param {string} link - Video link URL
 * @param {string} tabName - Name of the tab
 * @param {number} count - Recording count
 * @returns {string} Generated name
 */
function generateRecordingName(link, tabName, count) {
    if (link.includes('youtube.com') || link.includes('youtu.be')) {
        return `Video ${count}`;
    } else if (link.includes('panopto')) {
        return `Recording ${count}`;
    }
    return `${tabName.replace(/s$/, '')} ${count}`;
}

/**
 * Switches to a different recordings tab.
 * @param {string} courseId - Course ID
 * @param {string} tabId - Tab ID to switch to
 */
function switchRecordingsTab(courseId, tabId) {
    window.currentRecordingsTab = tabId;
    window.tempRecordingEdit = null;
    
    const course = getCourse(courseId);
    if (!course) return;
    
    renderRecordingsTabs(course);
    renderRecordingsList(course);
    
    // Update tab action button visibility
    const isDefaultTab = tabId === 'lectures' || tabId === 'tutorials';
    const deleteBtn = $('delete-tab-btn');
    const clearBtn = $('clear-tab-btn');
    
    if (deleteBtn) deleteBtn.style.display = isDefaultTab ? 'none' : 'inline-block';
    if (clearBtn) clearBtn.style.display = 'inline-block';
}

/**
 * Toggles the watched status of a recording.
 * @param {string} courseId - Course ID
 * @param {string} tabId - Tab ID
 * @param {number} index - Recording index
 */
function toggleRecordingStatus(courseId, tabId, index) {
    const course = getCourse(courseId);
    if (!course) return;
    
    const tab = getRecordingTab(course, tabId);
    if (!tab?.items[index]) return;
    
    tab.items[index].watched = !tab.items[index].watched;
    saveData();
    renderRecordingsList(course);
    renderCourses(); // Update course card progress
}



/**
 * Deletes a recording after confirmation.
 * @param {string} courseId - Course ID
 * @param {string} tabId - Tab ID
 * @param {number} index - Recording index
 */
async function deleteRecording(courseId, tabId, index) {
    const course = getCourse(courseId);
    if (!course) return;
    
    const tab = getRecordingTab(course, tabId);
    if (!tab?.items[index]) return;
    
    const recordingName = tab.items[index].name || 'this recording';
    
    const confirmed = await showConfirmDialog(
        `Delete "${recordingName}"?`,
        {
            title: 'Delete Recording',
            confirmText: 'Delete',
            dangerous: true
        }
    );
    
    if (!confirmed) return;
    
    tab.items.splice(index, 1);
    saveData();
    renderRecordingsTabs(course);
    renderRecordingsList(course);
    ToastManager.success('Recording deleted');
}

/**
 * Toggles the edit section for a recording.
 * @param {string} courseId - Course ID
 * @param {string} tabId - Tab ID
 * @param {number} index - Recording index
 */
function toggleRecordingEdit(courseId, tabId, index) {
    const section = $(`recording-edit-section-${index}`);
    if (!section) return;
    
    const course = getCourse(courseId);
    if (!course) return;
    
    const isHidden = section.classList.contains('hidden');
    
    // Close all other edit sections first
    document.querySelectorAll('.recording-edit-section').forEach(s => {
        s.classList.add('hidden');
    });
    
    if (isHidden) {
        section.classList.remove('hidden');
        const nameInput = $(`recording-edit-name-${index}`);
        if (nameInput) nameInput.focus();
    }
}

/**
 * Saves edits to a recording.
 * @param {string} courseId - Course ID
 * @param {string} tabId - Tab ID
 * @param {number} index - Recording index
 */
function saveRecordingEdit(courseId, tabId, index) {
    const course = getCourse(courseId);
    if (!course) return;
    
    const tab = getRecordingTab(course, tabId);
    if (!tab?.items[index]) return;
    
    const nameInput = $(`recording-edit-name-${index}`);
    const videoInput = $(`recording-edit-video-${index}`);
    const slidesInput = $(`recording-edit-slides-${index}`);
    
    tab.items[index].name = nameInput.value.trim();
    tab.items[index].videoLink = videoInput.value.trim();
    tab.items[index].slideLink = slidesInput.value.trim();
    
    saveData();
    renderRecordingsList(course);
    renderCourses(); // Update course card
}

/**
 * Cancels recording edit and re-renders the list.
 * @param {string} courseId - Course ID
 */
function cancelRecordingEdit(courseId) {
    const course = getCourse(courseId);
    if (!course) return;
    
    renderRecordingsList(course);
}

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

/**
 * Adds a new custom recordings tab.
 */
async function addRecordingsTab() {
    if (!editingCourseId) return;
    
    const name = await showPromptDialog('Enter tab name:', 'Custom', {
        title: 'Add Tab',
        placeholder: 'Tab name',
        required: true,
        validate: (value) => {
            const result = validateString(value, { required: true, maxLength: 50 });
            return result.valid ? true : result.error;
        }
    });
    
    if (!name) return;
    
    const course = getCourse(editingCourseId);
    if (!course) return;
    
    const tabId = `custom_${generateId()}`;
    course.recordings.tabs.push({
        id: tabId,
        name: name.trim(),
        items: []
    });
    
    window.currentRecordingsTab = tabId;
    saveData();
    renderRecordingsTabs(course);
    renderRecordingsList(course);
    ToastManager.success(`Tab "${name.trim()}" created`);
    
    const deleteBtn = $('delete-tab-btn');
    if (deleteBtn) deleteBtn.style.display = 'inline-block';
}

/**
 * Renames the current recordings tab.
 */
async function renameRecordingsTab() {
    if (!editingCourseId) return;
    
    const course = getCourse(editingCourseId);
    if (!course) return;
    
    const tab = getRecordingTab(course, window.currentRecordingsTab);
    if (!tab) return;
    
    const newName = await showPromptDialog('Rename tab:', tab.name, {
        title: 'Rename Tab',
        placeholder: 'Tab name',
        required: true,
        validate: (value) => {
            const result = validateString(value, { required: true, maxLength: 50 });
            return result.valid ? true : result.error;
        }
    });
    
    if (!newName) return;
    
    tab.name = newName.trim();
    saveData();
    renderRecordingsTabs(course);
    ToastManager.success(`Tab renamed to "${newName.trim()}"`);
}

/**
 * Deletes the current recordings tab (custom tabs only).
 */
async function deleteRecordingsTab() {
    if (!editingCourseId) return;
    
    if (window.currentRecordingsTab === 'lectures' || window.currentRecordingsTab === 'tutorials') {
        await showAlertDialog('Cannot delete default tabs.', {
            title: 'Cannot Delete',
            type: 'warning'
        });
        return;
    }
    
    const course = getCourse(editingCourseId);
    if (!course) return;
    
    const tab = getRecordingTab(course, window.currentRecordingsTab);
    if (!tab) return;
    
    let confirmed = true;
    if (tab.items.length > 0) {
        confirmed = await showConfirmDialog(
            `Delete "${tab.name}" tab and all ${tab.items.length} recordings in it?`,
            {
                title: 'Delete Tab',
                confirmText: 'Delete',
                dangerous: true
            }
        );
    }
    
    if (!confirmed) return;
    
    course.recordings.tabs = course.recordings.tabs.filter(t => t.id !== window.currentRecordingsTab);
    window.currentRecordingsTab = 'lectures';
    
    saveData();
    renderRecordingsTabs(course);
    renderRecordingsList(course);
    renderCourses(); // Update course card progress
    ToastManager.success(`Tab "${tab.name}" deleted`);
    
    const deleteBtn = $('delete-tab-btn');
    if (deleteBtn) deleteBtn.style.display = 'none';
}

/**
 * Clears all recordings from the current tab.
 */
async function clearRecordingsTab() {
    if (!editingCourseId) return;
    
    const course = getCourse(editingCourseId);
    if (!course) return;
    
    const tab = getRecordingTab(course, window.currentRecordingsTab);
    if (!tab) return;
    
    if (tab.items.length === 0) {
        ToastManager.info('This tab is already empty');
        return;
    }
    
    const confirmed = await showConfirmDialog(
        `Clear all ${tab.items.length} recordings from "${tab.name}"?`,
        {
            title: 'Clear Tab',
            description: 'This will remove all recordings from this tab. This action cannot be undone.',
            confirmText: 'Clear All',
            dangerous: true
        }
    );
    
    if (!confirmed) return;
    
    tab.items = [];
    saveData();
    renderRecordingsList(course);
    renderCourses(); // Update course card progress
    ToastManager.success(`Cleared all recordings from "${tab.name}"`);
}

// ============================================================================
// HOMEWORK CRUD
// ============================================================================

/**
 * Adds a new homework item.
 */
function addHomework() {
    if (!editingCourseId) return;
    
    const nameInput = $('new-homework-name-modal');
    const dateInput = $('new-homework-date-modal');
    
    const title = nameInput.value.trim();
    const dueDate = dateInput.value;
    
    if (!title) return;

    const course = getCourse(editingCourseId);
    if (!course) return;
    
    if (!course.homework) course.homework = [];
    course.homework.push({ title, dueDate, completed: false, notes: '', links: [] });

    nameInput.value = '';
    dateInput.value = '';
    
    saveData();
    renderHomeworkList(course);
    renderHomeworkSidebar();
    renderCalendar();
    renderCourses(); // Update course card progress
}

/**
 * Toggles homework completion status.
 * @param {string} courseId - Course ID
 * @param {number} hwIndex - Homework index
 */
function toggleHomeworkStatus(courseId, hwIndex) {
    const course = getCourse(courseId);
    if (!course) return;
    
    course.homework[hwIndex].completed = !course.homework[hwIndex].completed;
    saveData();
    
    // Update modal if open on homework tab
    const homeworkTab = document.querySelector('#tab-homework');
    if ($('course-modal').classList.contains('active') && homeworkTab?.classList.contains('active') && editingCourseId === courseId) {
        renderHomeworkList(course);
    }
    renderHomeworkSidebar();
    renderCalendar();
    renderCourses(); // Update course card progress
}

/**
 * Deletes a homework item after confirmation.
 * @param {string} courseId - Course ID
 * @param {number} hwIndex - Homework index
 */
async function deleteHomework(courseId, hwIndex) {
    const course = getCourse(courseId);
    if (!course?.homework?.[hwIndex]) return;
    
    const hwTitle = course.homework[hwIndex].title || 'this assignment';
    
    const confirmed = await showConfirmDialog(
        `Delete "${hwTitle}"?`,
        {
            title: 'Delete Assignment',
            confirmText: 'Delete',
            dangerous: true
        }
    );
    
    if (!confirmed) return;
    
    course.homework.splice(hwIndex, 1);
    saveData();
    renderHomeworkList(course);
    renderHomeworkSidebar();
    renderCalendar();
    renderCourses(); // Update course card progress
    ToastManager.success('Assignment deleted');
}

/**
 * Updates homework notes.
 * @param {string} courseId - Course ID
 * @param {number} hwIndex - Homework index
 * @param {string} notes - New notes content
 */
function updateHomeworkNotes(courseId, hwIndex, notes) {
    const course = getCourse(courseId);
    if (!course) return;
    
    course.homework[hwIndex].notes = notes;
    saveData();
    renderHomeworkSidebar();
}

// ============================================================================
// HOMEWORK LINKS
// ============================================================================

/**
 * Adds a link to a homework item.
 * @param {string} courseId - Course ID
 * @param {number} hwIndex - Homework index
 */
function addHomeworkLink(courseId, hwIndex) {
    if (tempEditLinks === null) return;
    
    const urlInput = $(`hw-link-url-${hwIndex}`);
    const labelInput = $(`hw-link-label-${hwIndex}`);
    
    const url = urlInput?.value?.trim();
    if (!url) return;
    
    // Find next available link number
    const existingNumbers = tempEditLinks
        .map(link => {
            const match = link.label.match(/^Link (\d+)$/);
            return match ? parseInt(match[1]) : 0;
        });
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    
    const label = labelInput?.value?.trim() || `Link ${maxNumber + 1}`;
    
    tempEditLinks.push({ url, label });
    
    urlInput.value = '';
    labelInput.value = '';
    
    renderEditLinksSection(courseId, hwIndex);
}

/**
 * Removes a link from a homework item.
 * @param {string} courseId - Course ID
 * @param {number} hwIndex - Homework index
 * @param {number} linkIndex - Link index
 */
function removeHomeworkLink(courseId, hwIndex, linkIndex) {
    if (tempEditLinks === null) return;
    
    tempEditLinks.splice(linkIndex, 1);
    renderEditLinksSection(courseId, hwIndex);
}

/**
 * Starts inline editing of a homework link.
 * @param {string} courseId - Course ID
 * @param {number} hwIndex - Homework index
 * @param {number} linkIndex - Link index
 */
function startEditHomeworkLink(courseId, hwIndex, linkIndex) {
    if (tempEditLinks === null) return;
    
    const link = tempEditLinks[linkIndex];
    const row = $(`hw-link-row-${hwIndex}-${linkIndex}`);
    if (!row) return;
    
    row.innerHTML = `
        <input type="text" class="hw-link-edit-input hw-link-edit-label-input" value="${escapeHtml(link.label)}" placeholder="Label">
        <input type="text" class="hw-link-edit-input hw-link-edit-url-input" value="${escapeHtml(link.url)}" placeholder="URL">
        <button class="hw-link-save-btn" onclick="saveEditHomeworkLink('${courseId}', ${hwIndex}, ${linkIndex})">&#10003;</button>
        <button class="hw-link-cancel-btn" onclick="renderEditLinksSection('${courseId}', ${hwIndex})">&times;</button>
    `;
    
    row.querySelector('.hw-link-edit-label-input').focus();
}

/**
 * Saves inline edits to a homework link.
 * @param {string} courseId - Course ID
 * @param {number} hwIndex - Homework index
 * @param {number} linkIndex - Link index
 */
function saveEditHomeworkLink(courseId, hwIndex, linkIndex) {
    if (tempEditLinks === null) return;
    
    const row = $(`hw-link-row-${hwIndex}-${linkIndex}`);
    if (!row) return;
    
    const labelInput = row.querySelector('.hw-link-edit-label-input');
    const urlInput = row.querySelector('.hw-link-edit-url-input');
    
    tempEditLinks[linkIndex].label = labelInput.value.trim() || 'Link';
    tempEditLinks[linkIndex].url = urlInput.value.trim();
    
    renderEditLinksSection(courseId, hwIndex);
}

/**
 * Renders the links edit section for a homework item.
 * @param {string} courseId - Course ID
 * @param {number} hwIndex - Homework index
 */
function renderEditLinksSection(courseId, hwIndex) {
    const container = $(`hw-edit-links-container-${hwIndex}`);
    if (!container || tempEditLinks === null) return;
    
    if (tempEditLinks.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = '<div class="hw-links-edit">' + 
        tempEditLinks.map((link, linkIdx) => 
            `<div class="hw-link-edit-row" id="hw-link-row-${hwIndex}-${linkIdx}">
                <span class="hw-link-edit-label">${escapeHtml(link.label)}</span>
                <span class="hw-link-edit-url">${escapeHtml(link.url)}</span>
                <button class="hw-link-edit-btn" onclick="startEditHomeworkLink('${courseId}', ${hwIndex}, ${linkIdx})">&#9998;</button>
                <button class="hw-link-remove-btn" onclick="removeHomeworkLink('${courseId}', ${hwIndex}, ${linkIdx})">&times;</button>
            </div>`
        ).join('') + 
        '</div>';
}

/**
 * Cancels inline editing of a homework link.
 * @param {string} courseId - Course ID
 * @param {number} hwIndex - Homework index
 */
function cancelEditHomeworkLink(courseId, hwIndex) {
    renderEditLinksSection(courseId, hwIndex);
}

// ============================================================================
// HOMEWORK EDIT STATE
// ============================================================================

/**
 * Toggles the homework edit section.
 * @param {string} courseId - Course ID
 * @param {number} hwIndex - Homework index
 */
function toggleHomeworkEdit(courseId, hwIndex) {
    const section = $(`hw-edit-section-${hwIndex}`);
    if (!section) return;
    
    const isHidden = section.classList.contains('hidden');
    section.classList.toggle('hidden');
    
    if (isHidden) {
        // Opening edit - initialize temp state
        const course = getCourse(courseId);
        if (course?.homework[hwIndex]) {
            tempEditLinks = JSON.parse(JSON.stringify(course.homework[hwIndex].links || []));
            tempEditHwIndex = hwIndex;
            tempEditCourseId = courseId;
        }
    } else {
        // Closing edit - clear temp state
        clearTempEditState();
    }
}

/**
 * Cancels homework edit and discards changes.
 * @param {string} courseId - Course ID
 * @param {number} hwIndex - Homework index
 */
function cancelHomeworkEdit(courseId, hwIndex) {
    clearTempEditState();
    
    const course = getCourse(courseId);
    if (course) {
        renderHomeworkList(course);
    }
}

/**
 * Clears temporary edit state.
 */
function clearTempEditState() {
    tempEditLinks = null;
    tempEditHwIndex = null;
    tempEditCourseId = null;
}

/**
 * Saves homework edits.
 * @param {string} courseId - Course ID
 * @param {number} hwIndex - Homework index
 */
function saveHomeworkEdit(courseId, hwIndex) {
    const course = getCourse(courseId);
    if (!course) return;
    
    const titleInput = $(`hw-edit-title-${hwIndex}`);
    const dateInput = $(`hw-edit-date-${hwIndex}`);
    
    const newTitle = titleInput.value.trim();
    if (newTitle) {
        course.homework[hwIndex].title = newTitle;
    }
    course.homework[hwIndex].dueDate = dateInput.value;
    
    // Save links from temp state
    if (tempEditLinks !== null) {
        course.homework[hwIndex].links = tempEditLinks;
    }
    
    clearTempEditState();
    
    saveData();
    renderHomeworkList(course);
    renderHomeworkSidebar();
    renderCalendar();
}

/**
 * Opens homework modal from sidebar and scrolls to specific item.
 * @param {string} courseId - Course ID
 * @param {number} hwIndex - Homework index
 */
function openHomeworkFromSidebar(courseId, hwIndex) {
    openHomeworkModal(courseId);
    
    setTimeout(() => {
        const items = document.querySelectorAll('#homework-modal-list .homework-item');
        if (items[hwIndex]) {
            items[hwIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
            items[hwIndex].classList.add('hw-highlight');
            setTimeout(() => items[hwIndex].classList.remove('hw-highlight'), 1500);
        }
    }, 100);
}

// ============================================================================
// SORT FUNCTIONS
// ============================================================================

/**
 * Gets the sort order for recordings in a course.
 * @param {Object} course - Course object
 * @param {string} tabId - Tab ID
 * @returns {string} Sort order
 */
function getRecordingsSortOrder(course, tabId) {
    return course.recordingsSortOrder?.[tabId] || SORT_ORDERS.recordings.DEFAULT;
}

/**
 * Gets the sort order for homework in a course.
 * @param {Object} course - Course object
 * @returns {string} Sort order
 */
function getHomeworkSortOrder(course) {
    return course.homeworkSortOrder || SORT_ORDERS.homework.DATE_ASC;
}

/**
 * Sets the sort order for recordings and re-renders.
 * @param {string} courseId - Course ID
 * @param {string} tabId - Tab ID
 * @param {string} order - Sort order
 */
function setRecordingsSortOrder(courseId, tabId, order) {
    const course = getCourse(courseId);
    if (!course) return;
    
    if (!course.recordingsSortOrder) {
        course.recordingsSortOrder = {};
    }
    course.recordingsSortOrder[tabId] = order;
    
    saveData();
    renderRecordingsList(course);
}

/**
 * Sets the sort order for homework and re-renders.
 * @param {string} courseId - Course ID
 * @param {string} order - Sort order
 */
function setHomeworkSortOrder(courseId, order) {
    const course = getCourse(courseId);
    if (!course) return;
    
    course.homeworkSortOrder = order;
    
    saveData();
    renderHomeworkList(course);
}

/**
 * Toggles the show completed homework setting for a course.
 * @param {string} courseId - Course ID
 */
function toggleShowCompletedHomework(courseId) {
    const course = getCourse(courseId);
    if (!course) return;
    
    // Get current state: default is true (show completed)
    const currentlyShowing = course.showCompletedHomework !== false;
    
    // Toggle to opposite state
    if (currentlyShowing) {
        // Currently showing, so hide them
        course.showCompletedHomework = false;
    } else {
        // Currently hiding, so show them (delete to use default true)
        delete course.showCompletedHomework;
    }
    
    saveData();
    renderHomeworkList(course);
}

/**
 * Extracts numeric value from a string for natural sorting.
 * "Recording 12" -> 12, "Lecture 5" -> 5, "Video 100" -> 100
 * @param {string} str - String to extract number from
 * @returns {number} Extracted number or Infinity if no number found
 */
function extractNumber(str) {
    if (!str) return Infinity;
    // Match numbers in the string, prefer trailing numbers like "Recording 12"
    const matches = str.match(/(\d+)/g);
    if (matches && matches.length > 0) {
        // Use the last number found (e.g., "Lecture 12" -> 12)
        return parseInt(matches[matches.length - 1], 10);
    }
    return Infinity;
}

/**
 * Sorts recordings based on the selected order.
 * @param {Array} items - Recording items array
 * @param {string} order - Sort order
 * @returns {Array} Sorted items with original indices
 */
function sortRecordings(items, order) {
    if (!Array.isArray(items)) return [];
    
    // Create array with original indices
    const indexed = items.map((item, idx) => ({ item, originalIndex: idx }));
    
    switch (order) {
        case SORT_ORDERS.recordings.DEFAULT:
            // Natural numeric sort: "Recording 5" comes before "Recording 12"
            indexed.sort((a, b) => {
                const numA = extractNumber(a.item.name);
                const numB = extractNumber(b.item.name);
                if (numA !== numB) return numA - numB;
                // If numbers are equal or both have no numbers, sort alphabetically
                return (a.item.name || '').localeCompare(b.item.name || '');
            });
            break;
        case SORT_ORDERS.recordings.NAME_ASC:
            indexed.sort((a, b) => (a.item.name || '').localeCompare(b.item.name || ''));
            break;
        case SORT_ORDERS.recordings.NAME_DESC:
            indexed.sort((a, b) => (b.item.name || '').localeCompare(a.item.name || ''));
            break;
        case SORT_ORDERS.recordings.WATCHED_FIRST:
            indexed.sort((a, b) => {
                if (a.item.watched !== b.item.watched) return a.item.watched ? -1 : 1;
                return a.originalIndex - b.originalIndex;
            });
            break;
        case SORT_ORDERS.recordings.UNWATCHED_FIRST:
            indexed.sort((a, b) => {
                if (a.item.watched !== b.item.watched) return a.item.watched ? 1 : -1;
                return a.originalIndex - b.originalIndex;
            });
            break;
        default: // MANUAL - keep original order
            break;
    }
    
    return indexed;
}

/**
 * Sorts homework based on the selected order.
 * @param {Array} items - Homework items array
 * @param {string} order - Sort order
 * @returns {Array} Sorted items with original indices
 */
function sortHomework(items, order) {
    if (!Array.isArray(items)) return [];
    
    // Create array with original indices
    const indexed = items.map((item, idx) => ({ item, originalIndex: idx }));
    
    switch (order) {
        case SORT_ORDERS.homework.DATE_ASC:
            indexed.sort((a, b) => {
                if (!a.item.dueDate && !b.item.dueDate) return a.originalIndex - b.originalIndex;
                if (!a.item.dueDate) return 1;
                if (!b.item.dueDate) return -1;
                return new Date(a.item.dueDate) - new Date(b.item.dueDate);
            });
            break;
        case SORT_ORDERS.homework.DATE_DESC:
            indexed.sort((a, b) => {
                if (!a.item.dueDate && !b.item.dueDate) return a.originalIndex - b.originalIndex;
                if (!a.item.dueDate) return 1;
                if (!b.item.dueDate) return -1;
                return new Date(b.item.dueDate) - new Date(a.item.dueDate);
            });
            break;
        case SORT_ORDERS.homework.COMPLETED_FIRST:
            indexed.sort((a, b) => {
                if (a.item.completed !== b.item.completed) return a.item.completed ? -1 : 1;
                return a.originalIndex - b.originalIndex;
            });
            break;
        case SORT_ORDERS.homework.INCOMPLETE_FIRST:
            indexed.sort((a, b) => {
                if (a.item.completed !== b.item.completed) return a.item.completed ? 1 : -1;
                return a.originalIndex - b.originalIndex;
            });
            break;
        case SORT_ORDERS.homework.NAME_ASC:
            indexed.sort((a, b) => (a.item.title || '').localeCompare(b.item.title || ''));
            break;
        default: // MANUAL - keep original order
            break;
    }
    
    return indexed;
}

/**
 * Moves a recording item up or down in the list.
 * @param {string} courseId - Course ID
 * @param {string} tabId - Tab ID  
 * @param {number} index - Current index
 * @param {string} direction - 'up' or 'down'
 */
function moveRecording(courseId, tabId, index, direction) {
    const course = getCourse(courseId);
    if (!course) return;
    
    const tab = getRecordingTab(course, tabId);
    if (!tab?.items) return;
    
    const items = tab.items;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= items.length) return;
    
    // Swap items
    [items[index], items[newIndex]] = [items[newIndex], items[index]];
    
    // Set to manual sort order since user is manually reordering
    if (!course.recordingsSortOrder) course.recordingsSortOrder = {};
    course.recordingsSortOrder[tabId] = SORT_ORDERS.recordings.MANUAL;
    
    saveData();
    renderRecordingsList(course);
}

/**
 * Moves a homework item up or down in the list.
 * @param {string} courseId - Course ID
 * @param {number} index - Current index
 * @param {string} direction - 'up' or 'down'
 */
function moveHomework(courseId, index, direction) {
    const course = getCourse(courseId);
    if (!course?.homework) return;
    
    const items = course.homework;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= items.length) return;
    
    // Swap items
    [items[index], items[newIndex]] = [items[newIndex], items[index]];
    
    // Set to manual sort order since user is manually reordering
    course.homeworkSortOrder = SORT_ORDERS.homework.MANUAL;
    
    saveData();
    renderHomeworkList(course);
    renderHomeworkSidebar();
}

// ============================================================================
// SCHEDULE
// ============================================================================

/**
 * Removes a schedule item by index.
 * @param {number} index - Item index
 */
function removeScheduleItem(index) {
    window.tempSchedule.splice(index, 1);
    renderScheduleList();
}
