// src/pages/Events.jsx
import React, { useEffect, useState } from 'react';
import axios from '../api/axiosConfig';
import EventCard from '../components/EventCard';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get('/events')
      .then(res => setEvents(res.data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="mb-3">Upcoming Events</h2>
      {loading && <div>Loading events...</div>}
      {!loading && events.length === 0 && <div className="text-muted">No events listed yet.</div>}
      <div>
        {events.map(ev => <EventCard key={ev.id} event={ev} />)}
      </div>
    </div>
  );
}
