/**
 * @fileoverview Profile management functionality.
 * Handles creating, switching, renaming, and deleting user profiles.
 */

'use strict';

// ============================================================================
// PROFILE CRUD OPERATIONS
// ============================================================================

/**
 * Creates a new profile.
 */
async function createProfile() {
    const name = await showPromptDialog('Enter new profile name:', 'New Profile', {
        title: 'Create Profile',
        placeholder: 'Profile name',
        required: true,
        validate: (value) => {
            const result = validateProfileName(value, profiles);
            return result.valid ? true : result.error;
        }
    });
    
    if (!name) return;
    
    const trimmedName = name.trim();
    
    const newId = generateId();
    profiles.push({ id: newId, name: trimmedName });
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));

    // Ensure the new profile has a storage entry (helps cloud merge / lastModified).
    try {
        const baseData = {
            semesters: [],
            settings: typeof DEFAULT_THEME_SETTINGS !== 'undefined' ? { ...DEFAULT_THEME_SETTINGS } : {},
            lastModified: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEYS.DATA_PREFIX + newId, JSON.stringify(baseData));
    } catch (err) {
        console.warn('[Profile] Failed initializing new profile data:', err);
    }

    switchProfile(newId);
    ToastManager.success(`Profile "${trimmedName}" created`);

    // Persist creation promptly so it appears on other devices.
    try {
        if (typeof forceSyncToFirebase === 'function') {
            await forceSyncToFirebase();
        }
    } catch (err) {
        console.error('[Profile] Failed to sync new profile to cloud:', err);
        ToastManager.warning('Profile created locally. Cloud sync failed.');
    }
}

/**
 * Switches to a different profile.
 * @param {string} id - Profile ID to switch to
 */
function switchProfile(id) {
    if (id === activeProfileId) return;
    
    activeProfileId = id;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, id);
    
    loadData();
    initTheme();
    renderProfileUI();
    
    // Auto-sync profile change to Firebase
    if (typeof autoSyncToFirebase === 'function') {
        autoSyncToFirebase();
    }
}

/**
 * Renames the current profile.
 */
async function renameProfile() {
    const profile = profiles.find(p => p.id === activeProfileId);
    if (!profile) return;
    
    const newName = await showPromptDialog('Rename profile:', profile.name, {
        title: 'Rename Profile',
        placeholder: 'Profile name',
        required: true,
        validate: (value) => {
            if (value.trim() === profile.name) return true; // Same name is OK
            const result = validateProfileName(value, profiles, activeProfileId);
            return result.valid ? true : result.error;
        }
    });
    
    if (!newName) return;
    
    const trimmedName = newName.trim();
    if (trimmedName === profile.name) return;
    
    profile.name = trimmedName;
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    renderProfileUI();
    ToastManager.success(`Profile renamed to "${trimmedName}"`);

    // Treat rename as a meaningful change: bump lastModified so the rename wins merges.
    try {
        if (typeof saveData === 'function') {
            saveData();
        } else {
            const key = STORAGE_KEYS.DATA_PREFIX + activeProfileId;
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : { semesters: [], settings: {} };
            parsed.lastModified = new Date().toISOString();
            localStorage.setItem(key, JSON.stringify(parsed));
        }
    } catch (err) {
        console.warn('[Profile] Failed bumping lastModified on rename:', err);
    }

    // Persist rename promptly so it doesn't revert after refresh / merge.
    try {
        if (typeof forceSyncToFirebase === 'function') {
            await forceSyncToFirebase();
        }
    } catch (err) {
        console.error('[Profile] Failed to sync rename to cloud:', err);
    }
}

/**
 * Deletes the current profile.
 */
async function deleteProfile() {
    const profile = profiles.find(p => p.id === activeProfileId);
    const profileName = profile?.name || 'this profile';
    
    const confirmed = await showConfirmDialog(
        `Are you sure you want to delete "${profileName}"?`,
        {
            title: 'Delete Profile',
            description: 'This will permanently delete this profile and all its data. This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            dangerous: true
        }
    );
    
    if (!confirmed) return;

    const idToDelete = activeProfileId;

    if (profiles.length === 1) {
        // Deleting the last profile: Create a new default one
        const newId = generateId();
        profiles = [{ id: newId, name: 'Default Profile' }];
        localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, newId);
        localStorage.removeItem(STORAGE_KEYS.DATA_PREFIX + idToDelete);
    } else {
        // Switch to another profile first
        const otherProfile = profiles.find(p => p.id !== idToDelete);
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, otherProfile.id);
        
        // Remove deleted profile
        profiles = profiles.filter(p => p.id !== idToDelete);
        localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
        localStorage.removeItem(STORAGE_KEYS.DATA_PREFIX + idToDelete);
    }
    
    ToastManager.success(`Profile "${profileName}" deleted`);
    
    // If signed in, push the updated profile list to Firebase BEFORE reload.
    // Otherwise, the cloud merge on page load can re-add the deleted profile.
    try {
        if (typeof forceSyncToFirebase === 'function') {
            await forceSyncToFirebase();
        } else if (typeof autoSyncToFirebase === 'function') {
            // Fallback (debounced) — better than nothing.
            autoSyncToFirebase();
            await new Promise((r) => setTimeout(r, 900));
        }
    } catch (err) {
        console.error('[Profile] Failed to sync deletion to cloud before reload:', err);
    }

    location.reload();
}

// ============================================================================
// PROFILE EXPORT/IMPORT
// ============================================================================

/**
 * Exports the current profile data as a JSON file.
 */
function exportProfile() {
    const profile = profiles.find(p => p.id === activeProfileId);
    if (!profile) return;
    
    const exportObj = {
        meta: {
            version: EXPORT_DATA_VERSION,
            profileName: profile.name,
            exportDate: new Date().toISOString()
        },
        data: appData
    };

    const dataStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const safeName = profile.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `tollab-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Imports profile data from a JSON file.
 * @param {File} file - The JSON file to import
 */
function importProfile(file) {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const importedJson = JSON.parse(e.target.result);
            
            // Handle both old and new formats
            let dataToImport = importedJson;
            let profileName = 'Imported Profile';

            if (importedJson.meta && importedJson.data) {
                dataToImport = importedJson.data;
                profileName = importedJson.meta.profileName || 'Imported Profile';
            }

            // Validate data structure using the new validation system
            const validation = validateImportedData(dataToImport);
            if (!validation.valid) {
                await showAlertDialog(validation.error, {
                    title: 'Import Failed',
                    type: 'error'
                });
                return;
            }
            
            // Show warnings if any
            if (validation.warnings.length > 0) {
                console.warn('[Import] Warnings:', validation.warnings);
            }

            // Create new profile with unique name
            const newId = generateId();
            const newName = getUniqueProfileName(profileName);

            profiles.push({ id: newId, name: newName });
            localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
            
            // Save migrated data
            const migratedData = migrateData(dataToImport);
            localStorage.setItem(STORAGE_KEYS.DATA_PREFIX + newId, JSON.stringify(migratedData));
            
            // Switch to imported profile
            switchProfile(newId);
            ToastManager.success(`Imported as "${newName}"`, {
                description: validation.warnings.length > 0 
                    ? `${validation.warnings.length} warning(s) - check console`
                    : undefined
            });
            closeModal('settings-modal');

            // Persist import promptly so it appears on other devices.
            try {
                if (typeof forceSyncToFirebase === 'function') {
                    await forceSyncToFirebase();
                }
            } catch (err) {
                console.error('[Profile] Failed to sync imported profile to cloud:', err);
            }

        } catch (err) {
            console.error('[Import] Error:', err);
            await showAlertDialog('Error importing data: ' + err.message, {
                title: 'Import Failed',
                type: 'error'
            });
        }
    };
    
    reader.onerror = () => {
        showAlertDialog('Error reading file. Please try again.', {
            title: 'Import Failed',
            type: 'error'
        });
    };
    
    reader.readAsText(file);
}

/**
 * Gets a unique profile name by appending a number if necessary.
 * @param {string} baseName - Base name for the profile
 * @returns {string} Unique profile name
 */
function getUniqueProfileName(baseName) {
    const trimmed = baseName.trim();
    if (!profiles.some(p => p.name === trimmed)) {
        return trimmed;
    }
    
    let counter = 2;
    while (profiles.some(p => p.name === `${trimmed} (${counter})`)) {
        counter++;
    }
    return `${trimmed} (${counter})`;
}
