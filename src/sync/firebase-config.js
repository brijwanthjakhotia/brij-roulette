/** Firebase configuration — lazy loaded when user connects to cloud.
 *
 *  IMPORTANT: Replace the placeholder config below with your actual
 *  Firebase project config from console.firebase.google.com.
 *  This is safe to commit — Firestore security rules protect the data, not the config.
 */

let app, firestore, auth;
let initialized = false;

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

export function isConfigured() {
  return !firebaseConfig.apiKey.startsWith('YOUR_');
}

export async function initFirebase() {
  if (initialized) return { app, firestore, auth };

  const { initializeApp } = await import('firebase/app');
  const { getFirestore } = await import('firebase/firestore');
  const { getAuth } = await import('firebase/auth');

  app = initializeApp(firebaseConfig);
  firestore = getFirestore(app);
  auth = getAuth(app);
  initialized = true;

  return { app, firestore, auth };
}

export function getFirebaseInstances() {
  if (!initialized) throw new Error('Firebase not initialized. Call initFirebase() first.');
  return { app, firestore, auth };
}
