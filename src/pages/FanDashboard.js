// src/pages/FanDashboard.jsx
import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  Tabs,
  Tab,
  Button,
  ListGroup,
  Alert,
  Modal,
  Form
} from 'react-bootstrap';
import axios from '../api/axiosConfig';
import FavoriteArtists from '../components/FavoriteArtists';
import MyEvents from '../components/MyEvents';
import { AuthContext } from '../context/AuthContext';
import AudioPlayer from '../components/AudioPlayer';
import RecentlyUploaded from '../components/RecentlyUploaded';
import MyRatings from '../components/MyRatings';
import PlaylistsList from '../components/PlaylistsList';
import ToastMessage from '../components/ToastMessage';
import LoadingSpinner from '../components/LoadingSpinner';

export default function FanDashboard() {
  const { user } = useContext(AuthContext);
  // removed unused favorites, rsvpEvents, ratings to satisfy ESLint
  const [recentTracks, setRecentTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals and forms
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlistForm, setPlaylistForm] = useState({ name: '', description: '' });

  // controlled tabs: persist across refresh (hash -> localStorage fallback)
  const [activeTab, setActiveTab] = useState('favorites');
  const toastTimerRef = useRef(null);

  // toast state
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success', delay: 3500 });

  useEffect(() => {
    // initialize active tab from URL hash or localStorage
    const hashKey = (window.location.hash || '').replace('#', '');
    const saved = localStorage.getItem('fanDashboard.activeTab');
    const initial = hashKey || saved || 'favorites';
    const allowed = ['favorites', 'recent', 'new', 'events', 'ratings', 'playlists'];
    setActiveTab(allowed.includes(initial) ? initial : 'favorites');

    // load data
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist tab function
  const persistTab = (tabKey) => {
    try {
      localStorage.setItem('fanDashboard.activeTab', tabKey);
      const url = new URL(window.location.href);
      url.hash = `#${tabKey}`;
      window.history.replaceState(null, '', url.toString());
    } catch (e) {
      // ignore storage/url errors
      // eslint-disable-next-line no-console
      console.debug('persistTab error', e);
    }
  };

  const handleTabSelect = (k) => {
    if (!k) return;
    setActiveTab(k);
    persistTab(k);
  };

  async function loadDashboardData() {
    setLoading(true);
    setError(null);
    try {
      // favorites and other widgets load from separate endpoints (FavoriteArtists handles /favorites)
      // Fetch recent listens for this fan and other small widgets
      const [listensRes] = await Promise.all([
        axios.get('/fan/listens').catch(() => ({ data: [] })), // recent listens
        axios.get('/events').catch(() => ({ data: [] }))     // fallback events
      ]);

      // Map listens to AudioPlayer-friendly tracks array. API returns { listen_id, played_at, track: {...}, artist: {...} }
      const listens = Array.isArray(listensRes.data) ? listensRes.data : [];
      const mappedTracks = listens.map(l => ({
        listen_id: l.listen_id,
        id: l.track?.id || null,
        title: l.track?.title || (l.artist?.display_name ? `${l.artist.display_name} — unknown track` : 'Unknown track'),
        preview_url: l.track?.preview_url || null,
        duration: l.track?.duration || null,
        artwork_url: l.track?.artwork_url || null,
        artist_name: l.artist?.display_name || null,
        artist_id: l.artist?.id || null,
        played_at: l.played_at || null,
        genre: l.track?.genre || null
      }));

      setRecentTracks(mappedTracks);

      // For other parts of the dashboard keep your existing approach or replace with API calls
      // rsvpEvents/ratings were not used in UI, so we do not store them
      setPlaylists([]); // keep empty or fetch /fan/playlists if you implement them
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  // toast helpers
  const showSuccessToast = (message = 'Done', delay = 3500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, message, variant: 'success', delay });
    toastTimerRef.current = setTimeout(() => setToast(t => ({ ...t, show: false })), delay + 200);
  };

  const showErrorToast = (message = 'Error', delay = 5000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, message, variant: 'danger', delay });
    toastTimerRef.current = setTimeout(() => setToast(t => ({ ...t, show: false })), delay + 200);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // When AudioPlayer starts playing a track, we POST /fan/listens to record it.
  const handleRecordPlay = async (track) => {
    if (!user || !user.id) return;
    try {
      await axios.post('/fan/listens', {
        track_id: track.id || null,
        artist_id: track.artist_id || null
      });

      // refresh recent tracks to show the latest play at top (lightweight)
      const res = await axios.get('/fan/listens');
      const listens = Array.isArray(res.data) ? res.data : [];
      const mapped = listens.map(l => ({
        listen_id: l.listen_id,
        id: l.track?.id || null,
        title: l.track?.title || (l.artist?.display_name ? `${l.artist.display_name} — unknown track` : 'Unknown track'),
        preview_url: l.track?.preview_url || null,
        duration: l.track?.duration || null,
        artwork_url: l.track?.artwork_url || null,
        artist_name: l.artist?.display_name || null,
        artist_id: l.artist?.id || null,
        played_at: l.played_at || null,
        genre: l.track?.genre || null
      }));
      setRecentTracks(mapped);
    } catch (err) {
      console.warn('Could not record listen', err);
    }
  };

  const handlePlaylistSubmit = async (e) => {
    e.preventDefault();
    if (!playlistForm.name || playlistForm.name.trim().length === 0) {
      showErrorToast('Please provide a playlist name');
      return;
    }

    const newPlaylist = {
      id: Date.now(),
      name: playlistForm.name.trim(),
      description: playlistForm.description || '',
      tracks: []
    };
    setPlaylists(prev => [newPlaylist, ...prev]);
    setShowPlaylistModal(false);
    setPlaylistForm({ name: '', description: '' });

    showSuccessToast('Playlist created');
    setActiveTab('playlists');
    persistTab('playlists');
  };

  const deletePlaylist = (id) => {
    if (!window.confirm('Delete this playlist?')) return;
    setPlaylists(prev => prev.filter(p => p.id !== id));
    showSuccessToast('Playlist deleted');
  };

  if (loading) return <div className="text-center py-5"><LoadingSpinner size="lg" /></div>;
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
      <Tabs activeKey={activeTab} id="fan-dashboard-tabs" onSelect={handleTabSelect}>
        <Tab eventKey="favorites" title="Favorite Artists">
          <div className="mt-3">
            <h5>My Favorite Artists</h5>
            <FavoriteArtists max={12} />
          </div>
        </Tab>

        <Tab eventKey="recent" title="Recently Played">
          <div className="mt-3">
            <h5>Recently Played Tracks</h5>
            {recentTracks.length > 0 ? (
              <>
                <AudioPlayer tracks={recentTracks} onPlay={handleRecordPlay} />
                <ListGroup className="mt-3">
                  {recentTracks.slice(0, 12).map((t, i) => (
                    <ListGroup.Item key={`${t.listen_id || t.id}-${i}`}>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{t.title}</strong>
                          <div className="small text-muted">
                            {t.artist_name ? t.artist_name : ''} {t.played_at ? `• ${new Date(t.played_at).toLocaleString()}` : ''}
                          </div>
                        </div>
                        <div className="small text-muted">{t.duration ? `${t.duration}s` : '-'}</div>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </>
            ) : (
              <p>No recently played tracks.</p>
            )}
          </div>
        </Tab>

        <Tab eventKey="new" title="New Releases">
          <div className="mt-3">
            <RecentlyUploaded limit={16} onRecordPlay={async (track) => {
              if (!user || !user.id) return;
              try {
                await axios.post('/fan/listens', { track_id: track.id, artist_id: track.artist_id || null });
                const res = await axios.get('/fan/listens');
                const listens = Array.isArray(res.data) ? res.data : [];
                const mapped = listens.map(l => ({
                  listen_id: l.listen_id,
                  id: l.track?.id || null,
                  title: l.track?.title || (l.artist?.display_name ? `${l.artist.display_name} — unknown track` : 'Unknown track'),
                  preview_url: l.track?.preview_url || null,
                  duration: l.track?.duration || null,
                  artwork_url: l.track?.artwork_url || null,
                  artist_name: l.artist?.display_name || null,
                  artist_id: l.artist?.id || null,
                  played_at: l.played_at || null,
                  genre: l.track?.genre || null
                }));
                setRecentTracks(mapped);
              } catch (e) {
                console.warn('record play failed', e);
              }
            }} />
          </div>
        </Tab>

        <Tab eventKey="events" title="My Events">
          <div className="mt-3">
            <h5>My Events</h5>
            <MyEvents />
          </div>
        </Tab>

        <Tab eventKey="ratings" title="My Ratings">
          <div className="mt-3">
            <h5>My Rating History</h5>
            <MyRatings />
          </div>
        </Tab>

        <Tab eventKey="playlists" title="Playlists">
          <div className="mt-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5>Your Playlists</h5>
              <Button size="sm" onClick={() => setShowPlaylistModal(true)}>Create Playlist</Button>
            </div>
            <PlaylistsList playlists={playlists} onDelete={deletePlaylist} />
          </div>
        </Tab>
      </Tabs>

      {/* Playlist Modal */}
      <Modal show={showPlaylistModal} onHide={() => setShowPlaylistModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create Playlist</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handlePlaylistSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control type="text" value={playlistForm.name} placeholder="e.g., Chill Vibes" onChange={e => setPlaylistForm({ ...playlistForm, name: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={3} value={playlistForm.description} placeholder="What this playlist is for..." onChange={e => setPlaylistForm({ ...playlistForm, description: e.target.value })} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowPlaylistModal(false)}>Cancel</Button>
            <Button type="submit" variant="success">Create</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}