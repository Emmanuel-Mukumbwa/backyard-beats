// File: src/pages/FanDashboard.js
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Tabs, Tab, ListGroup, Alert, Image, Button } from 'react-bootstrap';
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

  // toast state + timer ref
  const [toast, setToast] = useState({
    show: false,
    message: '',
    variant: 'success',
    delay: 3500,
    autohide: true,
  });
  const tabHideTimerRef = useRef(null);

  // responsive: switch to pills on small screens (≤576px)
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 576 : false));

  // resolve uploads (robust, similar to ArtistDashboard)
  const resolveToBackend = useCallback((raw) => {
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;

    const base =
      (axios && axios.defaults && axios.defaults.baseURL) ||
      process.env.REACT_APP_API_URL ||
      window.location.origin;

    // ensure leading slash then join
    const rel = raw.startsWith('/') ? raw : `/${raw}`;
    return `${String(base).replace(/\/$/, '')}${rel}`;
  }, []);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 576);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showToast = (message, variant = 'success', delay = 3500, autohide = true) => {
    if (tabHideTimerRef.current) clearTimeout(tabHideTimerRef.current);
    setToast({ show: true, message, variant, delay, autohide });
    if (autohide) {
      tabHideTimerRef.current = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, delay + 200);
    }
  };

  // load dashboard data (memoized)
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

  // INITIAL LOAD & tab bootstrapping (persist to URL + localStorage)
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

  // Persist tab helper
  const persistTab = useCallback((tabKey) => {
    try {
      localStorage.setItem('fanDashboard.activeTab', tabKey);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabKey);
      window.history.replaceState(null, '', url.toString());
    } catch (e) {
      // non-fatal
    }
  }, []);

  const handleTabSelect = (k) => {
    if (!k) return;
    setActiveTab(k);
    persistTab(k);
  };

  // audio play management (single-play)
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
      // Do NOT refresh the dashboard – it would interrupt playback
    } catch {
      console.warn('Could not record play');
    }
  };

  // cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (tabHideTimerRef.current) clearTimeout(tabHideTimerRef.current);
      // pause any playing audio
      try {
        if (playingRef.current) playingRef.current.pause();
      } catch {}
    };
  }, []);

  if (loading)
    return (
      <div className="text-center py-5">
        <LoadingSpinner size="lg" />
      </div>
    );

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
        /* Responsive tweaks for Fan Dashboard */
        .recent-track-art {
          width: 48px;
          height: 48px;
          object-fit: cover;
          border-radius: 6px;
          margin-right: 12px;
        }

        @media (max-width: 575.98px) {
          .recent-track-art { width: 44px; height: 44px; margin-right: 10px; }
          .recent-audio-control { width: 100% !important; max-width: 100% !important; }
          .recent-list-item { padding-left: 8px; padding-right: 8px; }
        }

        /* audio control width: limit to 220px on wide screens, but responsive */
        .recent-audio-control { width: min(220px, 100%); }
        
        /* Mobile FAB */
        .fan-fab {
          position: fixed;
          right: 16px;
          bottom: 20px;
          z-index: 1060;
          display: none;
        }
        @media (max-width: 767.98px) {
          .fan-fab { display: block; }
        }

        /* when we render nav-pills on mobile make them a little more compact */
        @media (max-width: 576px) {
          .nav-pills .nav-link {
            padding: .35rem .6rem;
            font-size: .92rem;
            border-radius: 999px;
          }
        }
      `}</style>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-0">Fan Dashboard</h2>
          <div className="text-muted small">Your recent plays, favourites and playlists</div>
        </div>

        <div className="d-flex align-items-center">
          <Button variant="outline-secondary" size="sm" onClick={() => navigate('/')} className="me-2">
            Back to Home
          </Button>
          <Button variant="primary" size="sm" onClick={() => showToast('Feature coming soon: shuffle across recent plays', 'info', 2500)}>
            Shuffle
          </Button>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onSelect={handleTabSelect}
        mountOnEnter
        unmountOnExit
        variant={isMobile ? 'pills' : undefined}
        fill={isMobile}
        justify={isMobile}
        className="mb-3"
      >
        <Tab eventKey="favorites" title="Favorite Artists">
          <div className="mt-3">
            <FavoriteArtists max={12} />
          </div>
        </Tab>

        <Tab eventKey="recent" title="Recently Played">
          <div className="mt-3">
            {recentTracks.length > 0 ? (
              <ListGroup>
                {recentTracks.slice(0, 12).map((t, i) => (
                  <ListGroup.Item key={`${t.id || 'noid'}-${i}`} className="d-flex justify-content-between align-items-center recent-list-item">
                    <div className="d-flex align-items-center" style={{ flex: 1, minWidth: 0 }}>
                      {t.artwork_url ? (
                        <Image
                          src={t.artwork_url}
                          rounded
                          className="recent-track-art"
                          alt={`${t.title} artwork`}
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = resolveToBackend('/defaults/track-art.png'); }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            background: '#eee',
                            borderRadius: 6,
                            marginRight: 12
                          }}
                        />
                      )}

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                        <div className="small text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artist_name || '-'}</div>

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
                              onPause={(e) => handlePause(e.target)}
                              onEnded={() => handlePause(null)}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="small text-muted ms-3" style={{ whiteSpace: 'nowrap' }}>{t.duration ? `${t.duration}s` : '-'}</div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            ) : (
              <p>No recently played tracks.</p>
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

      {/* Mobile FAB quick action - opens Recently Played */}
      <div className="fan-fab">
        <Button
          variant="success"
          className="rounded-circle shadow-lg"
          style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => {
            setActiveTab('recent');
            persistTab('recent');
          }}
          aria-label="Open recently played"
          title="Recently played"
        >
          ▶
        </Button>
      </div>
    </div>
  );
}