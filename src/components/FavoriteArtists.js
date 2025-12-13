//src/components/FavoriteArtists.js
import React, { useEffect, useState, useContext } from 'react';
import { Card, Button, Row, Col, Image, Spinner } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import { AuthContext } from '../context/AuthContext';

/**
 * FavoriteArtists
 * - Shows current user's favorite artists
 * - Allows unfollow
 * - Also exposes a follow/unfollow toggle via props.handler if needed
 *
 * Optimistic update:
 * - On follow/unfollow we update UI immediately
 * - If API fails we revert and show console.error (you can wire to toast)
 */

export default function FavoriteArtists({ max = 12, onFollowChange }) {
  const { user } = useContext(AuthContext);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({}); // { [artistId]: true }

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

  // Unfollow (optimistic)
  const unfollow = async (artistId) => {
    if (!user) {
      return window.location.href = '/login';
    }
    // optimistic UI remove
    const prev = favorites;
    setFavorites(prev.filter(a => a.id !== artistId));
    setProcessing(p => ({ ...p, [artistId]: true }));
    try {
      await axios.delete(`/favorites/${artistId}`);
      if (onFollowChange) onFollowChange({ artistId, following: false });
    } catch (err) {
      console.error('Unfollow failed', err);
      // revert
      setFavorites(prev);
    } finally {
      setProcessing(p => { const cp = { ...p }; delete cp[artistId]; return cp; });
    }
  };

  const follow = async (artistId) => {
    if (!user) {
      return window.location.href = '/login';
    }
    // optimistic add - fetch minimal artist info? we'll call API then refresh list
    setProcessing(p => ({ ...p, [artistId]: true }));
    try {
      await axios.post('/favorites', { artist_id: artistId });
      // refresh
      const res = await axios.get('/favorites');
      setFavorites(Array.isArray(res.data) ? res.data.slice(0, max) : []);
      if (onFollowChange) onFollowChange({ artistId, following: true });
    } catch (err) {
      console.error('Follow failed', err);
    } finally {
      setProcessing(p => { const cp = { ...p }; delete cp[artistId]; return cp; });
    }
  };

  if (loading) return <div>Loading favorites...</div>;
  if (!favorites || !favorites.length) return <div className="text-muted">No favorite artists yet. Follow artists from their profile pages.</div>;

  return (
    <Row>
      {favorites.map(a => (
        <Col md={6} lg={4} key={a.id} className="mb-3">
          <Card className="h-100">
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
              <Image
                src={a.photo_url ? (a.photo_url.startsWith('/') ? a.photo_url : a.photo_url) : `https://ui-avatars.com/api/?name=${encodeURIComponent(a.display_name || 'Artist')}&background=0D8ABC&color=fff`}
                roundedCircle
                style={{ width: 72, height: 72, objectFit: 'cover' }}
                alt={a.display_name}
              />
            </div>
            <Card.Body className="d-flex flex-column">
              <Card.Title style={{ fontSize: 16 }}>{a.display_name}</Card.Title>
              <div className="small text-muted mb-2">Artist</div>
              <div className="mt-auto">
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => unfollow(a.id)}
                  disabled={!!processing[a.id]}
                >
                  {processing[a.id] ? <Spinner animation="border" size="sm" /> : 'Unfollow'}
                </Button>{' '}
                <Button
                  size="sm"
                  variant="light"
                  onClick={() => window.location.href = `/artist/${a.id}`}
                >
                  View
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
