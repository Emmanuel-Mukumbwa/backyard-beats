import React, { useEffect, useState, useRef, useCallback, useContext } from 'react';
import axios from '../api/axiosConfig';
import FilterBar from '../components/FilterBar';
import { Container, Row, Col, Button, Spinner, ListGroup, Image, Form, Collapse } from 'react-bootstrap';
import { FaChevronLeft, FaMusic, FaFilter } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import ToastMessage from '../components/ToastMessage'; // added for toast notifications

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

export default function BrowseMusic() {
  const [filters, setFilters] = useState({ district: '', genre: '', mood: '', q: '' });
  const [sort, setSort] = useState('new'); // 'new' | 'most_played'
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [loading, setLoading] = useState(false);
  const playingRef = useRef(null);
  const mounted = useRef(true);
  const debounceRef = useRef(null);

  const [showFilters, setShowFilters] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null); // track which track is being downloaded
  const [toast, setToast] = useState({ show: false, message: '', variant: 'info' }); // local toast state

  const navigate = useNavigate();
  const { user, artist: myArtist } = useContext(AuthContext);

  // Fetch helper
  const fetchTracks = useCallback(async (opts = {}) => {
    const p = opts.page ?? page;
    const lim = opts.limit ?? limit;
    const s = opts.sort ?? sort;
    const f = opts.filters ?? filters;

    const params = { page: p, limit: lim, sort: s };
    if (f.q) params.q = f.q;
    if (f.genre) params.genre = f.genre;
    if (f.mood) params.mood = f.mood;
    if (f.district) params.district = f.district;
    if (f.artist_id) params.artist_id = f.artist_id;

    setLoading(true);
    try {
      const res = await axios.get('/public/tracks', { params });
      const payload = res.data || { items: [], total: 0 };
      setItems(payload.items || []);
      setTotal(payload.total || 0);
      setPage(payload.page || p);
    } catch (err) {
      console.error('Failed to load tracks', err);
      setItems([]);
      setTotal(0);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [page, limit, sort, filters]);

  useEffect(() => {
    mounted.current = true;
    fetchTracks({ page: 1, limit, sort, filters });
    return () => { mounted.current = false; clearTimeout(debounceRef.current); };
  }, [fetchTracks, limit, sort, filters]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchTracks({ page: 1, limit, sort, filters });
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [filters, sort, fetchTracks, limit]);

  useEffect(() => {
    fetchTracks({ page, limit, sort, filters });
  }, [page, limit, sort, filters, fetchTracks]);

  // audio play/pause helpers to ensure a single playing element
  function handlePlay(audioEl) {
    if (!audioEl) return;
    if (playingRef.current && playingRef.current !== audioEl) {
      try { playingRef.current.pause(); } catch (e) { /* ignore */ }
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

  // Handle download with toast and disable button while downloading
  const handleDownload = (trackId) => {
    setDownloadingId(trackId);
    setToast({ show: true, message: 'Preparing your download...', variant: 'info' });
    downloadTrackById(trackId, (toastObj) => {
      setToast(toastObj);
      // clear downloading state on success or failure
      setDownloadingId(null);
    });
  };

  const totalPages = Math.max(1, Math.ceil((total || 0) / limit));
  const activeFiltersCount = Object.values(filters).filter(v => v && String(v).trim().length > 0).length;

  return (
    <Container fluid className="mt-4 px-lg-5">
      <ToastMessage
        show={toast.show}
        onClose={() => setToast(s => ({ ...s, show: false }))}
        message={toast.message}
        variant={toast.variant}
        delay={3500}
        position="top-end"
      />

      <Row>
        <Col xs={12}>
          <h2 className="mb-3"><FaMusic className="me-2" />Browse Music</h2>
        </Col>
      </Row>

      {/* Top controls: filters toggle */}
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
                  <Button size="sm" variant="outline-secondary" onClick={() => { setFilters({ district: '', genre: '', mood: '', q: '' }); setSort('new'); }}>
                    Clear filters
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => { setShowFilters(false); }}>
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
                return (
                  <ListGroup.Item key={t.id} className="py-3">
                    <div className="d-flex align-items-start">
                      <div style={{ width: 72, marginRight: 14 }}>
                        {artwork ? (
                          <Image src={artwork} rounded style={{ width: 72, height: 72, objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 72, height: 72, background: '#efefef', borderRadius: 6 }} />
                        )}
                      </div>

                      <div className="flex-grow-1">
                        <div className="d-flex align-items-start justify-content-between">
                          <div style={{ minWidth: 0 }}>
                            <div className="fw-bold text-truncate" style={{ fontSize: 16 }}>{t.title}</div>
                            <div className="small text-muted mt-1">
                              <span style={{ cursor: artistName ? 'pointer' : 'default' }} onClick={() => t.artist?.id && handleArtistClick(t.artist.id)}>
                                {artistName}
                              </span>
                              {t.genre ? <span className="ms-2">• {t.genre}</span> : null}
                              {t.release_date ? <span className="ms-2">• {t.release_date}</span> : null}
                            </div>
                          </div>

                          <div className="text-end small text-muted">
                            {t.plays ? `${t.plays} plays` : null}
                          </div>
                        </div>

                        {/* Compact controls under title */}
                        <div className="d-flex align-items-center gap-3 mt-2">
                          {preview ? (
                            <audio
                              controls
                              preload="none"
                              controlsList="nodownload"
                              style={{ width: 220, height: 28 }}
                              src={preview}
                              onPlay={e => { handlePlay(e.target); recordListenIfNeeded(t); }}
                              onPause={e => { handlePause(e.target); }}
                              onEnded={() => { if (playingRef.current) playingRef.current = null; }}
                            />
                          ) : (
                            <div className="small text-muted">No preview</div>
                          )}
                        </div>

                        {/* Download button placed below preview, as text */}
                        <div className="mt-2">
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => handleDownload(t.id)}
                            disabled={isDownloading}
                            className="p-0 text-success"
                          >
                            {isDownloading ? 'Preparing...' : 'Download'}
                          </Button>
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

      {/* pagination */}
      <Row className="mt-3">
        <Col xs={12} className="d-flex justify-content-between align-items-center">
          <div className="small text-muted">Page {page} / {totalPages}</div>
          <div>
            <Button variant="link" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><FaChevronLeft /></Button>
            <Button variant="primary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="ms-2">Next</Button>
          </div>
        </Col>
      </Row>
    </Container>
  );
}