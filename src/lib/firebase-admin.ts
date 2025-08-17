// This file is for server-side use only.
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin SDK
let app: App;
if (!getApps().length) {
    // In a managed environment like App Hosting, initializeApp() is enough.
    // It will automatically discover credentials.
    app = initializeApp();
} else {
    app = getApps()[0];
}

const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
