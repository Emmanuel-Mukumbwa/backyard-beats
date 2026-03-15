// src/hooks/useTracks.js
import { useEffect, useState, useCallback } from 'react';
import axios from '../api/axiosConfig';

export default function useTracks(path = '/public/tracks/recent', opts = {}) {
  const { limit = 12, params = {} } = opts;

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce(n => n + 1), []);

  // stable string key representing params content (only changes when params content changes)
  const paramsKey = JSON.stringify(params || {});

  // helper to resolve relative uploads to absolute using configured axios baseURL
  function resolveToBackend(raw) {
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || window.location.origin;
    const rel = raw.startsWith('/') ? raw : `/${raw}`;
    return `${base.replace(/\/$/, '')}${rel}`;
  }

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    // parse paramsKey inside the effect so the effect only depends on paramsKey (a string)
    let parsedParams = {};
    try {
      parsedParams = paramsKey ? JSON.parse(paramsKey) : {};
    } catch (e) {
      // parsing failed (corrupted or not JSON) — fallback to empty object
      parsedParams = {};
    }

    axios.get(path, { params: { limit, ...(parsedParams || {}) }, signal: controller.signal })
      .then(res => {
        if (cancelled) return;

        const items = Array.isArray(res.data?.items)
          ? res.data.items
          : (Array.isArray(res.data) ? res.data : []);

        const mapped = items.map(t => ({
          id: t.id,
          title: t.title,
          preview_url: t.preview_url || t.previewUrl || null,
          // resolve artwork/preview to absolute to avoid dev-proxy relative path issues
          artwork_url: (t.artwork_url || t.artworkUrl) ? resolveToBackend(t.artwork_url || t.artworkUrl) : null,
          duration: t.duration ?? null,
          genre: t.genre || null,
          artist: t.artist
            ? (typeof t.artist === 'object'
                ? t.artist
                : { id: t.artist_id || null, display_name: t.artist_name || null })
            : null,
          release_date: t.release_date || null,
          created_at: t.created_at || null,
          download_url: t.download_url ? resolveToBackend(t.download_url) : null
        }));

        setTracks(mapped);
      })
      .catch(err => {
        if (cancelled) return;
        // if aborted, quietly ignore
        if (err?.name === 'CanceledError' || err?.message === 'canceled') return;
        setTracks([]);
        setError(
          err?.message ||
          err?.response?.data?.error ||
          'Failed to load tracks'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      try { controller.abort(); } catch (e) { /* ignore */ }
    };
  }, [path, limit, paramsKey, nonce]); // only re-run when content of params (paramsKey) changes

  return { tracks, loading, error, reload };
}