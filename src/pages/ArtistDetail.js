// src/pages/ArtistDetail.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from '../api/axiosConfig';
import AudioPlayer from '../components/AudioPlayer';
import RatingsList from '../components/RatingsList';
import RatingsForm from '../components/RatingsForm';
import { AuthContext } from '../context/AuthContext';
import { Badge, Row, Col, Card, Button, Spinner } from 'react-bootstrap';

/**
 * ArtistDetail page with follow/unfollow functionality.
 *
 * Requirements:
 * - Only logged-in users can follow (redirects to /login when not).
 * - User cannot follow their own artist profile (button disabled).
 * - Optimistic UI updates for immediate feedback; reverts on error.
 * - Assumes favorite endpoints:
 *    GET  /favorites/check/:artistId      -> { following: true|false }
 *    POST /favorites                      -> { message }  body: { artist_id }
 *    DELETE /favorites/:artistId          -> { message }
 */

export default function ArtistDetail() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // follow state & UI helpers
  const [following, setFollowing] = useState(null); // null = unknown, true/false = known
  const [processingFollow, setProcessingFollow] = useState(false);
  const [followMsg, setFollowMsg] = useState(null);

  // bump this to force RatingsList re-fetch after new rating
  const [ratingsKey, setRatingsKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Fetch artist
    axios.get(`/artists/${id}`)
      .then(res => {
        const payload = res.data && res.data.artist ? res.data.artist : res.data;
        if (!cancelled) setArtist(payload || null);
      })
      .catch(err => {
        console.error('Artist load error:', err);
        if (!cancelled) setError(err.response?.data?.error || err.message || 'Failed to load artist');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  // after we have artist & user, check follow status
  useEffect(() => {
    let cancelled = false;
    async function checkFollowing() {
      if (!artist) return;
      try {
        // If no auth or no user, treat as not following (but still try endpoint - server may require auth)
        if (!user || !user.id) {
          setFollowing(false);
          return;
        }
        const res = await axios.get(`/favorites/check/${artist.id}`);
        if (!cancelled) {
          // res.data expected { following: true/false }
          setFollowing(Boolean(res.data && res.data.following));
        }
      } catch (err) {
        console.warn('Check following failed, defaulting to false', err);
        if (!cancelled) setFollowing(false);
      }
    }
    checkFollowing();
    return () => { cancelled = true; };
  }, [artist, user]);

  if (loading) return <div className="text-center py-5">Loading artist...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!artist) return <div className="alert alert-warning">Artist not found</div>;

  // helper: format duration
  const fmtDuration = (sec) => {
    if (!sec && sec !== 0) return '—';
    const s = Number(sec) || 0;
    const mm = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${mm}:${String(ss).padStart(2, '0')}`;
  };

  // helper: get follower count from artist row if present
  const followerCount = artist.follower_count ?? artist.followers_count ?? null;

  // Click handler: toggles follow/unfollow with optimistic UI
  const handleFollowClick = async () => {
    // require login
    if (!user || !user.id) {
      // redirect to login, you can instead open a modal
      window.location.href = '/login';
      return;
    }

    // prevent following yourself
    if (artist.user_id && Number(artist.user_id) === Number(user.id)) {
      setFollowMsg("You cannot follow your own artist profile.");
      setTimeout(() => setFollowMsg(null), 3000);
      return;
    }

    // If following known true => unfollow; else follow
    const isCurrentlyFollowing = !!following;

    // optimistic update
    setProcessingFollow(true);
    setFollowing(!isCurrentlyFollowing);
    // optimistically reflect follower_count in artist state if available
    if (typeof followerCount === 'number') {
      setArtist(prev => prev ? { ...prev, follower_count: (isCurrentlyFollowing ? Math.max(0, prev.follower_count - 1) : (prev.follower_count || 0) + 1) } : prev);
    }

    try {
      if (isCurrentlyFollowing) {
        // Unfollow
        await axios.delete(`/favorites/${artist.id}`);
        setFollowMsg('Unfollowed');
      } else {
        // Follow
        await axios.post('/favorites', { artist_id: artist.id });
        setFollowMsg('Following');
      }

      // keep message short and remove after a bit
      setTimeout(() => setFollowMsg(null), 2500);
    } catch (err) {
      // revert optimistic update on error
      console.error('Follow/unfollow failed:', err);
      setFollowing(isCurrentlyFollowing);
      if (typeof followerCount === 'number') {
        setArtist(prev => prev ? { ...prev, follower_count: (isCurrentlyFollowing ? (prev.follower_count || 0) + 1 : Math.max(0, (prev.follower_count || 1) - 1)) } : prev);
      }
      const msg = err.response?.data?.error || err.message || 'Action failed';
      setFollowMsg(msg);
      setTimeout(() => setFollowMsg(null), 4000);
    } finally {
      setProcessingFollow(false);
    }
  };

  // A small helper to render the follow button area
  const renderFollowArea = () => {
    // If this is the same user who owns the artist profile -> disable
    const isOwner = artist.user_id && user && (Number(artist.user_id) === Number(user.id));
    // If following state unknown, show a small placeholder
    if (following === null) {
      return <Button variant="outline-secondary" size="sm" disabled><Spinner animation="border" size="sm" /></Button>;
    }

    // Button text and variant
    const btnVariant = following ? 'outline-success' : 'primary';
    const btnText = following ? 'Following ✓' : 'Follow';

    return (
      <>
        <Button
          variant={btnVariant}
          size="sm"
          className="me-2"
          onClick={handleFollowClick}
          disabled={processingFollow || isOwner}
          aria-pressed={following}
        >
          {processingFollow ? <Spinner animation="border" size="sm" /> : btnText}
        </Button>
        <Button as={Link} to={`/message/artist/${artist.id}`} variant="light" size="sm">Message</Button>
        <div className="small text-muted mt-1">
          {isOwner ? <em>This is your profile</em> : (typeof followerCount === 'number' ? `${followerCount} follower${followerCount !== 1 ? 's' : ''}` : '')}
        </div>
      </>
    );
  };

  // tracks array expected as artist.tracks (normalize if needed)
  const tracks = Array.isArray(artist.tracks) ? artist.tracks : (artist.tracks_list || artist.tracks || []);

  return (
    <div className="artist-detail-page">
      {/* Cover area */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div style={{
          height: 220,
          width: '100%',
          overflow: 'hidden',
          background: '#f4f4f4',
          borderRadius: 6,
        }}>
          <img
            src={artist.cover_url || artist.cover || artist.photo_url || `/assets/placeholder-cover.jpg`}
            alt={`${artist.displayName || artist.username} cover`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => {
              e.currentTarget.onerror = null;
              const name = encodeURIComponent(artist.displayName || artist.display_name || artist.username || 'Artist');
              e.currentTarget.src = `https://ui-avatars.com/api/?name=${name}&background=eeeeee&color=333&size=1200`;
            }}
            loading="lazy"
          />
        </div>

        {/* Avatar overlaps cover */}
        <div style={{
          position: 'absolute',
          left: 20,
          bottom: -48,
          display: 'flex',
          alignItems: 'center',
        }}>
          <img
            src={artist.photo_url || artist.photo || `/assets/placeholder-avatar.png`}
            alt={`${artist.displayName || artist.username} avatar`}
            style={{
              width: 96,
              height: 96,
              objectFit: 'cover',
              borderRadius: '50%',
              border: '4px solid white',
              boxShadow: '0 6px 18px rgba(0,0,0,0.12)'
            }}
            onError={(e) => {
              e.currentTarget.onerror = null;
              const name = encodeURIComponent(artist.displayName || artist.display_name || artist.username || 'Artist');
              e.currentTarget.src = `https://ui-avatars.com/api/?name=${name}&background=0D8ABC&color=fff&size=512`;
            }}
            loading="lazy"
          />
        </div>
      </div>

      {/* Main content area */}
      <div style={{ paddingTop: 56 }}>
        <Row>
          <Col md={8}>
            <Card className="mb-3">
              <Card.Body>
                <div className="d-flex align-items-start justify-content-between">
                  <div>
                    <h2 style={{ marginBottom: 6 }}>{artist.displayName || artist.display_name || artist.username}</h2>
                    <div className="text-muted small mb-2">
                      {artist.district || artist.district_name || ''} {artist.district ? '•' : ''} {Array.isArray(artist.genres) ? artist.genres.join(', ') : (artist.genres || '')}
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{artist.bio}</p>
                    <div className="d-flex align-items-center" style={{ gap: 12 }}>
                      <div>
                        <Badge bg="success" pill style={{ fontSize: 14 }}>
                          {artist.avg_rating ? `${artist.avg_rating} ★` : 'No ratings'}
                        </Badge>
                      </div>
                      <div className="text-muted small">{artist.total_reviews ? `${artist.total_reviews} review${artist.total_reviews > 1 ? 's' : ''}` : 'Be the first to review'}</div>
                    </div>
                  </div>

                  <div className="text-end">
                    <div style={{ marginBottom: 8 }}>
                      {renderFollowArea()}
                    </div>
                    <div className="small text-muted">Joined: {artist.created_at ? new Date(artist.created_at).toLocaleDateString() : '—'}</div>
                    {followMsg && <div className="small text-success mt-2">{followMsg}</div>}
                  </div>
                </div>
              </Card.Body>
            </Card>

            {/* Tracks */}
            <Card className="mb-3">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h5 className="mb-0">Tracks</h5>
                  <div className="small text-muted">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</div>
                </div>

                {tracks && tracks.length > 0 ? (
                  <>
                    <AudioPlayer tracks={tracks} />
                    <div className="list-group mt-3">
                      {tracks.map(t => (
                        <div key={t.id} className="list-group-item d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-bold">{t.title}</div>
                            <div className="small text-muted">{t.genre || ''} · {fmtDuration(t.duration)}</div>
                          </div>
                          <div className="text-muted small">Preview</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-muted">No tracks uploaded yet.</div>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col md={4}>
            <Card className="mb-3">
              <Card.Body>
                <h6>Ratings & Reviews</h6>
                <RatingsList artistId={artist.id} refreshKey={ratingsKey} />
              </Card.Body>
            </Card>

            <Card className="mb-3">
              <Card.Body>
                <h6 className="mb-2">Leave a rating</h6>
                <RatingsForm artistId={artist.id} onSubmitted={(resp) => {
                  // optimistic: bump ratings list and update artist avg if provided
                  setRatingsKey(k => k + 1);
                  if (resp?.avg_rating !== undefined) {
                    setArtist(prev => prev ? ({ ...prev, avg_rating: resp.avg_rating, total_reviews: resp.total_reviews }) : prev);
                  }
                }} />
              </Card.Body>
            </Card>

            {/* Small artist meta card */}
            <Card>
              <Card.Body>
                <div className="small text-muted mb-2">Artist details</div>
                <div><strong>Location:</strong> {artist.district || 'Unspecified'}</div>
                <div><strong>Genres:</strong> {Array.isArray(artist.genres) ? artist.genres.join(', ') : (artist.genres || '—')}</div>
                <div><strong>Tracks:</strong> {tracks.length}</div>
                <div><strong>Followers:</strong> {artist.follower_count ?? '—'}</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}
