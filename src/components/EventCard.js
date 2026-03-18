import React from 'react';
import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from '../api/axiosConfig';

/**
 * EventCard
 * - image on the left, content on the right (md+)
 * - stacks vertically on small screens
 * - image uses object-fit: contain so nothing is cropped
 */

function getApiBase() {
  try {
    return (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:3001';
  } catch {
    return process.env.REACT_APP_API_URL || 'http://localhost:3001';
  }
}

function resolveImage(url) {
  if (!url) return null;

  // absolute
  if (/^https?:\/\//i.test(url)) return url;

  const base = getApiBase().replace(/\/$/, '');

  // consistent upload paths
  if (url.startsWith('/uploads')) return `${base}${url}`;
  if (url.startsWith('uploads/')) return `${base}/${url}`;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

export default function EventCard({ event = {} }) {
  const title = event.title || 'Untitled Event';
  const dateLabel = event.event_date ? new Date(event.event_date).toLocaleDateString() : 'TBA';
  const district = event.district || event.district_name || '';
  const description = event.description || '';
  const imgUrl = resolveImage(event.image_url || event.image || event.banner || '');

  // placeholder static image (keeps same aspect visually)
  const placeholder = 'https://placehold.co/600x300?text=Event';

  return (
    <>
      <style>{`
        .event-card { margin-bottom: 1rem; }
        .event-card .content-wrap { display:flex; gap:1rem; align-items:stretch; }
        @media (max-width: 767.98px) {
          .event-card .content-wrap { flex-direction: column; }
          .event-card .event-image { width: 100%; height: 180px; }
        }
        @media (min-width: 768px) {
          .event-card .content-wrap { flex-direction: row; }
          .event-card .event-image { width: 260px; height: 160px; flex: 0 0 260px; }
        }
        .event-card .event-image { background: #f6f6f6; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:6px; }
        .event-card .event-image img { width:100%; height:100%; object-fit:contain; display:block; }
        .event-card .event-body { flex:1 1 auto; display:flex; flex-direction:column; justify-content:space-between; min-width:0; }
        .event-card .title { margin:0; font-size:1.05rem; font-weight:600; }
        .event-card .meta { color:#6c757d; font-size:.9rem; margin-top:.25rem; }
        .event-card .desc { margin-top:.6rem; color:#495057; max-height:3.6rem; overflow:hidden; text-overflow:ellipsis; }
        .event-card .actions { margin-left:auto; }
      `}</style>

      <Card className="event-card">
        <Card.Body className="p-3">
          <div className="content-wrap">
            <div className="event-image" aria-hidden={imgUrl ? 'false' : 'true'}>
              <img
                src={imgUrl || placeholder}
                alt={title}
                onError={(e) => {
                  // avoid infinite loop if placeholder fails
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = placeholder;
                }}
              />
            </div>

            <div className="event-body">
              <div style={{ minWidth: 0 }}>
                <h5 className="title">{title}</h5>
                <div className="meta">
                  {district ? <>{district} • </> : null}
                  <span>{dateLabel}</span>
                </div>

                <div className="desc" title={description}>
                  {description || <span className="text-muted">No description provided.</span>}
                </div>
              </div>

              <div className="d-flex align-items-center mt-3">
                <div className="me-2">
                  <Link to={`/events/${event.id}`} className="btn btn-success btn-sm">View</Link>
                </div>

                {event.ticket_url ? (
                  <div>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      as="a"
                      href={event.ticket_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Tickets
                    </Button>
                  </div>
                ) : null}

                <div style={{ marginLeft: 'auto' }} className="text-muted small">
                  {event.venue || ''}
                </div>
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>
    </>
  );
}