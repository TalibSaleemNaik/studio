// This file is for server-side use only.
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let app: App;
if (!getApps().length) {
    app = initializeApp();
} else {
    app = getApps()[0];
}

const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
