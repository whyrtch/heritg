import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, Firestore, getFirestore } from "firebase/firestore";

export type FirebasePublicConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  appId?: string;
  messagingSenderId?: string;
  storageBucket?: string;
};

const publicConfig: FirebasePublicConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
};

let emulatorsConnected = false;

export function isFirebaseConfigured(config: FirebasePublicConfig = publicConfig): boolean {
  return [config.apiKey, config.authDomain, config.projectId, config.appId, config.messagingSenderId]
    .every(value => typeof value === "string" && value.trim().length > 0);
}

function requireConfig(): FirebasePublicConfig & Required<Pick<FirebasePublicConfig, "apiKey" | "authDomain" | "projectId" | "appId" | "messagingSenderId">> {
  if (!isFirebaseConfigured(publicConfig)) {
    throw new Error("Firebase is not configured. Copy .env.example to .env.local and provide the Firebase Web SDK values.");
  }
  return publicConfig as FirebasePublicConfig & Required<Pick<FirebasePublicConfig, "apiKey" | "authDomain" | "projectId" | "appId" | "messagingSenderId">>;
}

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(requireConfig());
}

function connectEmulators(auth: Auth, db: Firestore) {
  if (emulatorsConnected || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "true" || typeof window === "undefined") return;
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  emulatorsConnected = true;
}

export function getFirebaseAuth(): Auth {
  const app = getFirebaseApp();
  const auth = getAuth(app);
  connectEmulators(auth, getFirestore(app));
  return auth;
}

export function getFirestoreDb(): Firestore {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  connectEmulators(getAuth(app), db);
  return db;
}
