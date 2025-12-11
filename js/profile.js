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
function createProfile() {
    const name = prompt('Enter new profile name:', 'New Profile');
    if (!name?.trim()) return;
    
    const trimmedName = name.trim();
    
    if (profiles.some(p => p.name === trimmedName)) {
        alert(`A profile named "${trimmedName}" already exists. Please choose a different name.`);
        return;
    }
    
    const newId = generateId();
    profiles.push({ id: newId, name: trimmedName });
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    
    switchProfile(newId);
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
function renameProfile() {
    const profile = profiles.find(p => p.id === activeProfileId);
    if (!profile) return;
    
    const newName = prompt('Rename profile:', profile.name);
    if (!newName?.trim()) return;
    
    const trimmedName = newName.trim();
    if (trimmedName === profile.name) return;
    
    if (profiles.some(p => p.id !== activeProfileId && p.name === trimmedName)) {
        alert(`A profile named "${trimmedName}" already exists. Please choose a different name.`);
        return;
    }
    
    profile.name = trimmedName;
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    renderProfileUI();
}

/**
 * Deletes the current profile.
 */
async function deleteProfile() {
    if (!confirm('Are you sure? This will delete the CURRENT profile and all its data.')) {
        return;
    }

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
    a.download = `course-manager-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
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
    
    reader.onload = (e) => {
        try {
            const importedJson = JSON.parse(e.target.result);
            
            // Handle both old and new formats
            let dataToImport = importedJson;
            let profileName = 'Imported Profile';

            if (importedJson.meta && importedJson.data) {
                dataToImport = importedJson.data;
                profileName = importedJson.meta.profileName || 'Imported Profile';
            }

            // Validate data structure
            if (!dataToImport.semesters || !Array.isArray(dataToImport.semesters)) {
                throw new Error('Invalid data format: Missing semesters array.');
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
            alert(`Imported as new profile: "${newName}"`);
            closeModal('settings-modal');

        } catch (err) {
            alert('Error importing data: ' + err.message);
        }
    };
    
    reader.onerror = () => {
        alert('Error reading file.');
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
