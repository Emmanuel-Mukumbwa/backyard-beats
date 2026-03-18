//src/components/artist/EventsPanel.js
import React, { useEffect, useState, useRef } from 'react';
import { Table, Button, Image, Badge, Card, Row, Col, Dropdown } from 'react-bootstrap';
import { FaCalendarAlt, FaEdit, FaTrash, FaChevronRight, FaEllipsisV } from 'react-icons/fa';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axiosConfig';
import './events-panel.css'; // new CSS file (below)

/**
 * EventsPanel
 * - Desktop: table view
 * - Mobile: card/list view with compact actions dropdown
 * - Adds a subtle right-side gradient + "Swipe to see actions" hint on small screens.
 * - Hint auto-hides after user scrolls or after ~3.5s.
 */

export default function EventsPanel({
  events = [],
  onEdit,
  onDelete,
  resolveEventImage = () => null,
  districtsMap = () => null, // can be a function(id) or an object map { id: name }
  supportUrl = '/support'
}) {
  const navigate = useNavigate();
  const [ticketsMap, setTicketsMap] = useState({});

  // Scroll hint state
  const wrapperRef = useRef(null);
  const hideHintTimeoutRef = useRef(null);
  const [showHint, setShowHint] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));

  // safe getter for district name - supports function or object map
  const getDistrictName = (districtId) => {
    if (districtId === null || typeof districtId === 'undefined' || districtId === '') return null;
    try {
      if (typeof districtsMap === 'function') {
        return districtsMap(districtId) || null;
      }
      if (typeof districtsMap === 'object' && districtsMap !== null) {
        return districtsMap[districtId] || districtsMap[String(districtId)] || null;
      }
    } catch (e) {
      // fall through
    }
    return null;
  };

  useEffect(() => {
    let mounted = true;
    async function loadUserTickets() {
      try {
        const res = await axios.get('/support', { params: { limit: 200 } });
        if (!mounted) return;
        const t = res.data.tickets || [];
        const map = {};
        for (const ticket of t) {
          if (ticket.target_type && ticket.target_type !== 'none' && ticket.target_id) {
            const key = `${ticket.target_type}:${String(ticket.target_id)}`;
            if (!map[key]) map[key] = ticket;
            else {
              const prev = new Date(map[key].updated_at).getTime();
              const cur = new Date(ticket.updated_at).getTime();
              if (cur >= prev) map[key] = ticket;
            }
          }
        }
        setTicketsMap(map);
      } catch (e) {
        // ignore
      }
    }
    loadUserTickets();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    function handleResize() {
      const mobile = window.innerWidth < 768;
      setShowHint(mobile);
      setIsMobile(mobile);
      if (!mobile && wrapper.classList) wrapper.classList.add('no-hint');
    }

    function onScroll() {
      if (!showHint) return;
      setShowHint(false);
      if (wrapper.classList) wrapper.classList.add('no-hint');
      if (hideHintTimeoutRef.current) {
        clearTimeout(hideHintTimeoutRef.current);
        hideHintTimeoutRef.current = null;
      }
    }

    wrapper.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    hideHintTimeoutRef.current = setTimeout(() => {
      setShowHint(false);
      if (wrapper.classList) wrapper.classList.add('no-hint');
    }, 3500);

    return () => {
      wrapper.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', handleResize);
      if (hideHintTimeoutRef.current) clearTimeout(hideHintTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderStatusBadge = (ev) => {
    if (ev && ev.is_approved) return <Badge bg="success" className="me-2">Approved</Badge>;
    if (ev && ev.is_rejected) return <Badge bg="danger" className="me-2">Rejected</Badge>;
    return <Badge bg="warning" text="dark" className="me-2">Pending</Badge>;
  };

  const formatDate = (value) => {
    if (!value) return '-';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString();
    } catch (e) {
      return '-';
    }
  };

  const safeEvents = Array.isArray(events) ? events : [];

  function handleViewTicket(ticket) {
    if (!ticket) return;
    navigate(`/support?openTicket=${ticket.id}`);
  }

  function openAppealForEvent(ev) {
    const existingFiles = [];
    try {
      const img = resolveEventImage ? resolveEventImage(ev) : null;
      if (img) {
        existingFiles.push({ url: img, filename: `${(ev.title || 'event').replace(/\s+/g, '_')}.jpg` });
      }
    } catch (e) {
      // ignore
    }

    const subject = `Appeal: ${ev.title || 'untitled event'}`;
    const body = `Hi support,\n\nMy event "${ev.title || 'untitled'}" was rejected.${ev.rejection_reason ? `\n\nRejection reason: ${ev.rejection_reason}` : ''}\n\nPlease review the decision.\n\nThanks.`;

    const prefill = {
      subject,
      body,
      type: 'appeal',
      targetType: 'event',
      targetId: String(ev.id),
      includeTargetFile: false,
      existingFiles
    };

    navigate('/support', { state: { prefill } });
  }

  // --- mobile card renderer ---
  function renderEventCard(ev) {
    const imgSrc = resolveEventImage ? resolveEventImage(ev) : null;
    const districtName = (ev && (ev.district_name || getDistrictName(ev.district_id))) || (ev && ev.district_id ? String(ev.district_id) : null);

    const ticketKey = `event:${String(ev && ev.id)}`;
    const ticket = ticketsMap[ticketKey];

    return (
      <Card className="mb-3" key={ev && ev.id}>
        <Card.Body>
          <Row className="g-2 align-items-center">
            <Col xs={3} className="text-center">
              {imgSrc ? (
                <a href={imgSrc} target="_blank" rel="noreferrer">
                  <Image
                    src={imgSrc}
                    rounded
                    style={{ width: 64, height: 64, objectFit: 'cover' }}
                    alt={ev && (ev.title || 'Event image')}
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent((ev && ev.title) || 'Event')}&background=eee&color=777&size=128`; }}
                  />
                </a>
              ) : (
                <div className="mobile-artwork-fallback"><FaCalendarAlt /></div>
              )}
            </Col>

            <Col xs={9}>
              <div className="d-flex justify-content-between">
                <div style={{ minWidth: 0 }}>
                  <strong className="d-block text-truncate">{(ev && ev.title) || 'Untitled event'}</strong>
                  <div className="small mt-1">
                    {renderStatusBadge(ev || {})}
                    {!ev?.is_approved && !ev?.is_rejected && <small className="text-muted">Visible to you until approved</small>}
                  </div>
                </div>

                <div className="ms-2">
                  <Dropdown align="end">
                    <Dropdown.Toggle variant="light" size="sm" aria-label={`More actions for ${ev?.title || 'event'}`}>
                      <FaEllipsisV />
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      <Dropdown.Item onClick={() => onEdit && onEdit(ev)} aria-label={`Edit ${ev?.title || 'event'}`}>
                        <FaEdit className="me-2" /> Edit
                      </Dropdown.Item>
                      {ev && ev.is_rejected && (
                        <Dropdown.Item onClick={() => openAppealForEvent(ev)}>Appeal</Dropdown.Item>
                      )}
                      <Dropdown.Item onClick={() => onDelete && onDelete(ev && ev.id)} aria-label={`Delete ${ev?.title || 'event'}`}>
                        <FaTrash className="me-2" /> Delete
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </div>
              </div>

              <div className="mt-2 d-flex align-items-center justify-content-between">
                <div style={{ width: '62%' }}>
                  <div className="small text-muted">Date</div>
                  <div>{formatDate(ev && ev.event_date)}</div>
                </div>

                <div className="ms-2 text-end">
                  <div className="small text-muted">District</div>
                  <div>{districtName || '-'}</div>
                </div>
              </div>

              <div className="mt-2 small text-muted">Venue: {(ev && ev.venue) || '-'}</div>

              <div className="mt-2">
                {ev && ev.is_rejected && ticket && (
                  <Button size="sm" variant="outline-primary" onClick={() => handleViewTicket(ticket)}>View ticket</Button>
                )}
                {ev && ev.is_rejected && !ticket && (
                  <Button size="sm" variant="link" onClick={() => openAppealForEvent(ev)}>Contact support</Button>
                )}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    );
  }

  // --- main render ---
  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div />
        <div className="small text-muted">Create and manage upcoming gigs</div>
      </div>

      <div ref={wrapperRef} className={`events-table-wrapper ${showHint ? '' : 'no-hint'}`} aria-hidden="false">
        {showHint && (
          <div className="scroll-hint" role="status" aria-live="polite">
            <span className="hint-text">Swipe to see actions</span>
            <FaChevronRight aria-hidden />
          </div>
        )}

        {isMobile ? (
          <div className="events-card-list">
            {safeEvents.length === 0 && (
              <div className="text-center text-muted py-4">No events yet — create your first event.</div>
            )}
            {safeEvents.map(ev => renderEventCard(ev))}
          </div>
        ) : (
          <Table striped hover responsive>
            <thead>
              <tr>
                <th style={{ width: 80 }}>Image</th>
                <th>Title</th>
                <th>Date</th>
                <th>District</th>
                <th>Venue</th>
                <th style={{ width: 200 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {safeEvents.length > 0 ? safeEvents.map(ev => {
                const imgSrc = resolveEventImage ? resolveEventImage(ev) : null;
                const districtName = (ev && (ev.district_name || getDistrictName(ev.district_id))) || (ev && ev.district_id ? String(ev.district_id) : null);

                // row highlight for rejected / pending (compute directly, no unused var)
                const rowClass = (ev && ev.is_rejected) ? 'table-danger' : ((ev && ev.is_approved) ? '' : 'table-warning');

                const ticketKey = `event:${String(ev && ev.id)}`;
                const ticket = ticketsMap[ticketKey];

                return (
                  <tr key={ev && ev.id} className={rowClass}>
                    <td className="align-middle">
                      {imgSrc ? (
                        <a href={imgSrc} target="_blank" rel="noreferrer">
                          <Image
                            src={imgSrc}
                            rounded
                            style={{ width: 64, height: 64, objectFit: 'cover' }}
                            alt={ev && (ev.title || 'Event image')}
                            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent((ev && ev.title) || 'Event')}&background=eee&color=777&size=128`; }}
                          />
                        </a>
                      ) : (
                        <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f3f5', color: '#6c757d', borderRadius: 6 }}>
                          <FaCalendarAlt />
                        </div>
                      )}
                    </td>

                    <td className="align-middle">
                      <div><strong>{(ev && ev.title) || 'Untitled event'}</strong></div>
                      <div className="mt-1">
                        {renderStatusBadge(ev || {})}
                        {!ev?.is_approved && !ev?.is_rejected && <small className="text-muted">Visible to you until approved</small>}
                      </div>

                      {ev && ev.is_rejected && ev.rejection_reason && (
                        <div className="mt-1"><small className="text-danger">Reason: {ev.rejection_reason}</small></div>
                      )}

                      <div className="mt-1">
                        {ev && ev.is_rejected && ticket && (
                          <Button size="sm" variant="outline-primary" onClick={() => handleViewTicket(ticket)}>View ticket</Button>
                        )}
                        {ev && ev.is_rejected && !ticket && (
                          <Button size="sm" variant="link" onClick={() => openAppealForEvent(ev)}>Contact support</Button>
                        )}
                      </div>
                    </td>

                    <td className="align-middle">{formatDate(ev && ev.event_date)}</td>

                    <td className="align-middle">{districtName || '-'}</td>

                    <td className="align-middle">{(ev && ev.venue) || '-'}</td>

                    <td className="align-middle">
                      <div className="d-flex gap-2">
                        <Button size="sm" variant="outline-primary" onClick={() => onEdit && onEdit(ev)}>
                          <FaEdit className="me-1" /> Edit
                        </Button>

                        {ev && ev.is_rejected && (
                          <Button size="sm" variant="outline-primary" onClick={() => openAppealForEvent(ev)}>
                            Appeal
                          </Button>
                        )}

                        <Button size="sm" variant="outline-danger" onClick={() => onDelete && onDelete(ev && ev.id)}>
                          <FaTrash className="me-1" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="text-center text-muted">No events yet — create your first event.</td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}

EventsPanel.propTypes = {
  events: PropTypes.array,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  resolveEventImage: PropTypes.func,
  districtsMap: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
  supportUrl: PropTypes.string
};