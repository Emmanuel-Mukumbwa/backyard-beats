// src/pages/ArtistDashboard.js
import React, { useState, useEffect, useContext } from 'react';
import {
  Tabs,
  Tab,
  Card,
  Button,
  Alert,
  Row,
  Col,
  Image,
  Badge,
  Stack
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axiosConfig';
import { AuthContext } from '../context/AuthContext';
import RatingsList from '../components/RatingsList';
import ToastMessage from '../components/ToastMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import AddTrackModal from '../components/AddTrackModal';
import AddEventModal from '../components/AddEventModal';

// new component imports
import TracksPanel from '../components/artist/TracksPanel';
import EventsPanel from '../components/artist/EventsPanel';

// icons
import { FaMusic, FaCalendarAlt, FaChartLine, FaPlus, FaEdit, FaUserCircle } from 'react-icons/fa';

export default function ArtistDashboard() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [events, setEvents] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [metaGenres, setMetaGenres] = useState([]);
  const [metaMoods, setMetaMoods] = useState([]);

  // districts state: list + lookup map
  const [districtsList, setDistrictsList] = useState([]);
  const [districtsMapObj, setDistrictsMapObj] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingTrack, setEditingTrack] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  // Toast state (re-usable ToastMessage)
  const [toast, setToast] = useState({ show: false, message: '', variant: 'warning', delay: 5000 });

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line
  }, []);

  // helper: build backend base
  const backendBase = (() => {
    try {
      return (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:3001';
    } catch {
      return process.env.REACT_APP_API_URL || 'http://localhost:3001';
    }
  })().replace(/\/$/, '');

  const resolveToBackend = (raw) => {
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `${backendBase}${raw}`;
    if (raw.startsWith('uploads/')) return `${backendBase}/${raw}`;
    return `${backendBase}/uploads/${raw}`;
  };

  // extract event image raw helper (keeps compatibility with different field names)
  const getEventImageRaw = (ev) => {
    if (!ev) return null;
    return ev.image_url || ev.image || ev.cover_url || ev.photo || ev.imagePath || ev.image_path || null;
  };
  const resolveEventImage = (ev) => {
    const raw = getEventImageRaw(ev);
    return raw ? resolveToBackend(raw) : null;
  };

  // determine artist account status
  function computeArtistStatus(a) {
    if (!a) return 'unknown';
    if (a.user && a.user.deleted_at) return 'deleted';
    if (a.user && a.user.banned) return 'banned';
    if (a.is_rejected) return 'rejected';
    if (!a.is_approved) return 'pending';
    return 'approved';
  }

  // friendly label & badge for status
  function statusBadge(status) {
    switch (status) {
      case 'approved': return <Badge bg="success">Approved</Badge>;
      case 'pending': return <Badge bg="warning" className="text-dark">Pending verification</Badge>;
      case 'rejected': return <Badge bg="danger">Rejected</Badge>;
      case 'banned': return <Badge bg="danger">Banned</Badge>;
      case 'deleted': return <Badge bg="secondary">Deleted</Badge>;
      default: return <Badge bg="secondary">Unknown</Badge>;
    }
  }

  // Convert artist.genres to array of names in flexible ways
  function extractGenreNames(a) {
    if (!a) return [];
    if (Array.isArray(a.genres) && a.genres.length > 0 && typeof a.genres[0] === 'object') {
      return a.genres.map(g => g.name);
    }
    if (Array.isArray(a.genres) && a.genres.length > 0 && (typeof a.genres[0] === 'number' || /^\d+$/.test(String(a.genres[0])))) {
      return a.genres.map(id => {
        const m = metaGenres.find(x => Number(x.id) === Number(id));
        return m ? m.name : String(id);
      });
    }
    if (Array.isArray(a.genres) && a.genres.length > 0) {
      return a.genres.map(String);
    }
    if (a.genre) return [String(a.genre)];
    return [];
  }

  function extractMoodNames(a) {
    if (!a) return [];
    if (Array.isArray(a.moods) && a.moods.length > 0 && typeof a.moods[0] === 'object') {
      return a.moods.map(m => m.name);
    }
    if (Array.isArray(a.moods) && a.moods.length > 0 && (typeof a.moods[0] === 'number' || /^\d+$/.test(String(a.moods[0])))) {
      return a.moods.map(id => {
        const m = metaMoods.find(x => Number(x.id) === Number(id));
        return m ? m.name : String(id);
      });
    }
    if (Array.isArray(a.moods) && a.moods.length > 0) {
      return a.moods.map(String);
    }
    if (a.mood) return [String(a.mood)];
    return [];
  }

  // load meta, profile, tracks, events, ratings, districts
  async function loadDashboardData() {
    setLoading(true);
    setError(null);
    try {
      // fetch meta, profile, districts in parallel
      const [gRes, mRes, profileRes, districtsRes] = await Promise.allSettled([
        axios.get('/meta/genres'),
        axios.get('/meta/moods'),
        axios.get('/profile/me'),
        axios.get('/districts')
      ]);

      if (gRes.status === 'fulfilled') setMetaGenres(Array.isArray(gRes.value.data) ? gRes.value.data : []);
      if (mRes.status === 'fulfilled') setMetaMoods(Array.isArray(mRes.value.data) ? mRes.value.data : []);

      // normalize districts
      const dList = (districtsRes.status === 'fulfilled' && Array.isArray(districtsRes.value.data))
        ? districtsRes.value.data.map(d => {
            const id = d.id !== undefined ? String(d.id) : (d.ID !== undefined ? String(d.ID) : '');
            const name = d.name || d.title || d.label || d.district_name || '';
            return { id, name };
          }).filter(x => x.name)
        : [];
      setDistrictsList(dList);
      const dmap = {};
      dList.forEach(d => {
        if (d && d.id) {
          dmap[d.id] = d.name;
          dmap[String(d.id)] = d.name;
        }
      });
      setDistrictsMapObj(dmap);

      let artistData = null;
      if (profileRes.status === 'fulfilled' && profileRes.value.data && profileRes.value.data.artist) {
        artistData = profileRes.value.data.artist;
        artistData.is_approved = !!artistData.is_approved;
        artistData.is_rejected = !!artistData.is_rejected;
      }
      setArtist(artistData);

      if (artistData && artistData.id) {
        // fetch tracks + artist-owned events (includes pending/rejected)
        const [tracksRes, eventsRes] = await Promise.allSettled([
          axios.get('/tracks'),
          axios.get('/events/my')   // important: use authenticated artist endpoint
        ]);

        setTracks(tracksRes.status === 'fulfilled' && Array.isArray(tracksRes.value.data) ? tracksRes.value.data : []);
        setEvents(eventsRes.status === 'fulfilled' && Array.isArray(eventsRes.value.data) ? eventsRes.value.data : []);

        try {
          const r = await axios.get(`/artists/${artistData.id}/ratings`);
          setRatings(Array.isArray(r.data) ? r.data : []);
        } catch {
          setRatings([]);
        }
      } else {
        setTracks([]);
        setEvents([]);
        setRatings([]);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('loadDashboardData error', err);
      setError('Failed to load dashboard. Try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }

  // helpers for Add Track/Event: check if artist is allowed to create
  const artistStatus = computeArtistStatus(artist);

  function showRestrictedToast(message, delay = 5000, variant = 'warning') {
    setToast({ show: true, message, variant, delay });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), delay + 200);
  }

  const handleAddTrackClick = () => {
    if (!artist) {
      showRestrictedToast('Complete your artist onboarding first before adding tracks.', 5000, 'warning');
      return;
    }
    if (artistStatus === 'pending') {
      showRestrictedToast('Your profile is pending verification. You may add tracks after your profile is approved.', 6000, 'warning');
      return;
    }
    if (artistStatus === 'rejected') {
      showRestrictedToast('Your artist profile was rejected. Contact support for help.', 6000, 'danger');
      return;
    }
    if (artistStatus === 'banned') {
      showRestrictedToast('Your account has been banned. You cannot add tracks.', 6000, 'danger');
      return;
    }
    if (artistStatus === 'deleted') {
      showRestrictedToast('Your account has been deleted. You cannot add tracks.', 6000, 'danger');
      return;
    }
    setEditingTrack(null);
    setShowTrackModal(true);
  };

  const handleAddEventClick = () => {
    if (!artist) {
      showRestrictedToast('Complete your artist onboarding first before creating events.', 5000, 'warning');
      return;
    }
    if (artistStatus === 'pending') {
      showRestrictedToast('Your profile is pending verification. You may create events after your profile is approved.', 6000, 'warning');
      return;
    }
    if (artistStatus === 'rejected') {
      showRestrictedToast('Your artist profile was rejected. Contact support for help.', 6000, 'danger');
      return;
    }
    if (artistStatus === 'banned') {
      showRestrictedToast('Your account has been banned. You cannot create events.', 6000, 'danger');
      return;
    }
    if (artistStatus === 'deleted') {
      showRestrictedToast('Your account has been deleted. You cannot create events.', 6000, 'danger');
      return;
    }
    setEditingEvent(null);
    setShowEventModal(true);
  };

  // CRUD handlers still call API
  const onTrackSaved = () => {
    loadDashboardData();
    setShowTrackModal(false);
    setEditingTrack(null);
  };

  const onEventSaved = () => {
    loadDashboardData();
    setShowEventModal(false);
    setEditingEvent(null);
  };

  const deleteTrack = async (id) => {
    if (!window.confirm('Delete this track?')) return;
    try {
      await axios.delete(`/tracks/${id}`);
      loadDashboardData();
    } catch (err) {
      showRestrictedToast(err.response?.data?.error || err.message || 'Failed to delete track', 5000, 'danger');
    }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await axios.delete(`/events/${id}`);
      loadDashboardData();
    } catch (err) {
      showRestrictedToast(err.response?.data?.error || err.message || 'Failed to delete event', 5000, 'danger');
    }
  };

  // ----------------------------------------
  // recordListen: fire-and-forget analytics ping
  // ----------------------------------------
  const recordListen = async (track) => {
    try {
      // fire-and-forget: don't block UI
      axios.post(`/tracks/${track.id}/listen`).catch(() => {});
    } catch (e) {
      // ignore errors from analytics call
      // eslint-disable-next-line no-console
      console.debug('recordListen ignored error', e);
    }
  };

  if (loading) return <div className="text-center py-5"><LoadingSpinner size="lg" /></div>;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!artist) return <Alert variant="warning">Artist profile not found. <Button size="sm" variant="link" onClick={() => navigate('/onboard')}>Complete onboarding</Button></Alert>;

  // avatar src: prefer stored photo path if present; fallback to ui-avatars
  const photoRaw = artist.photo_url || artist.photo || null;
  const avatarSrc = photoRaw
    ? (photoRaw.startsWith('http') ? photoRaw : resolveToBackend(photoRaw))
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.display_name || artist.username || 'Artist')}&background=0D8ABC&color=fff&size=256`;

  // derived lists
  const genreNames = (() => {
    const g = extractGenreNames(artist);
    return g;
  })();
  const moodNames = (() => extractMoodNames(artist))();

  const tracksCount = tracks.length;
  const eventsCount = events.length;
  const ratingsCount = ratings.length;
  const upcomingCount = events.filter(e => e.event_date && new Date(e.event_date) > new Date()).length;

  const status = computeArtistStatus(artist);

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

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-0">Artist Dashboard</h2>
          <div className="text-muted small">Manage your tracks, events and profile</div>
        </div>

        <div>
          <Stack direction="horizontal" gap={2}>
            <Button variant="outline-secondary" size="sm" onClick={() => navigate('/')}>Back to Home</Button>
            <Button variant="success" size="sm" onClick={handleAddTrackClick}>
              <FaPlus className="me-1" /> Add Track
            </Button>
            <Button variant="outline-success" size="sm" onClick={handleAddEventClick}>
              <FaPlus className="me-1" /> Add Event
            </Button>
          </Stack>
        </div>
      </div>

      <Tabs defaultActiveKey="overview" id="artist-dashboard-tabs" className="mb-3">
        <Tab eventKey="overview" title={<span><FaUserCircle className="me-1" /> Overview</span>}>
          <Row className="mt-3">
            <Col md={4}>
              <Card className="text-center p-3 shadow-sm">
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Image
                    src={avatarSrc}
                    roundedCircle
                    style={{ width: 160, height: 160, objectFit: 'cover', border: '4px solid #f8f9fa' }}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.display_name || artist.username || 'Artist')}&background=0D8ABC&color=fff&size=256`;
                    }}
                    alt={`${artist.display_name || artist.username || 'Artist'} avatar`}
                  />
                </div>

                <Card.Body>
                  <Card.Title className="mt-2 d-flex align-items-center justify-content-center">
                    <span>{artist.display_name}</span>
                    <span className="ms-2">{statusBadge(status)}</span>
                  </Card.Title>

                  <Card.Text className="text-muted small">{artist.bio || 'No bio yet — tell fans about your music.'}</Card.Text>

                  <div className="d-flex justify-content-center mt-3">
                    <Button variant="outline-primary" size="sm" onClick={() => navigate('/artist/${artist.id}')}>
                      <FaEdit className="me-1" /> Edit Profile
                    </Button>
                  </div>

                  <hr />

                  <div className="d-flex justify-content-around mt-2">
                    <div className="text-center">
                      <div className="h5 mb-0">{tracksCount}</div>
                      <div className="small text-muted">Tracks</div>
                    </div>
                    <div className="text-center">
                      <div className="h5 mb-0">{eventsCount}</div>
                      <div className="small text-muted">Events</div>
                    </div>
                    <div className="text-center">
                      <div className="h5 mb-0">{ratingsCount}</div>
                      <div className="small text-muted">Reviews</div>
                    </div>
                  </div>

                  <hr />

                  <div className="text-start">
                    <div className="small text-muted">District</div>
                    <div className="mb-2">{artist.district || (artist.user && artist.user.district ? artist.user.district.name : (artist.user && artist.user.district_id ? `#${artist.user.district_id}` : 'Unknown'))}</div>

                    <div className="small text-muted">Genres</div>
                    <div className="mb-2">
                      {genreNames.length ? genreNames.map(g => <Badge bg="success" className="me-1" key={g}>{g}</Badge>) : <small className="text-muted">No genres</small>}
                    </div>

                    <div className="small text-muted">Moods</div>
                    <div>
                      {moodNames.length ? moodNames.map(m => <Badge bg="info" text="dark" className="me-1" key={m}>{m}</Badge>) : <small className="text-muted">No moods</small>}
                    </div>
                  </div>

                </Card.Body>
              </Card>
            </Col>

            <Col md={8}>
              <Card className="shadow-sm">
                <Card.Body>
                  <h5><FaChartLine className="me-2" /> Engagement</h5>
                  <Row className="mt-3">
                    <Col md={6}>
                      <div className="mb-2"><strong>Average Rating</strong></div>
                      <div className="display-6 text-success">{artist.avg_rating ? Number(artist.avg_rating).toFixed(1) : 'N/A'}</div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-2"><strong>Upcoming Events</strong></div>
                      <div className="display-6">{upcomingCount}</div>
                    </Col>
                  </Row>

                  <hr />

                  <div className="mt-2">
                    <h6>Recent Reviews</h6>
                    <div>
                      <RatingsList artistId={artist.id} />
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>

        <Tab eventKey="tracks" title={<span><FaMusic className="me-1" /> Tracks <Badge bg="secondary" className="ms-2">{tracksCount}</Badge></span>}>
          <TracksPanel
            tracks={tracks}
            status={status}
            onEdit={(t) => { setEditingTrack(t); setShowTrackModal(true); }}
            onDelete={deleteTrack}
            resolveToBackend={resolveToBackend}
            onPlay={recordListen}
          />
        </Tab>

        <Tab eventKey="events" title={<span><FaCalendarAlt className="me-1" /> Events <Badge bg="secondary" className="ms-2">{eventsCount}</Badge></span>}>
          <EventsPanel
            events={events}
            onEdit={(e) => { setEditingEvent(e); setShowEventModal(true); }}
            onDelete={deleteEvent}
            resolveEventImage={resolveEventImage}
            districtsMap={(id) => (districtsMapObj && (districtsMapObj[String(id)] || districtsMapObj[id])) || null}
          />
        </Tab>

        <Tab eventKey="analytics" title={<span><FaChartLine className="me-1" /> Analytics</span>}>
          <div className="mt-3">
            <Card className="shadow-sm">
              <Card.Body>
                <h5>Engagement Metrics</h5>
                <Row className="mt-3">
                  <Col md={4}>
                    <div className="small text-muted">Total Plays</div>
                    <div className="h4">—</div>
                  </Col>
                  <Col md={4}>
                    <div className="small text-muted">Average Rating</div>
                    <div className="h4">{artist.avg_rating ? Number(artist.avg_rating).toFixed(1) : 'N/A'}</div>
                  </Col>
                  <Col md={4}>
                    <div className="small text-muted">Reviews</div>
                    <div className="h4">{ratings.length}</div>
                  </Col>
                </Row>
                <hr />
                <RatingsList artistId={artist.id} />
              </Card.Body>
            </Card>
          </div>
        </Tab>
      </Tabs>

      <AddTrackModal
        show={showTrackModal}
        onHide={() => setShowTrackModal(false)}
        onSaved={onTrackSaved}
        editing={editingTrack}
        genres={metaGenres.map(g => g.name)}
      />

      <AddEventModal
        show={showEventModal}
        onHide={() => setShowEventModal(false)}
        onSaved={onEventSaved}
        editing={editingEvent}
        districts={districtsList}
      />
    </div>
  );
}