// src/components/RecentlyUploaded.js
import React, { useRef } from 'react';
import { ListGroup, Image, Button } from 'react-bootstrap';
import { FaDownload, FaPlus } from 'react-icons/fa';
import useTracks from '../hooks/useTracks';
import LoadingSpinner from './LoadingSpinner';
import ToastMessage from './ToastMessage';
import axios from '../api/axiosConfig';

/** resolve backend base for relative /uploads paths */
function resolveToBackend(raw) {
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  // prefer axios baseURL if configured
  const base = (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const rel = raw.startsWith('/') ? raw : `/${raw}`;
  return `${base.replace(/\/$/, '')}${rel}`;
}

/** try find token in localStorage (same heuristic used elsewhere) */
function getStoredToken() {
  const keys = ['token', 'accessToken', 'authToken', 'auth', 'app_token'];
  for (let k of keys) {
    const v = localStorage.getItem(k);
    if (!v) continue;
    if (v.startsWith('eyJ') || v.split('.').length === 3) return v;
    if (v.startsWith('Bearer ')) return v.substring(7);
    try {
      const parsed = JSON.parse(v);
      if (parsed) {
        if (parsed.token) return parsed.token;
        if (parsed.accessToken) return parsed.accessToken;
        if (parsed.authToken) return parsed.authToken;
        const firstStr = Object.values(parsed).find(x => typeof x === 'string' && (x.startsWith('eyJ') || x.split?.('.').length === 3));
        if (firstStr) return firstStr;
      }
    } catch (e) { /* ignore */ }
    return v;
  }
  return null;
}

/** download via axios (preserves interceptors) */
async function downloadTrackById(trackId, setToast) {
  try {
    const token = getStoredToken();
    const headers = {};
    if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

    const res = await axios.get(`/tracks/${trackId}/download`, { responseType: 'blob', headers });
    const disposition = res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition']);
    let filename = 'track.mp3';
    if (disposition) {
      const m = disposition.match(/filename="(.+)"/);
      if (m && m[1]) filename = m[1];
    }
    const blob = res.data;
    if ((blob.type || '').includes('application/json')) {
      const txt = await blob.text();
      let parsed;
      try { parsed = JSON.parse(txt); } catch (e) { parsed = txt; }
      setToast({ show: true, message: `Download failed: ${JSON.stringify(parsed)}`, variant: 'danger' });
      return;
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    setToast({ show: true, message: 'Download started', variant: 'success' });
  } catch (err) {
    let message = err.message;
    try {
      if (err.response && err.response.data) {
        const data = err.response.data;
        if (data instanceof Blob) {
          const txt = await data.text();
          try { const parsed = JSON.parse(txt); message = parsed.error || JSON.stringify(parsed); } catch (e) { message = txt; }
        } else if (typeof data === 'object') { message = data.error || JSON.stringify(data); } else { message = String(data); }
      }
    } catch (e2) { /* ignore */ }
    setToast({ show: true, message: `Download failed: ${message}`, variant: 'danger' });
  }
}

export default function RecentlyUploaded({ limit = 12, onRecordPlay = null }) {
  const { tracks, loading, error } = useTracks('/public/tracks/recent', { limit });
  const playingRef = useRef(null);

  const [toast, setToast] = React.useState({ show: false, message: '', variant: 'success', title: null, position: 'top-end', delay: 4000 });
  const showToast = (opts) => setToast(prev => ({ ...prev, ...opts, show: true }));
  const closeToast = () => setToast(prev => ({ ...prev, show: false }));

  function handlePlay(audioEl, track) {
    if (playingRef.current && playingRef.current !== audioEl) {
      try { playingRef.current.pause(); } catch (e) { /* ignore */ }
    }
    playingRef.current = audioEl;
    if (typeof onRecordPlay === 'function') {
      try { onRecordPlay(track); } catch (e) { /* ignore */ }
    }
  }
  function handlePause(audioEl) { if (playingRef.current === audioEl) playingRef.current = null; }

  async function handleAddToPlaylist(trackId) {
    const pid = window.prompt('Enter playlist id to add to:');
    if (!pid) return;
    try {
      await axios.post(`/fan/playlists/${pid}/tracks`, { track_id: trackId });
      showToast({ message: 'Added to playlist', variant: 'success' });
    } catch (err) {
      console.error('Add to playlist failed', err);
      showToast({ message: err?.response?.data?.error || 'Failed to add to playlist', variant: 'danger' });
    }
  }

  if (loading) return <div className="text-center py-3"><LoadingSpinner /></div>;
  if (error) return <div className="text-muted">Error loading recent uploads: {error}</div>;
  if (!tracks || tracks.length === 0) return <div className="text-muted">No recent uploads yet.</div>;

  return (
    <div>
      <h6 className="mb-3">New Releases</h6>
      <ListGroup className="mt-0">
        {tracks.slice(0, limit).map((t, i) => {
          const artwork = t.artwork_url ? resolveToBackend(t.artwork_url) : `https://ui-avatars.com/api/?name=${encodeURIComponent(t.title || 'Track')}&background=ddd&color=333`;
          return (
            <ListGroup.Item key={`${t.id}-${i}`}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center" style={{ minWidth: 0 }}>
                  <Image src={artwork} rounded style={{ width: 48, height: 48, objectFit: 'cover', marginRight: 12 }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="fw-bold text-truncate">{t.title}</div>
                    <div className="small text-muted">{t.artist?.display_name || ''} {t.genre ? `• ${t.genre}` : ''}</div>
                    {t.preview_url ? (
                      <div style={{ marginTop: 6 }}>
                        <audio controls preload="none" controlsList="nodownload" style={{ width: 320, maxWidth: '100%' }}
                          src={/^https?:\/\//i.test(t.preview_url) ? t.preview_url : resolveToBackend(t.preview_url)}
                          onPlay={(e) => handlePlay(e.target, t)}
                          onPause={(e) => handlePause(e.target)}
                          onEnded={() => handlePause(null)}
                        />
                      </div>
                    ) : (
                      <div className="small text-muted mt-1">No preview</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <div className="small text-muted">{t.duration ? `${t.duration}s` : '-'}</div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button size="sm" variant="outline-secondary" onClick={() => downloadTrackById(t.id, setToast)} title="Download">
                      <FaDownload />
                    </Button>

                    <Button size="sm" variant="outline-primary" onClick={() => handleAddToPlaylist(t.id)} title="Add to playlist">
                      <FaPlus />
                    </Button>
                  </div>
                </div>
              </div>
            </ListGroup.Item>
          );
        })}
      </ListGroup>

      <ToastMessage show={toast.show} onClose={closeToast} message={toast.message} variant={toast.variant} title={toast.title} position={toast.position} delay={toast.delay} />
    </div>
  );
}