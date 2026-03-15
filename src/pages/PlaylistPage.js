import React, { useEffect, useState, useRef, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Container, Row, Col, ListGroup, Image, Button, Spinner } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import LoadingSpinner from '../components/LoadingSpinner';
import ToastMessage from '../components/ToastMessage';
import { AuthContext } from '../context/AuthContext';

/** resolve backend base for relative /uploads paths */
function resolveToBackend(raw) {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const rel = raw.startsWith('/') ? raw : `/${raw}`;
  return `${base.replace(/\/$/, '')}${rel}`;
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

/** download helper (forces filename by creating a File object) */
async function downloadTrackById(trackId, setToast, setDownloadingId) {
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
      let parsed;
      try { parsed = JSON.parse(txt); } catch (e) { parsed = txt; }
      if (setToast) setToast({ show: true, message: `Download failed: ${JSON.stringify(parsed)}`, variant: 'danger' });
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

    if (setToast) setToast({ show: true, message: `Download started: ${filename}`, variant: 'success' });
    if (setDownloadingId) setDownloadingId(null);
  } catch (err) {
    let message = err.message || 'Download failed';
    try {
      if (err.response && err.response.data) {
        const data = err.response.data;
        if (data instanceof Blob) {
          const txt = await data.text();
          try { const parsed = JSON.parse(txt); message = parsed.error || JSON.stringify(parsed); } catch (_) { message = txt; }
        } else if (typeof data === 'object') { message = data.error || JSON.stringify(data); } else { message = String(data); }
      }
    } catch (_) { /* ignore */ }
    if (setToast) setToast({ show: true, message: `Download failed: ${message}`, variant: 'danger' });
    if (setDownloadingId) setDownloadingId(null);
  }
}

export default function PlaylistPage() {
  const { id } = useParams();
  
  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const playingRef = useRef(null);
  const { user, artist: myArtist } = useContext(AuthContext);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/fan/playlists/${id}`);
        if (cancelled) return;

        const p = res.data;
        setPlaylist(p);

        const mapped = Array.isArray(p.tracks)
          ? p.tracks.map(t => ({
              id: t.id || t.track_id,
              title: t.title,
              preview_url: resolveToBackend(t.preview_url || t.previewUrl || ''),
              duration: t.duration,
              artwork_url: resolveToBackend(t.artwork_url || t.preview_artwork || t.artworkUrl || ''),
              artist: t.artist
            }))
          : [];

        setTracks(mapped);
      } catch (err) {
        console.error('Failed to load playlist', err);
        setPlaylist(null);
        setTracks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      try { if (playingRef.current) playingRef.current.pause(); } catch (e) { /* ignore */ }
    };
  }, [id]);

  function handlePlay(audioEl, track) {
    if (playingRef.current && playingRef.current !== audioEl) {
      try { playingRef.current.pause(); } catch (e) { /* ignore */ }
    }
    playingRef.current = audioEl;

    if (user && user.id && track && track.id) {
      if (myArtist && track.artist && Number(myArtist.id) === Number(track.artist.id)) {
        // skip recording owner plays
      } else {
        axios.post('/fan/listens', { track_id: track.id, artist_id: track.artist?.id || null }).catch(() => {});
      }
    }
  }

  function handlePause(audioEl) {
    if (playingRef.current === audioEl) playingRef.current = null;
  }

  const handleDownload = (trackId) => {
    setDownloadingId(trackId);
    setToast({ show: true, message: 'Preparing your download...', variant: 'info' });
    downloadTrackById(trackId, setToast, setDownloadingId);
  };

  if (loading) return <div className="text-center py-5"><LoadingSpinner /></div>;
  if (!playlist) return <div className="text-muted">Playlist not found.</div>;

  return (
    <>
      <ToastMessage
        show={toast.show}
        onClose={() => setToast(s => ({ ...s, show: false }))}
        message={toast.message}
        variant={toast.variant}
        delay={3500}
        position="top-end"
      />
      <Container className="py-4">
        <div className="mb-4">
          <Link to={{ pathname: '/fan/dashboard', search: '?tab=playlists' }} state={{ tab: 'playlists' }}>
            ← Back to playlists
          </Link>
        </div>

        <div className="d-flex align-items-start justify-content-between mb-3">
          <div>
            <h2 className="mb-1">{playlist.name}</h2>
            <div className="text-muted">{playlist.description}</div>
          </div>

          <div className="text-end">
            <div className="d-inline-block p-2 border rounded text-muted small" style={{ minWidth: 88 }}>
              <div style={{ fontWeight: 600, fontSize: 18 }}>{tracks.length}</div>
              <div style={{ fontSize: 12 }}>{tracks.length === 1 ? 'track' : 'tracks'}</div>
            </div>
          </div>
        </div>

        <Row>
          <Col lg={8}>
            <ListGroup>
              {tracks.map(track => {
                const isDownloading = downloadingId === track.id;
                return (
                  <ListGroup.Item key={track.id}>
                    <Row className="align-items-center">
                      <Col md={7} className="d-flex align-items-center">
                        <Image
                          src={track.artwork_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(track.title || 'Track')}&background=ddd&color=333`}
                          rounded
                          style={{ width: 60, height: 60, objectFit: 'cover', marginRight: 15 }}
                        />

                        <div style={{ minWidth: 0 }}>
                          <div className="fw-bold text-truncate" style={{ maxWidth: 420 }}>{track.title}</div>
                          <div className="text-muted small">{track.artist?.display_name || ''}</div>
                        </div>
                      </Col>

                      <Col md={5} className="text-end">
                        {track.preview_url ? (
                          <audio
                            controls
                            controlsList="nodownload"
                            preload="none"
                            style={{ width: '100%', maxWidth: 360 }}
                            src={track.preview_url}
                            onPlay={(e) => handlePlay(e.target, track)}
                            onPause={(e) => handlePause(e.target)}
                          />
                        ) : (
                          <div className="small text-muted">No preview</div>
                        )}

                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="link"
                            onClick={() => handleDownload(track.id)}
                            disabled={isDownloading}
                          >
                            {isDownloading ? <Spinner animation="border" size="sm" /> : 'Download'}
                          </Button>
                        </div>
                      </Col>
                    </Row>
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          </Col>

          <Col lg={4}>
            <div className="p-3 border rounded">
              <h6>Playlist Info</h6>
              <p className="small text-muted mb-2">
                <strong>{tracks.length}</strong> {tracks.length === 1 ? 'track' : 'tracks'}
              </p>

              <Button variant="outline-secondary" size="sm" onClick={async () => {
                setLoading(true);
                try {
                  const res = await axios.get(`/fan/playlists/${id}`);
                  const p = res.data;
                  setPlaylist(p);
                  const mapped = Array.isArray(p.tracks)
                    ? p.tracks.map(t => ({
                        id: t.id || t.track_id,
                        title: t.title,
                        preview_url: resolveToBackend(t.preview_url || t.previewUrl || ''),
                        duration: t.duration,
                        artwork_url: resolveToBackend(t.artwork_url || t.preview_artwork || t.artworkUrl || ''),
                        artist: t.artist
                      }))
                    : [];
                  setTracks(mapped);
                } catch (err) {
                  console.error('Refresh failed', err);
                } finally {
                  setLoading(false);
                }
              }}>
                Refresh
              </Button>
            </div>
          </Col>
        </Row>
      </Container>
    </>
  );
}