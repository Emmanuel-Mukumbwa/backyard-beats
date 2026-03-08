// src/components/EventCard.jsx
import React from 'react';
import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function resolveImage(url) {
  if (!url) return null;

  // already absolute
  if (url.startsWith('http')) return url;

  // relative upload path -> attach API base
  const base = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  if (url.startsWith('/uploads')) return `${base}${url}`;

  return url;
}

export default function EventCard({ event }) {
  const dateLabel = event.event_date
    ? new Date(event.event_date).toLocaleDateString()
    : 'TBA';

  const img = resolveImage(event.image_url || event.image);

  return (
    <Card className="mb-3">
      {img && (
        <div style={{ height: 140, overflow: 'hidden' }}>
          <img
            src={img}
            alt={event.title}
            style={{ width: '100%', objectFit: 'cover', height: '100%' }}
            onError={(e) => {
              // stop infinite loop
              e.currentTarget.onerror = null;

              // fallback placeholder
              e.currentTarget.src =
                'https://placehold.co/600x300?text=Event';
            }}
          />
        </div>
      )}

      <Card.Body>
        <div className="d-flex justify-content-between">
          <div>
            <h5>{event.title}</h5>
            <div className="small text-muted">
              {event.district || ''} • {dateLabel}
            </div>

            <div
              className="mt-2 text-truncate"
              style={{ maxWidth: 420 }}
            >
              {event.description}
            </div>
          </div>

          <div className="text-end">
            <Link to={`/events/${event.id}`} className="btn btn-success">
              View
            </Link>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}