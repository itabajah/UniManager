/**
 * @fileoverview Firebase Auth (Google) + Realtime Database sync for all profiles.
 *
 * Cloud model:
 *  - One per-user node containing a single payload with ALL profiles.
 *  - Merges local + cloud on login.
 *  - Auto-syncs on local changes while authenticated.
 */

/* eslint-disable no-console */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  get,
  set,
  onValue,
  type Database,
  type DatabaseReference,
  type Unsubscribe,
} from 'firebase/database';

import { store } from '@/state';
import * as render from '@/render';
import { $ } from '@/utils';

import type { FirebaseConfig, AppData, Profile } from '@/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOG = '[FirebaseSync]';
const CLOUD_PAYLOAD_VERSION = 1;
const SYNC_DEBOUNCE_MS = 750;

const DB_PATH_FOR_USER = (uid: string) => `unimanager/users/${uid}/allProfiles`;

const UI_IDS = {
  statusText: 'cloud-status-text',
  headerText: 'cloud-header-text',
  connectBtn: 'connect-cloud-btn',
  disconnectBtn: 'disconnect-cloud-btn',
} as const;

// ============================================================================
// TYPES
// ============================================================================

interface ProfileExport {
  meta: {
    version: number;
    profileName: string;
    exportDate: string;
  };
  data: AppData;
}

interface CloudProfileItem {
  id: string;
  name: string;
  lastModified: string | null;
  export: ProfileExport;
}

interface CloudPayload {
  version: number;
  updatedAt: string;
  activeProfileId: string | null;
  profiles: CloudProfileItem[];
}

interface CloudRecord {
  version: number;
  updatedAt: string;
  writeId: string;
  originClientId: string;
  payload: CloudPayload;
}

// ============================================================================
// STATE
// ============================================================================

let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;
let database: Database | null = null;

let initialized = false;
let currentUser: User | null = null;
let clientId: string | null = null;
let lastLocalWriteId: string | null = null;
let isApplyingRemote = false;
let pendingSyncTimer: ReturnType<typeof setTimeout> | null = null;
let dbUnsubscribe: Unsubscribe | null = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function ensureClientId(): string {
  try {
    const key = 'unimanager_firebase_client_id';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const fresh = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function setStatus(text: string): void {
  const statusEl = $(UI_IDS.statusText);
  if (statusEl) statusEl.textContent = text;

  const headerEl = $(UI_IDS.headerText);
  if (headerEl) headerEl.textContent = text;
}

function showElement(el: HTMLElement | null, shouldShow: boolean): void {
  if (el) el.style.display = shouldShow ? '' : 'none';
}

function isMobileView(): boolean {
  return window.matchMedia?.('(max-width: 768px)').matches ?? false;
}

function formatSyncedStatus(user: User | null): string {
  if (!user) return 'Not connected';
  if (isMobileView()) return 'Synced';
  return user.email ? `Synced (${user.email})` : 'Synced';
}

function updateUIForAuthState(user: User | null): void {
  const connectBtn = $(UI_IDS.connectBtn);
  const disconnectBtn = $(UI_IDS.disconnectBtn);

  if (!user) {
    setStatus('Not connected');
    showElement(connectBtn, true);
    showElement(disconnectBtn, false);
    return;
  }

  setStatus(formatSyncedStatus(user));
  showElement(connectBtn, false);
  showElement(disconnectBtn, true);
}

function safeJsonParse<T>(str: string): T | null {
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

function makeNameUnique(desiredName: string, takenNames: Set<string>): string {
  const base = desiredName.trim() || 'Profile';
  if (!takenNames.has(base)) return base;

  let counter = 2;
  let next = `${base} (${counter})`;
  while (takenNames.has(next)) {
    counter++;
    next = `${base} (${counter})`;
  }
  return next;
}

function compareIso(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const at = Date.parse(a);
  const bt = Date.parse(b);
  if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
  if (Number.isNaN(at)) return -1;
  if (Number.isNaN(bt)) return 1;
  return at - bt;
}

// ============================================================================
// PAYLOAD BUILDING & NORMALIZATION
// ============================================================================

function buildLocalPayload(): CloudPayload {
  const profiles = store.getProfiles();
  const activeId = store.getActiveProfileId();

  const defaultData: AppData = {
    semesters: [],
    settings: {
      theme: 'light',
      showCompleted: true,
      colorTheme: 'colorful',
      baseColorHue: 200,
    },
    lastModified: new Date().toISOString(),
  };

  const items: CloudProfileItem[] = profiles.map((p) => {
    const data = safeJsonParse<AppData>(
      localStorage.getItem(`unimanager-data-${p.id}`) ?? '{}'
    ) ?? defaultData;

    const exportObj: ProfileExport = {
      meta: {
        version: 1,
        profileName: p.name,
        exportDate: new Date().toISOString(),
      },
      data,
    };

    return {
      id: p.id,
      name: p.name,
      lastModified: data.lastModified ?? null,
      export: exportObj,
    };
  });

  return {
    version: CLOUD_PAYLOAD_VERSION,
    updatedAt: new Date().toISOString(),
    activeProfileId: activeId,
    profiles: items,
  };
}

function normalizeCloudPayload(payload: Partial<CloudPayload> | null): CloudPayload {
  if (!payload || typeof payload !== 'object') {
    return {
      version: CLOUD_PAYLOAD_VERSION,
      updatedAt: new Date().toISOString(),
      activeProfileId: null,
      profiles: [],
    };
  }

  return {
    version: typeof payload.version === 'number' ? payload.version : CLOUD_PAYLOAD_VERSION,
    updatedAt: payload.updatedAt ?? new Date().toISOString(),
    activeProfileId: payload.activeProfileId ?? null,
    profiles: Array.isArray(payload.profiles) ? payload.profiles : [],
  };
}

function localPayloadHash(payload: CloudPayload): string {
  try {
    const p = normalizeCloudPayload(payload);
    const parts: string[] = [];
    parts.push(`v=${p.version}`);
    parts.push(`active=${p.activeProfileId ?? ''}`);
    const sorted = [...p.profiles]
      .filter((x) => x?.id)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    for (const prof of sorted) {
      parts.push(`${prof.id}|${prof.name ?? ''}|${prof.lastModified ?? ''}`);
    }
    return parts.join('\n');
  } catch {
    return String(Date.now());
  }
}

// ============================================================================
// MERGE LOGIC
// ============================================================================

function mergeLocalAndCloud(
  localPayload: CloudPayload,
  cloudPayload: CloudPayload | null
): CloudPayload {
  const local = normalizeCloudPayload(localPayload);
  const cloud = normalizeCloudPayload(cloudPayload);

  const takenNames = new Set<string>();
  const byId = new Map<string, CloudProfileItem>();

  // Process local profiles first
  for (const lp of local.profiles) {
    if (!lp?.id) continue;
    const name = (lp.name || 'Profile').trim();
    takenNames.add(name);
    byId.set(lp.id, { ...lp, name });
  }

  // Merge cloud profiles
  for (const cpRaw of cloud.profiles) {
    if (!cpRaw?.id) continue;

    const existing = byId.get(cpRaw.id);
    const cp = { ...cpRaw };
    cp.name = (cp.name ?? cp.export?.meta?.profileName ?? 'Profile').trim();
    cp.lastModified = cp.lastModified ?? cp.export?.data?.lastModified ?? null;

    if (existing) {
      // Same ID exists locally - pick newer
      const localNewer = compareIso(existing.lastModified, cp.lastModified) >= 0;
      const chosen = localNewer ? existing : cp;

      let finalName = (chosen.name || 'Profile').trim();
      if (finalName !== existing.name && takenNames.has(finalName)) {
        finalName = makeNameUnique(finalName, takenNames);
        console.debug(LOG, 'Name collision on merge. Renaming:', chosen.name, '=>', finalName);
      }

      byId.set(cp.id, {
        ...chosen,
        name: finalName,
        export: chosen.export || existing.export || cp.export,
      });

      const merged = byId.get(cp.id);
      if (merged?.export?.meta) {
        merged.export.meta.profileName = finalName;
      }
      takenNames.add(finalName);
      continue;
    }

    // New profile from cloud
    const uniqueName = makeNameUnique(cp.name, takenNames);
    if (uniqueName !== cp.name) {
      console.debug(LOG, 'Name collision. Renaming cloud profile:', cp.name, '=>', uniqueName);
    }
    if (cp.export?.meta) {
      cp.export.meta.profileName = uniqueName;
    }
    takenNames.add(uniqueName);
    byId.set(cp.id, { ...cp, name: uniqueName });
  }

  const mergedProfiles = Array.from(byId.values());

  // Choose active profile
  let mergedActive = local.activeProfileId;
  if (!mergedActive || !byId.has(mergedActive)) {
    mergedActive = cloud.activeProfileId;
  }
  if (!mergedActive || !byId.has(mergedActive)) {
    mergedActive = mergedProfiles[0]?.id ?? 'default';
  }

  return {
    version: CLOUD_PAYLOAD_VERSION,
    updatedAt: new Date().toISOString(),
    activeProfileId: mergedActive,
    profiles: mergedProfiles,
  };
}

// ============================================================================
// LOCAL STORAGE WRITE
// ============================================================================

function writeMergedToLocalStorage(mergedPayload: CloudPayload): void {
  const merged = normalizeCloudPayload(mergedPayload);

  // Update profiles list
  const profileList: Profile[] = merged.profiles.map((p) => ({ id: p.id, name: p.name }));
  localStorage.setItem('unimanager-profiles', JSON.stringify(profileList));

  // Update active profile
  if (merged.activeProfileId) {
    localStorage.setItem('unimanager-active-profile', merged.activeProfileId);
  }

  // Write each profile's data
  for (const p of merged.profiles) {
    if (!p?.id) continue;
    const data = p.export?.data;
    if (!data || typeof data !== 'object') continue;

    if (p.export?.meta) {
      p.export.meta.profileName = p.name;
    }

    localStorage.setItem(`unimanager-data-${p.id}`, JSON.stringify(data));
  }
}

// ============================================================================
// CLOUD OPERATIONS
// ============================================================================

async function loadCloudPayload(uid: string): Promise<CloudPayload | null> {
  if (!database) return null;

  const path = DB_PATH_FOR_USER(uid);
  console.debug(LOG, 'Loading cloud payload from', path);

  const dbRef = ref(database, path);
  const snapshot = await get(dbRef);

  if (!snapshot.exists()) {
    console.debug(LOG, 'No cloud payload exists yet');
    return null;
  }

  const val = snapshot.val() as CloudRecord | CloudPayload;
  return 'payload' in val ? val.payload : (val);
}

async function saveCloudPayload(uid: string, payload: CloudPayload): Promise<void> {
  if (!database) return;

  const path = DB_PATH_FOR_USER(uid);
  lastLocalWriteId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const record: CloudRecord = {
    version: CLOUD_PAYLOAD_VERSION,
    updatedAt: new Date().toISOString(),
    writeId: lastLocalWriteId,
    originClientId: clientId ?? '',
    payload,
  };

  console.debug(LOG, 'Saving cloud payload to', path, 'writeId=', lastLocalWriteId);
  const dbRef = ref(database, path);
  await set(dbRef, record);
}

// ============================================================================
// REALTIME LISTENER
// ============================================================================

function startCloudListener(uid: string): void {
  stopCloudListener();

  if (!database) return;

  const path = DB_PATH_FOR_USER(uid);
  console.debug(LOG, 'Starting realtime listener on', path);

  const dbRef: DatabaseReference = ref(database, path);

  const unsubscribe = onValue(dbRef, (snapshot) => {
    if (!snapshot.exists()) return;

    const val = snapshot.val() as CloudRecord;
    const writeId = val?.writeId ?? null;
    const origin = val?.originClientId ?? null;
    const payload = val?.payload;

    // Skip our own writes
    if (origin && origin === clientId) {
      console.debug(LOG, 'Ignoring echo update from same clientId');
      return;
    }
    if (writeId && lastLocalWriteId && writeId === lastLocalWriteId) {
      console.debug(LOG, 'Ignoring echo update writeId', writeId);
      return;
    }

    console.debug(LOG, 'Remote update received. Applying to local…');
    isApplyingRemote = true;

    try {
      writeMergedToLocalStorage(payload);
      store.load();
      render.renderAll();
      render.renderProfileUI();
      setStatus(formatSyncedStatus(currentUser));
    } catch (err) {
      console.error(LOG, 'Failed applying remote update:', err);
      setStatus('Not synced (error)');
    } finally {
      isApplyingRemote = false;
    }
  });

  dbUnsubscribe = unsubscribe;
}

function stopCloudListener(): void {
  if (dbUnsubscribe) {
    dbUnsubscribe();
    dbUnsubscribe = null;
  }
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

async function mergeThenPush(): Promise<void> {
  if (!currentUser) {
    console.debug(LOG, 'mergeThenPush() skipped: not signed in');
    return;
  }

  try {
    setStatus('Syncing…');

    const local = buildLocalPayload();
    const cloud = await loadCloudPayload(currentUser.uid);
    const merged = mergeLocalAndCloud(local, cloud);

    const localHash = localPayloadHash(local);
    const mergedHash = localPayloadHash(merged);

    if (localHash !== mergedHash) {
      console.debug(LOG, 'Merged payload differs from local. Writing to localStorage.');
      writeMergedToLocalStorage(merged);
      store.load();
      render.renderAll();
      render.renderProfileUI();
    }

    await saveCloudPayload(currentUser.uid, merged);
    setStatus(formatSyncedStatus(currentUser));
  } catch (err) {
    console.error(LOG, 'mergeThenPush failed:', err);
    setStatus('Not synced (error)');
  }
}

async function pushLocalToCloud(): Promise<void> {
  if (!currentUser) return;

  try {
    setStatus('Syncing…');
    const payload = buildLocalPayload();
    await saveCloudPayload(currentUser.uid, payload);
    setStatus(formatSyncedStatus(currentUser));
  } catch (err) {
    console.error(LOG, 'pushLocalToCloud failed:', err);
    setStatus('Not synced (error)');
  }
}

function debounceAutoSync(): void {
  if (!currentUser) return;
  if (isApplyingRemote) {
    console.debug(LOG, 'Skip autosync: currently applying remote payload');
    return;
  }

  if (pendingSyncTimer) {
    clearTimeout(pendingSyncTimer);
  }

  pendingSyncTimer = setTimeout(() => {
    pendingSyncTimer = null;
    void pushLocalToCloud();
  }, SYNC_DEBOUNCE_MS);
}

// ============================================================================
// AUTH OPERATIONS
// ============================================================================

async function signIn(): Promise<void> {
  if (!auth) {
    console.error(LOG, 'Firebase Auth not initialized');
    return;
  }

  console.debug(LOG, 'Starting Google sign-in popup…');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  await signInWithPopup(auth, provider);
}

async function signOut(): Promise<void> {
  if (!auth) return;
  console.debug(LOG, 'Signing out…');
  await firebaseSignOut(auth);
}

// ============================================================================
// UI HANDLERS
// ============================================================================

function attachUIHandlers(): void {
  const connectBtn = $(UI_IDS.connectBtn);
  const disconnectBtn = $(UI_IDS.disconnectBtn);

  if (connectBtn) {
    connectBtn.addEventListener('click', () => {
      signIn().catch((err) => {
        // eslint-disable-next-line no-console
        console.error(LOG, 'Sign-in failed:', err);
        setStatus('Sign-in failed');
      });
    });
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
      void signOut();
    });
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes Firebase sync with the provided configuration.
 * Call this once at app startup.
 */
export function initializeFirebaseSync(config: FirebaseConfig): void {
  if (initialized) return;
  initialized = true;

  console.debug(LOG, 'initializeFirebaseSync()');

  // Validate config
  if (!config.apiKey || !config.projectId) {
    console.warn(LOG, 'Firebase config incomplete. Cloud sync disabled.');
    setStatus('Cloud sync unavailable');
    return;
  }

  clientId = ensureClientId();
  console.debug(LOG, 'clientId=', clientId);

  try {
    firebaseApp = initializeApp(config);
    auth = getAuth(firebaseApp);
    database = getDatabase(firebaseApp);
    console.debug(LOG, 'Firebase initialized');
  } catch (err) {
    console.error(LOG, 'Firebase init error:', err);
    setStatus('Firebase init failed');
    return;
  }

  attachUIHandlers();

  // Update status on resize (mobile/desktop formatting)
  window.addEventListener('resize', () => {
    if (currentUser) {
      setStatus(formatSyncedStatus(currentUser));
    }
  });

  // Auth state listener
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    // eslint-disable-next-line no-console
    console.debug(LOG, 'onAuthStateChanged:', currentUser?.uid ?? null);

    updateUIForAuthState(currentUser);

    if (!currentUser) {
      stopCloudListener();
      return;
    }

    void mergeThenPush().then(() => {
      if (currentUser) startCloudListener(currentUser.uid);
    });
  });
}

/**
 * Auto-sync to Firebase (debounced).
 * Call this when local data changes.
 */
export function autoSyncToFirebase(): void {
  console.debug(LOG, 'autoSyncToFirebase() called');
  debounceAutoSync();
}

/**
 * Force immediate sync to Firebase.
 * Use for critical operations like profile deletion.
 */
export async function forceSyncToFirebase(): Promise<void> {
  console.debug(LOG, 'forceSyncToFirebase() called');
  await pushLocalToCloud();
}

/**
 * Check if user is currently authenticated.
 */
export function isAuthenticated(): boolean {
  return currentUser !== null;
}

/**
 * Get current user info.
 */
export function getCurrentUser(): { uid: string; email: string | null } | null {
  if (!currentUser) return null;
  return {
    uid: currentUser.uid,
    email: currentUser.email,
  };
}
