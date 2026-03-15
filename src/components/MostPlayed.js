// src/components/MostPlayed.js
import React, { useEffect, useState, useRef, useContext } from 'react';
import axios from '../api/axiosConfig';
import { ListGroup, Spinner, Image, Button } from 'react-bootstrap';
import { FaDownload, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';

/** sanitize file name for client (small helper) */
function sanitizeFilename(s) {
  if (!s) return '';
  return String(s)
    .replace(/["'<>:\\/|?*]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 190);
}

/** download helper (forces filename by creating File object) */
async function downloadTrackById(trackId, setToast) {
  try {
    const res = await axios.get(`/download/${trackId}`, { responseType: 'blob' });
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
      const mime = (res.data && res.data.type) || '';
      let ext = '.mp3';
      if (mime.includes('mpeg')) ext = '.mp3';
      else if (mime.includes('audio/mp4') || mime.includes('m4a')) ext = '.m4a';
      else if (mime.includes('ogg')) ext = '.ogg';
      else if (mime.includes('wav')) ext = '.wav';
      else if (mime.includes('flac')) ext = '.flac';
      filename = `${sanitizeFilename(title || `track-${trackId}`)}${ext}`;
    }
    filename = filename && sanitizeFilename(filename) ? filename : `track-${trackId}.mp3`;
    const blob = res.data;
    if ((blob.type || '').includes('application/json')) {
      const txt = await blob.text();
      throw new Error(txt);
    }
    let fileToSave;
    try {
      fileToSave = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    } catch (e) {
      fileToSave = blob;
    }
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(fileToSave, filename);
    } else {
      const url = window.URL.createObjectURL(fileToSave);
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
    if (typeof setToast === 'function') setToast({ show: true, message: `Download started: ${filename}`, variant: 'success' });
  } catch (err) {
    if (typeof setToast === 'function') {
      const message = (err && err.message) ? err.message : 'Download failed';
      setToast({ show: true, message: `Download failed: ${message}`, variant: 'danger' });
    }
  }
}

export default function MostPlayed({ limit = 6, onSelect = () => {} }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const playingRef = useRef(null);
  const mountedRef = useRef(true);
  const { user, artist: myArtist } = useContext(AuthContext);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    axios.get('/public/tracks/most-played', { params: { limit, page } })
      .then(res => {
        if (!mountedRef.current) return;
        const data = res.data || {};
        setItems(data.items || []);
        setTotal(data.total || 0);
      })
      .catch(() => { if (mountedRef.current) setItems([]); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [limit, page]);

  function handlePlay(audioEl) {
    if (!audioEl) return;
    if (playingRef.current && playingRef.current !== audioEl) {
      try { playingRef.current.pause(); } catch {}
    }
    playingRef.current = audioEl;
  }

  function handlePause(audioEl) {
    if (playingRef.current === audioEl) playingRef.current = null;
  }

  async function recordListenIfNeeded(track) {
    if (!user || !user.id) return;
    if (myArtist && track.artist && Number(myArtist.id) === Number(track.artist.id)) return;
    try {
      await axios.post('/fan/listens', { track_id: track.id, artist_id: track.artist?.id || null });
    } catch (e) { /* ignore */ }
  }

  const totalPages = Math.max(1, Math.ceil((total || 0) / limit));

  if (loading) return <div className="py-2 text-center"><Spinner animation="border" size="sm" /></div>;
  if (!items.length) return <div className="small text-muted">No data yet.</div>;

  return (
    <div>
      <ListGroup size="sm" variant="flush">
        {items.map(t => {
          const artistName = t.artist?.display_name || '';
          const artistId = t.artist?.id || null;
          const artwork = t.artwork_url || t.preview_artwork || null;
          const preview = t.preview_url || t.previewUrl || null;
          const plays = Number(t.plays || 0);

          return (
            <ListGroup.Item key={t.id} className="py-2">
              <div className="d-flex align-items-start">
                {artwork ? (
                  <Image src={artwork} rounded style={{ width: 56, height: 56, objectFit: 'cover', marginRight: 12 }} />
                ) : (
                  <div style={{ width: 56, height: 56, marginRight: 12, background: '#eee', borderRadius: 6 }} />
                )}

                <div className="flex-grow-1">
                  <div className="d-flex align-items-start justify-content-between">
                    <div style={{ minWidth: 0 }}>
                      <div
                        className="small fw-bold text-truncate"
                        style={{ maxWidth: '100%', cursor: artistId ? 'pointer' : 'default' }}
                        onClick={() => artistId && onSelect(artistId)}
                        title={t.title}
                      >
                        {t.title}
                      </div>
                      <div className="small text-muted" style={{ marginTop: 4 }}>
                        {artistName ? `${artistName} ` : ''}{t.genre ? `• ${t.genre}` : ''}{t.release_date ? ` • ${t.release_date}` : ''}
                      </div>
                    </div>

                    <div className="ms-2 text-muted small" style={{ whiteSpace: 'nowrap' }}>
                      {plays}
                    </div>
                  </div>

                  <div className="d-flex align-items-center mt-2">
                    {preview ? (
                      <audio
                        controls
                        controlsList="nodownload"
                        preload="none"
                        style={{ width: 120, height: 30 }}
                        src={preview}
                        onPlay={e => { handlePlay(e.target); recordListenIfNeeded(t); }}
                        onPause={e => handlePause(e.target)}
                        onEnded={() => { if (playingRef.current) playingRef.current = null; }}
                        aria-label={`Preview for ${t.title}`}
                      />
                    ) : (
                      <div className="small text-muted me-2">No preview</div>
                    )}

                    {preview ? (
                      <Button
                        size="sm"
                        variant="link"
                        onClick={() => downloadTrackById(t.id)}
                        download
                        title="Download track"
                        className="ms-3 p-0"
                        aria-label={`Download ${t.title}`}
                      >
                        <FaDownload />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </ListGroup.Item>
          );
        })}
      </ListGroup>

      <div className="d-flex justify-content-between align-items-center mt-2">
        <div className="small text-muted">Page {page} / {totalPages}</div>
        <div>
          <Button variant="link" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><FaChevronLeft /></Button>
          <Button variant="link" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><FaChevronRight /></Button>
        </div>
      </div>
    </div>
  );
}