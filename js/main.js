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
