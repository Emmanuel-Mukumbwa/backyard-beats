// src/components/AddTrackModal.jsx
import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, Row, Col, Image } from 'react-bootstrap';
import axios from '../api/axiosConfig';

export default function AddTrackModal({ show, onHide, onSaved, editing = null, genres = [] }) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [artwork, setArtwork] = useState(null);
  const [genre, setGenre] = useState('');
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title || '');
      setGenre(editing.genre || '');
      setDuration(editing.duration || '');
      setFile(null);
      setArtwork(null);
      setError(null);
    } else {
      setTitle('');
      setGenre('');
      setDuration('');
      setFile(null);
      setArtwork(null);
      setError(null);
    }
  }, [editing, show]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('title', title);
      if (file) fd.append('file', file); // optional on edit
      if (artwork) fd.append('artwork', artwork);
      if (genre) fd.append('genre', genre);
      if (duration) fd.append('duration', String(duration));

      if (editing && editing.id) {
        const res = await axios.put(`/tracks/${editing.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        onSaved(res.data);
      } else {
        const res = await axios.post('/tracks', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        onSaved(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save track');
    } finally {
      setSaving(false);
    }
  };

  // existing preview / artwork (if any)
  const existingPreview = editing ? (editing.previewUrl || editing.preview_url || editing.file_url || null) : null;
  const existingArtwork = editing ? (editing.artwork_url || editing.cover_url || editing.artwork || editing.photo_url || null) : null;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? 'Edit Track' : 'Add Track'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <div className="alert alert-danger">{error}</div>}

          <Form.Group className="mb-3">
            <Form.Label>Title</Form.Label>
            <Form.Control value={title} onChange={e => setTitle(e.target.value)} required />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Audio File {editing ? '(leave blank to keep current)' : ''}</Form.Label>
            <Form.Control
              type="file"
              accept="audio/*"
              onChange={e => setFile(e.target.files[0])}
              required={!editing}
            />

            {existingPreview && (
              <div className="mt-2">
                <small className="text-muted">Current preview (inline):</small>
                <div className="mt-1">
                  <audio
                    controls
                    preload="metadata"
                    style={{ width: '100%' }}
                    src={existingPreview.startsWith('http') ? existingPreview : resolveToBackend(existingPreview)}
                  />
                </div>
              </div>
            )}
          </Form.Group>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Genre</Form.Label>
                <Form.Select value={genre} onChange={e => setGenre(e.target.value)}>
                  <option value="">Select genre</option>
                  {genres.map(g => <option key={g} value={g}>{g}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Duration (seconds)</Form.Label>
                <Form.Control type="number" min="0" value={duration} onChange={e => setDuration(e.target.value)} />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Artwork (optional)</Form.Label>
            <Form.Control type="file" accept="image/*" onChange={e => setArtwork(e.target.files[0])} />
            {existingArtwork && (
              <div className="mt-2">
                <small className="text-muted">Current artwork:</small>
                <div className="mt-1">
                  <Image
                    src={existingArtwork.startsWith('http') ? existingArtwork : resolveToBackend(existingArtwork)}
                    alt="art"
                    thumbnail
                    style={{ maxWidth: 160 }}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/assets/placeholder.png';
                    }}
                  />
                </div>
              </div>
            )}
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="success" disabled={saving}>
            {saving ? 'Saving...' : (editing ? 'Update Track' : 'Add Track')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
