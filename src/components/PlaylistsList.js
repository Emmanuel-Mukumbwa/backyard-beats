// src/components/PlaylistsList.jsx
import React, { useEffect, useState } from 'react';
import { Card, Button, Row, Col, Modal, Form, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axiosConfig';
import LoadingSpinner from './LoadingSpinner';

export default function PlaylistsList() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editing, setEditing] = useState(null);
  const [refreshFlag, setRefreshFlag] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    axios.get('/fan/playlists')
      .then(res => {
        if (cancelled) return;
        setPlaylists(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setPlaylists([]))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [refreshFlag]);

  async function createPlaylist(e) {
    e.preventDefault();
    if (!form.name.trim()) return;

    try {
      await axios.post('/fan/playlists', form);
      setShowCreate(false);
      setForm({ name: '', description: '' });
      setRefreshFlag(v => v + 1);
    } catch {
      alert('Failed to create playlist');
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      await axios.put(`/fan/playlists/${editing.id}`, form);
      setEditing(null);
      setShowCreate(false);
      setForm({ name: '', description: '' });
      setRefreshFlag(v => v + 1);
    } catch {
      alert('Update failed');
    }
  }

  async function deletePlaylist(id) {
    if (!window.confirm('Delete this playlist?')) return;
    try {
      await axios.delete(`/fan/playlists/${id}`);
      setRefreshFlag(v => v + 1);
    } catch {
      alert('Delete failed');
    }
  }

  function openForEdit(pl) {
    setEditing(pl);
    setForm({ name: pl.name, description: pl.description || '' });
    setShowCreate(true);
  }

  if (loading) return <div className="text-center py-4"><LoadingSpinner /></div>;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6>Your Playlists</h6>
        <Button onClick={() => { setShowCreate(true); setEditing(null); }}>
          New Playlist
        </Button>
      </div>

      <Row>
        {playlists.map(pl => (
          <Col md={6} lg={4} key={pl.id} className="mb-3">
            <Card className="h-100">
              <Card.Body className="d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <Card.Title style={{ fontSize: 16, marginBottom: 4 }}>
                      {pl.name}
                    </Card.Title>
                    <div className="small text-muted">
                      {pl.description}
                    </div>
                  </div>

                  <Badge bg="secondary" pill style={{ fontSize: 12, padding: '6px 10px', height: 'auto', alignSelf: 'flex-start' }}>
                    {Number(pl.track_count ?? 0)}
                  </Badge>
                </div>

                <div className="mt-auto d-flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/playlist/${pl.id}`)}
                  >
                    Open
                  </Button>

                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => openForEdit(pl)}
                  >
                    Edit
                  </Button>

                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => deletePlaylist(pl.id)}
                  >
                    Delete
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal show={showCreate} onHide={() => setShowCreate(false)}>
        <Form onSubmit={editing ? saveEdit : createPlaylist}>
          <Modal.Header closeButton>
            <Modal.Title>
              {editing ? 'Edit Playlist' : 'Create Playlist'}
            </Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                value={form.name}
                onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
                required
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={form.description}
                onChange={e => setForm(s => ({ ...s, description: e.target.value }))}
              />
            </Form.Group>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>

            <Button type="submit">
              {editing ? 'Save' : 'Create'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}