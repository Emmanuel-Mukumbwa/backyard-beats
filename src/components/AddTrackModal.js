// src/components/AddTrackModal.js
import React, { useEffect, useState, useRef } from 'react';
import { Modal, Button, Form, Row, Col, Image } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import LoadingSpinner from './LoadingSpinner';
import ToastMessage from './ToastMessage';

export default function AddTrackModal({
  show,
  onHide,
  onSaved,
  editing = null,
  genres = [],
  adminMode = false,          // new prop
  artists = [],               // new prop – list of { id, display_name }
}) {
  // split fields
  const [artistName, setArtistName] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [producer, setProducer] = useState('');
  const [selectedArtistId, setSelectedArtistId] = useState(''); // for admin mode
  const [file, setFile] = useState(null);
  const [artwork, setArtwork] = useState(null);
  const [genre, setGenre] = useState('');
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

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

  const formatTitle = (artist, song, prod) => {
    const a = (artist || '').trim();
    const s = (song || '').trim();
    const p = (prod || '').trim();
    if (!a && !s) return '';
    const base = a && s ? `${a}_${s}` : (a || s);
    return p ? `${base} (Prod. ${p})` : base;
  };

  const parseTitle = (raw = '') => {
    if (!raw) return { artist: '', song: '', producer: '' };
    let title = raw.trim();
    const prodRegex = /\(\s*(?:Prod(?:uced)?\.?|prod(?:uced)?\.?)\s*(.+?)\s*\)\s*$/i;
    let producerMatch = title.match(prodRegex);
    let prod = '';
    if (producerMatch) {
      prod = producerMatch[1].trim();
      title = title.slice(0, producerMatch.index).trim();
    } else {
      const prodByRegex = /\(\s*Produced\s+by\s+(.+?)\s*\)\s*$/i;
      producerMatch = title.match(prodByRegex);
      if (producerMatch) {
        prod = producerMatch[1].trim();
        title = title.slice(0, producerMatch.index).trim();
      }
    }
    let artist = '', song = '';
    if (title.includes('_')) {
      const [a, ...rest] = title.split('_');
      artist = a.trim();
      song = rest.join('_').trim();
    } else if (title.includes(' - ')) {
      const [a, ...rest] = title.split(' - ');
      artist = a.trim();
      song = rest.join(' - ').trim();
    } else if (title.includes(' — ')) {
      const [a, ...rest] = title.split(' — ');
      artist = a.trim();
      song = rest.join(' — ').trim();
    } else {
      song = title;
    }
    return { artist, song, producer: prod };
  };

  const existingPreview = editing ? (editing.previewUrl || editing.preview_url || editing.file_url || null) : null;
  const existingArtwork = editing ? (editing.artwork_url || editing.cover_url || editing.artwork || editing.photo_url || null) : null;

  const audioRef = useRef(null);
  const createdUrlRef = useRef(null);

  useEffect(() => {
    if (editing) {
      const existingTitle = editing.title || editing.preview_title || editing.name || '';
      const parsed = parseTitle(existingTitle);
      setArtistName(parsed.artist || '');
      setSongTitle(parsed.song || '');
      setProducer(parsed.producer || '');
      setGenre(editing.genre || '');
      setDuration(editing.duration ? String(editing.duration) : '');
      setFile(null);
      setArtwork(null);
      setError(null);
      // If admin mode and editing, pre-select artist if editing.artist_id
      if (adminMode && editing.artist_id) {
        setSelectedArtistId(String(editing.artist_id));
      }
    } else {
      setArtistName('');
      setSongTitle('');
      setProducer('');
      setGenre('');
      setDuration('');
      setFile(null);
      setArtwork(null);
      setSelectedArtistId('');
      setError(null);
    }
    return () => {
      revokeCreatedUrl();
      if (audioRef.current) {
        audioRef.current.onerror = null;
        audioRef.current.onloadedmetadata = null;
        audioRef.current = null;
      }
    };
  }, [editing, show, adminMode]);

  useEffect(() => {
    if (!file) return;
    revokeCreatedUrl();
    const url = URL.createObjectURL(file);
    createdUrlRef.current = url;
    readDurationFromUrl(url, { isLocalBlob: true })
      .then((secs) => {
        if (secs && !isNaN(secs)) {
          setDuration(String(Math.round(secs)));
          setToast({ show: true, message: `Duration detected: ${Math.round(secs)}s`, variant: 'success' });
        }
      })
      .catch(() => {
        setToast({ show: true, message: 'Could not detect audio duration automatically — enter it manually', variant: 'warning' });
      });
  }, [file]);

  const revokeCreatedUrl = () => {
    if (createdUrlRef.current) {
      try { URL.revokeObjectURL(createdUrlRef.current); } catch (e) { /* ignore */ }
      createdUrlRef.current = null;
    }
  };

  const readDurationFromUrl = (url, options = {}) => {
    return new Promise((resolve, reject) => {
      try {
        const audio = new Audio();
        audioRef.current = audio;
        audio.preload = 'metadata';
        if (!options.isLocalBlob) {
          audio.crossOrigin = 'anonymous';
        }
        let settled = false;
        audio.onloadedmetadata = function () {
          if (settled) return;
          settled = true;
          const d = audio.duration;
          audio.onloadedmetadata = null;
          audio.onerror = null;
          try { audio.src = ''; } catch (e) { /* ignore */ }
          resolve(d);
        };
        audio.onerror = function () {
          if (settled) return;
          settled = true;
          audio.onloadedmetadata = null;
          audio.onerror = null;
          try { audio.src = ''; } catch (e) { /* ignore */ }
          reject(new Error('Failed to load audio metadata'));
        };
        audio.src = url;
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!artistName.trim() && !songTitle.trim()) {
      setError('Please provide at least an artist name or a song title.');
      setSaving(false);
      return;
    }
    const finalTitle = formatTitle(artistName, songTitle, producer);
    if (finalTitle.length > 255) {
      setError('The composed title is too long for storage (over 255 characters). Shorten artist/song/producer.');
      setSaving(false);
      return;
    }

    // Admin mode: require artist selection
    if (adminMode && !selectedArtistId) {
      setError('Please select an artist.');
      setSaving(false);
      return;
    }

    try {
      const fd = new FormData();
      fd.append('title', finalTitle);
      if (file) fd.append('file', file);
      if (artwork) fd.append('artwork', artwork);
      if (genre) fd.append('genre', genre);
      if (duration) fd.append('duration', String(duration));
      if (adminMode && selectedArtistId) {
        fd.append('artist_id', selectedArtistId); // send selected artist ID
      }

      if (editing && editing.id) {
        const res = await axios.put(`/tracks/${editing.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setToast({ show: true, message: 'Track updated', variant: 'success' });
        onSaved(res.data);
      } else {
        const res = await axios.post('/tracks', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setToast({ show: true, message: 'Track added', variant: 'success' });
        onSaved(res.data);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Failed to save track';
      setError(msg);
      setToast({ show: true, message: msg, variant: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const computedTitlePreview = formatTitle(artistName, songTitle, producer);

  return (
    <>
      <ToastMessage
        show={toast.show}
        onClose={() => setToast(s => ({ ...s, show: false }))}
        message={toast.message}
        variant={toast.variant}
        delay={3500}
        position="top-end"
      />
      <Modal show={show} onHide={onHide} centered size="lg">
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editing ? 'Edit Track' : (adminMode ? 'Add Track (Admin)' : 'Add Track')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <div className="alert alert-danger">{error}</div>}

            {/* Admin artist selector */}
            {adminMode && !editing && (
              <Form.Group className="mb-3">
                <Form.Label>Select Artist <span className="text-danger">*</span></Form.Label>
                <Form.Select
                  value={selectedArtistId}
                  onChange={(e) => setSelectedArtistId(e.target.value)}
                  required
                >
                  <option value="">Choose artist...</option>
                  {artists.map(a => (
                    <option key={a.id} value={a.id}>{a.display_name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}

            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Artist</Form.Label>
                  <Form.Control
                    value={artistName}
                    onChange={e => setArtistName(e.target.value)}
                    placeholder="Artist name (optional)"
                  />
                </Form.Group>
              </Col>
              <Col md={5}>
                <Form.Group className="mb-3">
                  <Form.Label>Song Title</Form.Label>
                  <Form.Control
                    value={songTitle}
                    onChange={e => setSongTitle(e.target.value)}
                    placeholder="Song title"
                    required={!editing && !artistName}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>Producer</Form.Label>
                  <Form.Control
                    value={producer}
                    onChange={e => setProducer(e.target.value)}
                    placeholder="Producer (optional)"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Stored Title Preview</Form.Label>
              <Form.Control readOnly value={computedTitlePreview} />
              <Form.Text className="text-muted">This will be the stored song name exactly as shown.</Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Audio File {editing ? '(leave blank to keep current)' : ''}</Form.Label>
              <Form.Control
                type="file"
                accept="audio/*"
                onChange={e => setFile(e.target.files[0] || null)}
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
                  <Form.Control
                    type="number"
                    min="0"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    placeholder="Auto-filled from file when available"
                  />
                  <Form.Text className="text-muted">If auto-fill fails, enter the duration manually.</Form.Text>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Artwork (optional)</Form.Label>
              <Form.Control type="file" accept="image/*" onChange={e => setArtwork(e.target.files[0] || null)} />
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
              {saving ? (
                <>
                  <LoadingSpinner inline size="sm" ariaLabel="Saving" /> <span className="ms-2">Saving...</span>
                </>
              ) : (editing ? 'Update Track' : 'Add Track')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}