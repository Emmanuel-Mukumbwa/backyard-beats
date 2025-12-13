// src/pages/ArtistDashboard.jsx
import React, { useState, useEffect, useContext } from 'react';
import {
  Tabs,
  Tab,
  Card,
  Button,
  Alert,
  Table,
  Row,
  Col,
  Image,
  Badge,
  Stack
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axiosConfig';
import { AuthContext } from '../context/AuthContext';
import AudioPlayer from '../components/AudioPlayer';
import RatingsList from '../components/RatingsList';
import DISTRICTS from '../data/districts';
import AddTrackModal from '../components/AddTrackModal';
import AddEventModal from '../components/AddEventModal';

// icons
import { FaMusic, FaCalendarAlt, FaChartLine, FaPlus, FaEdit, FaTrash, FaUserCircle } from 'react-icons/fa';

const GENRES = ["Afropop", "Gospel", "Hip-hop", "R&B", "Reggae", "Highlife", "Traditional", "Dancehall", "Jazz", "Blues", "Electronic"];

export default function ArtistDashboard() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [events, setEvents] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingTrack, setEditingTrack] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);
    try {
      const [artistRes, tracksRes, eventsRes] = await Promise.all([
        axios.get('/artist/me'),
        axios.get('/tracks'),
        axios.get('/events'),
      ]);

      const artistData = artistRes.data.artist || null;
      setArtist(artistData);

      // tracks/events endpoints return only artist-owned items (as implemented server-side)
      setTracks(Array.isArray(tracksRes.data) ? tracksRes.data : []);
      setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);

      // ratings for artist
      if (artistData?.id) {
        const r = await axios.get(`/artists/${artistData.id}/ratings`);
        setRatings(Array.isArray(r.data) ? r.data : []);
      } else {
        setRatings([]);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  const onTrackSaved = (savedTrack) => {
    loadDashboardData();
    setShowTrackModal(false);
    setEditingTrack(null);
  };

  const onEventSaved = (savedEvent) => {
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
      setError(err.response?.data?.error || err.message);
    }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await axios.delete(`/events/${id}`);
      loadDashboardData();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  if (loading) return <div className="text-center py-5">Loading dashboard...</div>;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!artist) return <Alert variant="warning">Artist profile not found.</Alert>;

  // resolve backend URL helper (inline - no extra files)
  const backendBase = (() => {
    try {
      return (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:3001';
    } catch {
      return process.env.REACT_APP_API_URL || 'http://localhost:3001';
    }
  })().replace(/\/$/, '');

  const resolveToBackend = (raw, artistId) => {
    if (!raw && !artistId) return '';
    if (artistId && !raw) {
      return '';
    }
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `${backendBase}${raw}`;
    if (raw.startsWith('uploads/')) return `${backendBase}/${raw}`;
    return `${backendBase}/uploads/${raw}`;
  };

  // avatar src: prefer stored photo path if present; fallback to ui-avatars
  const photoRaw = artist.photo_url || artist.photo || null;
  const avatarSrc = photoRaw
    ? (photoRaw.startsWith('http') ? photoRaw : resolveToBackend(photoRaw, artist.id))
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.display_name || artist.username || 'Artist')}&background=0D8ABC&color=fff&size=256`;

  // counts used in tab titles
  const tracksCount = tracks.length;
  const eventsCount = events.length;
  const ratingsCount = ratings.length;

  // Small helper to format upcoming events count
  const upcomingCount = events.filter(e => e.event_date && new Date(e.event_date) > new Date()).length;

  // improved look: cards with subtle shadows, icons
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-0">Artist Dashboard</h2>
          <div className="text-muted small">Manage your tracks, events and profile</div>
        </div>

        <div>
          <Stack direction="horizontal" gap={2}>
            <Button variant="outline-secondary" size="sm" onClick={() => navigate('/')}>Back to Home</Button>
            <Button variant="success" size="sm" onClick={() => { setEditingTrack(null); setShowTrackModal(true); }}>
              <FaPlus className="me-1" /> Add Track
            </Button>
            <Button variant="outline-success" size="sm" onClick={() => { setEditingEvent(null); setShowEventModal(true); }}>
              <FaPlus className="me-1" /> Add Event
            </Button>
          </Stack>
        </div>
      </div>

      <Tabs defaultActiveKey="overview" id="artist-dashboard-tabs" className="mb-3">
        <Tab
          eventKey="overview"
          title={
            <span>
              <FaUserCircle className="me-1" /> Overview
            </span>
          }
        >
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
                  <Card.Title className="mt-2">{artist.display_name}</Card.Title>
                  <Card.Text className="text-muted small">{artist.bio || 'No bio yet — tell fans about your music.'}</Card.Text>

                  <div className="d-flex justify-content-center mt-3">
                    <Button variant="outline-primary" size="sm" onClick={() => navigate('/onboard')}>
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
                      <div className="display-6 text-success">{artist.avg_rating ? artist.avg_rating.toFixed(1) : 'N/A'}</div>
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

        <Tab
          eventKey="tracks"
          title={
            <span>
              <FaMusic className="me-1" /> Tracks <Badge bg="secondary" className="ms-2">{tracksCount}</Badge>
            </span>
          }
        >
          <div className="mt-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <Button onClick={() => { setEditingTrack(null); setShowTrackModal(true); }} variant="outline-success" size="sm">
                  <FaPlus className="me-1" /> New Track
                </Button>
              </div>
              <div className="small text-muted">Manage your audio uploads and metadata</div>
            </div>

            <Table striped hover responsive className="mb-3">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Duration</th>
                  <th>Genre</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map(track => (
                  <tr key={track.id}>
                    <td>{track.title}</td>
                    <td>{track.duration ? `${track.duration}s` : '-'}</td>
                    <td>{track.genre || '-'}</td>
                    <td>
                      <div className="d-flex gap-2">
                        <Button size="sm" variant="outline-primary" onClick={() => { setEditingTrack(track); setShowTrackModal(true); }}>
                          <FaEdit className="me-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline-danger" onClick={() => deleteTrack(track.id)}>
                          <FaTrash className="me-1" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tracks.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">No tracks yet — add your first track.</td>
                  </tr>
                )}
              </tbody>
            </Table>

            {tracks.length > 0 && <AudioPlayer tracks={tracks} />}
          </div>
        </Tab>

        <Tab
          eventKey="events"
          title={
            <span>
              <FaCalendarAlt className="me-1" /> Events <Badge bg="secondary" className="ms-2">{eventsCount}</Badge>
            </span>
          }
        >
          <div className="mt-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <Button onClick={() => { setEditingEvent(null); setShowEventModal(true); }} variant="outline-success" size="sm">
                  <FaPlus className="me-1" /> New Event
                </Button>
              </div>
              <div className="small text-muted">Create and manage upcoming gigs</div>
            </div>

            <Table striped hover responsive>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Date</th>
                  <th>District</th>
                  <th>Venue</th>
                  <th style={{ width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id}>
                    <td>{ev.title}</td>
                    <td>{ev.event_date ? new Date(ev.event_date).toLocaleDateString() : '-'}</td>
                    <td>{ev.district_id ? DISTRICTS[ev.district_id - 1] : '-'}</td>
                    <td>{ev.venue || '-'}</td>
                    <td>
                      <div className="d-flex gap-2">
                        <Button size="sm" variant="outline-primary" onClick={() => { setEditingEvent(ev); setShowEventModal(true); }}>
                          <FaEdit className="me-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline-danger" onClick={() => deleteEvent(ev.id)}>
                          <FaTrash className="me-1" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted">No events yet — create your first event.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Tab>

        <Tab
          eventKey="analytics"
          title={
            <span>
              <FaChartLine className="me-1" /> Analytics
            </span>
          }
        >
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
                    <div className="h4">{artist.avg_rating ? artist.avg_rating.toFixed(1) : 'N/A'}</div>
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

      {/* Modals */}
      <AddTrackModal
        show={showTrackModal}
        onHide={() => setShowTrackModal(false)}
        onSaved={onTrackSaved}
        editing={editingTrack}
        genres={GENRES}
      />

      <AddEventModal
        show={showEventModal}
        onHide={() => setShowEventModal(false)}
        onSaved={onEventSaved}
        editing={editingEvent}
        districts={DISTRICTS}
      />
    </div>
  );
}
