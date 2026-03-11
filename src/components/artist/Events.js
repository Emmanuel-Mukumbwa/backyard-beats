import React from 'react';
import { Badge } from 'react-bootstrap';

export default function EventsPanel({ events = [] }) {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="mb-0">Upcoming Events</h5>
        <div className="small text-muted">{events.length}</div>
      </div>

      {events.length > 0 ? (
        <div className="list-group">
          {events.map(ev => (
            <div key={ev.id} className="list-group-item">
              <div className="d-flex justify-content-between">
                <div>
                  <div className="fw-bold">{ev.title}</div>
                  <div className="small text-muted">{ev.district || ev.district_name || ''} • {ev.event_date ? new Date(ev.event_date).toLocaleDateString() : 'TBA'}</div>
                </div>
                <div>
                  {!ev.is_approved && <Badge bg="warning" text="dark">Pending</Badge>}
                  {ev.is_rejected && <Badge bg="danger">Rejected</Badge>}
                </div>
              </div>
              {ev.is_rejected && ev.rejection_reason ? <div className="small text-danger mt-1">Reason: {ev.rejection_reason}</div> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted">No upcoming events.</div>
      )}
    </>
  );
}