// src/api/axiosConfig.js
import axios from 'axios';

const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  withCredentials: true,
  timeout: 60000,
}); 
 
function debugLog(...args) { 
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

instance.interceptors.request.use(
  config => {
    try {
      let token = null;

      // Priority 1: Try bb_token (main storage location)
      token = localStorage.getItem('bb_token');

      // Priority 2: Try bb_auth object
      if (!token) {
        const rawBbAuth = localStorage.getItem('bb_auth');
        if (rawBbAuth) {
          try {
            const parsed = JSON.parse(rawBbAuth);
            if (parsed && parsed.token) token = parsed.token;
          } catch (e) {
            // bb_auth might sometimes be a plain token string
            token = rawBbAuth;
          }
        }
      }

      // Priority 3: Fallback to authToken
      if (!token) token = localStorage.getItem('authToken');

      if (process.env.NODE_ENV === 'development') {
        debugLog('🔑 Token lookup:', {
          bb_token: localStorage.getItem('bb_token') ? 'Found' : 'Missing',
          bb_auth: localStorage.getItem('bb_auth') ? 'Found' : 'Missing',
          authToken: localStorage.getItem('authToken') ? 'Found' : 'Missing',
          finalToken: token ? `Found (${token.substring(0, 20)}...)` : 'NOT FOUND'
        });
      }

      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        if (process.env.NODE_ENV === 'development') {
          debugLog('⚠️ No token found in localStorage - request will fail if auth is required');
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error in request interceptor:', e);
    }
    return config;
  },
  err => Promise.reject(err)
);

instance.interceptors.response.use(
  response => response,
  error => {
    // Network error (no response)
    if (!error.response) {
      error.isNetworkError = true;
      error.userMessage = 'Unable to reach our servers. Please check your network connection and try again.';
      return Promise.reject(error);
    }

    const status = error.response.status;

    // On 401, clear auth and redirect to /login
    if (status === 401) {
      debugLog('❌ Request returned 401 — clearing auth and redirecting to /login');

      // Clear all auth data (bb_*, authToken, and helper keys)
      try {
        localStorage.removeItem('bb_token');
        localStorage.removeItem('bb_auth');
        localStorage.removeItem('bb_user');

        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('userId');
        localStorage.removeItem('isLoggedIn');
      } catch (e) {
        debugLog('Error clearing storage during 401 handling:', e);
      }

      // Redirect to login page with optional redirectTo param
      try {
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `/login?redirectTo=${encodeURIComponent(currentPath)}`;
      } catch (e) {
        window.location.href = '/login';
      }

      // Still reject so callers can handle it if desired
      return Promise.reject(error);
    }

    // Other errors: just propagate
    return Promise.reject(error);
  }
);

export default instance;
