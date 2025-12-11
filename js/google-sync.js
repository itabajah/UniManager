/**
 * @fileoverview Google Drive synchronization for the Uni Course Manager application.
 * Handles OAuth authentication and data sync with Google Drive.
 * Includes intelligent conflict resolution for multi-device sync.
 * @version 2.0.0
 */

'use strict';

// ============================================================================
// GOOGLE API CONFIGURATION
// ============================================================================

// Configuration is loaded from google-config.js (not committed to git)
// See google-config.example.js for setup instructions
if (typeof GOOGLE_CONFIG === 'undefined') {
    console.error('⚠️ GOOGLE_CONFIG not loaded! Make sure google-config.js exists and is loaded before google-sync.js');
    console.error('To fix: Copy google-config.example.js to google-config.js and add your credentials');
}
const GOOGLE_CLIENT_ID = typeof GOOGLE_CONFIG !== 'undefined' ? GOOGLE_CONFIG.CLIENT_ID : 'YOUR_CLIENT_ID_HERE';
const GOOGLE_API_KEY = typeof GOOGLE_CONFIG !== 'undefined' ? GOOGLE_CONFIG.API_KEY : 'YOUR_API_KEY_HERE';

if (GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE' || GOOGLE_API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('⚠️ Google credentials not configured! Update google-config.js with your actual credentials.');
}
const GOOGLE_DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

/** @type {Object|null} Google API token client */
let tokenClient = null;

/** @type {boolean} Whether Google API is loaded */
let gapiInited = false;

/** @type {boolean} Whether Google Identity Services is loaded */
let gisInited = false;

// ============================================================================
// GOOGLE API INITIALIZATION
// ============================================================================

/**
 * Initialize Google API library.
 */
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

/**
 * Initialize Google API client.
 */
async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: GOOGLE_DISCOVERY_DOCS,
        });
        gapiInited = true;
        maybeEnableGoogleButtons();
    } catch (error) {
        console.error('Error initializing Google API client:', error);
        // Update UI to show error
        const statusText = $('google-status-text');
        if (statusText) {
            statusText.textContent = 'Setup Required';
            statusText.style.color = 'var(--error-border, #e74c3c)';
        }
        const statusContainer = $('google-connection-status');
        if (statusContainer) {
            statusContainer.innerHTML = '<div style="color: var(--error-border, #e74c3c); font-size: 12px;"><strong>⚠️ Google API Error</strong><br>Please add valid Google Cloud credentials in google-sync.js (lines 14-15)</div>';
        }
    }
}

/**
 * Initialize Google Identity Services.
 */
function gisLoaded() {
    if (typeof google === 'undefined' || !google.accounts) {
        console.error('Google Identity Services failed to load');
        const statusText = $('google-status-text');
        if (statusText) {
            statusText.textContent = 'Setup Required';
            statusText.style.color = 'var(--error-border, #e74c3c)';
        }
        return;
    }
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: GOOGLE_SCOPES,
            ux_mode: 'redirect', // Use redirect instead of popup to avoid COOP issues on GitHub Pages
            callback: '', // Will be set in handleAuthClick
        });
        gisInited = true;
        maybeEnableGoogleButtons();
    } catch (error) {
        console.error('Error initializing Google Identity Services:', error);
        const statusText = $('google-status-text');
        if (statusText) {
            statusText.textContent = 'Setup Required';
            statusText.style.color = 'var(--error-border, #e74c3c)';
        }
    }
}

/**
 * Enable Google buttons when both APIs are loaded.
 */
function maybeEnableGoogleButtons() {
    if (gapiInited && gisInited) {
        const connectBtn = $('connect-google-btn');
        if (connectBtn) {
            connectBtn.disabled = false;
        }
        
        // Restore saved token from localStorage
        const savedToken = localStorage.getItem('google_access_token');
        if (savedToken) {
            try {
                const tokenData = JSON.parse(savedToken);
                // Validate token structure
                if (tokenData && tokenData.access_token && tokenData.expires_in) {
                    gapi.client.setToken(tokenData);
                    console.log('✓ Restored Google token from storage');
                } else {
                    console.warn('Invalid token structure, removing');
                    localStorage.removeItem('google_access_token');
                    localStorage.removeItem('google_authenticated');
                }
            } catch (error) {
                console.log('Failed to restore token:', error);
                localStorage.removeItem('google_access_token');
                localStorage.removeItem('google_authenticated');
            }
        }
        
        updateGoogleConnectionStatus();
    }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Check if user is currently authenticated with Google.
 * @returns {boolean} True if authenticated
 * NOTE: Always check if gapi is loaded before using it
 */
function isGoogleAuthenticated() {
    // Safety check: Ensure Google API is loaded
    if (typeof gapi === 'undefined' || !gapi.client) {
        return false;
    }
    const token = gapi.client.getToken();
    return token !== null;
}

/**
 * Auto-login to Google silently (no popup).
 */
function autoLoginToGoogle() {
    if (!tokenClient) {
        console.error('Token client not initialized');
        return;
    }

    tokenClient.callback = async (resp) => {
        try {
            if (resp.error !== undefined) {
                console.log('Silent login failed - session expired. Please click Connect.');
                // Don't clear auth state yet - user might want to reconnect
                updateGoogleConnectionStatus();
                return;
            }
            
            console.log('✓ Silently restored Google session');
            
            // Sync from cloud to get latest data
            const data = await syncFromGoogleDrive();
            if (data) {
                console.log('✓ Data loaded from cloud after auto-login');
            }
            
            // Update UI
            updateGoogleConnectionStatus();
        } catch (error) {
            console.error('Error in auto-login callback:', error);
            updateGoogleConnectionStatus();
        }
    };

    // Request token silently using existing Google session
    // This will work if user has an active Google session and previously granted consent
    try {
        tokenClient.requestAccessToken({ prompt: '' });
    } catch (error) {
        console.log('Could not restore session:', error);
        updateGoogleConnectionStatus();
    }
}

/**
 * Handle Google authentication click.
 */
function handleAuthClick() {
    if (!tokenClient) {
        alert('Google API not loaded. Please refresh the page and try again.');
        return;
    }
    
    if (typeof gapi === 'undefined' || !gapi.client) {
        alert('Google API client not initialized. Please refresh the page.');
        return;
    }

    tokenClient.callback = async (resp) => {
        try {
            if (resp.error !== undefined) {
                console.error('Google auth error:', resp);
                alert('Failed to connect to Google: ' + resp.error);
                return;
            }
            
            // Get and save the token
            const token = gapi.client.getToken();
            if (token) {
                localStorage.setItem('google_access_token', JSON.stringify(token));
                localStorage.setItem('google_authenticated', 'true');
                console.log('✓ Saved Google token');
            } else {
                console.error('No token received after authentication');
                alert('Authentication succeeded but no token received. Please try again.');
                return;
            }
            
            // Initial sync after connection
            const syncSuccess = await syncToGoogleDrive();
            if (!syncSuccess) {
                console.warn('Initial sync failed, but authentication successful');
            }
            
            // Update UI after sync completes
            updateGoogleConnectionStatus();
        } catch (error) {
            console.error('Error in auth callback:', error);
            alert('An error occurred after authentication. Please try again.');
            updateGoogleConnectionStatus();
        }
    };

    try {
        if (gapi.client.getToken() === null) {
            // Prompt the user to select a Google Account and ask for consent
            // Using 'select_account' instead of 'consent' for better returning user experience
            tokenClient.requestAccessToken({ prompt: 'select_account' });
        } else {
            // Skip display of account chooser and consent dialog for an existing session.
            tokenClient.requestAccessToken({ prompt: '' });
        }
    } catch (error) {
        console.error('Error requesting access token:', error);
        alert('Failed to initiate authentication. Please try again.');
    }
}

/**
 * Handle Google disconnection.
 */
function handleDisconnectClick() {
    if (!isGoogleAuthenticated()) {
        console.log('Not authenticated, nothing to disconnect');
        return;
    }
    
    try {
        const token = gapi.client.getToken();
        if (token && token.access_token) {
            // Revoke token with Google
            if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                google.accounts.oauth2.revoke(token.access_token);
            }
        }
        
        // Clear local state
        gapi.client.setToken('');
        localStorage.removeItem('google_authenticated');
        localStorage.removeItem('google_access_token');
        
        updateGoogleConnectionStatus();
        console.log('✓ Disconnected from Google Drive');
    } catch (error) {
        console.error('Error during disconnect:', error);
        // Still clear local state even if revoke fails
        gapi.client.setToken('');
        localStorage.removeItem('google_authenticated');
        localStorage.removeItem('google_access_token');
        updateGoogleConnectionStatus();
    }
}

/**
 * Update the Google connection status UI.
 */
function updateGoogleConnectionStatus() {
    const statusText = $('google-status-text');
    const connectBtn = $('connect-google-btn');
    const disconnectBtn = $('disconnect-google-btn');
    const statusContainer = $('google-connection-status');
    const headerIcon = $('google-sync-icon');
    
    const authenticated = isGoogleAuthenticated();
    const wasAuthenticated = localStorage.getItem('google_authenticated') === 'true';
    
    // Update header icon
    if (headerIcon) {
        if (!gapiInited || !gisInited) {
            headerIcon.setAttribute('data-state', 'disconnected');
            headerIcon.setAttribute('title', 'Loading Google API...');
        } else if (authenticated) {
            headerIcon.setAttribute('data-state', 'connected');
            headerIcon.setAttribute('title', 'Connected to Google Drive');
        } else if (wasAuthenticated && !authenticated) {
            headerIcon.setAttribute('data-state', 'reconnect');
            headerIcon.setAttribute('title', 'Reconnect to Google Drive');
        } else {
            headerIcon.setAttribute('data-state', 'disconnected');
            headerIcon.setAttribute('title', 'Connect to Google Drive');
        }
    }
    
    // Update settings modal UI (if elements exist)
    if (!statusText || !connectBtn || !disconnectBtn || !statusContainer) return;

    // Check if Google API is loaded
    if (!gapiInited || !gisInited) {
        statusText.textContent = 'Loading Google API...';
        statusText.style.color = 'var(--text-tertiary)';
        statusContainer.style.background = 'var(--bg-tertiary)';
        statusContainer.style.borderLeft = 'none';
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'none';
        return;
    }
    
    if (authenticated) {
        statusText.textContent = 'Connected ✓';
        statusText.style.color = 'var(--green, #27ae60)';
        statusContainer.style.background = 'var(--bg-tertiary)';
        statusContainer.style.borderLeft = '3px solid var(--green, #27ae60)';
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'block';
    } else {
        statusText.textContent = 'Not connected';
        statusText.style.color = 'var(--text-secondary)';
        statusContainer.style.background = 'var(--bg-secondary)';
        statusContainer.style.borderLeft = 'none';
        connectBtn.style.display = 'block';
        disconnectBtn.style.display = 'none';
    }
}

// ============================================================================
// GOOGLE DRIVE SYNC
// ============================================================================

/** @type {string} Folder name in Google Drive AppData */
const DRIVE_FOLDER_NAME = 'unimanager_data';

/** @type {string|null} Cached Drive folder ID */
let driveFolderId = null;

/** @type {Object|null} Pending conflict resolution data */
let pendingConflict = null;

/**
 * Get or create the app folder in Google Drive AppData.
 * @returns {Promise<string>} Folder ID
 */
async function getOrCreateDriveFolder() {
    if (driveFolderId) return driveFolderId;

    try {
        // Search for existing folder
        const response = await gapi.client.drive.files.list({
            q: "name='unimanager_data' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            spaces: 'appDataFolder',
            fields: 'files(id, name)',
        });

        if (response.result.files && response.result.files.length > 0) {
            driveFolderId = response.result.files[0].id;
            return driveFolderId;
        }

        // Create folder if it doesn't exist
        const createResponse = await gapi.client.drive.files.create({
            resource: {
                name: 'unimanager_data',
                mimeType: 'application/vnd.google-apps.folder',
                parents: ['appDataFolder'],
            },
            fields: 'id',
        });

        driveFolderId = createResponse.result.id;
        return driveFolderId;
    } catch (error) {
        console.error('Error getting/creating Drive folder:', error);
        throw error;
    }
}

/**
 * Get the filename for a profile in Drive.
 * @param {string} profileId - Profile ID
 * @returns {string} Filename
 */
function getProfileFileName(profileId) {
    return `profile_${profileId}.json`;
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

/**
 * Create a backup of current app data in localStorage.
 * @returns {string} Backup key
 */
function createBackup() {
    const profileId = getActiveProfileId();
    if (!profileId) {
        console.error('Cannot create backup: no active profile');
        return null;
    }
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupKey = `unimanager_backup_${profileId}_${timestamp}`;
        localStorage.setItem(backupKey, JSON.stringify(window.appData));
        console.log('✓ Created backup:', backupKey);
        return backupKey;
    } catch (error) {
        console.error('Failed to create backup:', error);
        if (error.name === 'QuotaExceededError') {
            alert('Storage quota exceeded. Cannot create backup. Please clear old backups.');
        }
        return null;
    }
}

/**
 * Merge two datasets intelligently.
 * Combines unique items from both based on IDs.
 * @param {Object} localData - Local app data
 * @param {Object} cloudData - Cloud app data
 * @returns {Object} Merged data
 */
function mergeData(localData, cloudData) {
    // Validate inputs
    if (!localData || !cloudData) {
        console.error('Invalid merge data:', { localData, cloudData });
        return localData || cloudData || { semesters: [], settings: {}, lastModified: new Date().toISOString() };
    }
    
    const merged = {
        semesters: [],
        settings: { ...cloudData.settings, ...localData.settings }, // Local settings win
        lastModified: new Date().toISOString()
    };
    
    // Ensure semesters arrays exist
    const localSemesters = Array.isArray(localData.semesters) ? localData.semesters : [];
    const cloudSemesters = Array.isArray(cloudData.semesters) ? cloudData.semesters : [];
    
    // Create maps for quick lookup
    const localSemestersMap = new Map(localSemesters.filter(s => s && s.id).map(s => [s.id, s]));
    const cloudSemestersMap = new Map(cloudSemesters.filter(s => s && s.id).map(s => [s.id, s]));
    
    // Merge semesters
    const allSemesterIds = new Set([...localSemestersMap.keys(), ...cloudSemestersMap.keys()]);
    
    allSemesterIds.forEach(semId => {
        const localSem = localSemestersMap.get(semId);
        const cloudSem = cloudSemestersMap.get(semId);
        
        if (localSem && cloudSem) {
            // Both have this semester - merge courses
            merged.semesters.push(mergeSemester(localSem, cloudSem));
        } else {
            // Only one has it - take whichever exists
            merged.semesters.push(localSem || cloudSem);
        }
    });
    
    return merged;
}

/**
 * Merge two semesters.
 * @param {Object} localSem - Local semester
 * @param {Object} cloudSem - Cloud semester
 * @returns {Object} Merged semester
 */
function mergeSemester(localSem, cloudSem) {
    const merged = {
        ...cloudSem,
        ...localSem,
        courses: []
    };
    
    // Ensure courses arrays exist
    const localCourses = Array.isArray(localSem.courses) ? localSem.courses : [];
    const cloudCourses = Array.isArray(cloudSem.courses) ? cloudSem.courses : [];
    
    // Merge courses
    const localCoursesMap = new Map(localCourses.filter(c => c && c.id).map(c => [c.id, c]));
    const cloudCoursesMap = new Map(cloudCourses.filter(c => c && c.id).map(c => [c.id, c]));
    const allCourseIds = new Set([...localCoursesMap.keys(), ...cloudCoursesMap.keys()]);
    
    allCourseIds.forEach(courseId => {
        const localCourse = localCoursesMap.get(courseId);
        const cloudCourse = cloudCoursesMap.get(courseId);
        
        if (localCourse && cloudCourse) {
            // Both have this course - merge items
            merged.courses.push(mergeCourse(localCourse, cloudCourse));
        } else {
            merged.courses.push(localCourse || cloudCourse);
        }
    });
    
    return merged;
}

/**
 * Merge two courses.
 * @param {Object} localCourse - Local course
 * @param {Object} cloudCourse - Cloud course
 * @returns {Object} Merged course
 */
function mergeCourse(localCourse, cloudCourse) {
    const merged = {
        ...cloudCourse,
        ...localCourse,
        items: []
    };
    
    // Ensure items arrays exist
    const localItems = Array.isArray(localCourse.items) ? localCourse.items : [];
    const cloudItems = Array.isArray(cloudCourse.items) ? cloudCourse.items : [];
    
    // Merge homework, exams, recordings
    const localItemsMap = new Map(localItems.filter(i => i && i.id).map(i => [i.id, i]));
    const cloudItemsMap = new Map(cloudItems.filter(i => i && i.id).map(i => [i.id, i]));
    const allItemIds = new Set([...localItemsMap.keys(), ...cloudItemsMap.keys()]);
    
    allItemIds.forEach(itemId => {
        const localItem = localItemsMap.get(itemId);
        const cloudItem = cloudItemsMap.get(itemId);
        
        if (localItem && cloudItem) {
            // Use most recently modified (if timestamps available)
            // Otherwise prefer local
            merged.items.push(localItem);
        } else {
            merged.items.push(localItem || cloudItem);
        }
    });
    
    return merged;
}

/**
 * Show conflict resolution modal.
 * @param {Object} localData - Local data
 * @param {Object} cloudData - Cloud data
 * @returns {Promise<string>} User's choice: 'cloud', 'local', 'merge', or 'cancel'
 */
function showConflictModal(localData, cloudData) {
    return new Promise((resolve) => {
        const modal = $('sync-conflict-modal');
        const details = $('conflict-details');
        
        // Format conflict details
        const localDate = localData.lastModified ? new Date(localData.lastModified).toLocaleString() : 'Unknown';
        const cloudDate = cloudData.lastModified ? new Date(cloudData.lastModified).toLocaleString() : 'Unknown';
        
        const localCourses = localData.semesters?.reduce((sum, s) => sum + (s.courses?.length || 0), 0) || 0;
        const cloudCourses = cloudData.semesters?.reduce((sum, s) => sum + (s.courses?.length || 0), 0) || 0;
        
        details.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <strong style="color: var(--text-primary);">Local Data</strong>
                    <div style="margin-top: 8px; color: var(--text-secondary);">
                        <div>Modified: ${localDate}</div>
                        <div>Courses: ${localCourses}</div>
                        <div>Semesters: ${localData.semesters?.length || 0}</div>
                    </div>
                </div>
                <div>
                    <strong style="color: var(--text-primary);">Cloud Data</strong>
                    <div style="margin-top: 8px; color: var(--text-secondary);">
                        <div>Modified: ${cloudDate}</div>
                        <div>Courses: ${cloudCourses}</div>
                        <div>Semesters: ${cloudData.semesters?.length || 0}</div>
                    </div>
                </div>
            </div>
        `;
        
        // Show modal
        modal.classList.add('active');
        
        // Button handlers
        const useCloud = $('conflict-use-cloud');
        const useLocal = $('conflict-use-local');
        const merge = $('conflict-merge');
        const cancel = $('conflict-cancel');
        
        // Timeout safety - auto-cancel after 5 minutes to prevent memory leaks
        let timeoutId = setTimeout(() => {
            console.warn('Conflict modal timed out, auto-cancelling');
            cleanup();
            resolve('cancel');
        }, 300000); // 5 minutes
        
        const cleanup = () => {
            clearTimeout(timeoutId);
            modal.classList.remove('active');
            useCloud.onclick = null;
            useLocal.onclick = null;
            merge.onclick = null;
            cancel.onclick = null;
        };
        
        useCloud.onclick = () => {
            cleanup();
            resolve('cloud');
        };
        
        useLocal.onclick = () => {
            cleanup();
            resolve('local');
        };
        
        merge.onclick = () => {
            cleanup();
            resolve('merge');
        };
        
        cancel.onclick = () => {
            cleanup();
            resolve('cancel');
        };
    });
}

/**
 * Check for conflicts and upload to Drive with conflict resolution.
 * @param {boolean} forceUpload - Skip conflict check and force upload
 * @returns {Promise<boolean>} Success status
 */
async function syncToGoogleDrive(forceUpload = false) {
    if (!isGoogleAuthenticated()) {
        console.log('Not authenticated with Google, skipping sync');
        return false;
    }

    try {
        const activeProfileId = getActiveProfileId();
        if (!activeProfileId) {
            console.error('No active profile to sync');
            return false;
        }

        const folderId = await getOrCreateDriveFolder();
        const fileName = getProfileFileName(activeProfileId);
        const localData = window.appData;

        if (!localData) {
            console.error('No profile data to sync');
            return false;
        }

        // Check if file exists in cloud
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
            spaces: 'appDataFolder',
            fields: 'files(id, name)',
        });

        let fileId = searchResponse.result.files?.[0]?.id || null;
        
        // If file exists and not forcing, check for conflicts
        if (fileId && !forceUpload) {
            const cloudData = await downloadFromDrive(fileId);
            
            if (cloudData && cloudData.data) {
                // Check if there's a conflict
                const localTime = new Date(localData.lastModified || 0).getTime();
                const cloudTime = new Date(cloudData.data.lastModified || 0).getTime();
                
                // If cloud has data and timestamps differ significantly (more than 1 second)
                if (Math.abs(cloudTime - localTime) > 1000) {
                    console.log('Conflict detected - showing resolution modal');
                    const choice = await showConflictModal(localData, cloudData.data);
                    
                    if (choice === 'cancel') {
                        console.log('User cancelled sync');
                        return false;
                    } else if (choice === 'cloud') {
                        // User wants cloud data - load it
                        if (!createBackup()) {
                            alert('Failed to create backup. Sync cancelled for safety.');
                            return false;
                        }
                        window.appData = cloudData.data;
                        if (typeof saveData === 'function') {
                            saveData();
                        } else {
                            const profileKey = 'unimanager_data_' + activeProfileId;
                            localStorage.setItem(profileKey, JSON.stringify(window.appData));
                        }
                        // Notify and reload
                        alert('Cloud data loaded. Page will refresh to display changes.');
                        try {
                            location.reload();
                        } catch (reloadError) {
                            console.error('Reload failed:', reloadError);
                            alert('Failed to reload page. Please refresh manually.');
                        }
                        return true;
                    } else if (choice === 'merge') {
                        // Merge both datasets
                        if (!createBackup()) {
                            alert('Failed to create backup. Merge cancelled for safety.');
                            return false;
                        }
                        const merged = mergeData(localData, cloudData.data);
                        if (!merged) {
                            alert('Merge failed due to data validation error. Sync cancelled.');
                            return false;
                        }
                        window.appData = merged;
                        if (typeof saveData === 'function') {
                            saveData();
                        } else {
                            const profileKey = 'unimanager_data_' + activeProfileId;
                            localStorage.setItem(profileKey, JSON.stringify(window.appData));
                        }
                        // Continue to upload merged data
                    }
                    // If 'local', continue with normal upload
                }
            }
        }

        // Prepare data for upload
        const syncData = {
            profileId: activeProfileId,
            lastSync: new Date().toISOString(),
            data: localData,
        };

        const fileContent = JSON.stringify(syncData, null, 2);
        const blob = new Blob([fileContent], { type: 'application/json' });

        // Upload to Drive
        const metadata = {
            name: fileName,
            mimeType: 'application/json',
        };

        if (!fileId) {
            metadata.parents = [folderId];
        }

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const uploadUrl = fileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

        const currentToken = gapi.client.getToken();
        if (!currentToken || !currentToken.access_token) {
            console.error('No valid access token available');
            alert('Authentication expired. Please reconnect to Google Drive.');
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('google_authenticated');
            updateGoogleConnectionStatus();
            return false;
        }

        const uploadResponse = await fetch(uploadUrl, {
            method: fileId ? 'PATCH' : 'POST',
            headers: {
                Authorization: `Bearer ${currentToken.access_token}`,
            },
            body: form,
        });

        if (uploadResponse.ok) {
            console.log('✓ Successfully synced to Google Drive');
            return true;
        } else {
            console.error('Failed to upload to Drive:', await uploadResponse.text());
            return false;
        }
    } catch (error) {
        console.error('Error syncing to Google Drive:', error);
        return false;
    }
}

/**
 * Download file data from Google Drive.
 * @param {string} fileId - File ID
 * @param {number} retryCount - Number of retries attempted
 * @returns {Promise<Object|null>} File data
 */
async function downloadFromDrive(fileId, retryCount = 0) {
    const MAX_RETRIES = 3;
    
    try {
        const downloadResponse = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });
        return downloadResponse.result;
    } catch (error) {
        console.error(`Error downloading from Drive (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error);
        
        // Retry on network errors
        if (retryCount < MAX_RETRIES && (error.status === 0 || error.status >= 500)) {
            console.log(`Retrying download in ${(retryCount + 1) * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
            return downloadFromDrive(fileId, retryCount + 1);
        }
        
        return null;
    }
}

/**
 * Load profile data from Google Drive with conflict resolution.
 * @param {string} profileId - Profile ID to load (optional, uses active if not provided)
 * @param {boolean} showConflict - Whether to show conflict modal if data differs
 * @returns {Promise<Object|null>} Profile data or null
 */
async function syncFromGoogleDrive(profileId = null, showConflict = true) {
    if (!isGoogleAuthenticated()) {
        console.log('Not authenticated with Google, skipping sync');
        return null;
    }

    try {
        const targetProfileId = profileId || getActiveProfileId();
        const folderId = await getOrCreateDriveFolder();
        const fileName = getProfileFileName(targetProfileId);

        // Search for file
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
            spaces: 'appDataFolder',
            fields: 'files(id, name)',
        });

        if (!searchResponse.result.files || searchResponse.result.files.length === 0) {
            console.log('No file found in Drive for profile:', targetProfileId);
            return null;
        }

        const fileId = searchResponse.result.files[0].id;
        const syncData = await downloadFromDrive(fileId);
        
        if (!syncData || !syncData.data) {
            console.error('Invalid data from Drive');
            return null;
        }

        const cloudData = syncData.data;
        
        // If showing conflicts and local data exists, check for differences
        if (showConflict && window.appData) {
            const localTime = new Date(window.appData.lastModified || 0).getTime();
            const cloudTime = new Date(cloudData.lastModified || 0).getTime();
            
            if (Math.abs(cloudTime - localTime) > 1000) {
                const choice = await showConflictModal(window.appData, cloudData);
                
                if (choice === 'cancel') {
                    return null;
                } else if (choice === 'local') {
                    // Keep local, upload to cloud
                    await syncToGoogleDrive(true); // Force upload
                    return window.appData;
                } else if (choice === 'merge') {
                    if (!createBackup()) {
                        console.error('Failed to create backup before merge');
                        return null;
                    }
                    const merged = mergeData(window.appData, cloudData);
                    if (!merged) {
                        console.error('Merge failed due to data validation error');
                        alert('Merge failed. Data may be corrupted. Please choose "Use Cloud" or "Use Local" instead.');
                        return null;
                    }
                    // Save merged data and upload
                    window.appData = merged;
                    if (typeof saveData === 'function') {
                        saveData();
                    } else {
                        console.warn('saveData function not available, data not persisted to localStorage');
                    }
                    await syncToGoogleDrive(true); // Upload merged result
                    return merged;
                }
                // If 'cloud', return cloud data
            }
        }
        
        console.log('✓ Loaded data from Google Drive');
        return cloudData;
    } catch (error) {
        console.error('Error loading from Google Drive:', error);
        return null;
    }
}

/**
 * Auto-sync wrapper - syncs if authenticated.
 * @returns {Promise<boolean>} Success status
 */
async function autoSyncToGoogleDrive() {
    if (!isGoogleAuthenticated()) {
        return false;
    }
    
    try {
        return await syncToGoogleDrive();
    } catch (error) {
        console.error('Auto-sync failed:', error);
        // Don't show alert for auto-sync failures (user didn't initiate)
        return false;
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize Google sync when DOM is ready.
 */
function initializeGoogleSync() {
    // Prevent double initialization
    if (window.googleSyncInitialized) {
        console.warn('Google sync already initialized');
        return;
    }
    window.googleSyncInitialized = true;
    
    // Set up event listeners
    const connectBtn = $('connect-google-btn');
    if (connectBtn) {
        connectBtn.addEventListener('click', handleAuthClick);
        connectBtn.disabled = true; // Disabled until APIs load
    }

    const disconnectBtn = $('disconnect-google-btn');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', handleDisconnectClick);
    }
    
    // Header icon click handler
    const headerIcon = $('google-sync-icon');
    if (headerIcon) {
        headerIcon.addEventListener('click', () => {
            if (isGoogleAuthenticated()) {
                // Already connected, show a message or open settings
                const confirmDisconnect = confirm('You are connected to Google Drive. Do you want to disconnect?');
                if (confirmDisconnect) {
                    handleDisconnectClick();
                }
            } else {
                // Not connected, trigger authentication
                handleAuthClick();
            }
        });
    }

    // Load Google APIs with error handling
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.onload = gapiLoaded;
    gapiScript.onerror = () => {
        console.error('Failed to load Google API script');
        const statusText = $('google-status-text');
        if (statusText) {
            statusText.textContent = 'Failed to load Google API';
            statusText.style.color = 'var(--error-border, #e74c3c)';
        }
    };
    document.head.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = gisLoaded;
    gisScript.onerror = () => {
        console.error('Failed to load Google Identity Services script');
        const statusText = $('google-status-text');
        if (statusText) {
            statusText.textContent = 'Failed to load Google Identity Services';
            statusText.style.color = 'var(--error-border, #e74c3c)';
        }
    };
    document.head.appendChild(gisScript);

    // Show initial loading state
    const statusText = $('google-status-text');
    if (statusText) {
        statusText.textContent = 'Loading Google API...';
        statusText.style.color = 'var(--text-tertiary)';
    }
}

// Export functions for use in other modules
window.initializeGoogleSync = initializeGoogleSync;
window.syncToGoogleDrive = syncToGoogleDrive;
window.syncFromGoogleDrive = syncFromGoogleDrive;
window.autoSyncToGoogleDrive = autoSyncToGoogleDrive;
window.isGoogleAuthenticated = isGoogleAuthenticated;
