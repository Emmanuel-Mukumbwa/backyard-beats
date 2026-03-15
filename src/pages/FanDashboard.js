// src/pages/FanDashboard.jsx
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Tabs, Tab, ListGroup, Alert, Image } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
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
  const { user, artist: myArtist } = useContext(AuthContext);
  const location = useLocation();

  const [recentTracks, setRecentTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('favorites');

  // single-play controller
  const playingRef = useRef(null);

  const [toast, setToast] = useState({
    show: false,
    message: '',
    variant: 'success',
    delay: 3500
  });

  // resolve uploads
  const resolveToBackend = useCallback((raw) => {
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;

    const base =
      (axios && axios.defaults && axios.defaults.baseURL) ||
      process.env.REACT_APP_API_URL ||
      window.location.origin;

    const rel = raw.startsWith('/') ? raw : `/${raw}`;
    return `${base.replace(/\/$/, '')}${rel}`;
  }, []);

  // load dashboard data (memoized so it can be used in useEffect deps)
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

  // INITIAL LOAD
  useEffect(() => {
    const stateTab = location.state && location.state.tab ? String(location.state.tab) : '';
    const params = new URLSearchParams(location.search);
    const searchTab = params.get('tab') || '';
    const saved = localStorage.getItem('fanDashboard.activeTab');

    const initial = stateTab || searchTab || saved || 'favorites';

    const allowed = ['favorites', 'recent', 'new', 'events', 'ratings', 'playlists'];

    setActiveTab(allowed.includes(initial) ? initial : 'favorites');

    loadDashboardData();
    // run again when location.search/state or the loader changes
  }, [loadDashboardData, location.search, location.state]);

  // Persist tab
  function persistTab(tabKey) {
    try {
      localStorage.setItem('fanDashboard.activeTab', tabKey);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabKey);
      window.history.replaceState(null, '', url.toString());
    } catch (e) {
      console.warn(e);
    }
  }

  const handleTabSelect = (k) => {
    if (!k) return;
    setActiveTab(k);
    persistTab(k);
  };

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
    // require logged-in user
    if (!user || !user.id || !track) return;

    // Skip recording if current user is the artist owner of the track
    // (client-side guard; server should also enforce rules)
    if (myArtist && track.artist_id && Number(myArtist.id) === Number(track.artist_id)) {
      return;
    }

    try {
      await axios.post('/fan/listens', {
        track_id: track.id,
        artist_id: track.artist_id || null
      });
      // refresh dashboard listens
      await loadDashboardData();
    } catch {
      // non-blocking; just warn
      console.warn('Could not record play');
    }
  };

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
      />

      <h2 className="mb-4">Fan Dashboard</h2>

      <Tabs activeKey={activeTab} onSelect={handleTabSelect} mountOnEnter unmountOnExit>
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
                  <ListGroup.Item key={`${t.id}-${i}`}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center">
                        {t.artwork_url ? (
                          <Image
                            src={t.artwork_url}
                            rounded
                            style={{
                              width: 48,
                              height: 48,
                              objectFit: 'cover',
                              marginRight: 12
                            }}
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

                        <div>
                          <strong>{t.title}</strong>
                          <div className="small text-muted">{t.artist_name}</div>

                          {t.preview_url && (
                            <audio
                              controls
                              controlsList="nodownload"
                              preload="none"
                              style={{ width: 220 }}
                              src={t.preview_url}
                              onPlay={(e) => {
                                handlePlay(e.target);
                                handleRecordPlay(t);
                              }}
                              onPause={(e) => handlePause(e.target)}
                              onEnded={() => handlePause(null)}
                            />
                          )}
                        </div>
                      </div>

                      <div className="small text-muted">{t.duration ? `${t.duration}s` : '-'}</div>
                    </div>
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
    </div>
  );
}