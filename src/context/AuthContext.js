// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useCallback } from "react";
import axios from '../api/axiosConfig';

export const AuthContext = createContext();

const SAFE_KEYS = [
  'bb_token', 'bb_auth', 'bb_user',
  'authToken', 'userRole', 'userName', 'userId', 'isLoggedIn'
];

function safeParse(raw) { 
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Decode full JWT payload (no signature verification)
function decodeJwtPayload(token) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // atob is available in browsers; for older envs consider polyfill
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Failed to decode JWT payload', e);
    return null;
  }
}

// Keep backward-compatible helper that returns user id
function decodeJwtUserId(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return payload.userId || payload.id || null;
}

// Clear auth-related localStorage keys
function clearAuthStorage() {
  try {
    SAFE_KEYS.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    // ignore
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // canonical user object (includes token when available)
  const [artist, setArtist] = useState(null); // artist profile (if user is an artist)
  const [loading, setLoading] = useState(true); // overall auth hydration state

  // Helper: set axios auth header (best-effort)
  const applyAxiosAuthHeader = (token) => {
    try {
      if (token) {
        axios.defaults.headers.common = axios.defaults.headers.common || {};
        axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      } else if (axios.defaults.headers && axios.defaults.headers.common) {
        delete axios.defaults.headers.common.Authorization;
      }
    } catch (e) {
      // ignore
    }
  };

  // Fetch artist profile for currently authenticated user (if any)
  const fetchArtistProfile = useCallback(async () => {
    try {
      const res = await axios.get('/profile/me');
      if (res?.data?.artist) {
        setArtist(res.data.artist);
        return res.data.artist;
      }
      setArtist(null);
      return null;
    } catch (err) {
      // Could be 401 (no profile or not artist) or network error
      setArtist(null);
      return null;
    }
  }, []);

  // Save user and token into localStorage in all expected formats
  const saveAllStorages = (userData) => {
    try {
      const token = userData.token || localStorage.getItem('bb_token') || localStorage.getItem('authToken') || null;
      const userObj = { ...userData };
      delete userObj.token;

      if (token) localStorage.setItem('bb_token', token);
      localStorage.setItem('bb_user', JSON.stringify({ ...userObj, token }));
      localStorage.setItem('bb_auth', JSON.stringify({ token, user: userObj }));

      if (token) localStorage.setItem('authToken', token);
      if (userObj.role) localStorage.setItem('userRole', userObj.role);
      if (userObj.username || userObj.name || userObj.fullName) {
        localStorage.setItem('userName', userObj.username || userObj.name || userObj.fullName);
      }
      if (userObj.userId || userObj.id) localStorage.setItem('userId', String(userObj.userId ?? userObj.id));
      localStorage.setItem('isLoggedIn', 'true');

      // Ensure axios has header for subsequent immediate requests
      if (token) applyAxiosAuthHeader(token);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error saving auth to storage', e);
    }
  };

  // Remove auth state (local + memory)
  const clearAllAuth = () => {
    setUser(null);
    setArtist(null);
    clearAuthStorage();
    applyAxiosAuthHeader(null);
  };

  // Primary login action (frontend uses this after /auth/login)
  const login = (userData) => {
    if (!userData) return;
    const token = userData.token || null;

    let composedUser = { ...userData };
    // Populate userId if missing by decoding token
    if (!composedUser.userId && token) {
      const decodedId = decodeJwtUserId(token);
      if (decodedId) composedUser.userId = String(decodedId);
    }

    setUser(composedUser);
    saveAllStorages(composedUser);

    // If user is artist or has_profile true, try to fetch artist profile immediately
    if (composedUser.role === 'artist' || composedUser.has_profile === true) {
      // fire-and-forget; components can call fetchArtistProfile too
      fetchArtistProfile().catch(() => {});
    }
  };

  // Update stored user (merge) and persist
  const updateUser = (updates) => {
    const newUser = { ...(user || {}), ...updates };
    setUser(newUser);
    try {
      const token = newUser.token || localStorage.getItem('bb_token') || localStorage.getItem('authToken');
      const userCopy = { ...newUser };
      delete userCopy.token;

      localStorage.setItem('bb_user', JSON.stringify({ ...userCopy, token }));

      const bbAuthRaw = localStorage.getItem('bb_auth');
      if (bbAuthRaw) {
        const parsed = safeParse(bbAuthRaw) || {};
        parsed.user = userCopy;
        parsed.token = token;
        localStorage.setItem('bb_auth', JSON.stringify(parsed));
      }

      if (userCopy.role) localStorage.setItem('userRole', userCopy.role);
      if (userCopy.username || userCopy.name || userCopy.fullName) {
        localStorage.setItem('userName', userCopy.username || userCopy.name || userCopy.fullName);
      }
      if (userCopy.userId || userCopy.id) localStorage.setItem('userId', String(userCopy.userId ?? userCopy.id));

      // If role or has_profile changed to artist, refresh artist data
      if (userCopy.role === 'artist' || userCopy.has_profile === true) {
        fetchArtistProfile().catch(() => {});
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error updating user storage', e);
    }
  };

  // Logout: server best-effort, then clear frontend state
  const logout = async () => {
    try {
      await axios.post('/auth/logout').catch(() => {});
    } catch (e) {
      // ignore
    } finally {
      clearAllAuth();
    }
  };

  // Hydrate on app start: discover token, call /auth/check and populate user + artist
  const verifyAndHydrate = useCallback(async () => {
    setLoading(true);
    try {
      // 1) discover token from known storage spots
      let token = localStorage.getItem('bb_token') || null;
      if (!token) {
        const rawBbAuth = localStorage.getItem('bb_auth');
        if (rawBbAuth) {
          const parsed = safeParse(rawBbAuth);
          if (parsed && parsed.token) token = parsed.token;
          else if (typeof rawBbAuth === 'string' && rawBbAuth.length > 0) token = rawBbAuth;
        }
      }
      if (!token) token = localStorage.getItem('authToken') || null;

      if (!token) {
        // No token found — ensure we are clean
        clearAllAuth();
        return;
      }

      // 2) local expiration check if payload contains exp
      const payload = decodeJwtPayload(token);
      if (payload && payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
          // token expired locally
          clearAllAuth();
          return;
        }
      }

      // ensure axios uses header for /auth/check
      applyAxiosAuthHeader(token);

      // 3) verify with backend
      try {
        const res = await axios.get('/auth/check'); // axios interceptor/header will include token
        if (res?.data?.user) {
          const remoteUser = res.data.user;
          const composed = { ...remoteUser, token };
          setUser(composed);

          // persist canonical formats
          try {
            localStorage.setItem('bb_token', token);
            localStorage.setItem('authToken', token);
            localStorage.setItem('bb_user', JSON.stringify({ ...remoteUser, token }));
            localStorage.setItem('bb_auth', JSON.stringify({ token, user: remoteUser }));
            if (remoteUser.role) localStorage.setItem('userRole', remoteUser.role);
            if (remoteUser.username || remoteUser.name) localStorage.setItem('userName', remoteUser.username || remoteUser.name);
            if (remoteUser.userId || remoteUser.id) localStorage.setItem('userId', String(remoteUser.userId ?? remoteUser.id));
            localStorage.setItem('isLoggedIn', 'true');
          } catch (e) {
            // ignore storage errors
          }

          // If this user is an artist or has_profile true, fetch artist profile
          if (composed.role === 'artist' || composed.has_profile === true) {
            await fetchArtistProfile();
          } else {
            setArtist(null);
          }

          return;
        } else {
          // Unexpected shape -> treat as unauthenticated
          clearAllAuth();
          return;
        }
      } catch (err) {
        // If verification failed (401 or network), clear stale auth so app doesn't assume logged-in
        clearAllAuth();
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [fetchArtistProfile]);

  // Manual refresh wrapper
  const refresh = async () => {
    await verifyAndHydrate();
  };

  // Listen to localStorage changes to react to logout/login in other tabs
  useEffect(() => {
    verifyAndHydrate();

    const onStorage = (e) => {
      if (!e.key) return;
      // If auth keys changed (or cleared) update state
      if (SAFE_KEYS.includes(e.key)) {
        // If token removed -> clear state, if token added -> re-verify
        const hasToken = !!localStorage.getItem('bb_token') || !!localStorage.getItem('authToken');
        if (!hasToken) {
          setUser(null);
          setArtist(null);
        } else {
          // perform a lightweight verify in background
          verifyAndHydrate().catch(() => {});
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [verifyAndHydrate]);

  // Keep axios header in sync when user.token changes in-memory
  useEffect(() => {
    const token = user?.token || localStorage.getItem('bb_token') || localStorage.getItem('authToken') || null;
    applyAxiosAuthHeader(token);
  }, [user]);

  // role helpers
  const isAuthenticated = !!user;
  const isArtist = !!user && (user.role === 'artist' || user.role === 'admin' && !!artist); // admin may see artist management too
  const isAdmin = !!user && user.role === 'admin';
  const isFan = !!user && user.role === 'fan';

  return (
    <AuthContext.Provider value={{
      user,
      artist,
      login,
      logout,
      updateUser,
      loading,
      refresh,
      fetchArtistProfile,
      isAuthenticated,
      isArtist,
      isAdmin,
      isFan
    }}>
      {children}
    </AuthContext.Provider>
  );
};