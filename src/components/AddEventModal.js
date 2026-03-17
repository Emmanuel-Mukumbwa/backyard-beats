// src/components/AddEventModal.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Modal, Button, Form, Row, Col, Image } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import LoadingSpinner from './LoadingSpinner';
import ToastMessage from './ToastMessage';

export default function AddEventModal({
  show,
  onHide,
  onSaved,
  editing = null,
  districts = [],
  adminMode = false,
  artists = [],
}) {
  // Split title: eventName + organizer (optional)
  const [eventName, setEventName] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [selectedArtistId, setSelectedArtistId] = useState(''); // for admin mode

  // New split description fields
  const [whatToExpect, setWhatToExpect] = useState('');
  const [lineup, setLineup] = useState('');
  const [ageRestriction, setAgeRestriction] = useState('');
  // For editing we still keep a combined description field
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
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

  const [localDistricts, setLocalDistricts] = useState([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [districtsError, setDistrictsError] = useState(null);

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

  const normalizePropDistricts = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((d, i) => {
        if (!d) return null;
        if (typeof d === 'string' || typeof d === 'number') {
          return { id: String(i + 1), name: String(d) };
        }
        const idCandidate = d.id ?? d.value ?? d.pk ?? d.district_id ?? d.key ?? d.ID ?? d.pk_id;
        const nameCandidate = d.name ?? d.title ?? d.label ?? d.district_name ?? d.district ?? d.display_name;
        const id = idCandidate != null ? String(idCandidate) : String(i + 1);
        const name = nameCandidate || String(d);
        return { id, name };
      })
      .filter(Boolean);
  };

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
  }, [districts]);

  const formatTitle = (name, org) => {
    const n = (name || '').trim();
    const o = (org || '').trim();
    if (!n) return '';
    return o ? `${n} — ${o}` : n;
  };

  const parseTitle = (raw = '') => {
    if (!raw) return { name: '', organizer: '' };
    let t = String(raw).trim();
    const separators = [/—/, / - /, /–/, /\|/, / -/ , /-/];
    for (const sep of separators) {
      if (sep.test(t)) {
        const parts = t.split(sep);
        const name = parts.shift().trim();
        const organizer = parts.join(' ').trim();
        return { name, organizer };
      }
    }
    return { name: t, organizer: '' };
  };

  // set form fields from editing when modal opens
  useEffect(() => {
    if (editing) {
      const rawTitle = editing.title || editing.name || editing.event_name || '';
      const parsed = parseTitle(rawTitle);
      setEventName(parsed.name || '');
      setOrganizer(parsed.organizer || '');

      // For editing, we keep the combined description field
      setDescription(editing.description || editing.desc || '');

      if (editing.event_date) {
        setEventDate(String(editing.event_date).split('T')[0]);
      } else if (editing.eventDate) {
        setEventDate(String(editing.eventDate).split('T')[0]);
      } else {
        setEventDate('');
      }

      let dId = '';
      if (editing.district_id != null) dId = editing.district_id;
      else if (editing.districtId != null) dId = editing.districtId;
      else if (editing.district && editing.district.id != null) dId = editing.district.id;
      else if (editing.district != null) dId = editing.district;
      setDistrictId(dId !== null && dId !== undefined && dId !== '' ? String(dId) : '');

      setVenue(editing.venue || '');
      setAddress(editing.address || '');
      setTicketUrl(editing.ticket_url || editing.ticketUrl || '');

      const existingImage = editing.image_url || editing.image || editing.imagePath || editing.image_path || editing.photo_url || null;
      setImagePreview(existingImage ? resolveBackendUrl(existingImage) : null);

      if (adminMode && editing.artist_id) {
        setSelectedArtistId(String(editing.artist_id));
      }
    } else {
      // Reset all fields for new event
      setEventName('');
      setOrganizer('');
      setDescription('');
      setWhatToExpect('');
      setLineup('');
      setAgeRestriction('');
      setEventDate('');
      setDistrictId('');
      setVenue('');
      setAddress('');
      setTicketUrl('');
      setImagePreview(null);
      setSelectedArtistId('');
    }
    setImage(null);
    setError(null);

    return () => {
      if (previewBlobRef.current && typeof previewBlobRef.current === 'string' && previewBlobRef.current.indexOf('blob:') === 0) {
        try { URL.revokeObjectURL(previewBlobRef.current); } catch (e) {}
        previewBlobRef.current = null;
      }
    };
  }, [editing, show, adminMode]);

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
    if (previewBlobRef.current && previewBlobRef.current.indexOf('blob:') === 0) {
      try { URL.revokeObjectURL(previewBlobRef.current); } catch (e) {}
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
    if (adminMode && !selectedArtistId) {
      setError('Please select an artist.');
      setSaving(false);
      return;
    }

    // Build final description
    let finalDescription = '';
    if (editing) {
      // When editing, use the combined description field
      finalDescription = description.trim();
    } else {
      // For new event, combine the split fields
      const parts = [];
      if (whatToExpect.trim()) parts.push(`What to expect: ${whatToExpect.trim()}`);
      if (lineup.trim()) parts.push(`Lineup: ${lineup.trim()}`);
      if (ageRestriction.trim()) parts.push(`Age restriction: ${ageRestriction.trim()}`);
      finalDescription = parts.join('\n\n');
    }

    const finalTitle = formatTitle(eventName, organizer);
    if (finalTitle.length > 255) {
      setError('Composed title is too long (over 255 characters). Shorten event name or organizer.');
      setSaving(false);
      return;
    }

    try {
      const fd = new FormData();
      fd.append('title', finalTitle);
      fd.append('description', finalDescription || '');
      fd.append('event_date', eventDate || '');
      fd.append('district_id', districtId || '');
      fd.append('venue', venue || '');
      fd.append('address', address || '');
      fd.append('ticket_url', ticketUrl || '');
      if (image) fd.append('image', image);
      if (adminMode && selectedArtistId) {
        fd.append('artist_id', selectedArtistId);
      }

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
      <Modal show={show} onHide={onHide} centered size="lg">
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editing ? 'Edit Event' : (adminMode ? 'Add Event (Admin)' : 'Add Event')}</Modal.Title>
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

            {editing ? (
              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Event description (combined text)"
                />
              </Form.Group>
            ) : (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>What to Expect</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={whatToExpect}
                    onChange={(e) => setWhatToExpect(e.target.value)}
                    placeholder="e.g., Live DJ sets, food stalls, family-friendly activities"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Lineup</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={lineup}
                    onChange={(e) => setLineup(e.target.value)}
                    placeholder="e.g., Artist A, Artist B, DJ C"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Age Restriction</Form.Label>
                  <Form.Control
                    value={ageRestriction}
                    onChange={(e) => setAgeRestriction(e.target.value)}
                    placeholder="e.g., 18+, All ages, etc."
                  />
                </Form.Group>
              </>
            )}

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
                      ev.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(eventName || 'Event')}&background=eee&color=777&size=128`;
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
                          if (previewBlobRef.current && previewBlobRef.current.indexOf('blob:') === 0) {
                            try { URL.revokeObjectURL(previewBlobRef.current); } catch (e) {}
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
                          if (previewBlobRef.current && previewBlobRef.current.indexOf('blob:') === 0) {
                            try { URL.revokeObjectURL(previewBlobRef.current); } catch (e) {}
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
            <Button variant="secondary" onClick={onHide} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="success" disabled={saving}>
              {saving ? (
                <>
                  <LoadingSpinner inline size="sm" ariaLabel="Saving" /> <span className="ms-2">Saving...</span>
                </>
              ) : editing ? 'Update Event' : 'Add Event'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}