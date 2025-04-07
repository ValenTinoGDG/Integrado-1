import admin from 'firebase-admin';
import serviceAccount from './service-account-key.json' with { type: "json" };
// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const auth = admin.auth();