module.exports = {
    env: {
        browser: true,
        es2021: true,
        jest: true
    },
    extends: 'eslint:recommended',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script'
    },
    globals: {
        // DOM helpers
        '$': 'readonly',
        
        // Constants from constants.js
        'DEFAULT_CALENDAR_SETTINGS': 'readonly',
        'DAY_NAMES': 'readonly',
        'DAY_NAMES_FULL': 'readonly',
        'STORAGE_KEYS': 'readonly',
        'DAY_NAMES_SHORT': 'readonly',
        'COLOR_THEMES': 'readonly',
        'DEFAULT_THEME_SETTINGS': 'readonly',
        'GOLDEN_ANGLE': 'readonly',
        'DEFAULT_RECORDING_TABS': 'readonly',
        'PROTECTED_TAB_IDS': 'readonly',
        'CORS_PROXIES': 'readonly',
        'TECHNION_SAP_BASE_URL': 'readonly',
        'SEMESTER_SEASONS': 'readonly',
        'SEMESTER_TRANSLATIONS': 'readonly',
        'ANIMATION_DURATIONS': 'readonly',
        'TIME_UPDATE_INTERVAL': 'readonly',
        'MAX_LENGTHS': 'readonly',
        'HTML_ENTITIES': 'readonly',
        'EXPORT_DATA_VERSION': 'readonly',
        
        // Validation from validation.js
        'VALIDATION_LIMITS': 'readonly',
        'VALIDATION_PATTERNS': 'readonly',
        'validateString': 'readonly',
        'validateCourseName': 'readonly',
        'validateHomeworkTitle': 'readonly',
        'validateProfileName': 'readonly',
        'validateNotes': 'readonly',
        'validateUrl': 'readonly',
        'validateVideoUrl': 'readonly',
        'validateNumber': 'readonly',
        'validateCoursePoints': 'readonly',
        'validateGrade': 'readonly',
        'validateCalendarHour': 'readonly',
        'validateDate': 'readonly',
        'validateTime': 'readonly',
        'validateImportedData': 'readonly',
        'validateScheduleItem': 'readonly',
        'sanitizeString': 'readonly',
        'sanitizeFilename': 'readonly',
        
        // Toast from toast.js
        'ToastManager': 'readonly',
        'showConfirmDialog': 'readonly',
        'showPromptDialog': 'readonly',
        'showAlertDialog': 'readonly',
        
        // Error handling from error-handling.js
        'ERROR_CONFIG': 'readonly',
        'ERROR_MESSAGES': 'readonly',
        'extractErrorCode': 'readonly',
        'getUserFriendlyError': 'readonly',
        'isRetryableError': 'readonly',
        'withRetry': 'readonly',
        'safeExecute': 'readonly',
        'safeStorageOperation': 'readonly',
        'safeNetworkOperation': 'readonly',
        'setupGlobalErrorHandler': 'readonly',
        'isOnline': 'readonly',
        'setupOfflineHandling': 'readonly',
        
        // State from state.js
        'appData': 'writable',
        'getActiveProfileId': 'readonly',
        'saveData': 'readonly',
        'compactForStorage': 'readonly',
        'hydrateFromStorage': 'readonly',
        'migrateData': 'readonly',
        
        // Utils from utils.js
        'escapeHtml': 'readonly',
        'generateUUID': 'readonly',
        'formatDate': 'readonly',
        'throttle': 'readonly',
        'debounce': 'readonly',
        'getContrastColor': 'readonly',
        'truncateText': 'readonly',
        
        // Course logic
        'getCourse': 'readonly',
        'saveCourse': 'readonly',
        'deleteCourse': 'readonly',
        'duplicateCourse': 'readonly',
        
        // Other modules
        'getCurrentSemester': 'readonly',
        'renderCourses': 'readonly',
        'renderRecordingsList': 'readonly',
        'renderRecordingsTabs': 'readonly',
        'renderCalendar': 'readonly',
        'renderHomework': 'readonly',
        'closeModal': 'readonly',
        'editingCourseId': 'writable',
        
        // Firebase (optional)
        'autoSyncToFirebase': 'readonly',
        
        // Fetch module
        'FETCH_CONFIG': 'readonly'
    },
    rules: {
        // Error prevention
        'no-unused-vars': ['warn', { 
            'varsIgnorePattern': '^_',
            'argsIgnorePattern': '^_'
        }],
        'no-undef': 'error',
        'no-redeclare': 'error',
        
        // Best practices
        'eqeqeq': ['warn', 'smart'],
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-return-await': 'warn',
        'require-await': 'warn',
        
        // Style (warnings only)
        'semi': ['warn', 'always'],
        'quotes': ['warn', 'single', { 'avoidEscape': true }],
        'indent': ['warn', 4, { 'SwitchCase': 1 }],
        'comma-dangle': ['warn', 'never'],
        'no-trailing-spaces': 'warn',
        'no-multiple-empty-lines': ['warn', { 'max': 2 }],
        
        // Allow console for this project
        'no-console': 'off'
    }
};
