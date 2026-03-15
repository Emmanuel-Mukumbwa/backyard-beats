// src/components/PlaylistView.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Modal, Button, ListGroup, Image, Row, Col } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import LoadingSpinner from './LoadingSpinner';
import ToastMessage from './ToastMessage';

/**
 * PlaylistView - uses inline audio previews instead of AudioPlayer
 *
 * Props:
 * - playlistId (number)
 * - show (bool)
 * - onHide (fn)
 */
export default function PlaylistView({ playlistId, show, onHide }) {
  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);

  const [recentTracks, setRecentTracks] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const playingRef = useRef(null);

  // toast
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success', title: null, position: 'top-end', delay: 4000 });
  const showToast = ({ message = '', variant = 'success', title = null, position = 'top-end', delay = 4000 }) => {
    setToast({ show: true, message: String(message), variant, title, position, delay });
  };
  const closeToast = () => setToast(prev => ({ ...prev, show: false }));

  // Helper: resolve relative upload paths to absolute backend URLs to avoid dev proxy errors (ECONNREFUSED)
  function resolveToBackend(raw) {
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || window.location.origin;
    const rel = raw.startsWith('/') ? raw : `/${raw}`;
    return `${base.replace(/\/$/, '')}${rel}`;
  }

  // playback helpers (single playback)
  function handlePlay(audioEl) {
    if (playingRef.current && playingRef.current !== audioEl) {
      try { playingRef.current.pause(); } catch (e) { /* ignore */ }
    }
    playingRef.current = audioEl;
  }
  function handlePause(audioEl) {
    if (playingRef.current === audioEl) playingRef.current = null;
  }

  useEffect(() => {
    if (!playlistId || !show) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await axios.get(`/fan/playlists/${playlistId}`, { signal: controller.signal });
        if (cancelled) return;

        setPlaylist({ id: res.data.id, name: res.data.name, description: res.data.description });

        const t = Array.isArray(res.data.tracks) ? res.data.tracks.map(tr => {
          const rawArtwork = tr.artwork_url || tr.preview_artwork || tr.previewArtwork || null;
          const rawPreview = tr.preview_url || tr.previewUrl || null;
          return {
            id: tr.id || tr.track_id,
            title: tr.title || tr.track_title || tr.track_name || 'Unknown',
            preview_url: resolveToBackend(rawPreview),
            duration: tr.duration || null,
            artwork_url: rawArtwork ? resolveToBackend(rawArtwork) : null,
            artist_name: tr.artist?.display_name || (tr.artist_name || ''),
            track_id: tr.track_id || tr.id
          };
        }) : [];

        setTracks(t);
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.message === 'canceled') {
          // ignore abort
        } else {
          console.error('Failed to load playlist', err);
          setPlaylist(null);
          setTracks([]);
          showToast({ message: err?.response?.data?.error || 'Failed to load playlist', variant: 'danger' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      try { controller.abort(); } catch (e) { /* ignore */ }
    };
    // only re-run when playlistId or show changes
  }, [playlistId, show]);

  // recent tracks (for browse list)
  useEffect(() => {
    if (!show) return;
    const controller = new AbortController();
    let cancelled = false;
    setLoadingRecent(true);

    (async () => {
      try {
        const res = await axios.get('/public/tracks/recent', { params: { limit: 20 }, signal: controller.signal });
        if (cancelled) return;

        const items = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
        const mapped = items.map(t => ({
          id: t.id,
          title: t.title,
          preview_url: resolveToBackend(t.preview_url || t.previewUrl || null),
          artwork_url: resolveToBackend(t.artwork_url || t.artworkUrl || null),
          duration: t.duration,
          artist: t.artist || null
        }));
        setRecentTracks(mapped);
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.message === 'canceled') {
          // ignore
        } else {
          console.error('Failed to load recent tracks', err);
          setRecentTracks([]);
          showToast({ message: 'Failed to load recent tracks', variant: 'warning' });
        }
      } finally {
        if (!cancelled) setLoadingRecent(false);
      }
    })();

    return () => {
      cancelled = true;
      try { controller.abort(); } catch (e) { /* ignore */ }
    };
  }, [show]);

  async function removeTrack(trackId) {
    if (!window.confirm('Remove this track from playlist?')) return;
    try {
      await axios.delete(`/fan/playlists/${playlistId}/tracks/${trackId}`);
      const res = await axios.get(`/fan/playlists/${playlistId}`);
      const t = Array.isArray(res.data.tracks) ? res.data.tracks.map(tr => {
        const rawArtwork = tr.artwork_url || tr.preview_artwork || null;
        const rawPreview = tr.preview_url || tr.previewUrl || null;
        return {
          id: tr.id || tr.track_id,
          title: tr.title || 'Unknown',
          preview_url: resolveToBackend(rawPreview),
          duration: tr.duration || null,
          artwork_url: rawArtwork ? resolveToBackend(rawArtwork) : null,
          artist_name: tr.artist?.display_name || (tr.artist_name || '')
        };
      }) : [];
      setTracks(t);
      showToast({ message: 'Track removed', variant: 'success' });
    } catch (err) {
      console.error('remove failed', err);
      showToast({ message: err?.response?.data?.error || 'Could not remove track', variant: 'danger' });
    }
  }

  async function addTrack(trackId) {
    try {
      await axios.post(`/fan/playlists/${playlistId}/tracks`, { track_id: trackId });
      const res = await axios.get(`/fan/playlists/${playlistId}`);
      const t = Array.isArray(res.data.tracks)
        ? res.data.tracks.map(tr => {
            const rawArtwork = tr.artwork_url || tr.preview_artwork || null;
            const rawPreview = tr.preview_url || tr.previewUrl || null;
            return {
              id: tr.id || tr.track_id,
              title: tr.title || 'Unknown',
              preview_url: resolveToBackend(rawPreview),
              duration: tr.duration || null,
              artwork_url: rawArtwork ? resolveToBackend(rawArtwork) : null,
              artist_name: tr.artist?.display_name || ''
            };
          })
        : [];
      setTracks(t);
      showToast({ message: 'Track added', variant: 'success' });
    } catch (err) {
      console.error('Add track failed', err);
      showToast({ message: err?.response?.data?.error || 'Failed to add track', variant: 'danger' });
    }
  }

  async function reorder(newOrder) {
    try {
      await axios.put(`/fan/playlists/${playlistId}/reorder`, { track_order: newOrder });
      const res = await axios.get(`/fan/playlists/${playlistId}`);
      const t = Array.isArray(res.data.tracks) ? res.data.tracks.map(tr => {
        const rawArtwork = tr.artwork_url || tr.preview_artwork || null;
        const rawPreview = tr.preview_url || tr.previewUrl || null;
        return {
          id: tr.id || tr.track_id,
          title: tr.title || 'Unknown',
          preview_url: resolveToBackend(rawPreview),
          duration: tr.duration || null,
          artwork_url: rawArtwork ? resolveToBackend(rawArtwork) : null,
          artist_name: tr.artist?.display_name || (tr.artist_name || '')
        };
      }) : [];
      setTracks(t);
      showToast({ message: 'Playlist reordered', variant: 'success' });
    } catch (err) {
      console.error('reorder failed', err);
      showToast({ message: 'Could not reorder', variant: 'danger' });
    }
  }

  function moveUp(index) {
    if (index <= 0) return;
    const arr = [...tracks];
    const tmp = arr[index - 1];
    arr[index - 1] = arr[index];
    arr[index] = tmp;
    reorder(arr.map(x => x.id));
  }

  function moveDown(index) {
    if (index >= tracks.length - 1) return;
    const arr = [...tracks];
    const tmp = arr[index + 1];
    arr[index + 1] = arr[index];
    arr[index] = tmp;
    reorder(arr.map(x => x.id));
  }

  return (
    <Modal show={!!show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{playlist ? playlist.name : 'Playlist'}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {loading && (
          <div className="text-center py-3">
            <LoadingSpinner />
          </div>
        )}

        {!loading && playlist && (
          <>
            <div className="mb-3 text-muted">{playlist.description}</div>

            {/* Playlist tracks with inline previews */}
            <ListGroup className="mt-3">
              {tracks.map((t, i) => (
                <ListGroup.Item key={t.id ?? `${i}-${t.title}`}>
                  <Row className="align-items-center">
                    <Col xs={8} className="d-flex align-items-center">
                      <Image
                        src={t.artwork_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.title || 'Track')}&background=ddd&color=333`}
                        rounded
                        style={{ width: 48, height: 48, objectFit: 'cover', marginRight: 12 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div className="fw-bold text-truncate">{t.title}</div>
                        <div className="small text-muted">{t.artist_name || ''}</div>

                        {/* inline audio preview */}
                        {t.preview_url ? (
                          <div style={{ marginTop: 6 }}>
                            <audio
                              controls
                              preload="none"
                              controlsList="nodownload"
                              style={{ width: 280, maxWidth: '100%' }}
                              src={t.preview_url}
                              onPlay={(e) => handlePlay(e.target)}
                              onPause={(e) => handlePause(e.target)}
                              onEnded={() => handlePause(null)}
                            />
                          </div>
                        ) : (
                          <div className="small text-muted mt-1">No preview</div>
                        )}
                      </div>
                    </Col>

                    <Col xs={4} className="text-end">
                      <div className="small text-muted">{t.duration ? `${t.duration}s` : '-'}</div>

                      <div className="mt-2 d-flex justify-content-end gap-2">
                        <Button size="sm" variant="outline-secondary" onClick={() => moveUp(i)} disabled={i === 0}>↑</Button>
                        <Button size="sm" variant="outline-secondary" onClick={() => moveDown(i)} disabled={i === tracks.length - 1}>↓</Button>
                        <Button size="sm" variant="outline-danger" onClick={() => removeTrack(t.id)}>Remove</Button>
                      </div>
                    </Col>
                  </Row>
                </ListGroup.Item>
              ))}
            </ListGroup>

            {/* Browse Tracks */}
            <hr className="my-4" />
            <h6 className="mb-3">Browse Tracks</h6>

            {loadingRecent && (
              <div className="text-center py-2">
                <LoadingSpinner size="sm" />
              </div>
            )}

            <ListGroup>
              {recentTracks.map(t => (
                <ListGroup.Item key={t.id}>
                  <Row className="align-items-center">
                    <Col xs={8} className="d-flex align-items-center">
                      <Image
                        src={t.artwork_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.title)}`}
                        rounded
                        style={{ width: 42, height: 42, objectFit: 'cover', marginRight: 10 }}
                      />
                      <div>
                        <div className="fw-bold">{t.title}</div>
                        <div className="small text-muted">{t.artist?.display_name || ''}</div>

                        {t.preview_url ? (
                          <div style={{ marginTop: 6 }}>
                            <audio
                              controls
                              preload="none"
                              controlsList="nodownload"
                              style={{ width: 240, maxWidth: '100%' }}
                              src={t.preview_url}
                              onPlay={(e) => handlePlay(e.target)}
                              onPause={(e) => handlePause(e.target)}
                              onEnded={() => handlePause(null)}
                            />
                          </div>
                        ) : null}
                      </div>
                    </Col>

                    <Col xs={4} className="text-end">
                      <Button size="sm" onClick={() => addTrack(t.id)}>Add</Button>
                    </Col>
                  </Row>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </>
        )}

        {!loading && !playlist && <div className="text-muted">Playlist not found.</div>}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Close</Button>
      </Modal.Footer>

      {/* Toast for user feedback */}
      <ToastMessage
        show={toast.show}
        onClose={closeToast}
        message={toast.message}
        variant={toast.variant}
        title={toast.title}
        position={toast.position}
        delay={toast.delay}
      />
    </Modal>
  );
}