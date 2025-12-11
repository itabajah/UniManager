/**
 * @file events.js
 * @description Event listeners setup and handlers for the uni-course-manager
 */

// ============================================================================
// MAIN SETUP
// ============================================================================

/**
 * Sets up all event listeners for the application.
 * Called once during initialization.
 */
function setupEventListeners() {
    setupSemesterEvents();
    setupCourseEvents();
    setupRecordingsEvents();
    setupHomeworkEvents();
    setupSettingsEvents();
    setupProfileEvents();
    setupColorThemeEvents();
    setupMobileDayToggle();
}

// ============================================================================
// SEMESTER EVENTS
// ============================================================================

/**
 * Sets up semester-related event listeners.
 */
function setupSemesterEvents() {
    // Semester Select
    $('semester-select').addEventListener('change', (e) => {
        currentSemesterId = e.target.value;
        renderAll();
    });

    // Add Semester
    $('add-semester-btn').addEventListener('click', () => {
        populateSemesterOptions();
        openModal('add-semester-modal');
    });

    $('new-semester-select').addEventListener('change', (e) => {
        const customGroup = $('custom-semester-group');
        customGroup.classList.toggle('hidden', e.target.value !== 'custom');
    });

    $('save-semester-btn').addEventListener('click', saveSemester);

    // Delete Semester
    $('delete-semester-btn').addEventListener('click', deleteSemester);
}

/**
 * Saves a new semester from the add semester modal.
 */
function saveSemester() {
    const select = $('new-semester-select');
    let name = select.options[select.selectedIndex].text;
    
    if (select.value === 'custom') {
        name = $('new-semester-custom').value;
    }

    if (!name) return;
    
    if (appData.semesters.some(s => s.name === name)) {
        alert('Semester already exists!');
        return;
    }

    const newSem = {
        id: generateId(),
        name,
        courses: [],
        calendarSettings: { ...DEFAULT_CALENDAR_SETTINGS }
    };
    appData.semesters.push(newSem);
    currentSemesterId = newSem.id;
    saveData();
    renderAll();
    closeModal('add-semester-modal');
    $('new-semester-custom').value = '';
}

/**
 * Deletes the current semester after confirmation.
 */
function deleteSemester() {
    if (!currentSemesterId) return;
    
    const semester = appData.semesters.find(s => s.id === currentSemesterId);
    if (!semester) return;

    if (!confirm(`Are you sure you want to delete "${semester.name}" and all its courses?`)) return;

    appData.semesters = appData.semesters.filter(s => s.id !== currentSemesterId);
    
    // Switch to the last available semester, or null if none
    currentSemesterId = appData.semesters.length > 0 
        ? appData.semesters[appData.semesters.length - 1].id 
        : null;
    
    saveData();
    renderAll();
}

// ============================================================================
// COURSE EVENTS
// ============================================================================

/**
 * Sets up course-related event listeners.
 */
function setupCourseEvents() {
    // Add Course FAB
    $('add-course-fab').addEventListener('click', () => {
        if (!currentSemesterId) {
            populateSemesterOptions();
            openModal('add-semester-modal');
            return;
        }
        openCourseModal(null);
    });

    // Save Course
    $('save-course-btn').addEventListener('click', saveCourse);

    // Delete Course
    $('delete-course-btn').addEventListener('click', deleteCourse);

    // Course Color Hue Slider
    $('course-color-hue').addEventListener('input', (e) => {
        const hue = e.target.value;
        const colorTheme = appData.settings.colorTheme || 'colorful';
        const color = colorTheme === 'mono' 
            ? 'hsl(0, 0%, 50%)' 
            : `hsl(${hue}, 45%, 50%)`;
        $('course-color-preview').style.backgroundColor = color;
    });

    // Add Schedule Item
    $('add-schedule-btn').addEventListener('click', addScheduleItem);
    
    // Course Modal Tab Switching
    document.querySelectorAll('.course-modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchCourseModalTab(tab.dataset.tab);
        });
    });
}

/**
 * Adds a schedule item from the course modal inputs.
 */
function addScheduleItem() {
    const day = $('new-schedule-day').value;
    const start = $('new-schedule-start').value;
    const end = $('new-schedule-end').value;
    
    if (!start || !end) return;
    
    window.tempSchedule.push({
        day: parseInt(day),
        start,
        end
    });
    
    renderScheduleList();
    
    // Reset inputs
    $('new-schedule-start').value = '';
    $('new-schedule-end').value = '';
}

// ============================================================================
// RECORDINGS EVENTS
// ============================================================================

/**
 * Sets up recordings-related event listeners.
 */
function setupRecordingsEvents() {
    $('add-recording-btn').addEventListener('click', addRecording);
    
    $('new-recording-link').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addRecording();
    });
    
    $('add-recordings-tab-btn').addEventListener('click', addRecordingsTab);
    $('rename-tab-btn').addEventListener('click', renameRecordingsTab);
    $('clear-tab-btn').addEventListener('click', clearRecordingsTab);
    $('delete-tab-btn').addEventListener('click', deleteRecordingsTab);
    
    $('fetch-videos-btn').addEventListener('click', () => {
        $('fetch-status').textContent = '';
        resetPanoptoBrowser();
        toggleFetchSource(); // Ensure correct section is shown
        openModal('fetch-videos-modal');
    });
    
    $('fetch-videos-submit-btn').addEventListener('click', fetchVideosFromSource);
    
    $('fetch-source-select').addEventListener('change', toggleFetchSource);
    
    // Panopto console script import handlers
    $('copy-panopto-script-btn')?.addEventListener('click', copyPanoptoScript);
    $('parse-panopto-data-btn')?.addEventListener('click', parsePastedPanoptoData);
}

/**
 * Copies the Panopto extraction script to clipboard.
 */
function copyPanoptoScript() {
    const scriptCode = $('panopto-script-code');
    const btn = $('copy-panopto-script-btn');
    
    if (scriptCode && btn) {
        navigator.clipboard.writeText(scriptCode.textContent).then(() => {
            btn.classList.add('copied');
            setTimeout(() => btn.classList.remove('copied'), 1500);
        }).catch(() => {
            // Fallback for older browsers
            const range = document.createRange();
            range.selectNode(scriptCode);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand('copy');
            window.getSelection().removeAllRanges();
            btn.classList.add('copied');
            setTimeout(() => btn.classList.remove('copied'), 1500);
        });
    }
}

/**
 * Resets the Panopto UI to initial state.
 */
function resetPanoptoBrowser() {
    const extractedList = $('panopto-extracted-list');
    const textarea = $('panopto-paste-data');
    
    if (extractedList) {
        extractedList.classList.add('hidden');
        extractedList.innerHTML = '';
    }
    if (textarea) textarea.value = '';
    
    window.panoptoExtractedVideos = [];
}

/**
 * Parses pasted Panopto video data from console script.
 */
function parsePastedPanoptoData() {
    const textarea = $('panopto-paste-data');
    const data = textarea?.value.trim();
    
    if (!data) {
        showFetchStatus($('fetch-status'), 'Please paste the copied data.', true);
        return;
    }
    
    try {
        const videos = JSON.parse(data);
        if (!Array.isArray(videos) || videos.length === 0) {
            throw new Error('No videos found');
        }
        
        // Convert to our format - script includes full URL (u) or just ID (i) for backwards compat
        window.panoptoExtractedVideos = videos.map(v => ({
            title: v.t,
            url: v.u || v.i,
            id: v.u ? (v.u.match(/id=([a-f0-9-]+)/i)?.[1] || v.u) : v.i,
            selected: true
        }));
        
        showPanoptoVideoList();
        showFetchStatus($('fetch-status'), `Found ${videos.length} videos!`, false);
        
    } catch (e) {
        showFetchStatus($('fetch-status'), 'Invalid data format. Make sure you copied the output correctly.', true);
    }
}

/**
 * Shows the list of extracted Panopto videos for selection.
 */
function showPanoptoVideoList() {
    const container = $('panopto-extracted-list');
    
    if (!container) return;
    
    const videos = window.panoptoExtractedVideos || [];
    
    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="panopto-extracted-header">
            <span id="panopto-extracted-count">${videos.length} videos found</span>
            <button type="button" id="panopto-select-all-btn" class="btn-link">Deselect All</button>
        </div>
        <div id="panopto-video-list" class="panopto-video-list">
            ${videos.map((v, i) => `
                <div class="panopto-video-item">
                    <input type="checkbox" id="panopto-vid-${i}" ${v.selected ? 'checked' : ''} 
                        onchange="window.panoptoExtractedVideos[${i}].selected = this.checked">
                    <label for="panopto-vid-${i}">${escapeHtml(v.title)}</label>
                </div>
            `).join('')}
        </div>
    `;
    
    // Re-attach select all handler
    $('panopto-select-all-btn')?.addEventListener('click', toggleSelectAllPanoptoVideos);
}

/**
 * Toggles select all/none for extracted Panopto videos.
 */
function toggleSelectAllPanoptoVideos() {
    const videos = window.panoptoExtractedVideos || [];
    const allSelected = videos.every(v => v.selected);
    
    videos.forEach((v, i) => {
        v.selected = !allSelected;
        const checkbox = $(`panopto-vid-${i}`);
        if (checkbox) checkbox.checked = !allSelected;
    });
    
    const btn = $('panopto-select-all-btn');
    if (btn) btn.textContent = allSelected ? 'Select All' : 'Deselect All';
}

// ============================================================================
// HOMEWORK EVENTS
// ============================================================================

/**
 * Sets up homework-related event listeners.
 */
function setupHomeworkEvents() {
    $('add-homework-btn-modal').addEventListener('click', addHomework);
    
    $('show-completed-toggle').addEventListener('change', (e) => {
        appData.settings.showCompleted = e.target.checked;
        saveData();
        renderHomeworkSidebar();
    });
}

// ============================================================================
// SETTINGS EVENTS
// ============================================================================

/**
 * Sets up settings-related event listeners.
 */
function setupSettingsEvents() {
    $('settings-btn').addEventListener('click', openSettingsModal);
    
    // Settings Tab Switching
    document.querySelectorAll('.settings-modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchSettingsTab(tab.dataset.tab);
        });
    });
    
    // Calendar Settings Listeners
    $('cal-start-hour').addEventListener('change', updateCalendarSettings);
    $('cal-end-hour').addEventListener('change', updateCalendarSettings);
    document.querySelectorAll('#cal-days-container input').forEach(cb => {
        cb.addEventListener('change', updateCalendarSettings);
    });

    // Reset All Colors
    $('reset-colors-btn').addEventListener('click', resetAllColors);

    // Batch Sync Toggle
    $('batch-sync-toggle').addEventListener('change', (e) => {
        $('batch-sync-options').classList.toggle('hidden', !e.target.checked);
    });

    // Toggle Calendar Visibility
    $('toggle-calendar-btn').addEventListener('click', toggleCalendarVisibility);

    // ICS Link Sync
    $('sync-ics-btn').addEventListener('click', syncICSData);

    // Technion Data Fetch
    $('fetch-technion-data-btn').addEventListener('click', fetchTechnionData);
}

/**
 * Switches to a specific tab in the settings modal.
 * @param {string} tabName - Tab name ('profile', 'appearance', 'calendar', 'sync')
 */
function switchSettingsTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.settings-modal-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab panels
    document.querySelectorAll('.settings-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `settings-tab-${tabName}`);
    });
}

/**
 * Opens the settings modal and populates current values.
 */
function openSettingsModal() {
    // Capture current saved state as original values
    originalColorTheme = appData.settings.colorTheme || 'colorful';
    originalBaseColorHue = appData.settings.baseColorHue || 200;
    tempColorTheme = originalColorTheme;
    tempBaseColorHue = originalBaseColorHue;
    
    // Reset UI state
    $('theme-unsaved-indicator').style.display = 'none';
    $('theme-changed-buttons').style.display = 'none';
    
    // Set default years if empty
    const currentYear = new Date().getFullYear();
    const startYearEl = $('sync-start-year');
    if (!startYearEl.value) {
        startYearEl.value = currentYear;
        $('sync-end-year').value = currentYear + 1;
    }
    
    // Populate Calendar Settings from current semester or defaults
    const semester = getCurrentSemester();
    const calendarSettings = semester?.calendarSettings || DEFAULT_CALENDAR_SETTINGS;
    
    $('cal-start-hour').value = calendarSettings.startHour;
    $('cal-end-hour').value = calendarSettings.endHour;
    
    document.querySelectorAll('#cal-days-container input').forEach(cb => {
        cb.checked = calendarSettings.visibleDays.includes(parseInt(cb.value));
    });

    // Populate Color Theme Settings
    const colorThemeSelect = $('color-theme-select');
    colorThemeSelect.value = appData.settings.colorTheme || 'colorful';
    const baseColorContainer = $('base-color-container');
    const resetBtn = $('reset-colors-btn');
    
    if (appData.settings.colorTheme === 'single') {
        baseColorContainer.style.display = 'block';
        $('base-color-hue').value = appData.settings.baseColorHue || 200;
        updateBaseColorPreview();
    } else {
        baseColorContainer.style.display = 'none';
    }
    
    resetBtn.style.display = appData.settings.colorTheme === 'mono' ? 'none' : 'block';
    openModal('settings-modal');
}

/**
 * Toggles the calendar visibility and updates the button icon.
 */
function toggleCalendarVisibility() {
    const calendar = $('weekly-schedule');
    const btn = $('toggle-calendar-btn');
    const isHidden = calendar.classList.toggle('hidden');
    
    btn.innerHTML = isHidden
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
}

/**
 * Syncs ICS data from Cheesefork URL (single or batch mode).
 */
async function syncICSData() {
    const url = $('ics-link-input').value;
    if (!url) return;
    
    const statusDiv = $('import-status');
    const isBatch = $('batch-sync-toggle').checked;

    statusDiv.textContent = 'Starting sync...';
    statusDiv.style.color = 'var(--text-tertiary)';
    
    try {
        if (isBatch) {
            await syncBatchICS(url, statusDiv);
        } else {
            await syncSingleICS(url, statusDiv);
        }

        // Auto-fetch Technion data to enhance courses
        statusDiv.innerHTML += '<br><span style="font-size:11px; color:var(--text-tertiary)">Fetching Technion data...</span>';
        try {
            await fetchTechnionData();
            statusDiv.innerHTML += '<br><span style="font-size:11px; color:var(--success-text)">Technion data applied!</span>';
        } catch (e) {
            statusDiv.innerHTML += '<br><span style="font-size:11px; color:var(--text-tertiary)">Could not fetch Technion data.</span>';
        }

    } catch (err) {
        console.error(err);
        statusDiv.textContent = 'Error: ' + err.message;
        statusDiv.style.color = 'var(--error-border)';
    }
}

/**
 * Syncs a single ICS file.
 * @param {string} url - ICS URL
 * @param {HTMLElement} statusDiv - Status display element
 */
async function syncSingleICS(url, statusDiv) {
    statusDiv.textContent = 'Fetching calendar...';
    const result = await importICSFromUrl(url);
    statusDiv.textContent = `Success! Found ${result.count} courses for ${result.semesterName}.`;
    statusDiv.style.color = 'var(--success-text)';
}

/**
 * Syncs multiple semesters in batch mode.
 * @param {string} url - Base ICS URL
 * @param {HTMLElement} statusDiv - Status display element
 */
async function syncBatchICS(url, statusDiv) {
    const startSemester = $('sync-start-semester').value;
    const startYear = parseInt($('sync-start-year').value);
    const endSemester = $('sync-end-semester').value;
    const endYear = parseInt($('sync-end-year').value);
    
    if (!startYear || !endYear) {
        throw new Error('Please specify both start and end years.');
    }

    // Validate that start is not after end
    const semesterOrder = ['winter', 'spring', 'summer'];
    const startSemIndex = semesterOrder.indexOf(startSemester);
    const endSemIndex = semesterOrder.indexOf(endSemester);
    const startValue = startYear * 3 + startSemIndex;
    const endValue = endYear * 3 + endSemIndex;
    
    if (startValue > endValue) {
        throw new Error('Start semester cannot be after end semester.');
    }

    // Extract base URL
    const match = url.match(/^(.*\/)[^\/]+\.ics$/);
    if (!match) {
        throw new Error('Could not determine base URL from the link.');
    }
    const baseUrl = match[1];

    // Build list of semesters to fetch
    const semesters = buildSemesterList(semesterOrder, startSemIndex, endSemIndex, startYear, endYear);

    let successCount = 0;
    const logs = [];

    for (const target of semesters) {
        statusDiv.textContent = `Checking ${target.name}...`;
        try {
            const result = await importICSFromUrl(baseUrl + target.file, target.name);
            successCount++;
            logs.push(`Success: ${target.name} (${result.count} courses)`);
        } catch (e) {
            // Skip failed semesters
        }
    }

    if (successCount === 0) {
        throw new Error('No semesters found in the specified range.');
    }

    // Switch to the most recent semester
    if (appData.semesters.length > 0) {
        const sorted = [...appData.semesters].sort(compareSemesters);
        currentSemesterId = sorted[0].id;
        renderAll();
    }

    statusDiv.innerHTML = `Done! Imported ${successCount} semesters.<br><span style="font-size:11px; color:var(--text-tertiary)">${logs.join(', ')}</span>`;
    statusDiv.style.color = 'var(--success-text)';
}

/**
 * Builds a list of semesters to fetch based on range.
 * @param {string[]} semesterOrder - Order of semesters in a year
 * @param {number} startSemIndex - Start semester index
 * @param {number} endSemIndex - End semester index
 * @param {number} startYear - Start year
 * @param {number} endYear - End year
 * @returns {Array} List of semester objects with name and file
 */
function buildSemesterList(semesterOrder, startSemIndex, endSemIndex, startYear, endYear) {
    const semesters = [];
    let currentYear = startYear;
    let currentSemIndex = startSemIndex;
    
    while (true) {
        const semType = semesterOrder[currentSemIndex];
        const semYear = semType === 'winter' ? `${currentYear}-${currentYear+1}` : `${currentYear}`;
        const semName = `${semType.charAt(0).toUpperCase() + semType.slice(1)} ${semYear}`;
        const fileName = `${semType}-${semYear}.ics`;
        
        semesters.push({ name: semName, file: fileName });
        
        if (currentYear === endYear && currentSemIndex === endSemIndex) break;
        
        currentSemIndex++;
        if (currentSemIndex >= semesterOrder.length) {
            currentSemIndex = 0;
            currentYear++;
        }
        
        if (currentYear > endYear + 1) break;
    }
    
    return semesters;
}

// ============================================================================
// PROFILE EVENTS
// ============================================================================

/**
 * Sets up profile management event listeners.
 */
function setupProfileEvents() {
    $('export-data-btn').addEventListener('click', exportProfile);

    $('import-data-btn').addEventListener('click', () => {
        $('import-file-input').click();
    });

    $('import-file-input').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importProfile(e.target.files[0]);
            e.target.value = '';
        }
    });

    $('profile-select').addEventListener('change', (e) => {
        switchProfile(e.target.value);
    });
    $('add-profile-btn').addEventListener('click', createProfile);
    $('edit-profile-btn').addEventListener('click', renameProfile);
    $('delete-profile-btn').addEventListener('click', deleteProfile);
}

// ============================================================================
// COLOR THEME EVENTS
// ============================================================================

/**
 * Sets up color theme event listeners.
 */
function setupColorThemeEvents() {
    $('color-theme-select').addEventListener('change', (e) => {
        tempColorTheme = e.target.value;
        const baseColorContainer = $('base-color-container');
        const unsavedIndicator = $('theme-unsaved-indicator');
        const resetBtn = $('reset-colors-btn');
        const changedButtons = $('theme-changed-buttons');
        
        baseColorContainer.style.display = e.target.value === 'single' ? 'block' : 'none';
        if (e.target.value === 'single') updateBaseColorPreview();
        
        unsavedIndicator.style.display = 'inline';
        resetBtn.style.display = 'none';
        changedButtons.style.display = 'flex';
    });

    $('base-color-hue').addEventListener('input', (e) => {
        tempBaseColorHue = parseInt(e.target.value);
        updateBaseColorPreview();
        
        $('theme-unsaved-indicator').style.display = 'inline';
        $('reset-colors-btn').style.display = 'none';
        $('theme-changed-buttons').style.display = 'flex';
    });

    $('apply-theme-btn').addEventListener('click', () => {
        if (tempColorTheme !== null) appData.settings.colorTheme = tempColorTheme;
        if (tempBaseColorHue !== null) appData.settings.baseColorHue = tempBaseColorHue;
        resetAllColors();
    });

    $('cancel-theme-btn').addEventListener('click', cancelThemeChanges);
}

/**
 * Cancels theme changes and restores original values.
 */
function cancelThemeChanges() {
    $('color-theme-select').value = originalColorTheme;
    $('base-color-hue').value = originalBaseColorHue;
    
    tempColorTheme = originalColorTheme;
    tempBaseColorHue = originalBaseColorHue;
    
    const baseColorContainer = $('base-color-container');
    if (originalColorTheme === 'single') {
        baseColorContainer.style.display = 'block';
        updateBaseColorPreview();
    } else {
        baseColorContainer.style.display = 'none';
    }
    
    $('theme-unsaved-indicator').style.display = 'none';
    $('theme-changed-buttons').style.display = 'none';
    $('reset-colors-btn').style.display = originalColorTheme === 'mono' ? 'none' : 'block';
}

// ============================================================================
// CALENDAR SETTINGS
// ============================================================================

/**
 * Updates calendar settings from the settings modal.
 */
function updateCalendarSettings() {
    const start = parseInt($('cal-start-hour').value);
    const end = parseInt($('cal-end-hour').value);
    const days = [...document.querySelectorAll('#cal-days-container input:checked')]
        .map(cb => parseInt(cb.value));
    
    if (days.length === 0) {
        alert('Please select at least one visible day.');
        return;
    }
    
    if (start >= end) {
        alert('Start time must be before end time');
        return;
    }
    
    const semester = getCurrentSemester();
    if (semester) {
        semester.calendarSettings = {
            startHour: start,
            endHour: end,
            visibleDays: days.sort((a, b) => a - b)
        };
        saveData();
    }
    
    renderCalendar();
}

// ============================================================================
// CALENDAR EVENT NAVIGATION
// ============================================================================

/**
 * Handles clicks on calendar event chips and navigates to the specific event.
 * @param {string} courseId - Course ID
 * @param {string} eventType - 'homework' or 'exam'
 * @param {number} [homeworkIndex] - Index of homework item (for homework events)
 * @param {string} [examType] - 'moedA' or 'moedB' (for exam events)
 */
function handleCalendarEventClick(courseId, eventType, homeworkIndex, examType) {
    if (eventType === 'homework' && homeworkIndex !== undefined) {
        // Open homework tab with specific item highlighted
        openCourseModal(courseId, 'homework', {
            type: 'homework',
            index: homeworkIndex
        });
    } else if (eventType === 'exam' && examType) {
        // Open details tab with exam field highlighted
        openCourseModal(courseId, 'details', {
            type: 'exam',
            examType: examType
        });
    } else {
        // Fallback to just opening the course
        openCourseModal(courseId);
    }
}

// Export for use in other modules
window.handleCalendarEventClick = handleCalendarEventClick;

// ============================================================================
// RECORDINGS ACTIONS TOGGLE (MOBILE)
// ============================================================================

/**
 * Toggles the recordings actions panel on mobile
 */
function toggleRecordingsActions() {
    const content = document.querySelector('.recordings-control-panel-content');
    const toggle = document.querySelector('.recordings-control-panel-toggle');
    
    if (!content || !toggle) return;
    
    const isExpanded = content.classList.toggle('expanded');
    
    // Rotate arrow icon
    const svg = toggle.querySelector('svg');
    if (svg) {
        svg.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
        svg.style.transition = 'transform 0.3s ease';
    }
}

// Export for use in HTML onclick
window.toggleRecordingsActions = toggleRecordingsActions;

// ============================================================================
// MOBILE DAY TOGGLE
// ============================================================================

/**
 * Sets up mobile day view toggle (show only current day vs all days)
 */
function setupMobileDayToggle() {
    const toggleBtn = $('mobile-day-toggle');
    if (!toggleBtn) return;
    
    // Check if on mobile (button is visible)
    const isMobile = window.innerWidth <= 768;
    
    // Check initial state from localStorage (default to true for today mode on mobile only)
    const storedValue = localStorage.getItem('calendarShowOnlyToday');
    const showOnlyToday = storedValue === null ? isMobile : storedValue === 'true';
    const textSpan = toggleBtn.querySelector('span');
    
    // Set initial state
    if (showOnlyToday) {
        toggleBtn.classList.add('active');
        if (textSpan) {
            textSpan.textContent = 'Today';
        }
    } else {
        toggleBtn.classList.remove('active');
        if (textSpan) {
            textSpan.textContent = 'All Days';
        }
    }
    
    toggleBtn.addEventListener('click', () => {
        const isActive = toggleBtn.classList.toggle('active');
        localStorage.setItem('calendarShowOnlyToday', isActive);
        
        // Update button text to show current state (not the action)
        const textSpan = toggleBtn.querySelector('span');
        if (textSpan) {
            textSpan.textContent = isActive ? 'Today' : 'All Days';
        }
        
        // Apply filter to calendar
        applySingleDayFilter(isActive);
    });
    
    // Apply initial filter (only on mobile)
    if (isMobile) {
        applySingleDayFilter(showOnlyToday);
    }
    
    // Listen for window resize to auto-switch between mobile and desktop views
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const nowMobile = window.innerWidth <= 768;
            const storedValue = localStorage.getItem('calendarShowOnlyToday');
            const showOnlyToday = storedValue === null ? nowMobile : storedValue === 'true';
            
            if (nowMobile) {
                // Switched to mobile - apply today mode if active
                applySingleDayFilter(showOnlyToday);
            } else {
                // Switched to desktop - clear any day filter
                applySingleDayFilter(false);
            }
        }, 250);
    });
}

// Global temp variable for calendar day filter (doesn't affect settings)
window.tempCalendarDayFilter = null;

/**
 * Filters calendar to show only current day or all days (temporary view, doesn't save)
 */
function applySingleDayFilter(showOnlyToday) {
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    const wrapper = document.querySelector('.calendar-scroll-wrapper');
    
    if (showOnlyToday) {
        // Set temp filter to today only
        window.tempCalendarDayFilter = [today];
        if (wrapper) wrapper.classList.add('single-day-mode');
    } else {
        // Clear temp filter (show all days from settings)
        window.tempCalendarDayFilter = null;
        if (wrapper) wrapper.classList.remove('single-day-mode');
    }
    
    // Re-render calendar with temp filter (renderCalendar handles week events too)
    renderCalendar();
}
