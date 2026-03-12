// src/pages/Events.jsx
import React, { useEffect, useState } from 'react';
import axios from '../api/axiosConfig';
import EventCard from '../components/EventCard';
import { Alert } from 'react-bootstrap';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    axios.get('/events')
      .then(res => {
        if (cancelled) return;
        setEvents(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => {
        if (!cancelled) {
          setEvents([]);
          setError(err.response?.data?.error || 'Failed to load events');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="text-muted">Loading events...</div>;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!events.length) return <div className="text-muted">No events listed yet.</div>;

  return (
    <div>
      <h2 className="mb-3">Upcoming Events</h2>
      <div>
        {events.map(ev => <EventCard key={ev.id} event={ev} />)}
      </div>
    </div>
  );
}