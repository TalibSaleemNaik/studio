// This file is for server-side use only.
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    // Make sure to use environment variables for service account credentials
    // and not to commit the service account key to your repository.
    const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string
    );

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // Add your databaseURL here if you are using Realtime Database
        // databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    });
}


const db = admin.firestore();
const auth = admin.auth();

export { db, auth };
