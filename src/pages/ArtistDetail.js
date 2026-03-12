// src/pages/ArtistDetail.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from '../api/axiosConfig';
import ArtistHeader from '../components/artist/ArtistHeader';
import TracksPanel from '../components/artist/Tracks';
import EventsPanel from '../components/artist/Events';
import RatingsPanel from '../components/artist/RatingsPanel';
import ArtistSidebar from '../components/artist/ArtistSidebar';
import { AuthContext } from '../context/AuthContext';
import { Row, Col, Card, Button, Alert } from 'react-bootstrap';

import ToastMessage from '../components/ToastMessage';
import LoadingSpinner from '../components/LoadingSpinner';

/* Helper utilities (kept inside the file for clarity) */
const normBool = (v) => (v === true || v === 1 || v === '1' || v === 'true') ? true : false;
const hasValue = (v) => v !== null && typeof v !== 'undefined' && String(v) !== '';

// backend base for resolving relative upload paths
const getBackendBase = (axiosInstance) => {
  try { return (axiosInstance && axiosInstance.defaults && axiosInstance.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:3001'; }
  catch { return process.env.REACT_APP_API_URL || 'http://localhost:3001'; }
};
const resolveToBackendFactory = (axiosInstance) => {
  const backendBase = getBackendBase(axiosInstance).replace(/\/$/, '');
  return (raw) => {
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `${backendBase}${raw}`;
    if (raw.startsWith('uploads/')) return `${backendBase}/${raw}`;
    return `${backendBase}/uploads/${raw}`;
  };
};

export default function ArtistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [following, setFollowing] = useState(null);
  const [processingFollow, setProcessingFollow] = useState(false);
  const [ratingsKey, setRatingsKey] = useState(0);

  // toast state
  const [toast, setToast] = useState({
    show: false,
    message: '',
    variant: 'success',
    title: null,
    position: 'top-end',
    delay: 4000
  });
  const showToast = ({ message = '', variant = 'success', title = null, position = 'top-end', delay = 4000 }) => {
    setToast({ show: true, message: String(message), variant, title, position, delay });
  };
  const closeToast = () => setToast(prev => ({ ...prev, show: false }));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    axios.get(`/artists/${id}`)
      .then(res => {
        if (cancelled) return;
        const payload = res.data && res.data.artist ? res.data.artist : res.data;
        if (!payload) { setArtist(null); return; }

        const a = { ...payload };

        // normalize arrays stored as JSON/string
        if (a.genres && typeof a.genres === 'string') {
          try { a.genres = JSON.parse(a.genres); } catch { a.genres = a.genres.split(',').map(s => s.trim()); }
        }
        if (a.moods && typeof a.moods === 'string') {
          try { a.moods = JSON.parse(a.moods); } catch { a.moods = a.moods.split(',').map(s => s.trim()); }
        }

        // normalize booleans
        a.is_approved = normBool(a.is_approved);
        a.is_rejected = normBool(a.is_rejected);
        a.artist_is_approved = normBool(a.artist_is_approved || a.is_approved);
        a.artist_is_rejected = normBool(a.artist_is_rejected || a.is_rejected);

        // ensure nested user object exists
        if (!a.user && (a.username || a.user_id || a.user_id === 0)) {
          a.user = {
            id: a.user_id || null,
            username: a.username || null,
            created_at: a.user_created_at || a.user_created_at || null,
            banned: normBool(a.user_banned || a.banned),
            deleted_at: a.user_deleted_at || null,
            district: a.user_district || a.user_district_name || null
          };
        } else {
          // if we have user_created_at separate, ensure it's accessible
          if (a.user && !a.user.created_at && a.user_created_at) {
            a.user.created_at = a.user_created_at;
          }
        }

        setArtist(a);
      })
      .catch(err => {
        console.error('Artist load error:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load artist');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  // check following status
  useEffect(() => {
    let cancelled = false;
    async function checkFollowing() {
      if (!artist) return;
      try {
        if (!user || !user.id) { setFollowing(false); return; }
        // if viewer is artist owner -> not following concept
        if (artist.user && Number(artist.user.id) === Number(user.id)) { setFollowing(false); return; }
        const res = await axios.get(`/favorites/check/${artist.id}`);
        if (!cancelled) setFollowing(Boolean(res.data && res.data.following));
      } catch (err) {
        if (!cancelled) setFollowing(false);
      }
    }
    checkFollowing();
    return () => { cancelled = true; };
  }, [artist, user]);

  const computeArtistStatus = (a) => {
    if (!a) return 'unknown';
    if (a.user && (a.user.deleted_at || a.user_deleted_at)) return 'deleted';
    if (a.user && (a.user.banned || a.user_banned)) return 'banned';
    if (a.is_rejected || a.artist_is_rejected || a.status === 'rejected') return 'rejected';
    if (a.is_approved || a.artist_is_approved || a.status === 'approved' || hasValue(a.approved_at)) return 'approved';
    return 'pending';
  };
  const status = computeArtistStatus(artist);

  function fmtDuration(sec) {
    if (!sec && sec !== 0) return '—';
    const s = Number(sec) || 0;
    const mm = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${mm}:${String(ss).padStart(2, '0')}`;
  }

  // token reuse helper
  function getStoredToken() {
    const keys = ['token', 'accessToken', 'authToken', 'auth', 'app_token'];
    for (let k of keys) {
      const v = localStorage.getItem(k);
      if (!v) continue;
      if (v.startsWith('eyJ') || v.split('.').length === 3) return v;
      if (v.startsWith('Bearer ')) return v.substring(7);
      try {
        const parsed = JSON.parse(v);
        if (parsed) {
          if (parsed.token) return parsed.token;
          if (parsed.accessToken) return parsed.accessToken;
          if (parsed.authToken) return parsed.authToken;
          const firstStr = Object.values(parsed).find(x => typeof x === 'string' && (x.startsWith('eyJ') || x.split?.('.').length === 3));
          if (firstStr) return firstStr;
        }
      } catch (e) {}
      return v;
    }
    return null;
  }

  async function downloadTrack(trackId) {
    try {
      const token = getStoredToken();
      const headers = {};
      if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const res = await axios.get(`/tracks/${trackId}/download`, {
        responseType: 'blob',
        headers
      });

      const disposition = res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition']);
      let filename = 'track.mp3';
      if (disposition) {
        const m = disposition.match(/filename="(.+)"/);
        if (m && m[1]) filename = m[1];
      }

      const blob = res.data;
      const blobType = blob.type || '';
      if (blobType.includes('application/json')) {
        const txt = await blob.text();
        let parsed;
        try { parsed = JSON.parse(txt); } catch { parsed = txt; }
        showToast({ message: `Download failed: ${JSON.stringify(parsed)}`, variant: 'danger', title: 'Download' });
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showToast({ message: 'Download started', variant: 'success' });
    } catch (err) {
      let message = err.message;
      try {
        if (err.response && err.response.data) {
          const data = err.response.data;
          if (data instanceof Blob) {
            const txt = await data.text();
            try {
              const parsed = JSON.parse(txt);
              message = parsed.error || JSON.stringify(parsed);
            } catch (e) { message = txt; }
          } else if (typeof data === 'object') {
            message = data.error || JSON.stringify(data);
          } else {
            message = String(data);
          }
        }
      } catch (e2) {}
      showToast({ message: `Download failed: ${message}`, variant: 'danger', title: 'Download' });
    }
  }

  const resolveToBackend = resolveToBackendFactory(axios);

  // follow / unfollow with owner guard
  const handleFollowClick = async () => {
    if (!user || !user.id) { window.location.href = '/login'; return; }
    // extra guard: if viewer is artist owner, do not allow follow
    if (artist?.user && Number(artist.user.id) === Number(user.id)) {
      showToast({ message: "You cannot follow your own artist profile.", variant: 'warning' });
      return;
    }

    const isCurrentlyFollowing = !!following;
    setProcessingFollow(true);
    setFollowing(!isCurrentlyFollowing);

    if (typeof artist?.follower_count === 'number') {
      setArtist(prev => prev ? ({ ...prev, follower_count: isCurrentlyFollowing ? Math.max(0, prev.follower_count - 1) : (prev.follower_count || 0) + 1 }) : prev);
    }

    try {
      if (isCurrentlyFollowing) {
        await axios.delete(`/favorites/${artist.id}`);
        showToast({ message: 'Unfollowed', variant: 'warning' });
      } else {
        await axios.post('/favorites', { artist_id: artist.id });
        showToast({ message: 'Following', variant: 'success' });
      }
    } catch (err) {
      setFollowing(isCurrentlyFollowing);
      if (typeof artist?.follower_count === 'number') {
        setArtist(prev => prev ? ({ ...prev, follower_count: isCurrentlyFollowing ? (prev.follower_count || 0) + 1 : Math.max(0, (prev.follower_count || 1) - 1) }) : prev);
      }
      const msg = err.response?.data?.error || err.message || 'Action failed';
      showToast({ message: msg, variant: 'danger', title: 'Error' });
    } finally {
      setProcessingFollow(false);
    }
  };

  if (loading) return <div className="text-center py-5"><LoadingSpinner size="lg" /></div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!artist) return <div className="alert alert-warning">Artist not found</div>;

  const genres = Array.isArray(artist.genres) ? artist.genres.map(g => typeof g === 'object' ? g.name || String(g.id) : String(g)) : (artist.genres ? (typeof artist.genres === 'string' ? [artist.genres] : [String(artist.genres)]) : []);
  const moods = Array.isArray(artist.moods) ? artist.moods.map(m => typeof m === 'object' ? m.name || String(m.id) : String(m)) : (artist.moods ? (typeof artist.moods === 'string' ? [artist.moods] : [String(artist.moods)]) : []);
  const tracks = Array.isArray(artist.tracks) ? artist.tracks : (artist.tracks_list || artist.tracks || []);
  const events = Array.isArray(artist.events) ? artist.events : (artist.artist_events || artist.events_list || []);
  const followerCount = (typeof artist.follower_count === 'number') ? artist.follower_count : (typeof artist.followers_count === 'number' ? artist.followers_count : (typeof artist.followers === 'number' ? artist.followers : null));
  const events_count = typeof artist.events_count === 'number' ? artist.events_count : (events ? events.length : 0);
  const tracks_count = typeof artist.tracks_count === 'number' ? artist.tracks_count : (tracks ? tracks.length : 0);

  const isOwner = artist?.user && user && Number(artist.user.id) === Number(user.id);

  // COVER and avatar resolution (same as before; fallback to ui-avatars)
  const coverRaw = artist.cover_url || artist.cover || null;
  const coverSrc = coverRaw ? resolveToBackend(coverRaw) : `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.displayName || artist.display_name || artist.username || 'Artist')}&background=eeeeee&color=333&size=1200`;
  const avatarRaw = artist.photo_url || artist.photo || null;
  const avatarSrc = avatarRaw ? resolveToBackend(avatarRaw) : `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.displayName || artist.display_name || artist.username || 'Artist')}&background=0D8ABC&color=fff&size=512`;

  return (
    <div className="artist-detail-page">
      <div style={{ marginBottom: 12 }}>
        {status === 'pending' && <Alert variant="warning">This profile is pending verification — content may be private until approval.</Alert>}
        {status === 'rejected' && (
          <Alert variant="danger">
            This profile was rejected.
            {artist.rejection_reason ? <> Reason: <em>{artist.rejection_reason}</em>.</> : null}
            <div className="mt-2">
              <a href="/support" target="_blank" rel="noreferrer">Appeal / Contact support</a>
            </div>
          </Alert>
        )}
        {status === 'banned' && <Alert variant="danger">This account has been banned. Contact support if you believe this is an error.</Alert>}
        {status === 'deleted' && <Alert variant="secondary">This account has been deleted.</Alert>}
      </div>

      <div style={{ marginBottom: 24, position: 'relative' }}>
        <div style={{
          height: 220,
          width: '100%',
          overflow: 'hidden',
          background: '#f4f4f4',
          borderRadius: 6,
        }}>
          <img src={coverSrc} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
               onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = coverSrc; }} loading="lazy" />
        </div>

        <div style={{ position: 'absolute', left: 20, bottom: -48, display: 'flex', alignItems: 'center' }}>
          <img src={avatarSrc} alt="avatar" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: '50%', border: '4px solid white', boxShadow: '0 6px 18px rgba(0,0,0,0.12)' }} loading="lazy" />
        </div>
      </div>

      <div style={{ paddingTop: 56 }}>
        <Row>
          <Col md={8}>
            <Card className="mb-3">
              <Card.Body>
                <ArtistHeader
                  artist={artist}
                  genres={genres}
                  moods={moods}
                  isOwner={isOwner}
                  following={following}
                  processingFollow={processingFollow}
                  onFollowClick={handleFollowClick}
                  followerCount={followerCount}
                />
                {/* follow messages moved to toasts */}
              </Card.Body>
            </Card>

            <Card className="mb-3">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h5 className="mb-0">Tracks</h5>
                  <div className="small text-muted">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</div>
                </div>

                {status !== 'approved' && (
                  <div className="alert alert-warning">
                    Tracks are private until the artist profile is approved. They are visible only to you.
                    {status === 'rejected' && <div className="mt-2"><a href="/support">Appeal / Contact support</a></div>}
                  </div>
                )}

                <TracksPanel tracks={tracks} resolveToBackend={resolveToBackend} fmtDuration={fmtDuration} onDownload={downloadTrack} />
              </Card.Body>
            </Card>

            <Card className="mb-3">
              <Card.Body>
                <EventsPanel events={events} />
              </Card.Body>
            </Card>
          </Col>

          <Col md={4}>
            <Card className="mb-3">
              <Card.Body>
                <RatingsPanel
                  artistId={artist.id}
                  onRatingSubmitted={(resp) => {
                    setRatingsKey(k => k + 1);
                    if (resp?.avg_rating !== undefined) {
                      setArtist(prev => prev ? ({ ...prev, avg_rating: resp.avg_rating, total_reviews: resp.total_reviews }) : prev);
                    }
                  }}
                />
              </Card.Body>
            </Card>

            <div className="mb-3">
              <ArtistSidebar
                artist={artist}
                events_count={events_count}
                tracks_count={tracks_count}
                followerCount={followerCount}
                isOwner={isOwner}
                onEdit={() => navigate('/onboard')}
              />
            </div>
          </Col>
        </Row>
      </div>

      {/* page-level toast */}
      <ToastMessage
        show={toast.show}
        onClose={closeToast}
        message={toast.message}
        variant={toast.variant}
        title={toast.title}
        position={toast.position}
        delay={toast.delay}
      />
    </div>
  );
}