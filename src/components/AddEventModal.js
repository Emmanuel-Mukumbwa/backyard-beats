// src/components/AddEventModal.jsx
import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, Row, Col, Image } from 'react-bootstrap';
import axios from '../api/axiosConfig';

export default function AddEventModal({ show, onHide, onSaved, editing = null, districts = [] }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [image, setImage] = useState(null);            // File object to upload
  const [imagePreview, setImagePreview] = useState(null); // local preview URL or existing remote url
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // helper: resolve backend URL for existing image (if editing contains relative path)
  const resolveBackendUrl = (raw) => {
    try {
      const base = (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const backendBase = String(base).replace(/\/$/, '');
      if (!raw) return null;
      if (/^https?:\/\//i.test(raw)) return raw;
      if (raw.startsWith('/')) return `${backendBase}${raw}`;
      if (raw.startsWith('uploads/')) return `${backendBase}/${raw}`;
      return `${backendBase}/uploads/${raw}`;
    } catch {
      return raw;
    }
  };

  useEffect(() => {
    if (editing) {
      setTitle(editing.title || '');
      setDescription(editing.description || '');
      setEventDate(editing.event_date ? editing.event_date.split('T')[0] : '');
      setDistrictId(editing.district_id || '');
      setVenue(editing.venue || '');
      setAddress(editing.address || '');
      setTicketUrl(editing.ticket_url || '');
      // if existing event has an image_url, show it as the preview (remote)
      const existingImage = editing.image_url || editing.image || editing.imagePath || editing.image_path || null;
      setImagePreview(existingImage ? resolveBackendUrl(existingImage) : null);
    } else {
      setTitle(''); setDescription(''); setEventDate(''); setDistrictId(''); setVenue(''); setAddress(''); setTicketUrl('');
      setImagePreview(null);
    }
    setImage(null);
    setError(null);

    // cleanup preview object URLs on unmount/hide
    return () => {
      if (imagePreview && image && typeof imagePreview === 'string' && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, show]);

  const handleImageChange = (e) => {
    const f = e.target.files?.[0] || null;
    if (!f) {
      // clear preview only if there's no existing remote image
      setImage(null);
      setImagePreview(editing ? (editing.image_url ? resolveBackendUrl(editing.image_url) : null) : null);
      return;
    }

    // validate basic image type
    if (!f.type || !f.type.startsWith('image/')) {
      setError('Selected file is not an image');
      return;
    }

    // create local preview blob URL
    const previewUrl = URL.createObjectURL(f);
    // revoke old if it was a blob
    if (imagePreview && imagePreview.startsWith('blob:')) {
      try { URL.revokeObjectURL(imagePreview); } catch (e) {}
    }

    setImage(f);
    setImagePreview(previewUrl);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('event_date', eventDate);
      fd.append('district_id', districtId || '');
      fd.append('venue', venue || '');
      fd.append('address', address || '');
      fd.append('ticket_url', ticketUrl || '');
      // append image file as 'image' field (server expects req.file)
      if (image) fd.append('image', image);

      if (editing && editing.id) {
        const res = await axios.put(`/events/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        onSaved(res.data);
      } else {
        const res = await axios.post('/events', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        onSaved(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? 'Edit Event' : 'Add Event'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <div className="alert alert-danger">{error}</div>}

          <Form.Group className="mb-3">
            <Form.Label>Title</Form.Label>
            <Form.Control value={title} onChange={e => setTitle(e.target.value)} required />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control as="textarea" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          </Form.Group>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Date</Form.Label>
                <Form.Control type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>District</Form.Label>
                <Form.Select value={districtId} onChange={e => setDistrictId(e.target.value)} required>
                  <option value="">Select District</option>
                  {districts.map((d, i) => <option key={i} value={i+1}>{d}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Venue</Form.Label>
            <Form.Control value={venue} onChange={e => setVenue(e.target.value)} />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Address</Form.Label>
            <Form.Control value={address} onChange={e => setAddress(e.target.value)} />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Ticket URL</Form.Label>
            <Form.Control value={ticketUrl} onChange={e => setTicketUrl(e.target.value)} />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Image (optional)</Form.Label>
            <Form.Control type="file" accept="image/*" onChange={handleImageChange} />
            {imagePreview && (
              <div className="mt-3 d-flex align-items-center">
                <Image
                  src={imagePreview}
                  rounded
                  style={{ width: 160, height: 160, objectFit: 'cover', border: '1px solid #e9ecef' }}
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(title || 'Event')}&background=eee&color=777&size=128`; }}
                  alt="Event preview"
                />
                <div className="ms-3">
                  <div className="small text-muted">Preview</div>
                  <div className="mt-2">
                    <Button variant="outline-secondary" size="sm" onClick={() => { setImage(null); setImagePreview(editing && editing.image_url ? resolveBackendUrl(editing.image_url) : null); }}>
                      Remove selection
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="success" disabled={saving}>{saving ? 'Saving...' : (editing ? 'Update Event' : 'Add Event')}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}