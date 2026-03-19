// File: src/pages/FanDashboard.js
import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
  useMemo
} from 'react';
import {
  Tabs,
  Tab,
  ListGroup,
  Alert,
  Image,
  Button,
  Card,
  Badge
} from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../api/axiosConfig';

import FavoriteArtists from '../components/FavoriteArtists';
import MyEvents from '../components/MyEvents';
import RecentlyUploaded from '../components/RecentlyUploaded';
import MyRatings from '../components/MyRatings';
import PlaylistsList from '../components/PlaylistsList';
import ToastMessage from '../components/ToastMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import { AuthContext } from '../context/AuthContext';

function useMediaQuery(query) {
  const getMatches = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const mediaQueryList = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);

    setMatches(mediaQueryList.matches);

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', onChange);
      return () => mediaQueryList.removeEventListener('change', onChange);
    }

    mediaQueryList.addListener(onChange);
    return () => mediaQueryList.removeListener(onChange);
  }, [query]);

  return matches;
}

export default function FanDashboard() {
  const navigate = useNavigate();
  const { user, artist: myArtist } = useContext(AuthContext);
  const location = useLocation();

  const [recentTracks, setRecentTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('favorites');

  // single-play controller
  const playingRef = useRef(null);

  // toast state
  const [toast, setToast] = useState({
    show: false,
    message: '',
    variant: 'success',
    delay: 3500,
    autohide: true
  });

  const isMobile = useMediaQuery('(max-width: 575.98px)');

  const resolveToBackend = useCallback((raw) => {
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;

    const base =
      (axios && axios.defaults && axios.defaults.baseURL) ||
      process.env.REACT_APP_API_URL ||
      window.location.origin;

    const rel = raw.startsWith('/') ? raw : `/${raw}`;
    return `${String(base).replace(/\/$/, '')}${rel}`;
  }, []);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const listensRes = await axios.get('/fan/listens').catch(() => ({ data: [] }));
      const listens = Array.isArray(listensRes.data) ? listensRes.data : [];

      const map = new Map();

      for (const l of listens) {
        const track = l.track || {};
        const artist = l.artist || {};

        const key = track.id
          ? `id:${track.id}`
          : `t:${(track.title || '').slice(0, 100)}|a:${artist.id || ''}`;

        const artworkRaw = track.artwork_url || track.artworkUrl || null;
        const previewRaw = track.preview_url || track.previewUrl || null;
        const playedAt = l.played_at ? new Date(l.played_at).toISOString() : null;

        const existing = map.get(key);

        if (!existing) {
          map.set(key, {
            id: track.id || null,
            listen_id: l.listen_id || null,
            title:
              track.title ||
              (artist.display_name ? `${artist.display_name} — unknown track` : 'Unknown track'),
            preview_url: previewRaw ? resolveToBackend(previewRaw) : null,
            artwork_url: artworkRaw ? resolveToBackend(artworkRaw) : null,
            duration: track.duration ?? null,
            artist_name: artist.display_name || null,
            artist_id: artist.id || null,
            played_at: playedAt,
            plays: 1
          });
        } else {
          existing.plays += 1;
          if (playedAt && (!existing.played_at || new Date(playedAt) > new Date(existing.played_at))) {
            existing.played_at = playedAt;
          }
        }
      }

      const uniqueTracks = Array.from(map.values()).sort((a, b) => {
        const ta = a.played_at ? new Date(a.played_at).getTime() : 0;
        const tb = b.played_at ? new Date(b.played_at).getTime() : 0;
        return tb - ta;
      });

      setRecentTracks(uniqueTracks);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [resolveToBackend]);

  useEffect(() => {
    const stateTab = location.state && location.state.tab ? String(location.state.tab) : '';
    const params = new URLSearchParams(location.search);
    const searchTab = params.get('tab') || '';
    const saved = localStorage.getItem('fanDashboard.activeTab');

    const initial = stateTab || searchTab || saved || 'favorites';
    const allowed = ['favorites', 'recent', 'new', 'events', 'ratings', 'playlists'];

    setActiveTab(allowed.includes(initial) ? initial : 'favorites');
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDashboardData, location.search, location.state]);

  const persistTab = useCallback((tabKey) => {
    try {
      localStorage.setItem('fanDashboard.activeTab', tabKey);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabKey);
      window.history.replaceState(null, '', url.toString());
    } catch {
      // non-fatal
    }
  }, []);

  const handleTabSelect = (k) => {
    if (!k) return;
    setActiveTab(k);
    persistTab(k);
  };

  // audio play management (single-play)
  const handlePlay = (audioEl) => {
    if (!audioEl) return;
    if (playingRef.current && playingRef.current !== audioEl) {
      try {
        playingRef.current.pause();
      } catch {
        // ignore
      }
    }
    playingRef.current = audioEl;
  };

  const clearPlayingRef = (audioEl) => {
    if (!audioEl || playingRef.current === audioEl) {
      playingRef.current = null;
    }
  };

  const handleRecordPlay = async (track) => {
    if (!user || !user.id || !track) return;

    // Skip recording if current user is the artist owner of the track
    if (myArtist && track.artist_id && Number(myArtist.id) === Number(track.artist_id)) {
      return;
    }

    try {
      await axios.post('/fan/listens', {
        track_id: track.id,
        artist_id: track.artist_id || null
      });
    } catch {
      console.warn('Could not record play');
    }
  };

  useEffect(() => {
    return () => {
      try {
        if (playingRef.current) playingRef.current.pause();
      } catch {
        // ignore
      }
      playingRef.current = null;
    };
  }, []);

  const recentCount = useMemo(() => recentTracks.length, [recentTracks]);

  const RecentTrackDesktopItem = ({ t, i }) => (
    <ListGroup.Item
      key={`${t.id || 'noid'}-${i}`}
      className="d-flex justify-content-between align-items-center recent-list-item"
    >
      <div className="d-flex align-items-center" style={{ flex: 1, minWidth: 0 }}>
        {t.artwork_url ? (
          <Image
            src={t.artwork_url}
            rounded
            className="recent-track-art"
            alt={`${t.title} artwork`}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = resolveToBackend('/defaults/track-art.png');
            }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              background: '#eee',
              borderRadius: 6,
              marginRight: 12,
              flex: '0 0 auto'
            }}
          />
        )}

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {t.title}
          </div>
          <div
            className="small text-muted"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {t.artist_name || '-'}
          </div>

          {t.preview_url && (
            <div className="mt-2">
              <audio
                controls
                controlsList="nodownload"
                preload="none"
                className="recent-audio-control"
                src={t.preview_url}
                onPlay={(e) => {
                  handlePlay(e.target);
                  handleRecordPlay(t);
                }}
                onPause={(e) => clearPlayingRef(e.target)}
                onEnded={(e) => clearPlayingRef(e.target)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="small text-muted ms-3" style={{ whiteSpace: 'nowrap' }}>
        {t.duration ? `${t.duration}s` : '-'}
      </div>
    </ListGroup.Item>
  );

  const RecentTrackMobileCard = ({ t, i }) => (
    <Card key={`${t.id || 'noid'}-${i}`} className="shadow-sm border-0 mb-3 recent-track-card">
      <Card.Body className="p-3">
        <div className="d-flex align-items-start gap-3">
          {t.artwork_url ? (
            <Image
              src={t.artwork_url}
              rounded
              className="recent-track-art recent-track-art-mobile"
              alt={`${t.title} artwork`}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = resolveToBackend('/defaults/track-art.png');
              }}
            />
          ) : (
            <div
              className="recent-track-art-mobile"
              style={{
                width: 52,
                height: 52,
                background: '#eee',
                borderRadius: 8,
                flex: '0 0 auto'
              }}
            />
          )}

          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div
              className="fw-semibold"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {t.title}
            </div>
            <div className="small text-muted mb-2">
              {t.artist_name || '-'}
            </div>

            <div className="d-flex align-items-center justify-content-between mb-2">
              <Badge bg="secondary" className="text-truncate">
                {t.duration ? `${t.duration}s` : 'No duration'}
              </Badge>
              <div className="small text-muted ms-2">
                {t.plays > 1 ? `${t.plays} plays` : '1 play'}
              </div>
            </div>

            {t.preview_url && (
              <audio
                controls
                controlsList="nodownload"
                preload="none"
                className="w-100 recent-audio-control recent-audio-control-mobile"
                src={t.preview_url}
                onPlay={(e) => {
                  handlePlay(e.target);
                  handleRecordPlay(t);
                }}
                onPause={(e) => clearPlayingRef(e.target)}
                onEnded={(e) => clearPlayingRef(e.target)}
              />
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );

  if (loading) {
    return (
      <div className="text-center py-5">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <div>
      <ToastMessage
        show={toast.show}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
        message={toast.message}
        variant={toast.variant}
        delay={toast.delay}
        position="top-end"
        autohide={toast.autohide}
      />

      <style>{`
        .recent-track-art {
          width: 48px;
          height: 48px;
          object-fit: cover;
          border-radius: 6px;
          margin-right: 12px;
        }

        .recent-audio-control {
          width: min(220px, 100%);
        }

        .fan-tabs .nav-link {
          white-space: nowrap;
        }

        @media (max-width: 575.98px) {
          .recent-track-art {
            width: 52px;
            height: 52px;
            margin-right: 0;
          }

          .recent-audio-control-mobile {
            max-width: 100% !important;
          }

          .fan-header {
            flex-direction: column;
            align-items: stretch !important;
          }

          .fan-header-actions {
            width: 100%;
          }

          .fan-header-actions .btn {
            width: 100%;
          }

          .fan-tabs .nav-link {
            padding: .45rem .7rem;
            font-size: .9rem;
            border-radius: 999px;
          }

          .fan-tabs .nav {
            gap: .35rem;
          }
        }

        @media (min-width: 576px) {
          .fan-header-actions {
            margin-left: auto;
          }
        }
      `}</style>

      <div className="d-flex justify-content-between align-items-center gap-3 mb-3 fan-header">
        <div>
          <h2 className="mb-0">Fan Dashboard</h2>
          <div className="text-muted small">Your recent plays, favourites and playlists</div>
        </div>

        <div className="d-flex align-items-center gap-2 fan-header-actions">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => navigate('/')}
            className="w-100 w-sm-auto"
          >
            Back to Home
          </Button>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onSelect={handleTabSelect}
        mountOnEnter
        variant={isMobile ? 'pills' : undefined}
        fill={isMobile}
        justify={isMobile}
        className="mb-3 fan-tabs"
      >
        <Tab eventKey="favorites" title="Favorite Artists">
          <div className="mt-3">
            <FavoriteArtists max={12} />
          </div>
        </Tab>

        <Tab
          eventKey="recent"
          title={
            <span>
              Recently Played{' '}
              <Badge bg="secondary" className="ms-2">
                {recentCount}
              </Badge>
            </span>
          }
        >
          <div className="mt-3">
            {recentTracks.length > 0 ? (
              <>
                <div className="d-none d-md-block">
                  <ListGroup>
                    {recentTracks.slice(0, 12).map((t, i) => (
                      <RecentTrackDesktopItem key={`${t.id || 'noid'}-${i}`} t={t} i={i} />
                    ))}
                  </ListGroup>
                </div>

                <div className="d-md-none">
                  {recentTracks.slice(0, 12).map((t, i) => (
                    <RecentTrackMobileCard key={`${t.id || 'noid'}-${i}`} t={t} i={i} />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted">No recently played tracks.</p>
            )}
          </div>
        </Tab>

        <Tab eventKey="new" title="New Releases">
          <div className="mt-3">
            <RecentlyUploaded limit={16} onRecordPlay={handleRecordPlay} />
          </div>
        </Tab>

        <Tab eventKey="events" title="My Events">
          <div className="mt-3">
            <MyEvents />
          </div>
        </Tab>

        <Tab eventKey="ratings" title="My Ratings">
          <div className="mt-3">
            <MyRatings />
          </div>
        </Tab>

        <Tab eventKey="playlists" title="Playlists">
          <div className="mt-3">
            <PlaylistsList />
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}