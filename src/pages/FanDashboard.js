import React, { useState, useEffect, useContext } from 'react';
import { Tabs, Tab, Card, Button, ListGroup, Alert, Modal, Form, Row, Col } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import FavoriteArtists from '../components/FavoriteArtists';
import MyEvents from '../components/MyEvents';
import { AuthContext } from '../context/AuthContext';
import AudioPlayer from '../components/AudioPlayer';
 
export default function FanDashboard() {
  const { user } = useContext(AuthContext);
  const [favorites, setFavorites] = useState([]);
  const [recentTracks, setRecentTracks] = useState([]);
  const [rsvpEvents, setRsvpEvents] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals and forms
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlistForm, setPlaylistForm] = useState({ name: '', description: '' });
  const [editingPlaylist, setEditingPlaylist] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);
    try {
      // Mock data for now - replace with actual API calls
      setFavorites([
        { id: 1, displayName: 'Artist One', photoUrl: '/assets/placeholder.png' },
        { id: 2, displayName: 'Artist Two', photoUrl: '/assets/placeholder.png' }
      ]);
      setRecentTracks([
        { id: 1, title: 'Track One', artist: 'Artist One', previewUrl: '/tracks/sample.mp3' },
        { id: 2, title: 'Track Two', artist: 'Artist Two', previewUrl: '/tracks/sample2.mp3' }
      ]);
      setRsvpEvents([
        { id: 1, title: 'Event One', event_date: '2023-12-01', district: 'Lilongwe' },
        { id: 2, title: 'Event Two', event_date: '2023-12-15', district: 'Blantyre' }
      ]);
      setRatings([
        { id: 1, artist: 'Artist One', stars: 5, comment: 'Great track!', createdAt: '2023-11-01' },
        { id: 2, artist: 'Artist Two', stars: 4, comment: 'Nice!', createdAt: '2023-11-05' }
      ]);
      setPlaylists([
        { id: 1, name: 'My Favorites', description: 'Best tracks', tracks: [] },
        { id: 2, name: 'Chill Vibes', description: 'Relaxing music', tracks: [] }
      ]);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  const handlePlaylistSubmit = async (e) => {
    e.preventDefault();
    // Mock playlist creation
    const newPlaylist = {
      id: Date.now(),
      name: playlistForm.name,
      description: playlistForm.description,
      tracks: []
    };
    setPlaylists([...playlists, newPlaylist]);
    setShowPlaylistModal(false);
    setPlaylistForm({ name: '', description: '' });
  };

  const deletePlaylist = (id) => {
    if (!window.confirm('Delete this playlist?')) return;
    setPlaylists(playlists.filter(p => p.id !== id));
  };

  if (loading) return <div className="text-center py-5">Loading dashboard...</div>;
  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <div>
      <h2 className="mb-4">Fan Dashboard</h2>
      <Tabs defaultActiveKey="favorites" id="fan-dashboard-tabs">
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
              <AudioPlayer tracks={recentTracks} />
            ) : (
              <p>No recently played tracks.</p>
            )}
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
            <ListGroup>
              {ratings.map(rating => (
                <ListGroup.Item key={rating.id}>
                  <div className="d-flex justify-content-between">
                    <div>
                      <strong>{rating.artist}</strong>
                      <div>{'★'.repeat(rating.stars)} ({rating.stars}/5)</div>
                      <div className="small text-muted">{rating.comment}</div>
                    </div>
                    <div className="small text-muted">{new Date(rating.createdAt).toLocaleDateString()}</div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        </Tab>

        <Tab eventKey="playlists" title="Playlists">
          <div className="mt-3">
            <Button onClick={() => setShowPlaylistModal(true)}>Create Playlist</Button>
            <Row className="mt-3">
              {playlists.map(playlist => (
                <Col md={6} key={playlist.id} className="mb-3">
                  <Card>
                    <Card.Body>
                      <Card.Title>{playlist.name}</Card.Title>
                      <Card.Text>{playlist.description}</Card.Text>
                      <div className="d-flex gap-2">
                        <Button variant="primary" size="sm">View Tracks</Button>
                        <Button variant="outline-secondary" size="sm">Edit</Button>
                        <Button variant="outline-danger" size="sm" onClick={() => deletePlaylist(playlist.id)}>Delete</Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
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
              <Form.Control type="text" value={playlistForm.name} onChange={e => setPlaylistForm({...playlistForm, name: e.target.value})} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={3} value={playlistForm.description} onChange={e => setPlaylistForm({...playlistForm, description: e.target.value})} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowPlaylistModal(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
 