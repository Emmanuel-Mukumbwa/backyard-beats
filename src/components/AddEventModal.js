// src/components/AddEventModal.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Modal, Button, Form, Row, Col, Image } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import LoadingSpinner from './LoadingSpinner';
import ToastMessage from './ToastMessage';

export default function AddEventModal({ show, onHide, onSaved, editing = null, districts = [] }) {
  // Split title: eventName + organizer (optional)
  const [eventName, setEventName] = useState('');
  const [organizer, setOrganizer] = useState('');

  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const previewBlobRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // toast for non-blocking messages
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

  // districts handling
  const [localDistricts, setLocalDistricts] = useState([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [districtsError, setDistrictsError] = useState(null);

  // helper to build backend url for relative image paths
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

  // normalize districts prop (support ['Name','Name'] or [{id,name}, ...])
  const normalizePropDistricts = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((d, i) => {
        if (!d) return null;
        if (typeof d === 'string' || typeof d === 'number') {
          return { id: String(i + 1), name: String(d) };
        }
        // assume object
        const idCandidate = d.id ?? d.value ?? d.pk ?? d.district_id ?? d.key ?? d.ID ?? d.pk_id;
        const nameCandidate = d.name ?? d.title ?? d.label ?? d.district_name ?? d.district ?? d.display_name;
        const id = idCandidate != null ? String(idCandidate) : String(i + 1);
        const name = nameCandidate || String(d);
        return { id, name };
      })
      .filter(Boolean);
  };

  // load districts if parent didn't supply them
  useEffect(() => {
    const provided = normalizePropDistricts(districts || []);
    if (provided.length > 0) {
      setLocalDistricts(provided);
      setDistrictsError(null);
      return;
    }

    let mounted = true;
    const ctrl = new AbortController();
    setDistrictsLoading(true);
    setDistrictsError(null);

    axios
      .get('/districts', { signal: ctrl.signal })
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res.data)
          ? res.data
              .map((d, i) => {
                const idCandidate = d.id ?? d.ID ?? d.pk ?? d.value;
                const nameCandidate = d.name ?? d.title ?? d.label ?? d.district_name;
                return { id: idCandidate != null ? String(idCandidate) : String(i + 1), name: nameCandidate || '' };
              })
              .filter((x) => x.name)
          : [];
        setLocalDistricts(list);
      })
      .catch((err) => {
        if (!mounted) return;
        if (axios.isCancel && axios.isCancel(err)) return;
        setDistrictsError(err.response?.data?.error || err.message || 'Failed to load districts');
      })
      .finally(() => {
        if (!mounted) return;
        setDistrictsLoading(false);
      });

    return () => {
      mounted = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(districts)]);

  // Helpers: format and parse title
  // Store `title` in DB as either:
  // - "Event Name — Organizer"
  // - "Event Name - Organizer"
  // - or just "Event Name"
  const formatTitle = (name, org) => {
    const n = (name || '').trim();
    const o = (org || '').trim();
    if (!n) return '';
    return o ? `${n} — ${o}` : n;
  };

  const parseTitle = (raw = '') => {
    if (!raw) return { name: '', organizer: '' };
    let t = String(raw).trim();

    // accept separators —, -, | (common)
    // prefer the long em-dash or fancy dash first
    const separators = [/—/, / - /, /–/, /\|/, / -/ , /-/];
    for (const sep of separators) {
      if (sep.test(t)) {
        const parts = t.split(sep);
        const name = parts.shift().trim();
        const organizer = parts.join(' ').trim();
        return { name, organizer };
      }
    }
    // fallback: whole string is event name
    return { name: t, organizer: '' };
  };

  // set form fields from editing when modal opens
  useEffect(() => {
    if (editing) {
      // parse title into eventName + organizer
      const rawTitle = editing.title || editing.name || editing.event_name || '';
      const parsed = parseTitle(rawTitle);
      setEventName(parsed.name || '');
      setOrganizer(parsed.organizer || '');

      setDescription(editing.description || editing.desc || '');
      // date -> yyyy-mm-dd (safe split on T)
      if (editing.event_date) {
        setEventDate(String(editing.event_date).split('T')[0]);
      } else if (editing.eventDate) {
        setEventDate(String(editing.eventDate).split('T')[0]);
      } else {
        setEventDate('');
      }

      // determine district id from several possible shapes
      let dId = '';
      if (editing.district_id != null) dId = editing.district_id;
      else if (editing.districtId != null) dId = editing.districtId;
      else if (editing.district && editing.district.id != null) dId = editing.district.id;
      else if (editing.district != null) dId = editing.district;
      setDistrictId(dId !== null && dId !== undefined && dId !== '' ? String(dId) : '');

      setVenue(editing.venue || '');
      setAddress(editing.address || '');
      setTicketUrl(editing.ticket_url || editing.ticketUrl || '');

      const existingImage =
        editing.image_url || editing.image || editing.imagePath || editing.image_path || editing.photo_url || null;
      setImagePreview(existingImage ? resolveBackendUrl(existingImage) : null);
    } else {
      // reset
      setEventName('');
      setOrganizer('');
      setDescription('');
      setEventDate('');
      setDistrictId('');
      setVenue('');
      setAddress('');
      setTicketUrl('');
      setImagePreview(null);
    }
    setImage(null);
    setError(null);

    // cleanup blob preview on unmount/hide
    return () => {
      if (previewBlobRef.current && typeof previewBlobRef.current === 'string' && previewBlobRef.current.indexOf('blob:') === 0) {
        try {
          URL.revokeObjectURL(previewBlobRef.current);
        } catch (e) {}
        previewBlobRef.current = null;
      }
    };
  }, [editing, show]); // intentionally depend on editing and modal visibility

  const handleImageChange = (e) => {
    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    if (!f) {
      setImage(null);
      const existingImage = editing ? (editing.image_url ? resolveBackendUrl(editing.image_url) : null) : null;
      setImagePreview(existingImage);
      return;
    }

    if (!f.type || f.type.indexOf('image/') !== 0) {
      setError('Selected file is not an image');
      return;
    }

    // revoke any previous blob URL
    if (previewBlobRef.current && previewBlobRef.current.indexOf('blob:') === 0) {
      try {
        URL.revokeObjectURL(previewBlobRef.current);
      } catch (e) {}
      previewBlobRef.current = null;
    }

    const previewUrl = URL.createObjectURL(f);
    previewBlobRef.current = previewUrl;
    setImage(f);
    setImagePreview(previewUrl);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Basic validation
    if (!eventName.trim()) {
      setError('Please provide an event name.');
      setSaving(false);
      return;
    }
    if (!eventDate) {
      setError('Please select an event date.');
      setSaving(false);
      return;
    }
    if (!districtId) {
      setError('Please select a district.');
      setSaving(false);
      return;
    }

    const finalTitle = formatTitle(eventName, organizer);
    if (finalTitle.length > 255) {
      setError('Composed title is too long (over 255 characters). Shorten event name or organizer.');
      setSaving(false);
      return;
    }

    try {
      const fd = new FormData();
      fd.append('title', finalTitle); // still single title column in DB
      fd.append('description', description || '');
      fd.append('event_date', eventDate || '');
      fd.append('district_id', districtId || '');
      fd.append('venue', venue || '');
      fd.append('address', address || '');
      fd.append('ticket_url', ticketUrl || '');
      if (image) fd.append('image', image);

      if (editing && editing.id) {
        const res = await axios.put(`/events/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setToast({ show: true, message: 'Event updated', variant: 'success' });
        onSaved && onSaved(res.data);
      } else {
        const res = await axios.post('/events', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setToast({ show: true, message: 'Event added', variant: 'success' });
        onSaved && onSaved(res.data);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Failed to save event';
      setError(msg);
      setToast({ show: true, message: msg, variant: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ToastMessage
        show={toast.show}
        onClose={() => setToast((s) => ({ ...s, show: false }))}
        message={toast.message}
        variant={toast.variant}
        delay={3500}
        position="top-end"
      />

      <Modal show={show} onHide={onHide} centered>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editing ? 'Edit Event' : 'Add Event'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <div className="alert alert-danger">{error}</div>}

            <Row>
              <Col md={8}>
                <Form.Group className="mb-3">
                  <Form.Label>Event Name</Form.Label>
                  <Form.Control
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g., Backyard Beats Summer Jam"
                    required
                  />
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Organizer (optional)</Form.Label>
                  <Form.Control
                    value={organizer}
                    onChange={(e) => setOrganizer(e.target.value)}
                    placeholder="e.g., aRelic Promotions"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description — what to expect, lineup, age restrictions, etc."
              />
            </Form.Group>

            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Date</Form.Label>
                  <Form.Control type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>District</Form.Label>
                  <Form.Select value={districtId} onChange={(e) => setDistrictId(e.target.value)} required>
                    <option value="">{districtsLoading ? 'Loading districts...' : 'Select District'}</option>
                    {localDistricts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Form.Select>
                  {districtsError && <div className="small text-danger mt-1">{districtsError}</div>}
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Venue</Form.Label>
                  <Form.Control value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g., Chitipa Community Grounds" />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Address</Form.Label>
              <Form.Control value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area, landmark" />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Ticket URL</Form.Label>
              <Form.Control value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} placeholder="https://ticketing.example.com/event/123" />
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
                    onError={(ev) => {
                      ev.currentTarget.onerror = null;
                      ev.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        eventName || 'Event'
                      )}&background=eee&color=777&size=128`;
                    }}
                    alt="Event preview"
                  />
                  <div className="ms-3">
                    <div className="small text-muted">Preview</div>
                    <div className="mt-2 d-flex gap-2">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => {
                          // remove selection, restore existing remote image if any
                          if (previewBlobRef.current && previewBlobRef.current.indexOf('blob:') === 0) {
                            try {
                              URL.revokeObjectURL(previewBlobRef.current);
                            } catch (e) {}
                            previewBlobRef.current = null;
                          }
                          setImage(null);
                          const existingImage = editing ? (editing.image_url ? resolveBackendUrl(editing.image_url) : null) : null;
                          setImagePreview(existingImage);
                        }}
                      >
                        Remove selection
                      </Button>

                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => {
                          // clear all image fields and preview
                          if (previewBlobRef.current && previewBlobRef.current.indexOf('blob:') === 0) {
                            try {
                              URL.revokeObjectURL(previewBlobRef.current);
                            } catch (e) {}
                            previewBlobRef.current = null;
                          }
                          setImage(null);
                          setImagePreview(null);
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Form.Group>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={onHide} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={saving}>
              {saving ? (
                <>
                  <LoadingSpinner inline size="sm" ariaLabel="Saving" /> <span className="ms-2">Saving...</span>
                </>
              ) : editing ? (
                'Update Event'
              ) : (
                'Add Event'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}