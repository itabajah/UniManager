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
    const CLOUD_PAYLOAD_VERSION = 2;

    const DB_PATH_FOR_USER = (uid) => `tollab/users/${uid}/data`;

    const UI = Object.freeze({
        statusTextId: 'cloud-status-text',
        connectBtnId: 'connect-cloud-btn',
        disconnectBtnId: 'disconnect-cloud-btn'
    });

    let initialized = false;
    let dbUnsubscribe = null;

    let currentUser = null;

    let clientId = null;
    let lastLocalWriteId = null;
    let isApplyingRemote = false;
    let pendingSyncTimer = null;

    function ensureClientId() {
        try {
            const key = 'tollab_client';
            let existing = localStorage.getItem(key);
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

    function setStatus(text) {
        const el = getEl(UI.statusTextId);
        if (el) {
            el.textContent = text;
        }

        // Always update header indicator text if present
        const headerText = document.getElementById('cloud-header-text');
        if (headerText) {
            headerText.textContent = text;
        }
    }

    function show(el, shouldShow) {
        if (!el) return;
        el.style.display = shouldShow ? '' : 'none';
    }

    function isMobileView() {
        return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    }

    function formatSyncedStatus(user) {
        if (!user) return 'Not connected';
        if (isMobileView()) return 'Synced';
        return user.email ? `Synced (${user.email})` : 'Synced';
    }

    function updateUIForAuthState(user) {
        const connectBtn = getEl(UI.connectBtnId);
        const disconnectBtn = getEl(UI.disconnectBtnId);

        if (!user) {
            setStatus('Not connected');
            show(connectBtn, true);
            show(disconnectBtn, false);
            return;
        }

        setStatus(formatSyncedStatus(user));
        show(connectBtn, false);
        show(disconnectBtn, true);
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
            
            // Get hydrated data for lastModified, then compact for storage
            const hydrated = parsed ? (typeof hydrateFromStorage === 'function' ? hydrateFromStorage(parsed) : parsed) : null;
            const compactData = hydrated && typeof compactForStorage === 'function' 
                ? compactForStorage(hydrated) 
                : parsed;

            return {
                i: p.id,
                n: p.name,
                t: hydrated?.lastModified || null,
                d: compactData
            };
        });

        return {
            v: CLOUD_PAYLOAD_VERSION,
            u: new Date().toISOString(),
            a: activeId,
            p: items
        };
    }

    function normalizeCloudPayload(payload) {
        if (!payload || typeof payload !== 'object') {
            return {
                v: CLOUD_PAYLOAD_VERSION,
                u: new Date().toISOString(),
                a: null,
                p: []
            };
        }

        // Handle legacy format (v1)
        if (payload.version && !payload.v) {
            return {
                v: CLOUD_PAYLOAD_VERSION,
                u: payload.updatedAt || new Date().toISOString(),
                a: payload.activeProfileId || null,
                p: (payload.profiles || []).map(p => ({
                    i: p.id,
                    n: p.name,
                    t: p.lastModified || p.export?.data?.lastModified,
                    d: p.export?.data ? (typeof compactForStorage === 'function' ? compactForStorage(p.export.data) : p.export.data) : null
                }))
            };
        }

        const profiles = Array.isArray(payload.p) ? payload.p : [];
        return {
            v: typeof payload.v === 'number' ? payload.v : CLOUD_PAYLOAD_VERSION,
            u: payload.u || new Date().toISOString(),
            a: payload.a || null,
            p: profiles
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

        for (const lp of local.p) {
            if (!lp || !lp.i) continue;
            const name = (lp.n || 'Profile').trim();
            takenNames.add(name);
            byId.set(lp.i, { ...lp, n: name });
        }

        for (const cpRaw of cloud.p) {
            if (!cpRaw || !cpRaw.i) continue;

            const existing = byId.get(cpRaw.i);
            const cp = { ...cpRaw };
            cp.n = (cp.n || 'Profile').trim();

            if (existing) {
                const localNewer = compareIso(existing.t, cp.t) >= 0;
                const chosen = localNewer ? existing : cp;

                const desired = (chosen.n || 'Profile').trim();
                let finalName = desired;

                if (finalName !== existing.n && takenNames.has(finalName)) {
                    finalName = makeNameUnique(finalName, takenNames);
                    console.debug(LOG, 'Name collision on merge. Renaming:', desired, '=>', finalName);
                }

                byId.set(cp.i, {
                    ...chosen,
                    n: finalName,
                    d: chosen.d || existing.d || cp.d
                });

                takenNames.add(finalName);
                continue;
            }

            // New profile from cloud
            const uniqueName = makeNameUnique(cp.n, takenNames);
            if (uniqueName !== cp.n) {
                console.debug(LOG, 'Name collision on merge. Renaming cloud profile:', cp.n, '=>', uniqueName);
            }
            takenNames.add(uniqueName);
            byId.set(cp.i, { ...cp, n: uniqueName });
        }

        const mergedProfiles = Array.from(byId.values());

        let mergedActive = local.a;
        if (!mergedActive || !byId.has(mergedActive)) {
            mergedActive = cloud.a;
        }
        if (!mergedActive || !byId.has(mergedActive)) {
            mergedActive = mergedProfiles[0]?.i || 'default';
        }

        return {
            v: CLOUD_PAYLOAD_VERSION,
            u: new Date().toISOString(),
            a: mergedActive,
            p: mergedProfiles
        };
    }

    function writeMergedToLocalStorage(mergedPayload) {
        const merged = normalizeCloudPayload(mergedPayload);

        const profileList = merged.p.map(p => ({ id: p.i, name: p.n }));
        localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profileList));

        if (merged.a) {
            localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, merged.a);
        }

        for (const p of merged.p) {
            if (!p || !p.i) continue;
            const data = p.d;
            if (!data || typeof data !== 'object') continue;

            // Store compact data directly
            localStorage.setItem(STORAGE_KEYS.DATA_PREFIX + p.i, JSON.stringify(data));
        }
    }

    function localPayloadHash(payload) {
        // Stable summary to avoid missing changes; not cryptographic.
        try {
            const p = normalizeCloudPayload(payload);
            const parts = [];
            parts.push(`v=${p.v}`);
            parts.push(`active=${p.a || ''}`);
            const sorted = [...p.p].filter(x => x && x.i).sort((a, b) => String(a.i).localeCompare(String(b.i)));
            for (const prof of sorted) {
                parts.push(`${prof.i}|${prof.n || ''}|${prof.t || ''}`);
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
            v: CLOUD_PAYLOAD_VERSION,
            u: new Date().toISOString(),
            w: lastLocalWriteId,
            c: clientId,
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

                setStatus(formatSyncedStatus(currentUser));
            } catch (err) {
                console.error(LOG, 'Failed applying remote update:', err);
                setStatus('Not synced (error)');
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

            setStatus(formatSyncedStatus(currentUser));
        } catch (err) {
            console.error(LOG, 'mergeThenPush failed:', err);
            setStatus('Not synced (error)');
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
            setStatus(formatSyncedStatus(currentUser));
        } catch (err) {
            console.error(LOG, 'pushLocalToCloud failed:', err);
            setStatus('Not synced (error)');
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
        const connectBtn = getEl(UI.connectBtnId);
        const disconnectBtn = getEl(UI.disconnectBtnId);

        const connect = async () => {
            try {
                await signIn();
            } catch (err) {
                console.error(LOG, 'Sign-in failed:', err);
                setStatus('Sign-in failed (see console)');
            }
        };

        if (connectBtn) connectBtn.addEventListener('click', connect);
        if (disconnectBtn) disconnectBtn.addEventListener('click', () => signOut());
    }

    function initializeFirebaseSync() {
        if (initialized) return;
        initialized = true;

        console.debug(LOG, 'initializeFirebaseSync()');

        clientId = ensureClientId();
        console.debug(LOG, 'clientId=', clientId);

        if (typeof FIREBASE_CONFIG === 'undefined') {
            console.error(LOG, 'FIREBASE_CONFIG not loaded. Create js/firebase-config.js from js/firebase-config.example.js');
            setStatus('Missing Firebase config');
            return;
        }

        if (typeof firebase === 'undefined') {
            console.error(LOG, 'Firebase SDK not loaded.');
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

        window.addEventListener('resize', () => {
            if (currentUser) {
                setStatus(formatSyncedStatus(currentUser));
            }
        });

        firebase.auth().onAuthStateChanged(async (user) => {
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

    // Used for actions that must persist immediately (e.g., deleting a profile)
    window.forceSyncToFirebase = async () => {
        console.debug(LOG, 'forceSyncToFirebase() called');
        await pushLocalToCloud();
    };
})();
