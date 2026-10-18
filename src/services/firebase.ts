import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/contacts.readonly',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  provider.addScope(scope);
});
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedCustomUser: Partial<User> | null = null;

// Initialize from localStorage if valid session exists
try {
  const saved = localStorage.getItem('gqueues_auth_session');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.accessToken && parsed.user) {
      cachedAccessToken = parsed.accessToken;
      cachedCustomUser = parsed.user;
    }
  }
} catch {
  // Ignore storage read error
}

export const saveSession = (user: Partial<User>, accessToken: string) => {
  cachedAccessToken = accessToken;
  cachedCustomUser = user;
  try {
    localStorage.setItem(
      'gqueues_auth_session',
      JSON.stringify({
        accessToken,
        user,
        savedAt: Date.now(),
      })
    );
  } catch {
    // Ignore storage write error
  }
};

export const clearSession = () => {
  cachedAccessToken = null;
  cachedCustomUser = null;
  try {
    localStorage.removeItem('gqueues_auth_session');
  } catch {
    // Ignore storage clear error
  }
};

// Google Identity Services (GIS) fallback for direct Google OAuth
export const signInWithGIS = (
  clientId: string,
  scopes: string[]
): Promise<{ user: Partial<User>; accessToken: string }> => {
  return new Promise((resolve, reject) => {
    const initClient = () => {
      try {
        const googleObj = (window as any).google;
        if (!googleObj?.accounts?.oauth2) {
          reject(new Error('Google Identity Services library not available'));
          return;
        }

        const tokenClient = googleObj.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: scopes.join(' '),
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              if (tokenResponse.error === 'popup_closed_by_user') {
                resolve({ user: {} as any, accessToken: '' });
                return;
              }
              reject(new Error(`Google OAuth error: ${tokenResponse.error_description || tokenResponse.error}`));
              return;
            }

            const token = tokenResponse.access_token;
            if (!token) {
              reject(new Error('No access token received from Google'));
              return;
            }

            try {
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` },
              });
              const profile = await res.json();
              const u: Partial<User> = {
                uid: profile.sub || 'workspace-user',
                displayName: profile.name || 'Google Workspace User',
                email: profile.email || '',
                photoURL: profile.picture || '',
              };
              saveSession(u, token);
              resolve({ user: u, accessToken: token });
            } catch {
              const u: Partial<User> = {
                uid: 'workspace-user',
                displayName: 'Google Workspace User',
                email: '',
              };
              saveSession(u, token);
              resolve({ user: u, accessToken: token });
            }
          },
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
      } catch (err) {
        reject(err);
      }
    };

    if ((window as any).google?.accounts?.oauth2) {
      initClient();
    } else {
      const existingScript = document.getElementById('google-gsi-client');
      if (existingScript) {
        existingScript.onload = () => initClient();
      } else {
        const script = document.createElement('script');
        script.id = 'google-gsi-client';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = () => initClient();
        script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
        document.head.appendChild(script);
      }
    }
  });
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // If we already have a cached session from localStorage, fire success immediately!
  if (cachedCustomUser && cachedAccessToken) {
    if (onAuthSuccess) {
      onAuthSuccess(cachedCustomUser as User, cachedAccessToken);
    }
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      saveSession(user, cachedAccessToken);
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else if (cachedCustomUser && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(cachedCustomUser as User, cachedAccessToken);
    } else if (!isSigningIn && !cachedAccessToken) {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User | Partial<User>; accessToken: string } | null> => {
  try {
    isSigningIn = true;

    // Try standard Firebase popup first
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        saveSession(result.user, credential.accessToken);
        return { user: result.user, accessToken: credential.accessToken };
      }
    } catch (firebaseErr: any) {
      const errCode = firebaseErr?.code || '';
      const errMsg = firebaseErr?.message || '';

      // If unauthorized-domain, operation-not-allowed, or popup issues occur:
      // seamlessly fallback to Google Identity Services token client using OAuth client ID!
      if (
        errCode === 'auth/unauthorized-domain' ||
        errCode === 'auth/operation-not-allowed' ||
        errCode === 'auth/configuration-not-found' ||
        errMsg.includes('unauthorized-domain')
      ) {
        console.warn('Firebase Auth unauthorized domain, falling back to Google Identity Services...');
        const gisResult = await signInWithGIS(firebaseConfig.oAuthClientId, SCOPES);
        if (!gisResult.accessToken) {
          return null; // user closed GIS prompt
        }
        return gisResult;
      }

      // If user simply closed popup
      if (
        errCode === 'auth/popup-closed-by-user' ||
        errCode === 'auth/cancelled-popup-request'
      ) {
        return null;
      }

      // If popup was blocked or other error, try GIS as fallback
      if (errCode === 'auth/popup-blocked') {
        const gisResult = await signInWithGIS(firebaseConfig.oAuthClientId, SCOPES);
        if (!gisResult.accessToken) return null;
        return gisResult;
      }

      throw firebaseErr;
    }

    return null;
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      return null;
    }
    console.error('Google Sign-In failed:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async (): Promise<void> => {
  clearSession();
  try {
    await signOut(auth);
  } catch {
    // Ignore signout error
  }
};
