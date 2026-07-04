import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId
});

// Get Firebase services
export const auth = getAuth(app);
// Use the custom firestoreDatabaseId from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "default");
export const googleProvider = new GoogleAuthProvider();

// Custom validator to check Firestore connection
async function testConnection() {
  try {
    // Attempt to read from connection checker doc
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection initialized successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. Client is offline.");
    } else {
      console.warn("Firestore test connection check failed, this is usually fine:", error);
    }
  }
}

testConnection();
