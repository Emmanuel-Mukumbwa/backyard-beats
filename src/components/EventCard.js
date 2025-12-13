// src/components/EventCard.jsx
import React from 'react';
import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function EventCard({ event }) {
  const dateLabel = event.event_date ? new Date(event.event_date).toLocaleDateString() : 'TBA';
  // If image_url is present, prefer it. For dev you can use local uploaded file path for testing:
  // e.g. '/mnt/data/artistphotos.png' (only works in your dev environment if accessible)
  const img = event.image_url || event.image || '/assets/placeholder-event.jpg';

  return (
    <Card className="mb-3">
      {img && (
        <div style={{ height: 140, overflow: 'hidden' }}>
          <img src={img} alt={event.title} style={{ width: '100%', objectFit: 'cover' }} onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/assets/placeholder-event.jpg';
          }} />
        </div>
      )}
      <Card.Body>
        <div className="d-flex justify-content-between">
          <div>
            <h5>{event.title}</h5>
            <div className="small text-muted">{event.district || ''} • {dateLabel}</div>
            <div className="mt-2 text-truncate" style={{ maxWidth: 420 }}>{event.description}</div>
          </div>
          <div className="text-end">
            <Link to={`/events/${event.id}`} className="btn btn-success">View</Link>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
