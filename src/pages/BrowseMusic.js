// src/pages/BrowseMusic.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from '../api/axiosConfig';
import FilterBar from '../components/FilterBar';
import { Container, Row, Col, Button, Spinner, ListGroup, Image, Form, Collapse } from 'react-bootstrap';
import { FaDownload, FaChevronLeft, FaMusic, FaFilter } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

export default function BrowseMusic() {
  const [filters, setFilters] = useState({ district: '', genre: '', mood: '', q: '' });
  const [sort, setSort] = useState('new'); // 'new' | 'most_played'
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(12); // fixed page size (no "per page" control)
  const [loading, setLoading] = useState(false);
  const playingRef = useRef(null);
  const mounted = useRef(true);
  const debounceRef = useRef(null);

  const [showFilters, setShowFilters] = useState(false);

  const navigate = useNavigate();

  // Fetch helper (doesn't capture changing state directly; depends on passed opts)
  const fetchTracks = useCallback(async (opts = {}) => {
    const p = opts.page ?? page;
    const lim = opts.limit ?? limit;
    const s = opts.sort ?? sort;
    const f = opts.filters ?? filters;

    const params = {
      page: p,
      limit: lim,
      sort: s
    };
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
      // limit remains fixed
    } catch (err) {
      console.error('Failed to load tracks', err);
      setItems([]);
      setTotal(0);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [page, limit, sort, filters]);

  // initial load
  useEffect(() => {
    mounted.current = true;
    fetchTracks({ page: 1, limit, sort, filters });
    return () => { mounted.current = false; clearTimeout(debounceRef.current); };
  }, [fetchTracks, limit, sort, filters]);

  // when filters or sort change, debounce then fetch (reset to page 1)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchTracks({ page: 1, limit, sort, filters });
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [filters, sort, fetchTracks, limit]);

  // when page changes
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

  const totalPages = Math.max(1, Math.ceil((total || 0) / limit));
  const activeFiltersCount = Object.values(filters).filter(v => v && String(v).trim().length > 0).length;

  return (
    <Container fluid className="mt-4 px-lg-5">
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

          {/* Collapsible filter area (includes Sort) */}
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
                const download = t.download_url || t.preview_url || null;
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

                        {/* compact controls under title (preview + download) */}
                        <div className="d-flex align-items-center gap-3 mt-2">
                          {preview ? (
                            <audio
                              controls
                              preload="none"
                              style={{ width: 220, height: 28 }}
                              src={preview}
                              onPlay={e => handlePlay(e.target)}
                              onPause={e => handlePause(e.target)}
                              onEnded={() => { if (playingRef.current) playingRef.current = null; }}
                            />
                          ) : (
                            <div className="small text-muted">No preview</div>
                          )}

                          {download ? (
                            <Button
                              variant="link"
                              size="sm"
                              href={download}
                              download
                              title={`Download ${t.title}`}
                              className="p-0"
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