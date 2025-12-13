// src/components/MyEvents.jsx
import React, { useEffect, useState, useContext } from 'react';
import axios from '../api/axiosConfig';
import { AuthContext } from '../context/AuthContext';
import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function MyEvents() {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await axios.get('/events/my/rsvps');
        if (!cancelled) setItems(res.data || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || err.message || 'Failed to load RSVPs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (user && user.id) load();
    else setLoading(false);
    return () => { cancelled = true; };
  }, [user]);

  if (loading) return <div>Loading your events...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!items.length) return <div className="text-muted">You have no RSVPs yet.</div>;

  return (
    <div>
      {items.map(i => (
        <Card className="mb-3" key={i.id}>
          <Card.Body className="d-flex justify-content-between align-items-center">
            <div>
              <div className="fw-bold">{i.title}</div>
              <div className="small text-muted">{i.venue || ''} • {i.event_date ? new Date(i.event_date).toLocaleString() : 'TBA'}</div>
              <div className="small">Status: {i.status}</div>
            </div>
            <div className="text-end">
              <Link to={`/events/${i.event_id}`} className="btn btn-outline-primary btn-sm me-2">View</Link>
              <Button variant="outline-danger" size="sm" onClick={async () => {
                try {
                  await axios.delete(`/events/${i.event_id}/rsvp`);
                  setItems(items.filter(x => x.event_id !== i.event_id));
                } catch (err) {
                  alert('Cancel failed');
                }
              }}>Cancel RSVP</Button>
            </div>
          </Card.Body>
        </Card>
      ))}
    </div>
  );
}
