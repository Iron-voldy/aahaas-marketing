/**
 * Firebase Admin SDK initialization for server-side use.
 * Bypasses Firestore security rules — only used in Next.js API routes.
 *
 * Credentials are loaded from environment variables:
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 *
 * Set these in .env.local using values from your service account JSON
 * (Firebase Console → Project Settings → Service Accounts → Generate new private key).
 */

import * as admin from "firebase-admin";

function initAdmin() {
    if (admin.apps.length > 0) return admin.apps[0]!;

    const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    // The private key stored in .env has escaped newlines — unescape them
    const privateKey  = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
            "Firebase Admin credentials are missing. Add FIREBASE_ADMIN_PROJECT_ID, " +
            "FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY to .env.local."
        );
    }

    return admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        projectId,
    });
}

export function getAdminDb() {
    initAdmin();
    return admin.firestore();
}
