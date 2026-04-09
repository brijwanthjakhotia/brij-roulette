/** Push/pull sync between IndexedDB and Firestore. */

import { db as localDb } from '../db/schema.js';
import { clearAllData } from '../db/dealers.js';
import { initFirebase, isConfigured } from './firebase-config.js';

let currentUser = null;

export function getSyncStatus() {
  return {
    configured: isConfigured(),
    signedIn: currentUser !== null,
    userId: currentUser?.uid || null,
    displayName: currentUser?.displayName || (currentUser?.isAnonymous ? 'Anonymous' : null),
  };
}

export async function signInAnonymously() {
  const { auth } = await initFirebase();
  const { signInAnonymously: fbSignIn } = await import('firebase/auth');
  const result = await fbSignIn(auth);
  currentUser = result.user;
  await localDb.syncMeta.put({ key: 'userId', value: currentUser.uid });
  return currentUser;
}

export async function signInWithGoogle() {
  const { auth } = await initFirebase();
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  currentUser = result.user;
  await localDb.syncMeta.put({ key: 'userId', value: currentUser.uid });
  return currentUser;
}

export async function signOut() {
  const { auth } = await initFirebase();
  const { signOut: fbSignOut } = await import('firebase/auth');
  await fbSignOut(auth);
  currentUser = null;
  await localDb.syncMeta.delete('userId');
}

export async function pushToCloud() {
  if (!currentUser) throw new Error('Not signed in');

  const { firestore } = await initFirebase();
  const { collection, doc, writeBatch } = await import('firebase/firestore');

  const dealers = await localDb.dealers.toArray();
  const spins = await localDb.spins.toArray();
  const uid = currentUser.uid;

  // Batched writes (max 500 per batch)
  const allOps = [];

  for (const dealer of dealers) {
    allOps.push({ ref: doc(firestore, `users/${uid}/dealers`, String(dealer.id)), data: { ...dealer } });
  }
  for (const spin of spins) {
    allOps.push({ ref: doc(firestore, `users/${uid}/spins`, String(spin.id)), data: { ...spin } });
  }

  // Execute in batches of 500
  for (let i = 0; i < allOps.length; i += 500) {
    const batch = writeBatch(firestore);
    const chunk = allOps.slice(i, i + 500);
    for (const op of chunk) {
      batch.set(op.ref, op.data);
    }
    await batch.commit();
  }

  const now = new Date().toISOString();
  await localDb.syncMeta.put({ key: 'lastPush', value: now });

  return { dealers: dealers.length, spins: spins.length };
}

export async function pullFromCloud() {
  if (!currentUser) throw new Error('Not signed in');

  const { firestore } = await initFirebase();
  const { collection, getDocs } = await import('firebase/firestore');
  const uid = currentUser.uid;

  // Fetch all dealers and spins from Firestore
  const dealerSnap = await getDocs(collection(firestore, `users/${uid}/dealers`));
  const spinSnap = await getDocs(collection(firestore, `users/${uid}/spins`));

  const dealers = dealerSnap.docs.map(d => d.data());
  const spins = spinSnap.docs.map(d => d.data());

  if (dealers.length === 0 && spins.length === 0) {
    throw new Error('No data found in cloud. Push first.');
  }

  // Clear local and restore from cloud
  await clearAllData();

  if (dealers.length > 0) await localDb.dealers.bulkAdd(dealers);
  if (spins.length > 0) await localDb.spins.bulkAdd(spins);

  const now = new Date().toISOString();
  await localDb.syncMeta.put({ key: 'lastPull', value: now });

  return { dealers: dealers.length, spins: spins.length };
}

export async function getLastSyncTime() {
  const push = await localDb.syncMeta.get('lastPush');
  const pull = await localDb.syncMeta.get('lastPull');
  return {
    lastPush: push?.value || null,
    lastPull: pull?.value || null,
  };
}
