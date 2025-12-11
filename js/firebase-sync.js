/**
 * @file firebase-sync.js
 * @description Firebase Auth (Google) + Realtime Database sync for all profiles.
 *
 * Cloud model:
 *  - One per-user node containing a single payload with ALL profiles.
 *  - Merges local + cloud on login.
 *  - Auto-syncs on local changes while authenticated.
 */

'use strict';

(() => {
    const LOG = '[FirebaseSync]';
    const CLOUD_PAYLOAD_VERSION = 1;

    const DB_PATH_FOR_USER = (uid) => `unimanager/users/${uid}/allProfiles`;

    const UI = Object.freeze({
        headerIconId: 'cloud-sync-icon',
        statusTextId: 'cloud-status-text',
        connectBtnId: 'connect-cloud-btn',
        disconnectBtnId: 'disconnect-cloud-btn',
        forceSyncBtnId: 'force-sync-btn'
    });

    let initialized = false;
    let authUnsubscribe = null;
    let dbUnsubscribe = null;

    let currentUser = null;

    let clientId = null;
    let lastLocalWriteId = null;
    let isApplyingRemote = false;
    let pendingSyncTimer = null;

    function ensureClientId() {
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

    function getEl(id) {
        return document.getElementById(id);
    }

    function setHeaderState(state) {
        const icon = getEl(UI.headerIconId);
        if (!icon) return;
        icon.dataset.state = state;
    }

    function setStatus(text) {
        const el = getEl(UI.statusTextId);
        if (!el) return;
        el.textContent = text;
    }

    function show(el, shouldShow) {
        if (!el) return;
        el.style.display = shouldShow ? '' : 'none';
    }

    function updateUIForAuthState(user) {
        const connectBtn = getEl(UI.connectBtnId);
        const disconnectBtn = getEl(UI.disconnectBtnId);
        const forceSyncBtn = getEl(UI.forceSyncBtnId);

        if (!user) {
            setHeaderState('disconnected');
            setStatus('Not connected');
            show(connectBtn, true);
            show(disconnectBtn, false);
            show(forceSyncBtn, false);
            return;
        }

        setHeaderState('connected');
        setStatus(user.email ? `Connected: ${user.email}` : 'Connected');
        show(connectBtn, false);
        show(disconnectBtn, true);
        show(forceSyncBtn, true);
    }

    function safeJsonParse(str) {
        try {
            return JSON.parse(str);
        } catch {
            return null;
        }
    }

    function makeNameUnique(desiredName, takenNames) {
        const base = (desiredName || '').trim() || 'Profile';
        if (!takenNames.has(base)) {
            return base;
        }

        let counter = 2;
        let next = `${base} (${counter})`;
        while (takenNames.has(next)) {
            counter++;
            next = `${base} (${counter})`;
        }
        return next;
    }

    function buildLocalPayload() {
        const profilesJson = localStorage.getItem(STORAGE_KEYS.PROFILES);
        const localProfiles = profilesJson ? safeJsonParse(profilesJson) : null;
        const profilesList = Array.isArray(localProfiles) && localProfiles.length
            ? localProfiles
            : [{ id: 'default', name: 'Default Profile' }];

        const activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE) || (profilesList[0]?.id ?? 'default');

        const items = profilesList.map((p) => {
            const key = STORAGE_KEYS.DATA_PREFIX + p.id;
            const raw = localStorage.getItem(key);
            const parsed = raw ? safeJsonParse(raw) : null;
            const data = parsed && typeof migrateData === 'function' ? migrateData(parsed) : parsed;

            const exportObj = {
                meta: {
                    version: typeof EXPORT_DATA_VERSION === 'number' ? EXPORT_DATA_VERSION : 1,
                    profileName: p.name,
                    exportDate: new Date().toISOString()
                },
                data: data || { semesters: [], settings: { ...DEFAULT_THEME_SETTINGS }, lastModified: new Date().toISOString() }
            };

            const lastModified = exportObj?.data?.lastModified || null;

            return {
                id: p.id,
                name: p.name,
                lastModified,
                export: exportObj
            };
        });

        return {
            version: CLOUD_PAYLOAD_VERSION,
            updatedAt: new Date().toISOString(),
            activeProfileId: activeId,
            profiles: items
        };
    }

    function normalizeCloudPayload(payload) {
        if (!payload || typeof payload !== 'object') {
            return {
                version: CLOUD_PAYLOAD_VERSION,
                updatedAt: new Date().toISOString(),
                activeProfileId: null,
                profiles: []
            };
        }

        const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
        return {
            version: typeof payload.version === 'number' ? payload.version : CLOUD_PAYLOAD_VERSION,
            updatedAt: payload.updatedAt || new Date().toISOString(),
            activeProfileId: payload.activeProfileId || null,
            profiles
        };
    }

    function compareIso(a, b) {
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

    function mergeLocalAndCloud(localPayload, cloudPayload) {
        const local = normalizeCloudPayload(localPayload);
        const cloud = normalizeCloudPayload(cloudPayload);

        const takenNames = new Set();
        const byId = new Map();

        for (const lp of local.profiles) {
            if (!lp || !lp.id) continue;
            const name = (lp.name || 'Profile').trim();
            takenNames.add(name);
            byId.set(lp.id, { ...lp, name });
        }

        for (const cpRaw of cloud.profiles) {
            if (!cpRaw || !cpRaw.id) continue;

            const existing = byId.get(cpRaw.id);
            const cp = { ...cpRaw };
            cp.name = (cp.name || cp.export?.meta?.profileName || 'Profile').trim();
            cp.lastModified = cp.lastModified || cp.export?.data?.lastModified || null;

            if (existing) {
                const localNewer = compareIso(existing.lastModified, cp.lastModified) >= 0;
                const chosen = localNewer ? existing : cp;

                // Name resolution: pick name from the chosen record, then ensure uniqueness.
                const desired = (chosen.name || 'Profile').trim();
                let finalName = desired;

                // If the chosen name collides with some other profile name, make it unique.
                // (Keep the current profile's existing name reserved.)
                if (finalName !== existing.name && takenNames.has(finalName)) {
                    finalName = makeNameUnique(finalName, takenNames);
                    console.debug(LOG, 'Name collision on merge (same id). Renaming:', desired, '=>', finalName);
                }

                byId.set(cp.id, {
                    ...chosen,
                    name: finalName,
                    export: chosen.export || existing.export || cp.export
                });

                if (byId.get(cp.id)?.export?.meta) {
                    byId.get(cp.id).export.meta.profileName = finalName;
                }
                takenNames.add(finalName);
                continue;
            }

            // New profile from cloud: avoid name collisions against local.
            const uniqueName = makeNameUnique(cp.name, takenNames);
            if (uniqueName !== cp.name) {
                console.debug(LOG, 'Name collision on merge. Renaming cloud profile:', cp.name, '=>', uniqueName);
            }
            if (cp.export?.meta) {
                cp.export.meta.profileName = uniqueName;
            }
            takenNames.add(uniqueName);
            byId.set(cp.id, {
                ...cp,
                name: uniqueName,
                export: cp.export
            });
        }

        const mergedProfiles = Array.from(byId.values());

        // Choose active profile: prefer local if valid, else cloud, else first.
        let mergedActive = local.activeProfileId;
        if (!mergedActive || !byId.has(mergedActive)) {
            mergedActive = cloud.activeProfileId;
        }
        if (!mergedActive || !byId.has(mergedActive)) {
            mergedActive = mergedProfiles[0]?.id || 'default';
        }

        const merged = {
            version: CLOUD_PAYLOAD_VERSION,
            updatedAt: new Date().toISOString(),
            activeProfileId: mergedActive,
            profiles: mergedProfiles
        };

        return merged;
    }

    function writeMergedToLocalStorage(mergedPayload) {
        const merged = normalizeCloudPayload(mergedPayload);

        const profileList = merged.profiles.map(p => ({ id: p.id, name: p.name }));
        localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profileList));

        if (merged.activeProfileId) {
            localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, merged.activeProfileId);
        }

        for (const p of merged.profiles) {
            if (!p || !p.id) continue;
            const exportObj = p.export;
            const data = exportObj?.data || null;
            if (!data || typeof data !== 'object') continue;

            if (exportObj?.meta) {
                exportObj.meta.profileName = p.name;
            }

            const migrated = typeof migrateData === 'function' ? migrateData(data) : data;
            localStorage.setItem(STORAGE_KEYS.DATA_PREFIX + p.id, JSON.stringify(migrated));
        }
    }

    function localPayloadHash(payload) {
        // Stable summary to avoid missing changes; not cryptographic.
        try {
            const p = normalizeCloudPayload(payload);
            const parts = [];
            parts.push(`v=${p.version}`);
            parts.push(`active=${p.activeProfileId || ''}`);
            const sorted = [...p.profiles].filter(x => x && x.id).sort((a, b) => String(a.id).localeCompare(String(b.id)));
            for (const prof of sorted) {
                parts.push(`${prof.id}|${prof.name || ''}|${prof.lastModified || ''}`);
            }
            return parts.join('\n');
        } catch {
            return String(Date.now());
        }
    }

    async function loadCloudPayload(uid) {
        const path = DB_PATH_FOR_USER(uid);
        console.debug(LOG, 'Loading cloud payload from', path);

        const snap = await firebase.database().ref(path).once('value');
        if (!snap.exists()) {
            console.debug(LOG, 'No cloud payload exists yet');
            return null;
        }

        const val = snap.val();
        return val && val.payload ? val.payload : val;
    }

    async function saveCloudPayload(uid, payload) {
        const path = DB_PATH_FOR_USER(uid);
        lastLocalWriteId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

        const record = {
            version: CLOUD_PAYLOAD_VERSION,
            updatedAt: new Date().toISOString(),
            writeId: lastLocalWriteId,
            originClientId: clientId,
            payload
        };

        console.debug(LOG, 'Saving cloud payload to', path, 'writeId=', lastLocalWriteId);
        await firebase.database().ref(path).set(record);
    }

    function startCloudListener(uid) {
        stopCloudListener();

        const path = DB_PATH_FOR_USER(uid);
        console.debug(LOG, 'Starting realtime listener on', path);

        const ref = firebase.database().ref(path);

        const handler = (snap) => {
            if (!snap.exists()) return;
            const val = snap.val();
            const writeId = val?.writeId || null;
            const origin = val?.originClientId || null;
            const payload = val?.payload ? val.payload : val;

            if (origin && origin === clientId) {
                console.debug(LOG, 'Ignoring echo update from same clientId', origin);
                return;
            }
            if (writeId && lastLocalWriteId && writeId === lastLocalWriteId) {
                console.debug(LOG, 'Ignoring echo update writeId', writeId);
                return;
            }

            console.debug(LOG, 'Remote update received (writeId=', writeId, '). Applying to local…');
            isApplyingRemote = true;
            try {
                writeMergedToLocalStorage(payload);

                if (typeof loadData === 'function') {
                    loadData();
                }
                if (typeof initTheme === 'function') {
                    initTheme();
                }
                if (typeof renderProfileUI === 'function') {
                    renderProfileUI();
                }
            } catch (err) {
                console.error(LOG, 'Failed applying remote update:', err);
                setHeaderState('reconnect');
                setStatus('Sync error (see console)');
            } finally {
                isApplyingRemote = false;
            }
        };

        ref.on('value', handler);
        dbUnsubscribe = () => ref.off('value', handler);
    }

    function stopCloudListener() {
        if (typeof dbUnsubscribe === 'function') {
            dbUnsubscribe();
        }
        dbUnsubscribe = null;
    }

    async function mergeThenPush() {
        if (!currentUser) {
            console.debug(LOG, 'mergeThenPush() skipped: not signed in');
            return;
        }

        try {
            setHeaderState('connected');
            setStatus('Syncing…');

            const local = buildLocalPayload();
            const cloud = await loadCloudPayload(currentUser.uid);
            const merged = mergeLocalAndCloud(local, cloud);

            // If merge changed local, write it.
            const localHash = localPayloadHash(local);
            const mergedHash = localPayloadHash(merged);

            if (localHash !== mergedHash) {
                console.debug(LOG, 'Merged payload differs from local. Writing merged to localStorage.');
                writeMergedToLocalStorage(merged);

                if (typeof loadData === 'function') loadData();
                if (typeof initTheme === 'function') initTheme();
                if (typeof renderProfileUI === 'function') renderProfileUI();
            } else {
                console.debug(LOG, 'Merged payload equals local. No local write needed.');
            }

            await saveCloudPayload(currentUser.uid, merged);

            setStatus(currentUser.email ? `Connected: ${currentUser.email}` : 'Connected');
        } catch (err) {
            console.error(LOG, 'mergeThenPush failed:', err);
            setHeaderState('reconnect');
            setStatus('Sync error (see console)');
        }
    }

    function debounceAutoSync() {
        if (!currentUser) return;
        if (isApplyingRemote) {
            console.debug(LOG, 'Skip autosync: currently applying remote payload');
            return;
        }

        if (pendingSyncTimer) {
            clearTimeout(pendingSyncTimer);
        }

        pendingSyncTimer = setTimeout(async () => {
            pendingSyncTimer = null;
            await pushLocalToCloud();
        }, 750);
    }

    async function pushLocalToCloud() {
        if (!currentUser) return;
        const uid = currentUser.uid;

        try {
            setStatus('Syncing…');
            const payload = buildLocalPayload();
            await saveCloudPayload(uid, payload);
            setStatus(currentUser.email ? `Connected: ${currentUser.email}` : 'Connected');
        } catch (err) {
            console.error(LOG, 'pushLocalToCloud failed:', err);
            setHeaderState('reconnect');
            setStatus('Sync error (see console)');
        }
    }

    async function signIn() {
        if (!firebase?.auth) {
            console.error(LOG, 'Firebase SDK not loaded (auth missing).');
            return;
        }

        console.debug(LOG, 'Starting Google sign-in popup…');
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        await firebase.auth().signInWithPopup(provider);
    }

    async function signOut() {
        if (!firebase?.auth) return;
        console.debug(LOG, 'Signing out…');
        await firebase.auth().signOut();
    }

    function attachUIHandlers() {
        const icon = getEl(UI.headerIconId);
        const connectBtn = getEl(UI.connectBtnId);
        const disconnectBtn = getEl(UI.disconnectBtnId);
        const forceSyncBtn = getEl(UI.forceSyncBtnId);

        const connect = async () => {
            try {
                await signIn();
            } catch (err) {
                console.error(LOG, 'Sign-in failed:', err);
                setHeaderState('reconnect');
                setStatus('Sign-in failed (see console)');
            }
        };

        if (icon) {
            icon.addEventListener('click', () => {
                if (currentUser) {
                    // No-op: status click
                    return;
                }
                connect();
            });
        }

        if (connectBtn) connectBtn.addEventListener('click', connect);
        if (disconnectBtn) disconnectBtn.addEventListener('click', () => signOut());
        if (forceSyncBtn) forceSyncBtn.addEventListener('click', () => mergeThenPush());
    }

    function initializeFirebaseSync() {
        if (initialized) return;
        initialized = true;

        console.debug(LOG, 'initializeFirebaseSync()');

        clientId = ensureClientId();
        console.debug(LOG, 'clientId=', clientId);

        if (typeof FIREBASE_CONFIG === 'undefined') {
            console.error(LOG, 'FIREBASE_CONFIG not loaded. Create js/firebase-config.js from js/firebase-config.example.js');
            setHeaderState('reconnect');
            setStatus('Missing Firebase config');
            return;
        }

        if (typeof firebase === 'undefined') {
            console.error(LOG, 'Firebase SDK not loaded.');
            setHeaderState('reconnect');
            setStatus('Missing Firebase SDK');
            return;
        }

        try {
            firebase.initializeApp(FIREBASE_CONFIG);
            console.debug(LOG, 'Firebase initialized');
        } catch (err) {
            // Ignore duplicate init
            console.debug(LOG, 'Firebase init error (maybe already initialized):', err);
        }

        attachUIHandlers();

        authUnsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
            currentUser = user || null;
            console.debug(LOG, 'onAuthStateChanged:', currentUser ? currentUser.uid : null);

            updateUIForAuthState(currentUser);

            if (!currentUser) {
                stopCloudListener();
                return;
            }

            await mergeThenPush();
            startCloudListener(currentUser.uid);
        });
    }

    // Expose public API
    window.initializeFirebaseSync = initializeFirebaseSync;

    // Called by state/profile changes
    window.autoSyncToFirebase = async () => {
        console.debug(LOG, 'autoSyncToFirebase() called');
        debounceAutoSync();
    };
})();
