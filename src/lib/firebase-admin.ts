// This file is for server-side use only.
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
    // In a managed environment like Firebase App Hosting, the SDK can
    // auto-discover credentials. We don't need to manually initialize.
    initializeApp();
}

const db = getFirestore();
const auth = getAuth();

export { db, auth };
