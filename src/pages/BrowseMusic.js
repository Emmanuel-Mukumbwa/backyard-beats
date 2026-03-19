import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useContext,
  useLayoutEffect
} from 'react';
import axios from '../api/axiosConfig';
import FilterBar from '../components/FilterBar';
import {
  Container,
  Row,
  Col,
  Button,
  Spinner,
  ListGroup,
  Image,
  Form,
  Collapse
} from 'react-bootstrap';
import { FaChevronLeft, FaMusic, FaFilter } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import ToastMessage from '../components/ToastMessage';

/** sanitize file name for client (small helper) */
function sanitizeFilename(s) {
  if (!s) return '';
  return String(s)
    .replace(/["'<>:\\/|?*]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 190);
}

/** title that scrolls, pauses at the end, then restarts without duplicating visible text */
function ScrollingTitle({ text, className = '', threshold = 28 }) {
  const viewportRef = useRef(null);
  const textRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [shift, setShift] = useState(0);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const textEl = textRef.current;
    if (!viewport || !textEl) return;

    const viewportWidth = viewport.clientWidth || 0;
    const textWidth = textEl.scrollWidth || 0;
    const needsScroll = textWidth > viewportWidth + 8 && String(text || '').length > threshold;

    setShouldScroll(needsScroll);
    setShift(Math.max(0, textWidth - viewportWidth));
  }, [text, threshold]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (!viewportRef.current || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => measure());
    ro.observe(viewportRef.current);

    return () => ro.disconnect();
  }, [measure]);

  if (!text) return null;

  return (
    <div
      ref={viewportRef}
      className={`browse-title-viewport ${className}`}
      title={text}
    >
      <span
        ref={textRef}
        className={`browse-title-text ${shouldScroll ? 'is-scrolling' : 'is-static'}`}
        style={{
          '--scroll-shift': `${shift}px`
        }}
      >
        {text}
      </span>
    </div>
  );
}

/** download helper (forces filename by creating File object) */
async function downloadTrackById(trackId, setToast) {
  try {
    const res = await axios.get(`/download/${trackId}`, { responseType: 'blob' });

    const disposition =
      (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
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
  } catch (err) {
    if (typeof setToast === 'function') {
      const message = (err && err.message) ? err.message : 'Download failed';
      setToast({ show: true, message: `Download failed: ${message}`, variant: 'danger', autohide: false });
    }
  }
}

export default function BrowseMusic() {
  const [filters, setFilters] = useState({ district: '', genre: '', mood: '', q: '' });
  const [sort, setSort] = useState('new');

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(4);
  const [loading, setLoading] = useState(false);

  const playingRef = useRef(null);
  const mounted = useRef(true);
  const debounceRef = useRef(null);

  const [showFilters, setShowFilters] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [toast, setToast] = useState({
    show: false,
    message: '',
    variant: 'info',
    autohide: true,
    delay: 3500
  });

  const navigate = useNavigate();
  const { user, artist: myArtist } = useContext(AuthContext);

  const pageRef = useRef(page);
  const filtersRef = useRef(filters);
  const sortRef = useRef(sort);
  const limitRef = useRef(limit);

  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { sortRef.current = sort; }, [sort]);
  useEffect(() => { limitRef.current = limit; }, [limit]);

  const fetchTracks = useCallback(async (opts = {}) => {
    const p = opts.page ?? pageRef.current ?? 1;
    const lim = opts.limit ?? limitRef.current ?? 4;
    const s = opts.sort ?? sortRef.current ?? 'new';
    const f = opts.filters ?? filtersRef.current ?? {};

    const params = { page: p, limit: lim, sort: s };
    if (f.q) params.q = f.q;
    if (f.genre) params.genre = f.genre;
    if (f.mood) params.mood = f.mood;
    if (f.district) params.district = f.district;
    if (f.artist_id) params.artist_id = f.artist_id;

    setLoading(true);
    try {
      const res = await axios.get('/public/tracks', { params });
      const payload = res.data || { items: [], total: 0, page: p };

      setItems(payload.items || []);
      setTotal(payload.total || 0);

      const serverPage = (typeof payload.page === 'number') ? payload.page : p;
      setPage(serverPage);
      pageRef.current = serverPage;
    } catch (err) {
      console.error('Failed to load tracks', err);
      setItems([]);
      setTotal(0);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    fetchTracks({ page: 1, limit: limitRef.current, sort: sortRef.current, filters: filtersRef.current });
    return () => {
      mounted.current = false;
      clearTimeout(debounceRef.current);
    };
  }, [fetchTracks]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      pageRef.current = 1;
      fetchTracks({ page: 1, limit: limitRef.current, sort: sortRef.current, filters: filtersRef.current });
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [filters, sort, fetchTracks]);

  useEffect(() => {
    fetchTracks({ page, limit: limitRef.current, sort: sortRef.current, filters: filtersRef.current });
  }, [page, fetchTracks]);

  function handlePlay(audioEl) {
    if (!audioEl) return;
    if (playingRef.current && playingRef.current !== audioEl) {
      try {
        playingRef.current.pause();
      } catch (e) {
        /* ignore */
      }
    }
    playingRef.current = audioEl;
  }

  function handlePause(audioEl) {
    if (playingRef.current === audioEl) playingRef.current = null;
  }

  function handleArtistClick(artistId) {
    if (!artistId) return;
    navigate(`/artist/${artistId}`);
  }

  async function recordListenIfNeeded(track) {
    if (!user || !user.id) return;
    if (myArtist && track.artist && Number(myArtist.id) === Number(track.artist.id)) return;
    try {
      await axios.post('/fan/listens', { track_id: track.id, artist_id: track.artist?.id || null });
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
    setToast({ show: true, message: 'Preparing your download...', variant: 'info', autohide: true, delay: 3500 });
    downloadTrackById(trackId, (toastObj) => {
      setToast(prev => ({ ...prev, ...toastObj }));
      setDownloadingId(null);
    });
  };

  const totalPages = Math.max(1, Math.ceil((total || 0) / Math.max(1, limit)));
  const activeFiltersCount = Object.values(filters).filter(v => v && String(v).trim().length > 0).length;

  return (
    <Container fluid className="mt-4 px-lg-5">
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
        .browse-track-item {
          overflow: hidden;
        }

        .browse-track-row {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: nowrap;
        }

        .browse-artwork {
          flex: 0 0 72px;
          width: 72px;
          height: 72px;
          border-radius: 6px;
          overflow: hidden;
          min-width: 72px;
        }

        .browse-content {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .browse-top-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          min-width: 0;
        }

        .browse-title-wrap {
          min-width: 0;
          flex: 1 1 auto;
          overflow: hidden;
        }

        .browse-title-viewport {
          overflow: hidden;
          width: 100%;
          min-width: 0;
        }

        .browse-title-text {
          display: inline-block;
          max-width: 100%;
          font-size: 16px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .browse-title-text.is-static {
          display: block;
        }

        /* key fix: allow the scrolling state to reveal the hidden letters */
        .browse-title-text.is-scrolling {
          display: block;
          width: max-content;
          max-width: none;
          overflow: visible;
          text-overflow: clip;
          will-change: transform;
          animation: browse-title-scroll 14s linear infinite;
        }

        @keyframes browse-title-scroll {
          0%,
          12% {
            transform: translateX(0%);
          }

          40%,
          62% {
            transform: translateX(calc(-1 * var(--scroll-shift)));
          }

          62.01%,
          100% {
            transform: translateX(0%);
          }
        }

        .browse-sub {
          font-size: 0.9rem;
          color: #6c757d;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .browse-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .browse-controls-left {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1 1 auto;
        }

        .browse-audio {
          width: 100%;
          max-width: 220px;
        }

        .browse-meta {
          flex: 0 0 auto;
          white-space: nowrap;
          text-align: right;
        }

        @media (max-width: 575.98px) {
          .browse-track-row {
            gap: 10px;
          }

          .browse-artwork {
            flex: 0 0 56px;
            width: 56px;
            height: 56px;
            min-width: 56px;
          }

          .browse-title-text {
            font-size: 15px;
          }

          .browse-sub {
            font-size: 0.78rem;
          }

          .browse-audio {
            max-width: 100%;
          }

          .browse-meta {
            margin-top: 6px;
          }
        }

        .list-group-flush > .list-group-item {
          padding-right: 12px;
          padding-left: 12px;
        }

        @media (prefers-reduced-motion: reduce) {
          .browse-title-text.is-scrolling {
            animation: none;
          }
        }
      `}</style>

      <Row>
        <Col xs={12}>
          <h2 className="mb-3"><FaMusic className="me-2" />Browse Music</h2>
        </Col>
      </Row>

      <Row className="mb-3 align-items-start">
        <Col xs={12} lg={8} className="mb-2 mb-lg-0">
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <Button
                variant={showFilters ? 'outline-secondary' : 'outline-primary'}
                size="sm"
                onClick={() => setShowFilters(s => !s)}
                aria-expanded={showFilters}
                aria-controls="browse-filters"
              >
                <FaFilter className="me-1" />
                {showFilters ? 'Hide filters' : `Filters ${activeFiltersCount ? `(${activeFiltersCount})` : ''}`}
              </Button>
            </div>

            <div className="small text-muted d-none d-md-block">
              Toggle filters to refine results.
            </div>
          </div>

          <Collapse in={showFilters}>
            <div id="browse-filters" className="mt-3 p-3 bg-light rounded shadow-sm">
              <FilterBar filters={filters} setFilters={setFilters} />
              <div className="d-flex align-items-center justify-content-between mt-3">
                <div style={{ minWidth: 160 }}>
                  <Form.Group>
                    <Form.Label className="small text-muted mb-1">Sort</Form.Label>
                    <Form.Select value={sort} onChange={e => setSort(e.target.value)} size="sm">
                      <option value="new">Newest first</option>
                      <option value="most_played">Most played</option>
                    </Form.Select>
                  </Form.Group>
                </div>

                <div className="d-flex gap-2">
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => {
                      setFilters({ district: '', genre: '', mood: '', q: '' });
                      setSort('new');
                    }}
                  >
                    Clear filters
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setShowFilters(false);
                    }}
                  >
                    Apply & Close
                  </Button>
                </div>
              </div>
            </div>
          </Collapse>
        </Col>
      </Row>

      <Row>
        <Col xs={12}>
          {loading ? (
            <div className="py-5 text-center">
              <Spinner animation="border" />
              <div className="small text-muted mt-2">Loading tracks...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="py-5 text-center text-muted">
              <h5>No tracks found.</h5>
              <div className="mt-1">Try changing filters or clearing search.</div>
            </div>
          ) : (
            <ListGroup variant="flush">
              {items.map(t => {
                const artistName = t.artist?.display_name || t.artist?.displayName || '';
                const artwork = t.artwork_url || null;
                const preview = t.preview_url || null;
                const isDownloading = downloadingId === t.id;
                const title = String(t.title || '');

                return (
                  <ListGroup.Item key={t.id} className="py-3 browse-track-item">
                    <div className="browse-track-row">
                      <div className="browse-artwork">
                        {artwork ? (
                          <Image
                            src={artwork}
                            rounded
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            alt={`${t.title} artwork`}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = '/defaults/track-art.png';
                            }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: '#efefef' }} />
                        )}
                      </div>

                      <div className="browse-content">
                        <div className="browse-top-row">
                          <div className="browse-title-wrap">
                            <ScrollingTitle text={title} />

                            <div className="browse-sub">
                              <span
                                style={{ cursor: artistName ? 'pointer' : 'default' }}
                                onClick={() => t.artist?.id && handleArtistClick(t.artist.id)}
                                title={artistName || ''}
                              >
                                {artistName || '-'}
                              </span>
                              {t.genre ? <span className="ms-2">• {t.genre}</span> : null}
                              {t.release_date ? <span className="ms-2">• {t.release_date}</span> : null}
                            </div>
                          </div>

                          <div className="browse-meta">
                            <div className="small text-muted">
                              {t.plays ? `${t.plays} plays` : null}
                            </div>
                            <div>
                              <Button
                                variant="link"
                                size="sm"
                                onClick={() => handleDownload(t.id)}
                                disabled={isDownloading}
                                className="p-0 text-success"
                                aria-label={`Download ${t.title}`}
                                title="Download"
                              >
                                {isDownloading ? 'Preparing...' : 'Download'}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="browse-controls">
                          <div className="browse-controls-left">
                            {preview ? (
                              <audio
                                controls
                                preload="none"
                                controlsList="nodownload"
                                className="browse-audio"
                                src={preview}
                                onPlay={e => {
                                  handlePlay(e.target);
                                  recordListenIfNeeded(t);
                                }}
                                onPause={e => {
                                  handlePause(e.target);
                                }}
                                onEnded={() => {
                                  if (playingRef.current) playingRef.current = null;
                                }}
                              />
                            ) : (
                              <div className="small text-muted">No preview</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          )}
        </Col>
      </Row>

      <Row className="mt-3">
        <Col xs={12} className="d-flex justify-content-between align-items-center">
          <div className="small text-muted">Page {page} / {totalPages}</div>
          <div>
            <Button
              variant="link"
              size="sm"
              disabled={page <= 1}
              onClick={() => {
                setPage(p => Math.max(1, p - 1));
                pageRef.current = Math.max(1, pageRef.current - 1);
              }}
            >
              <FaChevronLeft />
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => {
                setPage(p => Math.min(totalPages, p + 1));
                pageRef.current = Math.min(totalPages, pageRef.current + 1);
              }}
              className="ms-2"
            >
              Next
            </Button>
          </div>
        </Col>
      </Row>
    </Container>
  );
}