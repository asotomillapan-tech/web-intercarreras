import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);

function initCachedFirestore(): Firestore {
  if (typeof window !== 'undefined') {
    try {
      return initializeFirestore(
        app,
        {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        },
        firebaseConfig.firestoreDatabaseId
      );
    } catch {
      // Fallback if Firestore was already initialized or IndexedDB is unavailable (e.g. private iframe)
    }
  }
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = initCachedFirestore();

export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive',
];

// Backward-compatible export alias
export const GOOGLE_SHEETS_SCOPES = GOOGLE_WORKSPACE_SCOPES;

// Basic Firebase Auth provider (openid/email/profile only — no sensitive Drive/Sheets scopes)
// Used for all regular student, player, delegate, and referee sign-ins.
const basicProvider = new GoogleAuthProvider();
basicProvider.setCustomParameters({ prompt: 'select_account' });

// Elevated Google Workspace provider (Drive + Sheets scopes)
// Requested strictly on-demand by Admins (Sheets sync) or Photographers/Admins (Drive upload).
const workspaceProvider = new GoogleAuthProvider();
GOOGLE_WORKSPACE_SCOPES.forEach((scope) => workspaceProvider.addScope(scope));
workspaceProvider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
// Strict in-memory OAuth access token cache (never localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Firestore connectivity on startup
async function testConnection() {
  if (typeof window === 'undefined') return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function initGoogleAuth(
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
}

/**
 * Standard Google Sign-In for all championship users (students, players, delegates, referees).
 * Requests ONLY basic identity (name, email, avatar) — never triggers sensitive Drive/Sheets prompts.
 */
export async function signInWithGoogleBasic(): Promise<{ user: User }> {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, basicProvider);
    return { user: result.user };
  } finally {
    isSigningIn = false;
  }
}

/**
 * Incremental elevated Google Workspace authorization for Admins (Master Sheets sync)
 * and Photographers/Admins (direct Google Drive gallery uploads).
 */
export async function signInWithGoogleWorkspace(): Promise<{ user: User; accessToken: string }> {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, workspaceProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google Workspace.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export const signInWithGoogleSheets = signInWithGoogleWorkspace;

export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

export async function getFirebaseIdToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

export async function signOutGoogle(): Promise<void> {
  await auth.signOut();
  cachedAccessToken = null;
}
