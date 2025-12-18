/**
 * @fileoverview Main application entry point.
 * Initializes the application and sets up all modules.
 */

import { TIME_UPDATE_INTERVAL } from '@/constants';
import * as render from '@/render';
import { setupEventListeners } from '@/services/events';
import { firebaseConfig } from '@/services/firebase-config';
import { autoSyncToFirebase, initializeFirebaseSync } from '@/services/firebase-sync';
import * as modals from '@/services/modals';
import { initTheme, toggleTheme } from '@/services/theme';
import { store } from '@/state';

// Import styles
import './styles/main.css';

// ============================================================================
// TIME UPDATER
// ============================================================================

let timeInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the interval for updating the current time line on the calendar.
 */
function startTimeUpdater(): void {
  if (timeInterval) clearInterval(timeInterval);
  render.renderCurrentTime();
  timeInterval = setInterval(() => render.renderCurrentTime(), TIME_UPDATE_INTERVAL);
}

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

/**
 * Initializes the application when DOM is ready.
 */
function initializeApp(): void {
  // Load data from localStorage
  store.load();

  // Initialize theme
  initTheme();

  // Setup event listeners
  setupEventListeners();

  // Render initial UI
  render.renderAll();
  render.renderProfileUI();

  // Start time updater for calendar current time line
  startTimeUpdater();

  // Initialize Firebase sync (will connect if user was previously signed in)
  initializeFirebaseSync(firebaseConfig);

  // Subscribe to state changes for re-rendering and cloud sync
  store.subscribe(() => {
    render.renderAll();
    render.renderProfileUI();
    // Auto-sync to cloud when data changes
    autoSyncToFirebase();
  });

  // eslint-disable-next-line no-console
  console.info('UniManager initialized successfully');
}

// ============================================================================
// GLOBAL EXPORTS FOR HTML HANDLERS
// ============================================================================

// Expose functions to window for onclick handlers (temporary - will be removed in full migration)
declare global {
  interface Window {
    toggleTheme: typeof toggleTheme;
    closeModal: (id: string) => void;
    openCourseModal: (courseId: string | null) => void;
    openSettingsModal: () => void;
  }
}

window.toggleTheme = toggleTheme;
window.closeModal = modals.closeModal;
window.openCourseModal = modals.openCourseModal;
window.openSettingsModal = modals.openSettingsModal;

// ============================================================================
// START APPLICATION
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
