/**
 * Jest setup file.
 * Initializes the test environment with necessary mocks and globals.
 */

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => {
            store[key] = String(value);
        }),
        removeItem: jest.fn((key) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
        get length() {
            return Object.keys(store).length;
        },
        key: jest.fn((i) => Object.keys(store)[i] || null)
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

// Mock DOM helper
global.$ = (id) => document.getElementById(id);

// Mock console methods for cleaner test output
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Mock constants that would be loaded by constants.js
global.VALIDATION_LIMITS = {
    COURSE_NAME_MAX: 100,
    HOMEWORK_TITLE_MAX: 200,
    NOTES_MAX: 5000,
    URL_MAX: 2048,
    PROFILE_NAME_MAX: 50,
    SEMESTER_NAME_MAX: 50,
    MIN_YEAR: 2000,
    MAX_YEAR: 2100
};

global.VALIDATION_PATTERNS = {
    URL: /^https?:\/\/[^\s<>'"]+$/i,
    YOUTUBE_URL: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i,
    PANOPTO_URL: /panopto/i,
    COURSE_NUMBER: /^[A-Za-z0-9\-_.]{0,20}$/,
    TIME_FORMAT: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    DATE_FORMAT: /^\d{4}-\d{2}-\d{2}$/,
    SAFE_FILENAME: /^[a-zA-Z0-9_\-. ]+$/,
    UUID: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
};

global.CORS_PROXIES = [
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.org/?${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
];

global.ANIMATION_DURATIONS = {
    MODAL_TRANSITION: 300,
    HIGHLIGHT_PULSE: 1500,
    FETCH_SUCCESS_DELAY: 1500
};

// Mock ToastManager for tests
global.ToastManager = {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn()
};

// Clean up before each test
beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    document.body.innerHTML = '';
});
