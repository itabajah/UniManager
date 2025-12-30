/**
 * @file main.js
 * @description Application entry point and global function exports
 */

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes the application when DOM is ready.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Setup global error handling first
    if (typeof setupGlobalErrorHandler === 'function') {
        setupGlobalErrorHandler({ showToast: true, logToConsole: true });
    }
    
    // Setup offline/online detection
    if (typeof setupOfflineHandling === 'function') {
        setupOfflineHandling({
            onOffline: () => {
                // Optionally disable sync-related UI
                console.warn('[App] Browser offline');
            },
            onOnline: () => {
                // Trigger sync when back online
                console.info('[App] Browser online - triggering sync');
                if (typeof autoSyncToFirebase === 'function') {
                    autoSyncToFirebase();
                }
            }
        });
    }
    
    loadData();
    initTheme();
    setupEventListeners();
    renderProfileUI();

    // Initialize Firebase sync (Google Auth + RTDB)
    if (typeof initializeFirebaseSync === 'function') {
        initializeFirebaseSync();
    }

    // Start header ticker rotation (data is refreshed via renderAll())
    if (typeof startHeaderTickerRotation === 'function') {
        startHeaderTickerRotation();
    }
    
    // Hide calendar by default on mobile
    if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
        const calendar = document.getElementById('weekly-schedule');
        const btn = document.getElementById('toggle-calendar-btn');
        if (calendar && btn) {
            calendar.classList.add('hidden');
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
        }
    }
    
    // Show initialization complete
    console.info('[App] Tollab initialized successfully');
});

// ============================================================================
// GLOBAL EXPORTS
// Expose functions to global scope for HTML onclick handlers
// ============================================================================

// Core UI
window.toggleTheme = toggleTheme;
window.closeModal = closeModal;
window.openCourseModal = openCourseModal;
window.openRecordingsModal = openRecordingsModal;
window.openHomeworkModal = openHomeworkModal;

// Recording functions
window.switchRecordingsTab = switchRecordingsTab;
window.toggleRecordingStatus = toggleRecordingStatus;

window.toggleRecordingEdit = toggleRecordingEdit;
window.saveRecordingEdit = saveRecordingEdit;
window.cancelRecordingEdit = cancelRecordingEdit;
window.deleteRecording = deleteRecording;
window.addRecordingsTab = addRecordingsTab;
window.renameRecordingsTab = renameRecordingsTab;
window.clearRecordingsTab = clearRecordingsTab;
window.deleteRecordingsTab = deleteRecordingsTab;

// Homework functions
window.toggleHomeworkStatus = toggleHomeworkStatus;
window.deleteHomework = deleteHomework;
window.updateHomeworkNotes = updateHomeworkNotes;
window.addHomeworkLink = addHomeworkLink;
window.removeHomeworkLink = removeHomeworkLink;
window.startEditHomeworkLink = startEditHomeworkLink;
window.saveEditHomeworkLink = saveEditHomeworkLink;
window.renderEditLinksSection = renderEditLinksSection;
window.toggleHomeworkEdit = toggleHomeworkEdit;
window.saveHomeworkEdit = saveHomeworkEdit;
window.cancelHomeworkEdit = cancelHomeworkEdit;
window.openHomeworkFromSidebar = openHomeworkFromSidebar;

// Course functions
window.moveCourse = moveCourse;
window.removeScheduleItem = removeScheduleItem;
