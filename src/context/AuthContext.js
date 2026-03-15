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

function decodeJwtPayload(token) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Failed to decode JWT payload', e);
    return null;
  }
}

function decodeJwtUserId(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return payload.userId || payload.id || null;
}

function clearAuthStorage() {
  try {
    SAFE_KEYS.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    // ignore
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);

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
      setArtist(null);
      return null;
    }
  }, []);

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

      if (token) applyAxiosAuthHeader(token);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error saving auth to storage', e);
    }
  };

  // Stabilize clearAllAuth so callbacks can depend on it safely
  const clearAllAuth = useCallback(() => {
    setUser(null);
    setArtist(null);
    clearAuthStorage();
    applyAxiosAuthHeader(null);
  }, []);

  const login = (userData) => {
    if (!userData) return;
    const token = userData.token || null;

    let composedUser = { ...userData };
    if (!composedUser.userId && token) {
      const decodedId = decodeJwtUserId(token);
      if (decodedId) composedUser.userId = String(decodedId);
    }

    setUser(composedUser);
    saveAllStorages(composedUser);

    if (composedUser.role === 'artist' || composedUser.has_profile === true) {
      fetchArtistProfile().catch(() => {});
    }
  };

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

      if (userCopy.role === 'artist' || userCopy.has_profile === true) {
        fetchArtistProfile().catch(() => {});
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error updating user storage', e);
    }
  };

  const logout = async () => {
    try {
      await axios.post('/auth/logout').catch(() => {});
    } catch (e) {
      // ignore
    } finally {
      clearAllAuth();
    }
  };

  const verifyAndHydrate = useCallback(async () => {
    setLoading(true);
    try {
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
        clearAllAuth();
        return;
      }

      const payload = decodeJwtPayload(token);
      if (payload && payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
          clearAllAuth();
          return;
        }
      }

      applyAxiosAuthHeader(token);

      try {
        const res = await axios.get('/auth/check');
        if (res?.data?.user) {
          const remoteUser = res.data.user;
          const composed = { ...remoteUser, token };
          setUser(composed);

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

          if (composed.role === 'artist' || composed.has_profile === true) {
            await fetchArtistProfile();
          } else {
            setArtist(null);
          }

          return;
        } else {
          clearAllAuth();
          return;
        }
      } catch (err) {
        clearAllAuth();
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [fetchArtistProfile, clearAllAuth]);

  const refresh = async () => {
    await verifyAndHydrate();
  };

  useEffect(() => {
    verifyAndHydrate();

    const onStorage = (e) => {
      if (!e.key) return;
      if (SAFE_KEYS.includes(e.key)) {
        const hasToken = !!localStorage.getItem('bb_token') || !!localStorage.getItem('authToken');
        if (!hasToken) {
          setUser(null);
          setArtist(null);
        } else {
          verifyAndHydrate().catch(() => {});
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [verifyAndHydrate]);

  useEffect(() => {
    const token = user?.token || localStorage.getItem('bb_token') || localStorage.getItem('authToken') || null;
    applyAxiosAuthHeader(token);
  }, [user]);

  // clarify mixed operators with parentheses
  const isAuthenticated = !!user;
  const isArtist = !!user && (user.role === 'artist' || (user.role === 'admin' && !!artist));
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