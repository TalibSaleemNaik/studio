// This file is for server-side use only.
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    // In a managed environment like Firebase App Hosting, the SDK can
    // auto-discover credentials. We don't need to manually initialize.
    admin.initializeApp();
}


const db = admin.firestore();
const auth = admin.auth();

export { db, auth };
