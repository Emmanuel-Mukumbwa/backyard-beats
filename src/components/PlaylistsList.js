// src/components/PlaylistsList.jsx
import React, { useEffect, useState } from 'react';
import { Card, Button, Row, Col, Modal, Form, ListGroup, Spinner, Badge } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import PlaylistView from './PlaylistView';

/**
 * PlaylistsList
 * - Shows user playlists, with counts
 * - Create / edit / delete
 * - Open PlaylistView modal to inspect and play playlist
 */
export default function PlaylistsList() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [refreshFlag, setRefreshFlag] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios.get('/fan/playlists')
      .then(res => { if (cancelled) return; setPlaylists(Array.isArray(res.data) ? res.data : []); })
      .catch(err => { console.error('Failed to load playlists', err); setPlaylists([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [refreshFlag]);

  async function createPlaylist(e) {
    e?.preventDefault();
    if (!form.name.trim()) return;
    try {
      await axios.post('/fan/playlists', { name: form.name, description: form.description });
      setForm({ name: '', description: '' });
      setShowCreate(false);
      setRefreshFlag(f => f + 1);
    } catch (err) {
      console.error('Create failed', err);
      alert(err?.response?.data?.error || 'Failed to create');
    }
  }

  async function deletePlaylist(id) {
    if (!window.confirm('Delete this playlist?')) return;
    try {
      await axios.delete(`/fan/playlists/${id}`);
      setRefreshFlag(f => f + 1);
    } catch (err) {
      console.error('Delete failed', err);
      alert('Failed to delete playlist');
    }
  }

  async function openForEdit(pl) {
    setEditing(pl);
    setForm({ name: pl.name, description: pl.description || '' });
    setShowCreate(true);
  }

  async function saveEdit(e) {
    e?.preventDefault();
    if (!editing) return;
    try {
      await axios.put(`/fan/playlists/${editing.id}`, { name: form.name, description: form.description });
      setEditing(null);
      setShowCreate(false);
      setForm({ name: '', description: '' });
      setRefreshFlag(f => f + 1);
    } catch (err) {
      console.error('Update failed', err);
      alert(err?.response?.data?.error || 'Update failed');
    }
  }

  if (loading) return <div className="py-3 text-center"><Spinner animation="border" /></div>;
  if (!playlists.length) return (
    <div>
      <div className="mb-3 text-muted">You have no playlists yet.</div>
      <Button onClick={() => setShowCreate(true)}>Create playlist</Button>

      <Modal show={showCreate} onHide={() => { setShowCreate(false); setEditing(null); }}>
        <Form onSubmit={editing ? saveEdit : createPlaylist}>
          <Modal.Header closeButton>
            <Modal.Title>{editing ? 'Edit playlist' : 'Create playlist'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={3} value={form.description} onChange={e => setForm(s => ({ ...s, description: e.target.value }))} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowCreate(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit">{editing ? 'Save' : 'Create'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">Your Playlists</h6>
        <Button onClick={() => { setShowCreate(true); setEditing(null); }}>New Playlist</Button>
      </div>

      <Row>
        {playlists.map(pl => (
          <Col md={6} lg={4} key={pl.id} className="mb-3">
            <Card className="h-100">
              <Card.Body className="d-flex flex-column">
                <div>
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <Card.Title style={{ fontSize: 16 }}>{pl.name}</Card.Title>
                      <div className="small text-muted">{pl.description || ''}</div>
                    </div>
                    <Badge bg="secondary" pill>{pl.track_count ?? 0}</Badge>
                  </div>
                </div>

                <div className="mt-auto d-flex gap-2">
                  <Button size="sm" onClick={() => setSelected(pl.id)}>Open</Button>
                  <Button size="sm" variant="outline-secondary" onClick={() => openForEdit(pl)}>Edit</Button>
                  <Button size="sm" variant="outline-danger" onClick={() => deletePlaylist(pl.id)}>Delete</Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal show={showCreate} onHide={() => { setShowCreate(false); setEditing(null); }}>
        <Form onSubmit={editing ? saveEdit : createPlaylist}>
          <Modal.Header closeButton>
            <Modal.Title>{editing ? 'Edit playlist' : 'Create playlist'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={3} value={form.description} onChange={e => setForm(s => ({ ...s, description: e.target.value }))} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowCreate(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit">{editing ? 'Save' : 'Create'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <PlaylistView
        playlistId={selected}
        show={!!selected}
        onHide={() => { setSelected(null); setRefreshFlag(f => f + 1); }}
      />
    </>
  );
}