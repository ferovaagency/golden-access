import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Google Sheets standard scope to read and write spreadsheet dashboards
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
// Google Drive scope to search, create, and backup the agency finance file
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = typeof window !== 'undefined' ? sessionStorage.getItem('ferova_oauth_token') : null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If there's a Firebase session but no Google access token, we must force a sign in
        cachedAccessToken = null;
        typeof window !== 'undefined' && sessionStorage.removeItem('ferova_oauth_token');
        await auth.signOut();
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      typeof window !== 'undefined' && sessionStorage.removeItem('ferova_oauth_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google OAuth.');
    }
    cachedAccessToken = credential.accessToken;
    typeof window !== 'undefined' && sessionStorage.setItem('ferova_oauth_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Error de inicio de sesión:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setAccessTokenCustom = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('ferova_oauth_token', token);
    } else {
      sessionStorage.removeItem('ferova_oauth_token');
    }
  }
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('ferova_oauth_token');
  }
};
