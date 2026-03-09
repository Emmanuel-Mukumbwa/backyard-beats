// src/components/RecentlyUploaded.js
import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Image, Button, ListGroup, Spinner } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import AudioPlayer from './AudioPlayer';

/**
 * RecentlyUploaded
 * - Fetches /public/tracks/recent
 * - Shows AudioPlayer for the list + a short list of recent uploads
 *
 * Props:
 * - limit (default 12)
 * - onRecordPlay(track) -> optional fn passed from parent to record listens
 */
export default function RecentlyUploaded({ limit = 12, onRecordPlay = null }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios.get(`/public/tracks/recent?limit=${limit}`)
      .then(res => {
        if (cancelled) return;
        const data = Array.isArray(res.data) ? res.data : [];
        // map to AudioPlayer-friendly shape
        const mapped = data.map(t => ({
          id: t.id,
          title: t.title,
          preview_url: t.preview_url,
          duration: t.duration,
          artwork_url: t.artwork_url,
          artist_name: t.artist?.display_name || '',
          genre: t.genre,
        }));
        setTracks(mapped);
      })
      .catch(err => {
        console.error('Failed to load recent uploads', err);
        setTracks([]);
        setError(err?.message || 'Failed to load');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [limit]);

  if (loading) return <div className="text-center py-3"><Spinner animation="border" /></div>;
  if (error) return <div className="text-muted">Error loading recent uploads: {error}</div>;
  if (!tracks.length) return <div className="text-muted">No recent uploads yet.</div>;

  return (
    <div>
      <h6 className="mb-3">New Releases</h6>
      <AudioPlayer tracks={tracks} onPlay={async (t) => {
        if (typeof onRecordPlay === 'function') {
          try { await onRecordPlay({ id: t.id, artist_id: null }); } catch (e) { /* non-fatal */ }
        }
      }} />
      <ListGroup className="mt-3">
        {tracks.slice(0, 12).map((t, i) => (
          <ListGroup.Item key={`${t.id}-${i}`}>
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center">
                <Image src={t.artwork_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.title||'Track')}&background=ddd&color=333`} rounded style={{ width: 48, height: 48, objectFit: 'cover', marginRight: 12 }} />
                <div>
                  <div className="fw-bold">{t.title}</div>
                  <div className="small text-muted">{t.artist_name || ''} {t.genre ? `• ${t.genre}` : ''}</div>
                </div>
              </div>
              <div className="small text-muted">{t.duration ? `${t.duration}s` : '-'}</div>
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </div>
  );
}