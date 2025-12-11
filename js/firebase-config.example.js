/**
 * Firebase config template
 *
 * 1) Create a Firebase project
 * 2) Enable Authentication: Google provider
 * 3) Create Realtime Database (in locked mode is fine while testing)
 * 4) Copy this file to: js/firebase-config.js
 * 5) Paste your Firebase web app config below
 *
 * NOTE: Do NOT commit js/firebase-config.js
 */

'use strict';

// eslint-disable-next-line no-unused-vars
const FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.YOUR_REGION.firebasedatabase.app",
    projectId: "YOUR_PROJECT_ID",
    appId: "YOUR_APP_ID"
    // Optional:
    // storageBucket: "YOUR_PROJECT_ID.appspot.com",
    // messagingSenderId: "YOUR_SENDER_ID"
};
