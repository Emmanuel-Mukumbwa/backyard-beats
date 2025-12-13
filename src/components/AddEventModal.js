// src/components/AddEventModal.jsx
import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';
import axios from '../api/axiosConfig';

export default function AddEventModal({ show, onHide, onSaved, editing = null, districts = [] }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title || '');
      setDescription(editing.description || '');
      setEventDate(editing.event_date ? editing.event_date.split('T')[0] : '');
      setDistrictId(editing.district_id || '');
      setVenue(editing.venue || '');
      setAddress(editing.address || '');
      setTicketUrl(editing.ticket_url || '');
    } else {
      setTitle(''); setDescription(''); setEventDate(''); setDistrictId(''); setVenue(''); setAddress(''); setTicketUrl('');
    }
    setImage(null);
    setError(null);
  }, [editing, show]);

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
            <Form.Control type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} />
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
