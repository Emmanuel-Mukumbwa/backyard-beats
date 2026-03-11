// src/components/artist/EventsPanel.jsx
import React from 'react';
import { Table, Button, Image, Badge } from 'react-bootstrap';
import { FaCalendarAlt, FaEdit, FaTrash } from 'react-icons/fa';
import PropTypes from 'prop-types';

export default function EventsPanel({ events, onEdit, onDelete, resolveEventImage, districtsMap = () => null, supportUrl = '/support', supportEmail = 'support@backyardbeats.local' }) {
  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div />
        <div className="small text-muted">Create and manage upcoming gigs</div>
      </div>

      <Table striped hover responsive>
        <thead>
          <tr>
            <th style={{ width: 80 }}>Image</th>
            <th>Title</th>
            <th>Date</th>
            <th>District</th>
            <th>Venue</th>
            <th style={{ width: 140 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map(ev => {
            const itemStatus = ev.is_approved ? 'approved' : (ev.is_rejected ? 'rejected' : 'pending');
            const imgSrc = resolveEventImage(ev);
            return (
              <tr key={ev.id}>
                <td className="align-middle">
                  {imgSrc ? (
                    <a href={imgSrc} target="_blank" rel="noreferrer">
                      <Image
                        src={imgSrc}
                        rounded
                        style={{ width: 64, height: 64, objectFit: 'cover' }}
                        alt={ev.title || 'Event image'}
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(ev.title || 'Event')}&background=eee&color=777&size=128`; }}
                      />
                    </a>
                  ) : (
                    <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f3f5', color: '#6c757d', borderRadius: 6 }}>
                      <FaCalendarAlt />
                    </div>
                  )}
                </td>

                <td className="align-middle">
                  <div><strong>{ev.title}</strong></div>
                  <div>
                    {itemStatus === 'approved' && <Badge bg="success" className="me-2">Approved</Badge>}
                    {itemStatus === 'pending' && <Badge bg="warning" text="dark" className="me-2">Pending</Badge>}
                    {itemStatus === 'rejected' && <Badge bg="danger" className="me-2">Rejected</Badge>}
                  </div>
                  {ev.is_rejected && ev.rejection_reason && (
                    <div className="mt-1"><small className="text-danger">Reason: {ev.rejection_reason}</small></div>
                  )}
                  {ev.is_rejected && (
                    <div className="mt-1">
                      <small>
                        <a href={supportUrl}>Contact support</a> or <a href={`mailto:${supportEmail}`}>email support</a> to appeal.
                      </small>
                    </div>
                  )}
                </td>

                <td className="align-middle">{ev.event_date ? new Date(ev.event_date).toLocaleDateString() : '-'}</td>
                <td className="align-middle">{ev.district_id ? (ev.district_name || districtsMap(ev.district_id) || ev.district_id) : '-'}</td>
                <td className="align-middle">{ev.venue || '-'}</td>
                <td className="align-middle">
                  <div className="d-flex gap-2">
                    <Button size="sm" variant="outline-primary" onClick={() => onEdit(ev)}>
                      <FaEdit className="me-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => onDelete(ev.id)}>
                      <FaTrash className="me-1" /> Delete
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}

          {events.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-muted">No events yet — create your first event.</td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}

EventsPanel.propTypes = {
  events: PropTypes.array.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  resolveEventImage: PropTypes.func.isRequired,
  districtsMap: PropTypes.func,
  supportUrl: PropTypes.string,
  supportEmail: PropTypes.string
};