/**
 * @fileoverview Profile management module.
 * Handles multiple user profiles with separate data stores.
 */

import * as render from '@/render';
import { store } from '@/state';
import { $ } from '@/utils';

// ============================================================================
// UI RENDERING
// ============================================================================

/**
 * Renders the profile selector UI.
 */
export function renderProfileUI(): void {
  const profiles = store.getProfiles();
  const activeId = store.getActiveProfileId();

  const select = $('profile-select') as HTMLSelectElement | null;
  if (!select) return;

  select.innerHTML = profiles
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === activeId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
    )
    .join('');

  // Update delete button state
  const deleteBtn = $('delete-profile-btn') as HTMLButtonElement | null;
  if (deleteBtn) {
    deleteBtn.disabled = profiles.length <= 1;
  }
}

/**
 * Escapes HTML entities in a string.
 */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================================
// PROFILE ACTIONS
// ============================================================================

/**
 * Creates a new profile.
 */
export function createProfile(name: string): void {
  store.createProfile(name);
  renderProfileUI();
}

/**
 * Switches to a different profile.
 */
export function switchProfile(profileId: string): void {
  store.switchProfile(profileId);
  render.renderAll();
  renderProfileUI();
}

/**
 * Renames the current profile.
 */
export function renameProfile(newName: string): void {
  const activeId = store.getActiveProfileId();
  store.renameProfile(activeId, newName);
  renderProfileUI();
}

/**
 * Deletes the current profile.
 */
export function deleteProfile(): boolean {
  const profiles = store.getProfiles();
  if (profiles.length <= 1) {
    return false;
  }

  const activeId = store.getActiveProfileId();
  store.deleteProfile(activeId);
  render.renderAll();
  renderProfileUI();
  return true;
}

// ============================================================================
// IMPORT / EXPORT
// ============================================================================

/**
 * Exports the current profile data as a JSON file.
 */
export function exportProfile(): void {
  const data = store.getData();
  const profiles = store.getProfiles();
  const activeId = store.getActiveProfileId();
  const profile = profiles.find((p) => p.id === activeId);

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const filename = `unimanager-${profile?.name ?? 'export'}-${new Date().toISOString().split('T')[0]}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Imports profile data from a JSON file.
 */
export async function importProfile(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as unknown;

        if (!data || typeof data !== 'object' || !('semesters' in data)) {
          alert('Invalid data file. Missing required fields.');
          resolve(false);
          return;
        }

        if (!confirm('This will replace your current profile data. Continue?')) {
          resolve(false);
          return;
        }

        store.replaceData(data as Parameters<typeof store.replaceData>[0]);
        render.renderAll();
        renderProfileUI();
        resolve(true);
      } catch (err) {
        console.error('Import error:', err);
        alert('Error reading file. Please ensure it\'s a valid JSON file.');
        resolve(false);
      }
    };

    reader.onerror = () => {
      alert('Error reading file.');
      resolve(false);
    };

    reader.readAsText(file);
  });
}

/**
 * Exports all profiles as a single backup file.
 */
export function exportAllProfiles(): void {
  const profiles = store.getProfiles();
  const allData: Record<string, unknown> = {
    version: 1,
    exportDate: new Date().toISOString(),
    profiles: profiles.map((p) => ({
      id: p.id,
      name: p.name,
      data: JSON.parse(localStorage.getItem(`unimanager-data-${p.id}`) ?? '{}') as unknown,
    })),
  };

  const json = JSON.stringify(allData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const filename = `unimanager-backup-${new Date().toISOString().split('T')[0]}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Imports profiles from a backup file.
 */
export async function importAllProfiles(file: File): Promise<boolean> {
  interface BackupProfile {
    id: string;
    name: string;
    data: unknown;
  }
  
  interface BackupData {
    profiles: BackupProfile[];
  }
  
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target?.result as string) as unknown;

        if (!backup || typeof backup !== 'object' || !('profiles' in backup) || !Array.isArray((backup as BackupData).profiles)) {
          alert('Invalid backup file. Missing profiles array.');
          resolve(false);
          return;
        }

        const backupData = backup as BackupData;
        const profileCount = backupData.profiles.length;
        if (
          !confirm(
            `This will import ${profileCount} profile(s). ` +
              'Existing profiles with the same ID will be overwritten. Continue?'
          )
        ) {
          resolve(false);
          return;
        }

        for (const profileData of backupData.profiles) {
          if (!profileData.id || !profileData.name || !profileData.data) {
            continue;
          }

          // Save profile data
          localStorage.setItem(
            `unimanager-data-${profileData.id}`,
            JSON.stringify(profileData.data)
          );

          // Update profiles list
          const profiles = store.getProfiles();
          const existingIndex = profiles.findIndex((p) => p.id === profileData.id);

          if (existingIndex >= 0) {
            profiles[existingIndex].name = profileData.name;
          } else {
            profiles.push({
              id: profileData.id,
              name: profileData.name,
            });
          }

          localStorage.setItem('unimanager-profiles', JSON.stringify(profiles));
        }

        // Reload current profile data
        store.load();
        render.renderAll();
        renderProfileUI();

        alert(`Successfully imported ${profileCount} profile(s).`);
        resolve(true);
      } catch (err) {
        console.error('Import backup error:', err);
        alert('Error reading backup file.');
        resolve(false);
      }
    };

    reader.onerror = () => {
      alert('Error reading file.');
      resolve(false);
    };

    reader.readAsText(file);
  });
}

// ============================================================================
// PROFILE METADATA
// ============================================================================

/**
 * Gets profile statistics.
 */
export function getProfileStats(): {
  totalCourses: number;
  totalSemesters: number;
  totalRecordings: number;
  totalHomework: number;
} {
  const data = store.getData();

  let totalCourses = 0;
  let totalRecordings = 0;
  let totalHomework = 0;

  for (const semester of data.semesters) {
    totalCourses += semester.courses.length;

    for (const course of semester.courses) {
      if (course.recordings?.tabs) {
        for (const tab of course.recordings.tabs) {
          totalRecordings += tab.items?.length ?? 0;
        }
      }
      totalHomework += course.homework?.length ?? 0;
    }
  }

  return {
    totalCourses,
    totalSemesters: data.semesters.length,
    totalRecordings,
    totalHomework,
  };
}

/**
 * Displays profile statistics in the UI.
 */
export function displayProfileStats(): void {
  const stats = getProfileStats();
  const container = $('profile-stats');
  if (!container) return;

  container.innerHTML = `
    <div class="stat-item">
      <span class="stat-value">${stats.totalSemesters}</span>
      <span class="stat-label">Semesters</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${stats.totalCourses}</span>
      <span class="stat-label">Courses</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${stats.totalRecordings}</span>
      <span class="stat-label">Recordings</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${stats.totalHomework}</span>
      <span class="stat-label">Assignments</span>
    </div>
  `;
}
