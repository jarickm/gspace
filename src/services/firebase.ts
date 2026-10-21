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
                email: profile.email || '',
                photoURL: profile.picture || '',
              };
              saveSession(u, token, expiresIn);
              resolve({ user: u, accessToken: token });
            } catch {
              const u: Partial<User> = {
                uid: 'workspace-user',
                displayName: 'Google Workspace User',
                email: '',
              };
              saveSession(u, token, expiresIn);
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
 * Attempts silent token refresh via Google Identity Services without showing a popup.
 * If user has granted permissions before in this browser session, GIS returns a new access_token immediately.
 */
export const refreshAccessTokenSilently = async (): Promise<string | null> => {
  if (silentRefreshPromise) {
    return silentRefreshPromise;
  }

  silentRefreshPromise = (async () => {
    try {
      const loaded = await ensureGISLoaded();
      if (!loaded) return null;

      const googleObj = (window as any).google;
      if (!googleObj?.accounts?.oauth2) return null;

      const emailHint = cachedCustomUser?.email || auth.currentUser?.email || '';

      return await new Promise<string | null>((resolve) => {
        let hasResolved = false;
        const timer = setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            resolve(null);
          }
        }, 8000);

        try {
          const tokenClient = googleObj.accounts.oauth2.initTokenClient({
            client_id: firebaseConfig.oAuthClientId,
            scope: SCOPES.join(' '),
            hint: emailHint || undefined,
            callback: (tokenResponse: any) => {
              if (hasResolved) return;
              hasResolved = true;
              clearTimeout(timer);

              if (tokenResponse?.access_token) {
                const token = tokenResponse.access_token;
                const expiresIn = Number(tokenResponse.expires_in) || 3500;
                const user = cachedCustomUser || {
                  uid: 'workspace-user',
                  displayName: 'Google Workspace User',
                  email: emailHint,
                };
                saveSession(user, token, expiresIn);
                console.log('[Auth] Silent token refresh succeeded');
                resolve(token);
              } else {
                console.warn('[Auth] Silent refresh returned no token:', tokenResponse?.error);
                resolve(null);
              }
            },
            error_callback: (err: any) => {
              if (hasResolved) return;
              hasResolved = true;
              clearTimeout(timer);
              console.warn('[Auth] Silent refresh error:', err);
              resolve(null);
            },
          });

          // prompt: '' enables silent renewal without opening an interactive popup
          tokenClient.requestAccessToken({ prompt: '' });
        } catch (err) {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timer);
            resolve(null);
          }
        }
      });
    } catch {
      return null;
    } finally {
      silentRefreshPromise = null;
    }
  })();

  return silentRefreshPromise;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // If we already have a cached session from localStorage, load user immediately!
  if (cachedCustomUser && cachedAccessToken) {
    if (onAuthSuccess) {
      onAuthSuccess(cachedCustomUser as User, cachedAccessToken);
    }

    // If expired or about to expire, run silent background refresh
    if (isTokenExpired()) {
      refreshAccessTokenSilently().then((freshToken) => {
        if (freshToken && onAuthSuccess && cachedCustomUser) {
          onAuthSuccess(cachedCustomUser as User, freshToken);
        }
      });
    }
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      saveSession(user, cachedAccessToken);
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else if (cachedCustomUser && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(cachedCustomUser as User, cachedAccessToken);
    } else if (!isSigningIn && !cachedAccessToken) {
      // Try silent refresh before failing
      refreshAccessTokenSilently().then((freshToken) => {
        if (freshToken && cachedCustomUser && onAuthSuccess) {
          onAuthSuccess(cachedCustomUser as User, freshToken);
        } else if (onAuthFailure) {
          onAuthFailure();
        }
      });
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User | Partial<User>;
  accessToken: string;
} | null> => {
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
          return null;
        }
        return gisResult;
      }

      if (
        errCode === 'auth/popup-closed-by-user' ||
        errCode === 'auth/cancelled-popup-request'
      ) {
        return null;
      }

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
