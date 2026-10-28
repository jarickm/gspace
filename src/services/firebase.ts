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
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/directory.readonly',
  'https://www.googleapis.com/auth/contacts.other.readonly',
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
let tokenExpiresAt: number = 0;

export interface StoredSession {
  accessToken: string;
  user: Partial<User>;
  savedAt: number;
  expiresAt: number;
}

// Global 401 / session expired callbacks
const sessionExpiredListeners = new Set<() => void>();

export const onSessionExpired = (listener: () => void) => {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
};

export const notifySessionExpired = () => {
  sessionExpiredListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('Error in session expired listener:', e);
    }
  });
};

// Initialize from localStorage if session exists
try {
  const saved = localStorage.getItem('gqueues_auth_session');
  if (saved) {
    const parsed: StoredSession = JSON.parse(saved);
    if (parsed.accessToken && parsed.user) {
      cachedAccessToken = parsed.accessToken;
      cachedCustomUser = parsed.user;
      tokenExpiresAt = parsed.expiresAt || parsed.savedAt + 3500 * 1000;
    }
  }
} catch {
  // Ignore storage read error
}

export const isTokenExpired = (): boolean => {
  if (!cachedAccessToken) return true;
  // If current time is beyond expiresAt (or within 2 minutes of expiring)
  return Date.now() > (tokenExpiresAt - 2 * 60 * 1000);
};

export const getStoredSession = (): StoredSession | null => {
  try {
    const saved = localStorage.getItem('gqueues_auth_session');
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    return null;
  }
};

export const saveSession = (
  user: Partial<User>,
  accessToken: string,
  expiresInSeconds: number = 3500
) => {
  cachedAccessToken = accessToken;
  cachedCustomUser = user;
  const now = Date.now();
  tokenExpiresAt = now + expiresInSeconds * 1000;

  try {
    const sessionData: StoredSession = {
      accessToken,
      user,
      savedAt: now,
      expiresAt: tokenExpiresAt,
    };
    localStorage.setItem('gqueues_auth_session', JSON.stringify(sessionData));
  } catch {
    // Ignore storage write error
  }
};

export const clearSession = () => {
  cachedAccessToken = null;
  cachedCustomUser = null;
  tokenExpiresAt = 0;
  try {
    localStorage.removeItem('gqueues_auth_session');
  } catch {
    // Ignore storage clear error
  }
};

// Google Identity Services (GIS) fallback for direct Google OAuth
export const signInWithGIS = (
  clientId: string,
  scopes: string[],
  loginHint?: string
): Promise<{ user: Partial<User>; accessToken: string }> => {
  return new Promise((resolve, reject) => {
    const initClient = () => {
      try {
        const googleObj = (window as any).google;
        if (!googleObj?.accounts?.oauth2) {
          reject(new Error('Google Identity Services library not available'));
          return;
        }

        const clientConfig: any = {
          client_id: clientId,
          scope: scopes.join(' '),
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              if (tokenResponse.error === 'popup_closed_by_user') {
                resolve({ user: {} as any, accessToken: '' });
                return;
              }
              reject(
                new Error(
                  `Google OAuth error: ${tokenResponse.error_description || tokenResponse.error}`
                )
              );
              return;
            }

            const token = tokenResponse.access_token;
            if (!token) {
              reject(new Error('No access token received from Google'));
              return;
            }

            const expiresIn = Number(tokenResponse.expires_in) || 3500;

            try {
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` },
              });
              const profile = await res.json();
              const u: Partial<User> = {
                uid: profile.sub || 'workspace-user',
                displayName: profile.name || 'Google Workspace User',
                email: profile.email || loginHint || '',
                photoURL: profile.picture || '',
              };
              saveSession(u, token, expiresIn);
              if (u.email) {
                try {
                  localStorage.setItem('gqueues_preferred_workspace_email', u.email);
                } catch {}
              }
              resolve({ user: u, accessToken: token });
            } catch {
              const u: Partial<User> = {
                uid: 'workspace-user',
                displayName: 'Google Workspace User',
                email: loginHint || '',
              };
              saveSession(u, token, expiresIn);
              resolve({ user: u, accessToken: token });
            }
          },
          error_callback: (err: any) => {
            if (err?.type === 'popup_closed') {
              resolve({ user: {} as any, accessToken: '' });
              return;
            }
            reject(err);
          },
        };

        if (loginHint) {
          clientConfig.hint = loginHint;
        }

        const tokenClient = googleObj.accounts.oauth2.initTokenClient(clientConfig);

        const requestConfig: any = { prompt: 'select_account' };
        if (loginHint) {
          requestConfig.hint = loginHint;
        }
        tokenClient.requestAccessToken(requestConfig);
      } catch (err) {
        reject(err);
      }
    };

    if ((window as any).google?.accounts?.oauth2) {
      initClient();
    } else {
      ensureGISLoaded().then((loaded) => {
        if (loaded) {
          initClient();
        } else {
          reject(new Error('Google Identity Services client failed to load'));
        }
      });
    }
  });
};

/**
 * Ensures Google Identity Services (GIS) client script is injected and available
 */
export const ensureGISLoaded = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve(true);
      return;
    }
    const existing = document.getElementById('google-gsi-client');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      setTimeout(() => resolve(!!(window as any).google?.accounts?.oauth2), 3000);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
    setTimeout(() => resolve(!!(window as any).google?.accounts?.oauth2), 4000);
  });
};

let silentRefreshPromise: Promise<string | null> | null = null;

/**
 * Checks if the current session token is still valid.
 * IMPORTANT: Google Identity Services prohibits calling requestAccessToken()
 * without a direct user gesture (such as an explicit button click).
 * Background / unprompted calls are blocked by browsers and generate GSI_LOGGER errors.
 * This method simply returns the active in-memory token if valid, or notifies session expiration.
 */
export const refreshAccessTokenSilently = async (): Promise<string | null> => {
  if (cachedAccessToken && !isTokenExpired()) {
    return cachedAccessToken;
  }
  // If token is missing or expired, mark session as expired so user can click Reconnect
  notifySessionExpired();
  return null;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // If we already have a cached session from localStorage, restore state immediately!
  if (cachedCustomUser && cachedAccessToken) {
    if (onAuthSuccess) {
      onAuthSuccess(cachedCustomUser as User, cachedAccessToken);
    }

    // If expired, notify user gracefully without unprompted popup
    if (isTokenExpired()) {
      notifySessionExpired();
    }
  } else {
    if (onAuthFailure) onAuthFailure();
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

export const googleSignIn = async (
  loginHint?: string
): Promise<{
  user: User | Partial<User>;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const effectiveHint =
      loginHint ||
      (typeof localStorage !== 'undefined'
        ? localStorage.getItem('gqueues_preferred_workspace_email') || ''
        : '') ||
      'jarick.montojo@coolaireconsolidated.com';

    const activeClientId =
      (typeof localStorage !== 'undefined'
        ? localStorage.getItem('gqueues_custom_client_id')
        : null) ||
      (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
      firebaseConfig.oAuthClientId;

    // In AI Studio preview iframes (e.g. *.run.app), GIS TokenClient provides
    // instant, direct Google OAuth tokens without domain authorization errors.
    if ((window as any).google?.accounts?.oauth2 && activeClientId) {
      try {
        const gisResult = await signInWithGIS(activeClientId, SCOPES, effectiveHint);
        if (gisResult?.accessToken) {
          return gisResult;
        }
      } catch (gisErr: any) {
        console.warn('GIS sign in error, trying Firebase popup fallback:', gisErr);
        if (
          gisErr?.message?.includes('origin') ||
          gisErr?.message?.includes('idpiframe') ||
          gisErr?.error === 'idpiframe_initialization_failed'
        ) {
          throw new Error(
            `Google OAuth origin mismatch: "${window.location.origin}" is not registered in Google Cloud Console. Add "${window.location.origin}" to Authorized JavaScript origins for OAuth Client ID ${activeClientId.slice(0, 20)}...`
          );
        }
      }
    }

    // Firebase popup fallback with prompt: 'select_account' and login_hint
    try {
      if (effectiveHint) {
        provider.setCustomParameters({
          prompt: 'select_account',
          login_hint: effectiveHint,
        });
      } else {
        provider.setCustomParameters({
          prompt: 'select_account',
        });
      }

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        saveSession(result.user, credential.accessToken);
        if (result.user.email) {
          try {
            localStorage.setItem('gqueues_preferred_workspace_email', result.user.email);
          } catch {}
        }
        return { user: result.user, accessToken: credential.accessToken };
      }
    } catch (firebaseErr: any) {
      const errCode = firebaseErr?.code || '';

      if (
        errCode === 'auth/popup-closed-by-user' ||
        errCode === 'auth/cancelled-popup-request'
      ) {
        return null;
      }

      if (errCode === 'auth/unauthorized-domain') {
        throw new Error(
          `Domain "${window.location.hostname}" is not authorized. In Firebase Console > Authentication > Settings > Authorized domains, add "${window.location.hostname}".`
        );
      }

      if (
        (window as any).google?.accounts?.oauth2 &&
        activeClientId
      ) {
        const fallbackGis = await signInWithGIS(activeClientId, SCOPES, effectiveHint);
        if (fallbackGis?.accessToken) return fallbackGis;
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
