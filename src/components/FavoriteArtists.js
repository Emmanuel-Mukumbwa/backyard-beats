// src/components/FavoriteArtists.js
import React, { useEffect, useState, useContext } from 'react';
import { Card, Button, Row, Col, Image, Spinner, Badge, ButtonGroup } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import { AuthContext } from '../context/AuthContext';

/**
 * FavoriteArtists
 * - Responsive card layout optimized for small screens
 * - Client-side pagination (2 cards per page)
 *
 * Props:
 * - max (max number of favorites to fetch/display)
 * - onFollowChange({ artistId, following })
 */

export default function FavoriteArtists({ max = 12, onFollowChange }) {
  const { user } = useContext(AuthContext);
  const [favorites, setFavorites] = useState([]); // full list from server (or limited by `max`)
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({}); // { [artistId]: true }
  const [error, setError] = useState(null);

  // pagination: 2 cards per page (stable UI across breakpoints)
  const limit = 2;
  const [page, setPage] = useState(1);

  // resolve backend base similar to ArtistDashboard resolveToBackend
  const backendBase = (() => {
    try {
      return (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:3001';
    } catch {
      return process.env.REACT_APP_API_URL || 'http://localhost:3001';
    }
  })().replace(/\/$/, '');

  function resolveToBackend(raw) {
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `${backendBase}${raw}`;
    if (raw.startsWith('uploads/')) return `${backendBase}/${raw}`;
    return `${backendBase}/uploads/${raw}`;
  }

  // Fetch favorites on mount (and when `max` changes)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    axios
      .get('/favorites')
      .then((res) => {
        if (cancelled) return;
        const items = Array.isArray(res.data) ? res.data : [];
        const sliced = items.slice(0, max);
        setFavorites(sliced);
        // ensure page is within bounds
        const pages = Math.max(1, Math.ceil(sliced.length / limit));
        setPage((p) => Math.min(p, pages));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load favorites', err);
        setError('Failed to load favorites');
        setFavorites([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [max]);

  // Utility: render star string or small star component
  const renderStars = (avg) => {
    if (avg === null || avg === undefined) return <span className="text-muted small">No ratings</span>;
    const full = Math.floor(avg);
    const half = avg - full >= 0.5;
    // build visual-friendly stars (max 5)
    const starsArr = [];
    for (let i = 0; i < full && i < 5; i++) starsArr.push('★');
    if (half && starsArr.length < 5) starsArr.push('½');
    return <span className="text-warning" aria-hidden>{starsArr.join('')} <span className="small text-muted">({avg.toFixed(1)})</span></span>;
  };

  // Optimistic unfollow
  const unfollow = async (artistId) => {
    if (!user) return window.location.href = '/login';
    const prev = favorites;
    const next = prev.filter(a => a.id !== artistId);
    setFavorites(next);
    setProcessing(p => ({ ...p, [artistId]: true }));

    try {
      await axios.delete(`/favorites/${artistId}`);
      if (onFollowChange) onFollowChange({ artistId, following: false });
      // adjust page if needed (e.g., last item on last page removed)
      const pages = Math.max(1, Math.ceil(next.length / limit));
      setPage(p => Math.min(p, pages));
    } catch (err) {
      console.error('Unfollow failed', err);
      setFavorites(prev); // revert
    } finally {
      setProcessing(p => { const cp = { ...p }; delete cp[artistId]; return cp; });
    }
  };

  // Pagination helpers
  const totalPages = Math.max(1, Math.ceil((favorites.length || 0) / limit));
  const paginated = favorites.slice((page - 1) * limit, page * limit);

  const goToPage = (p) => {
    const np = Math.max(1, Math.min(totalPages, p));
    setPage(np);
    // keep focus for accessibility: scroll to top of component
    const el = document.querySelector('#favorite-artists-root');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) return <div id="favorite-artists-root" className="text-center py-4"><Spinner animation="border" /></div>;
  if (error) return <div className="text-danger">{error}</div>;
  if (!favorites || favorites.length === 0) {
    return <div id="favorite-artists-root" className="text-muted">No favorite artists yet. Follow artists from their profile pages.</div>;
  }

  return (
    <div id="favorite-artists-root">
      <style>{`
        /* Card tweaks for small screens */
        .fav-card {
          min-height: 150px;
        }
        .fav-card .card-body {
          display: flex;
          gap: 12px;
          padding: 12px;
        }

        /* Left avatar container */
        .fav-avatar {
          flex: 0 0 72px;
          width: 72px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Content area should shrink to allow truncation */
        .fav-content {
          flex: 1 1 auto;
          min-width: 0; /* critical for truncation inside flex containers */
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .fav-title {
          font-size: 1rem;
          font-weight: 600;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .fav-meta {
          font-size: 0.85rem;
          color: #6c757d;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .fav-stats {
          font-size: 0.85rem;
          color: #6c757d;
        }

        /* Actions grouped and aligned at bottom on wide screens */
        .fav-actions {
          display: flex;
          gap: 8px;
        }

        /* When very narrow, stack avatar above content */
        @media (max-width: 575.98px) {
          .fav-card .card-body {
            flex-direction: column;
            align-items: stretch;
          }
          .fav-avatar {
            flex: 0 0 auto;
            width: 84px;
            height: 84px;
            margin: 0 auto;
          }
          .fav-content { align-items: stretch; }
          .fav-actions { justify-content: center; width: 100%; }
        }
      `}</style>

      <Row className="g-3">
        {paginated.map(a => {
          const photoSrc = a.photo_url ? resolveToBackend(a.photo_url) : `https://ui-avatars.com/api/?name=${encodeURIComponent(a.display_name || 'Artist')}&background=0D8ABC&color=fff`;
          const trackCount = a.track_count ?? 0;
          const approvedCount = a.approved_track_count ?? 0;
          const followerCount = a.follower_count ?? 0;
          const latest = a.latest_track || null;
          const genres = Array.isArray(a.genres) && a.genres.length ? a.genres.join(', ') : null;
          const moods = Array.isArray(a.moods) && a.moods.length ? a.moods.join(', ') : null;

          return (
            <Col xs={12} key={a.id}>
              <Card className="fav-card h-100 shadow-sm">
                <div className="card-body">
                  <div className="fav-avatar" aria-hidden>
                    <Image
                      src={photoSrc}
                      roundedCircle
                      style={{ width: '100%', height: '100%', objectFit: 'cover', border: '2px solid #fff' }}
                      alt={a.display_name}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(a.display_name || 'Artist')}&background=0D8ABC&color=fff`;
                      }}
                    />
                  </div>

                  <div className="fav-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="fav-title" title={a.display_name}>{a.display_name}</div>
                        <div className="fav-meta" title={a.district || (a.district_id ? `District ${a.district_id}` : 'Unknown district')}>
                          {a.district ? a.district : (a.district_id ? `District ${a.district_id}` : 'Unknown district')}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                        {a.has_upcoming_event ? <Badge bg="success" pill className="mb-1">Upcoming</Badge> : null}
                        <div className="small text-muted">{followerCount.toLocaleString()} followers</div>
                      </div>
                    </div>

                    <div className="fav-stats">
                      <div>{trackCount} {trackCount === 1 ? 'track' : 'tracks'}{approvedCount !== null ? ` • ${approvedCount} approved` : ''}</div>
                      {latest && latest.title ? <div>Latest: <strong style={{ fontSize: 13 }}>{latest.title}</strong></div> : null}
                      {genres ? <div>Genres: <span className="text-muted">{genres}</span></div> : null}
                      {moods ? <div>Moods: <span className="text-muted">{moods}</span></div> : null}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <div>{renderStars(a.avg_rating)}</div>

                      <div className="fav-actions">
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => unfollow(a.id)}
                          disabled={!!processing[a.id]}
                          aria-label={`Unfollow ${a.display_name}`}
                        >
                          {processing[a.id] ? <Spinner animation="border" size="sm" /> : 'Unfollow'}
                        </Button>

                        <Button
                          size="sm"
                          variant="light"
                          onClick={() => (window.location.href = `/artist/${a.id}`)}
                          aria-label={`View ${a.display_name} profile`}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Pagination controls */}
      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="small text-muted">
          Showing {(favorites.length === 0) ? 0 : ((page - 1) * limit + 1)} - {Math.min(page * limit, favorites.length)} of {favorites.length}
        </div>

        <ButtonGroup aria-label="Favorite artists pagination">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            Prev
          </Button>

          <Button variant="light" size="sm" disabled className="px-3">
            Page {page} / {totalPages}
          </Button>

          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            Next
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}