// src/pages/EventDetail.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from '../api/axiosConfig';
import { Card, Button } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';

// Resolve backend image URLs correctly
function resolveImage(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;

  const base = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  if (url.startsWith('/uploads')) return `${base}${url}`;
  return url;
}

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rsvpStatus, setRsvpStatus] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    axios.get(`/events/${id}`)
      .then(res => {
        if (!cancelled) setEvent(res.data);
      })
      .catch(() => {
        if (!cancelled) setEvent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!user || !user.id) {
      setRsvpStatus(null);
      return;
    }

    let cancelled = false;

    axios.get('/events/my/rsvps')
      .then(res => {
        if (cancelled) return;

        const found = (res.data || []).find(
          r => Number(r.event_id) === Number(id)
        );

        setRsvpStatus(found ? found.status : null);
      })
      .catch(() => {
        if (!cancelled) setRsvpStatus(null);
      });

    return () => { cancelled = true; };
  }, [user, id]);

  const doRsvp = async (status = 'going') => {
    if (!user || !user.id) {
      window.location.href = '/login';
      return;
    }

    setProcessing(true);

    try {
      const res = await axios.post(`/events/${id}/rsvp`, { status });

      const newStatus = res.data.status || status;

      setRsvpStatus(newStatus);

      setEvent(prev =>
        prev
          ? {
              ...prev,
              rsvp_counts: {
                ...(prev.rsvp_counts || {}),
                [newStatus]:
                  (prev.rsvp_counts?.[newStatus] || 0) + 1
              }
            }
          : prev
      );
    } catch (err) {
      alert(err.response?.data?.error || 'RSVP failed');
    } finally {
      setProcessing(false);
    }
  };

  const cancel = async () => {
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

  if (loading) return <div>Loading event...</div>;
  if (!event) return <div className="alert alert-warning">Event not found</div>;

  return (
    <Card>
      <Card.Body>

        {/* Event Image */}
        {event.image_url && (
          <div style={{ marginBottom: 16 }}>
            <img
              src={resolveImage(event.image_url)}
              alt={event.title}
              style={{
                width: '100%',
                maxHeight: 400,
                objectFit: 'cover',
                borderRadius: 6
              }}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src =
                  'https://placehold.co/800x400?text=Event';
              }}
            />
          </div>
        )}

        <h3>{event.title}</h3>

        <div className="small text-muted">
          {event.district} • {event.event_date ? new Date(event.event_date).toLocaleString() : 'TBA'}
        </div>

        <p className="mt-3">{event.description}</p>

        {event.artist && (
          <div className="mb-2">
            Artist:{' '}
            <Link to={`/artist/${event.artist.id}`}>
              {event.artist.displayName}
            </Link>
          </div>
        )}

        <div className="mb-3">
          <strong>Venue:</strong> {event.venue || 'TBA'}<br />
          <strong>Address:</strong> {event.address || 'TBA'}<br />
          {event.ticket_url && (
            <a href={event.ticket_url} target="_blank" rel="noreferrer">
              Buy tickets
            </a>
          )}
        </div>

        {/* RSVP controls */}
        <div className="d-flex gap-2">
          {rsvpStatus ? (
            <>
              <Button variant="outline-success" disabled>
                RSVP: {rsvpStatus}
              </Button>

              <Button
                variant="outline-danger"
                onClick={cancel}
                disabled={processing}
              >
                Cancel RSVP
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="success"
                onClick={() => doRsvp('going')}
                disabled={processing}
              >
                I'm going
              </Button>

              <Button
                variant="outline-secondary"
                onClick={() => doRsvp('interested')}
                disabled={processing}
              >
                Interested
              </Button>
            </>
          )}

          <Button variant="outline-secondary">Share</Button>
        </div>

      </Card.Body>
    </Card>
  );
}