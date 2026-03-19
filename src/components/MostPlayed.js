import React, { useEffect, useState, useRef, useContext, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { ListGroup, Spinner, Image, Button } from 'react-bootstrap';
import { FaDownload, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import ToastMessage from './ToastMessage';
import { useNavigate } from 'react-router-dom';

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
async function downloadTrackById(trackId, setToast, setDownloadingId) {
  try {
    const res = await axios.get(`/download/${trackId}`, { responseType: 'blob' });
    const disposition = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
    let filename = null;

    if (disposition) {
      const fnStar = disposition.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i);
      if (fnStar && fnStar[1]) {
        try {
          filename = decodeURIComponent(fnStar[1].replace(/['"]/g, ''));
        } catch (e) {
          filename = fnStar[1].replace(/['"]/g, '');
        }
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

    if (typeof setToast === 'function') {
      setToast({
        show: true,
        message: `Download started: ${filename}`,
        variant: 'success',
        autohide: true,
        delay: 3500
      });
    }

    if (setDownloadingId) setDownloadingId(null);
  } catch (err) {
    if (typeof setToast === 'function') {
      const message = (err && err.message) ? err.message : 'Download failed';
      setToast({
        show: true,
        message: `Download failed: ${message}`,
        variant: 'danger',
        autohide: false
      });
    }
    if (setDownloadingId) setDownloadingId(null);
  }
}

export default function MostPlayed({ limit = 4, onSelect = () => {} }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const playingRef = useRef(null);
  const mountedRef = useRef(true);
  const initialLoadRef = useRef(false);

  const { user, artist: myArtist } = useContext(AuthContext);
  const navigate = useNavigate();

  const [toast, setToast] = useState({
    show: false,
    message: '',
    variant: 'info',
    autohide: true,
    delay: 3500
  });

  const [downloadingId, setDownloadingId] = useState(null);

  // refs to avoid stale closures
  const pageRef = useRef(page);
  const limitRef = useRef(limit);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    limitRef.current = limit;
  }, [limit]);

  const fetchMost = useCallback(async ({ p = pageRef.current, lim = limitRef.current } = {}) => {
    mountedRef.current = true;
    setLoading(true);

    try {
      const res = await axios.get('/public/tracks/most-played', {
        params: { limit: lim, page: p }
      });

      if (!mountedRef.current) return;

      const data = res.data || {};
      setItems(data.items || []);
      setTotal(data.total || 0);

      const serverPage = (typeof data.page === 'number') ? data.page : p;
      setPage(serverPage);
      pageRef.current = serverPage;
    } catch (err) {
      if (mountedRef.current) setItems([]);
      console.error('Failed to load most-played', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchMost({ p: 1, lim: limitRef.current });
    initialLoadRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, [fetchMost]);

  useEffect(() => {
    if (!initialLoadRef.current) return;
    fetchMost({ p: page, lim: limitRef.current });
  }, [page, fetchMost]);

  function handlePlay(audioEl) {
    if (!audioEl) return;
    if (playingRef.current && playingRef.current !== audioEl) {
      try {
        playingRef.current.pause();
      } catch {}
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
      await axios.post('/fan/listens', {
        track_id: track.id,
        artist_id: track.artist?.id || null
      });
    } catch (e) {
      // ignore
    }
  }

  const handleDownload = (trackId) => {
    if (!user || !user.id) {
      setToast({
        show: true,
        message: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>Please log in to download tracks.</div>
            <div>
              <Button
                size="sm"
                variant="light"
                onClick={() => {
                  setToast(t => ({ ...t, show: false }));
                  navigate('/login');
                }}
              >
                Login
              </Button>
            </div>
          </div>
        ),
        variant: 'info',
        autohide: false,
        delay: 10000
      });
      return;
    }

    setDownloadingId(trackId);
    setToast({
      show: true,
      message: 'Preparing your download...',
      variant: 'info',
      autohide: true,
      delay: 3500
    });

    downloadTrackById(trackId, setToast, setDownloadingId);
  };

  const totalPages = Math.max(1, Math.ceil((total || 0) / Math.max(1, limit)));

  if (loading) {
    return (
      <div className="py-2 text-center">
        <Spinner animation="border" size="sm" />
      </div>
    );
  }

  if (!items.length) {
    return <div className="small text-muted">No data yet.</div>;
  }

  return (
    <>
      <ToastMessage
        show={!!toast.show}
        onClose={() => setToast(s => ({ ...s, show: false }))}
        message={toast.message}
        variant={toast.variant}
        delay={toast.delay || 3500}
        position="top-end"
        autohide={typeof toast.autohide === 'boolean' ? toast.autohide : true}
      />

      <style>{`
        .most-played-item {
          overflow: hidden;
        }

        .most-played-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-width: 0;
        }

        .most-played-artwork {
          flex: 0 0 56px;
          width: 56px;
          height: 56px;
          border-radius: 6px;
          overflow: hidden;
          background: #eee;
          min-width: 56px;
        }

        .most-played-content {
          flex: 1 1 auto;
          min-width: 0;
        }

        .track-title-viewport {
          overflow: hidden;
          min-width: 0;
          width: 100%;
        }

        .track-title-static {
          font-size: 0.95rem;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: block;
        }

        .track-title-marquee {
          display: inline-flex;
          align-items: center;
          gap: 2rem;
          white-space: nowrap;
          will-change: transform;
          min-width: 0;
          animation: none;
        }

        .track-title-marquee.is-long {
          animation: track-marquee 10s linear infinite;
          padding-right: 2rem;
        }

        .track-title-marquee span {
          font-size: 0.95rem;
          font-weight: 700;
        }

        @keyframes track-marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .most-played-meta {
          flex: 0 0 auto;
          white-space: nowrap;
          text-align: right;
          margin-left: 8px;
        }

        .most-played-sub {
          font-size: 0.8rem;
          color: #6c757d;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
          margin-top: 3px;
        }

        .most-played-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 8px;
          min-width: 0;
          flex-wrap: wrap;
        }

        .most-played-audio {
          width: 120px;
          height: 30px;
          max-width: 100%;
        }

        @media (max-width: 575.98px) {
          .most-played-row {
            gap: 10px;
          }

          .most-played-artwork {
            flex: 0 0 48px;
            width: 48px;
            height: 48px;
            min-width: 48px;
          }

          .track-title-static,
          .track-title-marquee span {
            font-size: 0.9rem;
          }

          .most-played-sub {
            font-size: 0.75rem;
          }

          .most-played-audio {
            width: 100%;
            max-width: 170px;
          }

          .most-played-meta {
            margin-left: 4px;
          }
        }
      `}</style>

      <div>
        <ListGroup size="sm" variant="flush">
          {items.map(t => {
            const artistName = t.artist?.display_name || '';
            const artistId = t.artist?.id || null;
            const artwork = t.artwork_url || t.preview_artwork || null;
            const preview = t.preview_url || t.previewUrl || null;
            const plays = Number(t.plays || 0);
            const isDownloading = downloadingId === t.id;

            const title = String(t.title || '');
            const isLongTitle = title.length > 28;

            return (
              <ListGroup.Item key={t.id} className="py-2 most-played-item">
                <div className="most-played-row">
                  {artwork ? (
                    <div className="most-played-artwork">
                      <Image
                        src={artwork}
                        alt={title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/defaults/track-art.png';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="most-played-artwork" />
                  )}

                  <div className="most-played-content">
                    <div className="d-flex align-items-start justify-content-between" style={{ minWidth: 0 }}>
                      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                        <div className="track-title-viewport" title={title}>
                          {isLongTitle ? (
                            <div className="track-title-marquee is-long">
                              <span onClick={() => artistId && onSelect(artistId)} style={{ cursor: artistId ? 'pointer' : 'default' }}>
                                {title}
                              </span>
                              <span aria-hidden="true" onClick={() => artistId && onSelect(artistId)} style={{ cursor: artistId ? 'pointer' : 'default' }}>
                                {title}
                              </span>
                            </div>
                          ) : (
                            <span
                              className="track-title-static"
                              onClick={() => artistId && onSelect(artistId)}
                              style={{ cursor: artistId ? 'pointer' : 'default' }}
                            >
                              {title}
                            </span>
                          )}
                        </div>

                        <div className="most-played-sub" title={artistName}>
                          {artistName ? `${artistName} ` : ''}
                          {t.genre ? `• ${t.genre}` : ''}
                          {t.release_date ? ` • ${t.release_date}` : ''}
                        </div>
                      </div>

                      <div className="most-played-meta">
                        <div className="small text-muted">
                          {plays}
                        </div>
                      </div>
                    </div>

                    <div className="most-played-controls">
                      {preview ? (
                        <audio
                          controls
                          controlsList="nodownload"
                          preload="none"
                          className="most-played-audio"
                          src={preview}
                          onPlay={e => {
                            handlePlay(e.target);
                            recordListenIfNeeded(t);
                          }}
                          onPause={e => handlePause(e.target)}
                          onEnded={() => {
                            if (playingRef.current) playingRef.current = null;
                          }}
                          aria-label={`Preview for ${title}`}
                        />
                      ) : (
                        <div className="small text-muted me-2">No preview</div>
                      )}

                      {preview ? (
                        <Button
                          size="sm"
                          variant="link"
                          onClick={() => handleDownload(t.id)}
                          disabled={isDownloading}
                          title="Download track"
                          className="p-0"
                          aria-label={`Download ${title}`}
                        >
                          {isDownloading ? <Spinner animation="border" size="sm" /> : <FaDownload />}
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
            <Button
              variant="link"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <FaChevronLeft />
            </Button>
            <Button
              variant="link"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              <FaChevronRight />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}