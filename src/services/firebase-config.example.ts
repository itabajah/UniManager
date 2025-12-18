/**
 * @fileoverview Firebase configuration example.
 * Copy this file to firebase-config.ts and replace with your actual Firebase credentials.
 */

import type { FirebaseConfig } from '@/types';

/**
 * Firebase configuration object.
 * Get these values from your Firebase Console > Project Settings > General > Your apps
 */
export const firebaseConfig: FirebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
  databaseURL: 'https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com',
  measurementId: 'YOUR_MEASUREMENT_ID',
};

/**
 * Instructions:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project or select an existing one
 * 3. Go to Project Settings > General > Your apps
 * 4. Register a web app if you haven't already
 * 5. Copy the firebaseConfig object values to this file
 * 6. Enable Authentication (Google Sign-In) in Firebase Console
 * 7. Enable Realtime Database and set up security rules
 * 
 * Recommended Realtime Database security rules:
 * {
 *   "rules": {
 *     "users": {
 *       "$uid": {
 *         ".read": "$uid === auth.uid",
 *         ".write": "$uid === auth.uid"
 *       }
 *     }
 *   }
 * }
 */
