import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from '../api/axiosConfig';
import { Card, Button, Alert, Row, Col, Badge } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import {
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaTicketAlt,
  FaClock,
  FaUsers,
  FaPhoneAlt,
  FaCar,
  FaAccessibleIcon,
  FaTshirt,
  FaGift,
  FaMusic,
  FaInfoCircle,
  FaShareAlt,
  FaCheckCircle,
  FaQuestionCircle
} from 'react-icons/fa';

const SUPPORT_EMAIL = 'support@backyardbeats.local';
const SUPPORT_URL = '/support';

function getBackendBase() {
  try {
    return (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:3001';
  } catch {
    return process.env.REACT_APP_API_URL || 'http://localhost:3001';
  }
}

function resolveImage(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;

  const base = getBackendBase().replace(/\/$/, '');
  if (url.startsWith('/')) return `${base}${url}`;
  if (url.startsWith('uploads/')) return `${base}/${url}`;
  return `${base}/uploads/${url}`;
}

// Helper to parse description into sections (if stored as key: value lines)
// Falls back to displaying as plain text with line breaks.
const parseDescription = (desc) => {
  if (!desc) return { sections: [], plain: '' };
  const lines = desc.split('\n\n'); // split by double newline (paragraphs)
  return { sections: lines, plain: desc };
};

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rsvpStatus, setRsvpStatus] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    axios.get(`/events/${id}`)
      .then(res => {
        if (cancelled) return;
        setEvent(res.data || null);
      })
      .catch(err => {
        if (!cancelled) {
          setEvent(null);
          setError(err.response?.data?.error || 'Failed to load event');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  // load user's RSVP for this event (if logged in)
  useEffect(() => {
    if (!user || !user.id) {
      setRsvpStatus(null);
      return;
    }

    let cancelled = false;
    axios.get('/events/my/rsvps')
      .then(res => {
        if (cancelled) return;
        const found = (res.data || []).find(r => Number(r.event_id) === Number(id));
        setRsvpStatus(found ? found.status : null);
      })
      .catch(() => {
        if (!cancelled) setRsvpStatus(null);
      });

    return () => { cancelled = true; };
  }, [user, id]);

  const isEventApproved = (ev) => !!(ev && (ev.is_approved || ev.isApproved));
  const isArtistApproved = (ev) => {
    if (!ev) return false;
    if (ev.artist && typeof ev.artist.is_approved !== 'undefined') return !!ev.artist.is_approved;
    if (typeof ev.artist_is_approved !== 'undefined') return !!ev.artist_is_approved;
    return true;
  };
  const isArtistRejected = (ev) => {
    if (!ev) return false;
    if (ev.artist && typeof ev.artist.is_rejected !== 'undefined') return !!ev.artist.is_rejected;
    if (typeof ev.artist_is_rejected !== 'undefined') return !!ev.artist_is_rejected;
    return false;
  };
  const isArtistBannedOrDeleted = (ev) => {
    if (!ev) return false;
    if (ev.artist && (ev.artist.user_banned || ev.artist.user_deleted_at)) return true;
    if (typeof ev.user_banned !== 'undefined' && ev.user_banned) return true;
    if (typeof ev.user_deleted_at !== 'undefined' && ev.user_deleted_at) return true;
    return false;
  };

  const rsvpAllowed = (ev) => {
    if (!ev) return false;
    if (!isEventApproved(ev)) return false;
    if (!isArtistApproved(ev)) return false;
    if (isArtistRejected(ev)) return false;
    if (isArtistBannedOrDeleted(ev)) return false;
    return true;
  };

  const doRsvp = async (status = 'going') => {
    if (!user || !user.id) {
      window.location.href = '/login';
      return;
    }
    if (!event) return;
    if (!rsvpAllowed(event)) {
      alert('This event is not open for public RSVPs.');
      return;
    }
    setProcessing(true);
    try {
      const res = await axios.post(`/events/${id}/rsvp`, { status });
      const newStatus = res.data?.status || status;
      setRsvpStatus(newStatus);
      setEvent(prev => prev ? {
        ...prev,
        rsvp_counts: {
          ...(prev.rsvp_counts || {}),
          [newStatus]: (prev.rsvp_counts?.[newStatus] || 0) + 1
        }
      } : prev);
    } catch (err) {
      alert(err.response?.data?.error || 'RSVP failed');
    } finally {
      setProcessing(false);
    }
  };

  const cancelRsvp = async () => {
    if (!user || !user.id) {
      window.location.href = '/login';
      return;
    }
    setProcessing(true);
    try {
      await axios.delete(`/events/${id}/rsvp`);
      setRsvpStatus(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Cancel failed');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="text-center py-4">Loading event...</div>;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!event) return <Alert variant="warning">Event not found</Alert>;

  const districtName = event.district_name || event.district || (event.district_id ? `#${event.district_id}` : 'TBA');
  const artistDisplayName = event.artist?.display_name || event.artist_display_name || event.artistName || (event.artist && (event.artist.displayName || event.artist.username)) || null;
  const artistId = event.artist?.id || event.artist_id || event.artistId || null;

  const showRejectedBanner = !!(event.is_rejected || event.isRejected || (event.is_approved === 0 && event.rejection_reason));
  const showPendingBanner = !!(event.is_approved === 0 && !showRejectedBanner);
  const eventRejectedReason = event.rejection_reason || event.rejectionReason || null;

  // Parse description into sections
  const { sections } = parseDescription(event.description);

  return (
    <Card className="shadow-sm border-0">
      <Card.Body className="p-4">
        {showPendingBanner && (
          <Alert variant="warning" className="mb-4">
            <FaInfoCircle className="me-2" />
            This event is pending approval. It is currently visible only to you (the artist) and not public.
          </Alert>
        )}
        {showRejectedBanner && (
          <Alert variant="danger" className="mb-4">
            <div><strong>Event rejected.</strong></div>
            {eventRejectedReason && <div className="small text-danger mt-1">Reason: {eventRejectedReason}</div>}
            <div className="small mt-2">
              <a href={SUPPORT_URL}>Contact support</a> or <a href={`mailto:${SUPPORT_EMAIL}`}>email support</a> to appeal.
            </div>
          </Alert>
        )}
        {isArtistRejected(event) && (
          <Alert variant="danger" className="mb-4">
            <div className="small">Your artist profile was rejected — this event will remain private until your profile is approved.</div>
            <div className="small mt-2">
              <a href={SUPPORT_URL}>Contact support</a> or <a href={`mailto:${SUPPORT_EMAIL}`}>email support</a>
            </div>
          </Alert>
        )}
        {isArtistBannedOrDeleted(event) && (
          <Alert variant="danger" className="mb-4">Artist account is banned or deleted — event not available.</Alert>
        )}

        {/* Event Image */}
        {event.image_url && (
          <div className="mb-4 text-center">
            <img
              src={resolveImage(event.image_url)}
              alt={event.title}
              className="img-fluid rounded"
              style={{ maxHeight: 400, objectFit: 'cover', width: '100%' }}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = 'https://placehold.co/800x400?text=Event';
              }}
            />
          </div>
        )}

        <h2 className="mb-3 fw-bold">{event.title}</h2>

        <Row className="mb-4">
          <Col md={6}>
            <div className="d-flex align-items-center mb-2 text-muted">
              <FaCalendarAlt className="me-2" />
              <span>{event.event_date ? new Date(event.event_date).toLocaleString() : 'TBA'}</span>
            </div>
            <div className="d-flex align-items-center mb-2 text-muted">
              <FaMapMarkerAlt className="me-2" />
              <span>{districtName}</span>
            </div>
            {event.venue && (
              <div className="d-flex align-items-center mb-2 text-muted">
                <FaMapMarkerAlt className="me-2" />
                <span>{event.venue}</span>
              </div>
            )}
          </Col>
          <Col md={6}>
            {artistDisplayName && (
              <div className="d-flex align-items-center mb-2">
                <FaMusic className="me-2 text-success" />
                <strong>Artist: </strong>
                {artistId ? (
                  <Link to={`/artist/${artistId}`} className="ms-1">{artistDisplayName}</Link>
                ) : (
                  <span className="ms-1">{artistDisplayName}</span>
                )}
              </div>
            )}
            {event.ticket_url && (
              <div className="d-flex align-items-center mb-2">
                <FaTicketAlt className="me-2 text-success" />
                <a href={event.ticket_url} target="_blank" rel="noreferrer" className="text-decoration-none">Buy Tickets</a>
              </div>
            )}
          </Col>
        </Row>

        {/* Description – nicely formatted */}
        {event.description && (
          <Card className="bg-light border-0 mb-4">
            <Card.Body>
              <h5 className="mb-3">Event Details</h5>
              {sections.length > 1 ? (
                sections.map((paragraph, idx) => {
                  // Try to detect if paragraph starts with a known label
                  const lower = paragraph.toLowerCase();
                  let icon = null;
                  if (lower.startsWith('highlights')) icon = <FaInfoCircle className="me-2 text-success" />;
                  else if (lower.startsWith('lineup')) icon = <FaUsers className="me-2 text-success" />;
                  else if (lower.startsWith('schedule')) icon = <FaClock className="me-2 text-success" />;
                  else if (lower.startsWith('tickets')) icon = <FaTicketAlt className="me-2 text-success" />;
                  else if (lower.startsWith('age')) icon = <FaCheckCircle className="me-2 text-success" />;
                  else if (lower.startsWith('parking')) icon = <FaCar className="me-2 text-success" />;
                  else if (lower.startsWith('accessibility')) icon = <FaAccessibleIcon className="me-2 text-success" />;
                  else if (lower.startsWith('contact')) icon = <FaPhoneAlt className="me-2 text-success" />;
                  else if (lower.startsWith('presented')) icon = <FaGift className="me-2 text-success" />;
                  else if (lower.startsWith('dress')) icon = <FaTshirt className="me-2 text-success" />;
                  else icon = <FaInfoCircle className="me-2 text-muted" />;

                  return (
                    <div key={idx} className="mb-3 d-flex">
                      <div className="me-2 mt-1">{icon}</div>
                      <div style={{ whiteSpace: 'pre-line', flex: 1 }}>{paragraph}</div>
                    </div>
                  );
                })
              ) : (
                <div style={{ whiteSpace: 'pre-line' }}>{event.description}</div>
              )}
            </Card.Body>
          </Card>
        )}

        {/* RSVP section */}
        <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
          {!rsvpAllowed(event) && (
            <Badge bg="secondary" className="me-2 p-2">
              RSVPs disabled (event not public)
            </Badge>
          )}

          {rsvpStatus ? (
            <>
              <Badge bg="success" className="p-2">You're {rsvpStatus}</Badge>
              <Button variant="outline-danger" size="sm" onClick={cancelRsvp} disabled={processing || !rsvpAllowed(event)}>
                Cancel RSVP
              </Button>
            </>
          ) : (
            <>
              <Button variant="success" size="sm" onClick={() => doRsvp('going')} disabled={processing || !rsvpAllowed(event)}>
                <FaCheckCircle className="me-1" /> I'm going
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={() => doRsvp('interested')} disabled={processing || !rsvpAllowed(event)}>
                <FaQuestionCircle className="me-1" /> Interested
              </Button>
            </>
          )}

          <Button variant="outline-secondary" size="sm" onClick={() => navigator.clipboard?.writeText(window.location.href)} title="Copy event link">
            <FaShareAlt className="me-1" /> Share
          </Button>
        </div>

        {/* RSVP counts */}
        {event.rsvp_counts && (
          <div className="small text-muted mb-3 d-flex gap-3">
            {Object.entries(event.rsvp_counts).map(([k, v]) => (
              <span key={k}>
                <strong>{k}:</strong> {v}
              </span>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}