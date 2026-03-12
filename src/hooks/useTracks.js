// src/hooks/useTracks.js
import { useEffect, useState, useCallback } from 'react';
import axios from '../api/axiosConfig';

/**
 * useTracks - tiny hook to fetch tracks from a public endpoint that returns { items, total, page, limit }
 *
 * Usage:
 *   const { tracks, loading, error, reload } = useTracks('/public/tracks/recent', { limit: 12 });
 *
 * Returned track shape (normalized):
 *   { id, title, preview_url, artwork_url, duration, genre, artist: { id, display_name }, release_date, created_at }
 */
export default function useTracks(path = '/public/tracks/recent', opts = {}) {
  const { limit = 12, params = {} } = opts;
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // build query string
    const qs = new URLSearchParams({ limit: String(limit), ...params }).toString();
    const url = `${path}${qs ? `?${qs}` : ''}`;

    axios.get(url)
      .then(res => {
        if (cancelled) return;
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        const mapped = items.map(t => ({
          id: t.id,
          title: t.title,
          preview_url: t.preview_url || t.previewUrl || null,
          artwork_url: t.artwork_url || t.artworkUrl || null,
          duration: t.duration != null ? t.duration : null,
          genre: t.genre || null,
          artist: t.artist ? (typeof t.artist === 'object' ? t.artist : { id: t.artist_id || null, display_name: t.artist_name || null }) : null,
          release_date: t.release_date || null,
          created_at: t.created_at || null
        }));
        setTracks(mapped);
      })
      .catch(err => {
        if (!cancelled) {
          setTracks([]);
          setError(err?.message || err?.response?.data?.error || 'Failed to load tracks');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [path, limit, JSON.stringify(params), nonce]);

  return { tracks, loading, error, reload };
}