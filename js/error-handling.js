/**
 * @fileoverview Error handling utilities with retry logic and user-friendly messaging.
 * Provides consistent error handling patterns across the application.
 */

'use strict';

// ============================================================================
// ERROR CONFIGURATION
// ============================================================================

/**
 * Default retry configuration.
 * @const {Object}
 */
const ERROR_CONFIG = Object.freeze({
    /** Maximum number of retry attempts */
    MAX_RETRIES: 3,
    /** Initial delay between retries (ms) */
    INITIAL_DELAY: 1000,
    /** Maximum delay between retries (ms) */
    MAX_DELAY: 10000,
    /** Backoff multiplier */
    BACKOFF_MULTIPLIER: 2,
    /** Errors that should not be retried */
    NON_RETRYABLE_ERRORS: [
        'PERMISSION_DENIED',
        'UNAUTHENTICATED',
        'INVALID_ARGUMENT',
        'NOT_FOUND',
        'ALREADY_EXISTS'
    ]
});

/**
 * User-friendly error messages for common error codes.
 * @const {Object}
 */
const ERROR_MESSAGES = Object.freeze({
    // Network errors
    'NETWORK_ERROR': 'Unable to connect. Please check your internet connection.',
    'TIMEOUT': 'Request timed out. Please try again.',
    'OFFLINE': 'You appear to be offline. Changes will sync when you reconnect.',
    
    // Firebase errors
    'PERMISSION_DENIED': 'You don\'t have permission to perform this action.',
    'UNAUTHENTICATED': 'Please sign in to continue.',
    'QUOTA_EXCEEDED': 'Storage quota exceeded. Please delete some data.',
    'UNAVAILABLE': 'Service temporarily unavailable. Please try again later.',
    
    // Data errors
    'INVALID_DATA': 'The data format is invalid.',
    'VALIDATION_ERROR': 'Please check your input and try again.',
    'CORRUPT_DATA': 'Data appears to be corrupted. Try refreshing the page.',
    
    // Storage errors
    'QUOTA_EXCEEDED_ERROR': 'Local storage is full. Please export your data and clear old profiles.',
    'STORAGE_ERROR': 'Failed to save data. Your browser storage may be full or blocked.',
    
    // Generic
    'UNKNOWN': 'Something went wrong. Please try again.'
});

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Extracts an error code from various error types.
 * @param {Error|Object|string} error - The error to extract code from
 * @returns {string} Error code
 */
function extractErrorCode(error) {
    if (!error) return 'UNKNOWN';
    
    // Firebase error
    if (error.code) return error.code.replace('/', '_').toUpperCase();
    
    // DOMException (storage errors)
    if (error.name === 'QuotaExceededError') return 'QUOTA_EXCEEDED_ERROR';
    if (error.name === 'SecurityError') return 'STORAGE_ERROR';
    
    // Network errors
    if (error.name === 'TypeError' && error.message?.includes('fetch')) return 'NETWORK_ERROR';
    if (error.name === 'AbortError') return 'TIMEOUT';
    
    // Check message for hints
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('network') || msg.includes('fetch')) return 'NETWORK_ERROR';
    if (msg.includes('timeout')) return 'TIMEOUT';
    if (msg.includes('offline')) return 'OFFLINE';
    if (msg.includes('permission')) return 'PERMISSION_DENIED';
    
    return 'UNKNOWN';
}

/**
 * Gets a user-friendly error message.
 * @param {Error|Object|string} error - The error
 * @returns {string} User-friendly message
 */
function getUserFriendlyError(error) {
    const code = extractErrorCode(error);
    return ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN;
}

/**
 * Determines if an error is retryable.
 * @param {Error|Object} error - The error to check
 * @returns {boolean} Whether the error is retryable
 */
function isRetryableError(error) {
    const code = extractErrorCode(error);
    return !ERROR_CONFIG.NON_RETRYABLE_ERRORS.includes(code);
}

/**
 * Calculates delay for exponential backoff with jitter.
 * @param {number} attempt - Current attempt number (0-based)
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay(attempt) {
    const base = ERROR_CONFIG.INITIAL_DELAY * Math.pow(ERROR_CONFIG.BACKOFF_MULTIPLIER, attempt);
    const capped = Math.min(base, ERROR_CONFIG.MAX_DELAY);
    // Add jitter (±20%)
    const jitter = capped * 0.2 * (Math.random() * 2 - 1);
    return Math.floor(capped + jitter);
}

/**
 * Waits for a specified duration.
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// RETRY WRAPPER
// ============================================================================

/**
 * Executes an async function with retry logic.
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @returns {Promise<*>} Result of the function
 */
async function withRetry(fn, options = {}) {
    const {
        maxRetries = ERROR_CONFIG.MAX_RETRIES,
        onRetry = null,
        shouldRetry = isRetryableError,
        context = 'Operation'
    } = options;
    
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn(attempt);
        } catch (error) {
            lastError = error;
            
            // Check if we should retry
            if (attempt >= maxRetries || !shouldRetry(error)) {
                break;
            }
            
            // Calculate delay
            const delay = calculateBackoffDelay(attempt);
            
            // Notify about retry
            if (onRetry) {
                onRetry({
                    attempt: attempt + 1,
                    maxRetries,
                    delay,
                    error
                });
            }
            
            console.warn(`[${context}] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error);
            
            await wait(delay);
        }
    }
    
    // All retries exhausted
    throw lastError;
}

/**
 * Wraps an operation with error handling and optional retry.
 * Shows toast notifications for errors.
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Options
 * @returns {Promise<{success: boolean, result?: *, error?: Error}>}
 */
async function safeExecute(fn, options = {}) {
    const {
        retry = false,
        showToast = true,
        successMessage = null,
        context = 'Operation'
    } = options;
    
    try {
        const executor = retry ? () => withRetry(fn, { context }) : fn;
        const result = await executor();
        
        if (showToast && successMessage && typeof ToastManager !== 'undefined') {
            ToastManager.success(successMessage);
        }
        
        return { success: true, result };
    } catch (error) {
        console.error(`[${context}]`, error);
        
        if (showToast && typeof ToastManager !== 'undefined') {
            ToastManager.error(getUserFriendlyError(error));
        }
        
        return { success: false, error };
    }
}

// ============================================================================
// SPECIALIZED WRAPPERS
// ============================================================================

/**
 * Wraps a storage operation with error handling.
 * @param {Function} fn - Storage operation
 * @param {string} operation - Operation name for logging
 * @returns {Promise<boolean>} Success status
 */
async function safeStorageOperation(fn, operation = 'Storage') {
    const result = await safeExecute(fn, {
        retry: false,
        showToast: true,
        context: operation
    });
    return result.success;
}

/**
 * Wraps a network operation with retry and error handling.
 * @param {Function} fn - Network operation
 * @param {Object} options - Options
 * @returns {Promise<{success: boolean, data?: *, error?: Error}>}
 */
async function safeNetworkOperation(fn, options = {}) {
    const {
        context = 'Network',
        showRetryToast = true
    } = options;
    
    return safeExecute(fn, {
        retry: true,
        showToast: true,
        context,
        onRetry: showRetryToast ? (info) => {
            if (typeof ToastManager !== 'undefined') {
                ToastManager.warning(`Retrying... (attempt ${info.attempt}/${info.maxRetries})`);
            }
        } : null
    });
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

/**
 * Creates a global error handler for uncaught errors.
 * @param {Object} options - Handler options
 */
function setupGlobalErrorHandler(options = {}) {
    const { showToast = true, logToConsole = true } = options;
    
    // Handle uncaught promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        if (logToConsole) {
            console.error('[Unhandled Rejection]', event.reason);
        }
        
        if (showToast && typeof ToastManager !== 'undefined') {
            ToastManager.error('An unexpected error occurred. Please refresh the page.');
        }
        
        // Prevent the default browser error message
        event.preventDefault();
    });
    
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
        // Skip resource loading errors
        if (event.target !== window) return;
        
        if (logToConsole) {
            console.error('[Uncaught Error]', event.error || event.message);
        }
        
        if (showToast && typeof ToastManager !== 'undefined') {
            ToastManager.error('An unexpected error occurred. Please refresh the page.');
        }
    });
}

// ============================================================================
// OFFLINE DETECTION
// ============================================================================

/**
 * Checks if the browser is online.
 * @returns {boolean}
 */
function isOnline() {
    return navigator.onLine;
}

/**
 * Sets up offline/online event listeners.
 * @param {Object} handlers - Event handlers
 */
function setupOfflineHandling(handlers = {}) {
    const { onOffline, onOnline } = handlers;
    
    window.addEventListener('offline', () => {
        console.warn('[Network] Browser went offline');
        if (typeof ToastManager !== 'undefined') {
            ToastManager.warning('You are offline. Changes will sync when you reconnect.', { duration: 5000 });
        }
        if (onOffline) onOffline();
    });
    
    window.addEventListener('online', () => {
        console.info('[Network] Browser came back online');
        if (typeof ToastManager !== 'undefined') {
            ToastManager.success('Back online!');
        }
        if (onOnline) onOnline();
    });
}

// ============================================================================
// EXPORTS
// ============================================================================

window.ERROR_CONFIG = ERROR_CONFIG;
window.ERROR_MESSAGES = ERROR_MESSAGES;
window.extractErrorCode = extractErrorCode;
window.getUserFriendlyError = getUserFriendlyError;
window.isRetryableError = isRetryableError;
window.withRetry = withRetry;
window.safeExecute = safeExecute;
window.safeStorageOperation = safeStorageOperation;
window.safeNetworkOperation = safeNetworkOperation;
window.setupGlobalErrorHandler = setupGlobalErrorHandler;
window.isOnline = isOnline;
window.setupOfflineHandling = setupOfflineHandling;
