/**
 * @fileoverview Toast notification system for user feedback.
 * Provides non-blocking notifications for success, error, warning, and info messages.
 */

'use strict';

// ============================================================================
// TOAST CONFIGURATION
// ============================================================================

/**
 * Toast configuration constants.
 * @const {Object}
 */
const TOAST_CONFIG = Object.freeze({
    /** Default duration for auto-dismiss (ms) */
    DEFAULT_DURATION: 4000,
    /** Duration for error toasts (ms) */
    ERROR_DURATION: 6000,
    /** Maximum number of toasts visible at once */
    MAX_VISIBLE: 5,
    /** Animation duration for slide in/out (ms) */
    ANIMATION_DURATION: 300,
    /** Position of toast container */
    POSITION: 'bottom-right'
});

/**
 * Toast type configurations.
 * @const {Object}
 */
const TOAST_TYPES = Object.freeze({
    success: {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        className: 'toast-success'
    },
    error: {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        className: 'toast-error'
    },
    warning: {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        className: 'toast-warning'
    },
    info: {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
        className: 'toast-info'
    }
});

// ============================================================================
// TOAST MANAGER
// ============================================================================

/**
 * Toast notification manager.
 * Handles creation, display, and removal of toast notifications.
 */
const ToastManager = (() => {
    /** @type {HTMLElement|null} Toast container element */
    let container = null;
    
    /** @type {Array<{id: string, element: HTMLElement, timeoutId: number|null}>} Active toasts */
    const activeToasts = [];
    
    /** @type {number} Toast ID counter */
    let toastIdCounter = 0;

    /**
     * Initializes the toast container if not already created.
     */
    function ensureContainer() {
        if (container && document.body.contains(container)) return;
        
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = `toast-container toast-${TOAST_CONFIG.POSITION}`;
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }

    /**
     * Creates a toast element.
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, error, warning, info)
     * @param {Object} options - Additional options
     * @returns {HTMLElement} Toast element
     */
    function createToastElement(message, type, options = {}) {
        const config = TOAST_TYPES[type] || TOAST_TYPES.info;
        const toast = document.createElement('div');
        const toastId = `toast-${++toastIdCounter}`;
        
        toast.id = toastId;
        toast.className = `toast ${config.className}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
        
        const hasAction = options.action && options.actionLabel;
        
        toast.innerHTML = `
            <div class="toast-icon">${config.icon}</div>
            <div class="toast-content">
                <div class="toast-message">${escapeHtml(message)}</div>
                ${options.description ? `<div class="toast-description">${escapeHtml(options.description)}</div>` : ''}
            </div>
            ${hasAction ? `<button class="toast-action" data-action="custom">${escapeHtml(options.actionLabel)}</button>` : ''}
            <button class="toast-close" aria-label="Dismiss notification">&times;</button>
            ${options.progress !== false ? '<div class="toast-progress"></div>' : ''}
        `;
        
        // Bind events
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => removeToast(toastId));
        
        if (hasAction) {
            const actionBtn = toast.querySelector('.toast-action');
            actionBtn.addEventListener('click', () => {
                options.action();
                removeToast(toastId);
            });
        }
        
        return toast;
    }

    /**
     * Shows a toast notification.
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, error, warning, info)
     * @param {Object} options - Additional options
     * @returns {string} Toast ID for programmatic control
     */
    function show(message, type = 'info', options = {}) {
        ensureContainer();
        
        // Remove oldest toasts if exceeding max
        while (activeToasts.length >= TOAST_CONFIG.MAX_VISIBLE) {
            const oldest = activeToasts.shift();
            if (oldest) {
                clearTimeout(oldest.timeoutId);
                oldest.element.remove();
            }
        }
        
        const toast = createToastElement(message, type, options);
        container.appendChild(toast);
        
        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('toast-visible');
        });
        
        // Auto-dismiss
        const duration = options.duration ?? 
            (type === 'error' ? TOAST_CONFIG.ERROR_DURATION : TOAST_CONFIG.DEFAULT_DURATION);
        
        let timeoutId = null;
        if (duration > 0 && !options.persistent) {
            // Set progress bar animation
            const progressBar = toast.querySelector('.toast-progress');
            if (progressBar) {
                progressBar.style.animationDuration = `${duration}ms`;
            }
            
            timeoutId = setTimeout(() => removeToast(toast.id), duration);
        }
        
        activeToasts.push({ id: toast.id, element: toast, timeoutId });
        
        return toast.id;
    }

    /**
     * Removes a toast by ID.
     * @param {string} toastId - Toast ID to remove
     */
    function removeToast(toastId) {
        const index = activeToasts.findIndex(t => t.id === toastId);
        if (index === -1) return;
        
        const { element, timeoutId } = activeToasts[index];
        activeToasts.splice(index, 1);
        
        if (timeoutId) clearTimeout(timeoutId);
        
        element.classList.remove('toast-visible');
        element.classList.add('toast-hiding');
        
        setTimeout(() => {
            element.remove();
        }, TOAST_CONFIG.ANIMATION_DURATION);
    }

    /**
     * Removes all active toasts.
     */
    function clearAll() {
        [...activeToasts].forEach(({ id }) => removeToast(id));
    }

    // Public API
    return {
        /**
         * Shows a success toast.
         * @param {string} message - Success message
         * @param {Object} options - Additional options
         * @returns {string} Toast ID
         */
        success: (message, options = {}) => show(message, 'success', options),
        
        /**
         * Shows an error toast.
         * @param {string} message - Error message
         * @param {Object} options - Additional options
         * @returns {string} Toast ID
         */
        error: (message, options = {}) => show(message, 'error', options),
        
        /**
         * Shows a warning toast.
         * @param {string} message - Warning message
         * @param {Object} options - Additional options
         * @returns {string} Toast ID
         */
        warning: (message, options = {}) => show(message, 'warning', options),
        
        /**
         * Shows an info toast.
         * @param {string} message - Info message
         * @param {Object} options - Additional options
         * @returns {string} Toast ID
         */
        info: (message, options = {}) => show(message, 'info', options),
        
        /**
         * Shows a toast with custom type.
         * @param {string} message - Toast message
         * @param {string} type - Toast type
         * @param {Object} options - Additional options
         * @returns {string} Toast ID
         */
        show,
        
        /**
         * Removes a specific toast.
         * @param {string} toastId - Toast ID to remove
         */
        dismiss: removeToast,
        
        /**
         * Removes all toasts.
         */
        clearAll
    };
})();

// ============================================================================
// CONFIRMATION DIALOG (Non-blocking replacement for confirm())
// ============================================================================

/**
 * Shows a confirmation dialog (non-blocking replacement for confirm()).
 * @param {string} message - Confirmation message
 * @param {Object} options - Dialog options
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled
 */
function showConfirmDialog(message, options = {}) {
    return new Promise((resolve) => {
        const modalId = 'confirm-dialog-modal';
        
        // Remove existing confirm modal if present
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        
        const title = options.title || 'Confirm';
        const confirmText = options.confirmText || 'Confirm';
        const cancelText = options.cancelText || 'Cancel';
        const isDangerous = options.dangerous === true;
        
        modal.innerHTML = `
            <div class="modal confirm-dialog-modal">
                <div class="modal-header">
                    <h2 class="modal-title">${escapeHtml(title)}</h2>
                </div>
                <div class="modal-body">
                    <p class="confirm-dialog-message">${escapeHtml(message)}</p>
                    ${options.description ? `<p class="confirm-dialog-description">${escapeHtml(options.description)}</p>` : ''}
                </div>
                <div class="modal-actions confirm-dialog-actions">
                    <button class="btn-secondary confirm-dialog-cancel">${escapeHtml(cancelText)}</button>
                    <button class="${isDangerous ? 'btn-danger' : 'btn-primary'} confirm-dialog-confirm">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Activate modal
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });
        
        const cleanup = (result) => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.remove();
                // Restore body scroll if no other modals are open
                const activeModals = document.querySelectorAll('.modal-overlay.active');
                if (activeModals.length === 0) {
                    document.body.style.overflow = '';
                }
            }, 300);
            resolve(result);
        };
        
        // Event handlers
        modal.querySelector('.confirm-dialog-confirm').addEventListener('click', () => cleanup(true));
        modal.querySelector('.confirm-dialog-cancel').addEventListener('click', () => cleanup(false));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cleanup(false);
        });
        
        // Keyboard handling
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                cleanup(false);
                document.removeEventListener('keydown', handleKeydown);
            } else if (e.key === 'Enter') {
                cleanup(true);
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
        
        // Focus confirm button
        modal.querySelector('.confirm-dialog-confirm').focus();
    });
}

// ============================================================================
// PROMPT DIALOG (Non-blocking replacement for prompt())
// ============================================================================

/**
 * Shows a prompt dialog (non-blocking replacement for prompt()).
 * @param {string} message - Prompt message
 * @param {string} defaultValue - Default input value
 * @param {Object} options - Dialog options
 * @returns {Promise<string|null>} Resolves to input value if confirmed, null if cancelled
 */
function showPromptDialog(message, defaultValue = '', options = {}) {
    return new Promise((resolve) => {
        const modalId = 'prompt-dialog-modal';
        
        // Remove existing prompt modal if present
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        
        const title = options.title || 'Input Required';
        const confirmText = options.confirmText || 'OK';
        const cancelText = options.cancelText || 'Cancel';
        const placeholder = options.placeholder || '';
        const inputType = options.inputType || 'text';
        
        modal.innerHTML = `
            <div class="modal prompt-dialog-modal">
                <div class="modal-header">
                    <h2 class="modal-title">${escapeHtml(title)}</h2>
                </div>
                <div class="modal-body">
                    <p class="prompt-dialog-message">${escapeHtml(message)}</p>
                    <input type="${inputType}" class="prompt-dialog-input" value="${escapeHtml(defaultValue)}" placeholder="${escapeHtml(placeholder)}">
                    ${options.validationMessage ? `<p class="prompt-dialog-validation hidden">${escapeHtml(options.validationMessage)}</p>` : ''}
                </div>
                <div class="modal-actions prompt-dialog-actions">
                    <button class="btn-secondary prompt-dialog-cancel">${escapeHtml(cancelText)}</button>
                    <button class="btn-primary prompt-dialog-confirm">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Activate modal
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });
        
        const input = modal.querySelector('.prompt-dialog-input');
        const validationMsg = modal.querySelector('.prompt-dialog-validation');
        
        const cleanup = (result) => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.remove();
                const activeModals = document.querySelectorAll('.modal-overlay.active');
                if (activeModals.length === 0) {
                    document.body.style.overflow = '';
                }
            }, 300);
            resolve(result);
        };
        
        const validateAndSubmit = () => {
            const value = input.value.trim();
            
            // Custom validation
            if (options.validate) {
                const validationResult = options.validate(value);
                if (validationResult !== true) {
                    if (validationMsg) {
                        validationMsg.textContent = validationResult || 'Invalid input';
                        validationMsg.classList.remove('hidden');
                    }
                    input.classList.add('input-error');
                    input.focus();
                    return;
                }
            }
            
            // Required validation
            if (options.required && !value) {
                if (validationMsg) {
                    validationMsg.textContent = 'This field is required';
                    validationMsg.classList.remove('hidden');
                }
                input.classList.add('input-error');
                input.focus();
                return;
            }
            
            cleanup(value || null);
        };
        
        // Event handlers
        modal.querySelector('.prompt-dialog-confirm').addEventListener('click', validateAndSubmit);
        modal.querySelector('.prompt-dialog-cancel').addEventListener('click', () => cleanup(null));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cleanup(null);
        });
        
        // Input validation feedback
        input.addEventListener('input', () => {
            input.classList.remove('input-error');
            if (validationMsg) validationMsg.classList.add('hidden');
        });
        
        // Keyboard handling
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                validateAndSubmit();
            } else if (e.key === 'Escape') {
                cleanup(null);
            }
        });
        
        // Focus and select input
        input.focus();
        input.select();
    });
}

// ============================================================================
// ALERT DIALOG (Non-blocking replacement for alert())
// ============================================================================

/**
 * Shows an alert dialog (non-blocking replacement for alert()).
 * @param {string} message - Alert message
 * @param {Object} options - Dialog options
 * @returns {Promise<void>} Resolves when dialog is dismissed
 */
function showAlertDialog(message, options = {}) {
    return new Promise((resolve) => {
        const modalId = 'alert-dialog-modal';
        
        // Remove existing alert modal if present
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        
        const title = options.title || 'Notice';
        const confirmText = options.confirmText || 'OK';
        const type = options.type || 'info'; // info, success, warning, error
        
        const icons = {
            info: TOAST_TYPES.info.icon,
            success: TOAST_TYPES.success.icon,
            warning: TOAST_TYPES.warning.icon,
            error: TOAST_TYPES.error.icon
        };
        
        modal.innerHTML = `
            <div class="modal alert-dialog-modal alert-dialog-${type}">
                <div class="modal-header">
                    <div class="alert-dialog-icon">${icons[type] || icons.info}</div>
                    <h2 class="modal-title">${escapeHtml(title)}</h2>
                </div>
                <div class="modal-body">
                    <p class="alert-dialog-message">${escapeHtml(message)}</p>
                    ${options.description ? `<p class="alert-dialog-description">${escapeHtml(options.description)}</p>` : ''}
                </div>
                <div class="modal-actions alert-dialog-actions">
                    <button class="btn-primary alert-dialog-confirm">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });
        
        const cleanup = () => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.remove();
                const activeModals = document.querySelectorAll('.modal-overlay.active');
                if (activeModals.length === 0) {
                    document.body.style.overflow = '';
                }
            }, 300);
            resolve();
        };
        
        modal.querySelector('.alert-dialog-confirm').addEventListener('click', cleanup);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cleanup();
        });
        
        const handleKeydown = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
                cleanup();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
        
        modal.querySelector('.alert-dialog-confirm').focus();
    });
}

// Export for global access
window.ToastManager = ToastManager;
window.showConfirmDialog = showConfirmDialog;
window.showPromptDialog = showPromptDialog;
window.showAlertDialog = showAlertDialog;
