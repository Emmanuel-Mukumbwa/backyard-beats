// src/components/FavoriteArtists.js
import React, { useEffect, useState, useContext } from 'react';
import { Card, Button, Row, Col, Image, Spinner, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import { AuthContext } from '../context/AuthContext';

/**
 * FavoriteArtists
 * - Shows current user's favorite artists with details:
 *   photo, display name, district, avg_rating, track_count, follower_count, upcoming event badge
 *
 * Props:
 * - max
 * - onFollowChange({ artistId, following })
 */
export default function FavoriteArtists({ max = 12, onFollowChange }) {
  const { user } = useContext(AuthContext);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({}); // { [artistId]: true }

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios.get('/favorites')
      .then(res => {
        if (cancelled) return;
        const items = Array.isArray(res.data) ? res.data : [];
        setFavorites(items.slice(0, max));
      })
      .catch(err => {
        console.error('Failed to load favorites', err);
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
    return <span className="text-warning">{starsArr.join('')} <span className="small text-muted">({avg.toFixed(1)})</span></span>;
  };

  // Optimistic unfollow
  const unfollow = async (artistId) => {
    if (!user) return window.location.href = '/login';
    const prev = favorites;
    setFavorites(prev.filter(a => a.id !== artistId));
    setProcessing(p => ({ ...p, [artistId]: true }));
    try {
      await axios.delete(`/favorites/${artistId}`);
      if (onFollowChange) onFollowChange({ artistId, following: false });
    } catch (err) {
      console.error('Unfollow failed', err);
      setFavorites(prev); // revert
    } finally {
      setProcessing(p => { const cp = { ...p }; delete cp[artistId]; return cp; });
    }
  };

  // Follow from artist card (optimistic + refresh)
  const follow = async (artistId) => {
    if (!user) return window.location.href = '/login';
    setProcessing(p => ({ ...p, [artistId]: true }));
    try {
      await axios.post('/favorites', { artist_id: artistId });
      // refresh list to reflect latest metadata (follower_count etc)
      const res = await axios.get('/favorites');
      setFavorites(Array.isArray(res.data) ? res.data.slice(0, max) : []);
      if (onFollowChange) onFollowChange({ artistId, following: true });
    } catch (err) {
      console.error('Follow failed', err);
    } finally {
      setProcessing(p => { const cp = { ...p }; delete cp[artistId]; return cp; });
    }
  };

  if (loading) return <div className="text-center py-4"><Spinner animation="border" /></div>;
  if (!favorites || favorites.length === 0) {
    return <div className="text-muted">No favorite artists yet. Follow artists from their profile pages.</div>;
  }

  return (
    <Row>
      {favorites.map(a => {
        const photoSrc = a.photo_url ? resolveToBackend(a.photo_url) : `https://ui-avatars.com/api/?name=${encodeURIComponent(a.display_name || 'Artist')}&background=0D8ABC&color=fff`;
        return (
          <Col md={6} lg={4} key={a.id} className="mb-3">
            <Card className="h-100 shadow-sm">
              <div className="d-flex justify-content-center pt-3">
                <Image
                  src={photoSrc}
                  roundedCircle
                  style={{ width: 84, height: 84, objectFit: 'cover', border: '2px solid #fff' }}
                  alt={a.display_name}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(a.display_name || 'Artist')}&background=0D8ABC&color=fff`;
                  }}
                />
              </div>

              <Card.Body className="d-flex flex-column">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <Card.Title style={{ fontSize: 16, marginBottom: 0 }}>{a.display_name}</Card.Title>
                    <div className="small text-muted">
                      {a.district ? a.district : 'Unknown district'} • { (a.track_count ?? 0) } { (a.track_count === 1) ? 'track' : 'tracks' }
                    </div>
                  </div>

                  <div className="text-end">
                    {a.has_upcoming_event ? <Badge bg="success" pill>Upcoming</Badge> : null}
                    <div className="small text-muted mt-1">{ (a.follower_count ?? 0).toLocaleString() } followers</div>
                  </div>
                </div>

                <div className="mt-2 mb-2">
                  {renderStars(a.avg_rating)}
                </div>

                <div className="mt-auto d-flex gap-2">
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => unfollow(a.id)}
                    disabled={!!processing[a.id]}
                  >
                    {processing[a.id] ? <Spinner animation="border" size="sm" /> : 'Unfollow'}
                  </Button>

                  <Button
                    size="sm"
                    variant="light"
                    onClick={() => window.location.href = `/artist/${a.id}`}
                  >
                    View
                  </Button>

                  <OverlayTrigger
                    placement="top"
                    overlay={<Tooltip id={`t-${a.id}`}>Open artist profile</Tooltip>}
                  >
                    <Button size="sm" variant="outline-secondary" onClick={() => window.location.href = `/artist/${a.id}`}>...</Button>
                  </OverlayTrigger>
                </div>
              </Card.Body>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}