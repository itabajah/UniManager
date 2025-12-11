/**
 * @fileoverview Google Drive synchronization for the Uni Course Manager application.
 * Handles OAuth authentication and data sync with Google Drive.
 * @version 1.0.1
 */

'use strict';

// ============================================================================
// GOOGLE API CONFIGURATION
// ============================================================================

// Configuration is loaded from google-config.js (not committed to git)
// See google-config.example.js for setup instructions
const GOOGLE_CLIENT_ID = typeof GOOGLE_CONFIG !== 'undefined' ? GOOGLE_CONFIG.CLIENT_ID : 'YOUR_CLIENT_ID_HERE';
const GOOGLE_API_KEY = typeof GOOGLE_CONFIG !== 'undefined' ? GOOGLE_CONFIG.API_KEY : 'YOUR_API_KEY_HERE';
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
 * Handle Google authentication click.
 */
function handleAuthClick() {
    if (!tokenClient) {
        alert('Google API not loaded. Please refresh the page and try again.');
        return;
    }

    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            console.error('Google auth error:', resp);
            alert('Failed to connect to Google: ' + resp.error);
            return;
        }
        
        // Store authentication state
        localStorage.setItem('google_authenticated', 'true');
        
        // Initial sync after connection
        await syncToGoogleDrive();
        
        // Update UI after sync completes
        updateGoogleConnectionStatus();
        
        alert('Successfully connected to Google Drive! Your data will now sync automatically.');
    };

    if (gapi.client.getToken() === null) {
        // Prompt the user to select a Google Account and ask for consent
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

/**
 * Handle Google disconnection.
 */
function handleDisconnectClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        localStorage.removeItem('google_authenticated');
        updateGoogleConnectionStatus();
        alert('Disconnected from Google Drive.');
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

    const authenticated = isGoogleAuthenticated();
    console.log('Update status - authenticated:', authenticated, 'token:', gapi.client.getToken());
    
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

/**
 * Save current profile data to Google Drive.
 * @returns {Promise<boolean>} Success status
 */
async function syncToGoogleDrive() {
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
        
        // Get current profile data from appData (already loaded by loadProfileData())
        const profileData = window.appData;

        if (!profileData) {
            console.error('No profile data to sync');
            return false;
        }

        // Add metadata
        const syncData = {
            profileId: activeProfileId,
            lastSync: new Date().toISOString(),
            data: profileData,
        };

        const fileContent = JSON.stringify(syncData, null, 2);
        const blob = new Blob([fileContent], { type: 'application/json' });

        // Check if file exists
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
            spaces: 'appDataFolder',
            fields: 'files(id, name)',
        });

        let fileId = null;
        if (searchResponse.result.files && searchResponse.result.files.length > 0) {
            fileId = searchResponse.result.files[0].id;
        }

        const metadata = {
            name: fileName,
            mimeType: 'application/json',
        };

        if (!fileId) {
            metadata.parents = [folderId];
        }

        // Upload file
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const uploadUrl = fileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

        const uploadResponse = await fetch(uploadUrl, {
            method: fileId ? 'PATCH' : 'POST',
            headers: {
                Authorization: `Bearer ${gapi.client.getToken().access_token}`,
            },
            body: form,
        });

        if (uploadResponse.ok) {
            console.log('Successfully synced to Google Drive');
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
 * Load profile data from Google Drive.
 * @param {string} profileId - Profile ID to load
 * @returns {Promise<Object|null>} Profile data or null
 */
async function syncFromGoogleDrive(profileId) {
    if (!isGoogleAuthenticated()) {
        console.log('Not authenticated with Google, skipping sync');
        return null;
    }

    try {
        const folderId = await getOrCreateDriveFolder();
        const fileName = getProfileFileName(profileId);

        // Search for file
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
            spaces: 'appDataFolder',
            fields: 'files(id, name)',
        });

        if (!searchResponse.result.files || searchResponse.result.files.length === 0) {
            console.log('No file found in Drive for profile:', profileId);
            return null;
        }

        const fileId = searchResponse.result.files[0].id;

        // Download file
        const downloadResponse = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        const syncData = downloadResponse.result;
        return syncData.data;
    } catch (error) {
        console.error('Error loading from Google Drive:', error);
        return null;
    }
}

/**
 * Auto-sync wrapper - syncs if authenticated.
 */
async function autoSyncToGoogleDrive() {
    if (isGoogleAuthenticated()) {
        await syncToGoogleDrive();
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize Google sync when DOM is ready.
 */
function initializeGoogleSync() {
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

    // Load Google APIs
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.onload = gapiLoaded;
    document.head.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = gisLoaded;
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
