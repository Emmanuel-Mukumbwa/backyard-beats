// src/components/RecentlyUploaded.js
import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { ListGroup, Image, Button, Spinner } from 'react-bootstrap';
import { FaDownload, FaPlus } from 'react-icons/fa';
import useTracks from '../hooks/useTracks';
import LoadingSpinner from './LoadingSpinner';
import ToastMessage from './ToastMessage';
import axios from '../api/axiosConfig';
import AddToPlaylistModal from './AddToPlaylistModal';

/** resolve backend base for relative /uploads paths */
function resolveToBackend(raw) {
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const rel = raw.startsWith('/') ? raw : `/${raw}`;
  return `${base.replace(/\/$/, '')}${rel}`;
}

/** try find token in localStorage (same heuristic used elsewhere) */
function getStoredToken() {
  const keys = ['token', 'accessToken', 'authToken', 'auth', 'app_token', 'bb_token'];
  for (let k of keys) {
    const v = localStorage.getItem(k);
    if (!v) continue;
    if (typeof v === 'string' && (v.startsWith('eyJ') || v.split('.').length === 3)) return v;
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

/** sanitize file name for client */
function sanitizeFilename(s) {
  if (!s) return '';
  return String(s)
    .replace(/["'<>:\\/|?*]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 190);
}

/** improved download that forces filename by creating a File object */
async function downloadTrackById(trackId, setToast, setDownloadingId) {
  try {
    const token = getStoredToken();
    const headers = {};
    if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

    const res = await axios.get(`/download/${trackId}`, { responseType: 'blob', headers });

    const disposition = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
    let filename = null;

    if (disposition) {
      const fnStar = disposition.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i);
      if (fnStar && fnStar[1]) {
        try { filename = decodeURIComponent(fnStar[1].replace(/['"]/g, '')); } catch (e) { filename = fnStar[1].replace(/['"]/g, ''); }
      }
      if (!filename) {
        const quoted = disposition.match(/filename\s*=\s*"([^"]+)"/i);
        if (quoted && quoted[1]) filename = quoted[1];
      }
      if (!filename) {
        const unquoted = disposition.match(/filename\s*=\s*([^;]+)/i);
        if (unquoted && unquoted[1]) filename = unquoted[1].replace(/['"]/g, '').trim();
      }
    }

    if (!filename) {
      const title = (res.headers && (res.headers['x-track-title'] || res.headers['X-Track-Title'])) || '';
      const artist = (res.headers && (res.headers['x-track-artist'] || res.headers['X-Track-Artist'])) || '';
      const mime = (res.data && res.data.type) || '';
      let ext = '.mp3';
      if (mime.includes('mpeg')) ext = '.mp3';
      else if (mime.includes('audio/mp4') || mime.includes('m4a')) ext = '.m4a';
      else if (mime.includes('ogg')) ext = '.ogg';
      else if (mime.includes('wav')) ext = '.wav';
      else if (mime.includes('flac')) ext = '.flac';
      const base = sanitizeFilename(title || artist || `track-${trackId}`);
      filename = `${base}${ext}`;
    }

    filename = filename && sanitizeFilename(filename) ? filename : `track-${trackId}.mp3`;

    const blob = res.data;
    if ((blob.type || '').includes('application/json')) {
      const txt = await blob.text();
      let parsed;
      try { parsed = JSON.parse(txt); } catch (e) { parsed = txt; }
      setToast({ show: true, message: `Download failed: ${JSON.stringify(parsed)}`, variant: 'danger' });
      if (setDownloadingId) setDownloadingId(null);
      return;
    }

    let fileToSave;
    try {
      fileToSave = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    } catch (e) {
      fileToSave = blob;
    }

    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(fileToSave, filename);
      setToast({ show: true, message: `Download started: ${filename}`, variant: 'success' });
      if (setDownloadingId) setDownloadingId(null);
      return;
    }

    const url = window.URL.createObjectURL(fileToSave);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    setToast({ show: true, message: `Download started: ${filename}`, variant: 'success' });
    if (setDownloadingId) setDownloadingId(null);
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
    if (setDownloadingId) setDownloadingId(null);
  }
}

export default function RecentlyUploaded({ limit = 12, onRecordPlay = null }) {
  const { tracks, loading, error } = useTracks('/public/tracks/recent', { limit });
  const playingRef = useRef(null);

  const [toast, setToast] = useState({ show: false, message: '', variant: 'success', title: null, position: 'top-end', delay: 4000 });
  const [downloadingId, setDownloadingId] = useState(null);
  const showToast = useCallback((opts) => setToast(prev => ({ ...prev, ...opts, show: true })), []);
  const closeToast = useCallback(() => setToast(prev => ({ ...prev, show: false })), []);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTrackToAdd, setSelectedTrackToAdd] = useState(null);

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

  function openAddModal(trackId) { setSelectedTrackToAdd(trackId); setShowAddModal(true); }

  async function handleAddComplete(pid) {
    showToast({ message: 'Added to playlist', variant: 'success' });
    setShowAddModal(false);
  }

  const handleDownload = useCallback((trackId) => {
    setDownloadingId(trackId);
    showToast({ message: 'Preparing your download...', variant: 'info' });
    downloadTrackById(trackId, setToast, setDownloadingId);
  }, [showToast]);

  // --- stable client-side pagination: 4 tracks per page ---
  const perPage = 4;
  const [page, setPage] = useState(1);

  // clamp page if tracks change
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((Array.isArray(tracks) ? tracks.length : 0) / perPage));
    setPage(p => Math.min(p, totalPages));
  }, [tracks, perPage]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((Array.isArray(tracks) ? tracks.length : 0) / perPage)), [tracks, perPage]);

  const paginated = useMemo(() => {
    if (!Array.isArray(tracks)) return [];
    const start = (page - 1) * perPage;
    return tracks.slice(start, start + perPage);
  }, [tracks, page, perPage]);

  const goPrev = useCallback(() => setPage(p => Math.max(1, p - 1)), []);
  const goNext = useCallback(() => setPage(p => Math.min(totalPages, p + 1)), [totalPages]);

  if (loading) return <div className="text-center py-3"><LoadingSpinner /></div>;
  if (error) return <div className="text-muted">Error loading recent uploads: {error}</div>;
  if (!tracks || tracks.length === 0) return <div className="text-muted">No recent uploads yet.</div>;

  return (
    <div>
      <h6 className="mb-3">New Releases</h6>
      <ListGroup className="mt-0">
        {paginated.map((t, i) => {
          const artwork = t.artwork_url ? resolveToBackend(t.artwork_url) : `https://ui-avatars.com/api/?name=${encodeURIComponent(t.title || 'Track')}&background=ddd&color=333`;
          const isDownloading = downloadingId === t.id;
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
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => handleDownload(t.id)}
                      disabled={isDownloading}
                      title="Download"
                    >
                      {isDownloading ? <Spinner animation="border" size="sm" /> : <FaDownload />}
                    </Button>

                    <Button size="sm" variant="outline-primary" onClick={() => openAddModal(t.id)} title="Add to playlist">
                      <FaPlus />
                    </Button>
                  </div>
                </div>
              </div>
            </ListGroup.Item>
          );
        })}
      </ListGroup>

      {/* Pagination controls (stable, 4 per page) */}
      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="small text-muted">
          Showing {(tracks.length === 0) ? 0 : ((page - 1) * perPage + 1)} - {Math.min(page * perPage, tracks.length)} of {tracks.length}
        </div>

        <div>
          <Button size="sm" variant="outline-secondary" onClick={goPrev} disabled={page <= 1} className="me-2">Prev</Button>
          <Button size="sm" variant="light" disabled className="me-2">Page {page} / {totalPages}</Button>
          <Button size="sm" variant="outline-secondary" onClick={goNext} disabled={page >= totalPages}>Next</Button>
        </div>
      </div>

      <AddToPlaylistModal show={showAddModal} onHide={() => setShowAddModal(false)} trackId={selectedTrackToAdd} onAdded={handleAddComplete} />

      <ToastMessage show={toast.show} onClose={closeToast} message={toast.message} variant={toast.variant} title={toast.title} position={toast.position} delay={toast.delay} />
    </div>
  );
}