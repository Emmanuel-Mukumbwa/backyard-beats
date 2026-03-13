import React, { useEffect, useState, useRef } from 'react';
import {
  Table, Button, Badge, Offcanvas, Form, Spinner, Row, Col, InputGroup, FormControl, ListGroup
} from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../api/axiosConfig';
import ToastMessage from './ToastMessage';
import LoadingSpinner from './LoadingSpinner';

/**
 * UserSupportPanel
 * Props:
 *  - openTicketIdFromQuery (optional) -> tries to open this ticket automatically (from query param)
 *
 * Important:
 *  - This version expects server /support to return tickets with targetSnapshot already attached.
 *  - It no longer fetches /tracks/:id or /events/:id for snapshots.
 *  - It supports query param deep-linking: /support?openTicket=123
 */

export default function UserSupportPanel({ openTicketIdFromQuery = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const openTicketFromQuery = openTicketIdFromQuery || params.get('openTicket') || null;

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // selected ticket (detailed) and messages
  const [selected, setSelected] = useState(null); // full ticket object from /support/:id
  const [messages, setMessages] = useState([]);

  // reply / attachments
  const [reply, setReply] = useState('');
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  // filters
  const [statusFilter, setStatusFilter] = useState(''); // '' => all
  const [searchQ, setSearchQ] = useState('');
  const searchDebounceRef = useRef(null);

  // UI states
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchTickets();
    }, 500);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQ]);

  // auto-open ticket from query param if present (run once)
  useEffect(() => {
    if (!openTicketFromQuery) return;
    (async () => {
      try {
        const res = await axios.get(`/support/${openTicketFromQuery}`);
        const ticket = res.data.ticket;
        const msgs = res.data.messages || [];
        if (ticket) {
          setSelected(ticket);
          setMessages(msgs);
          setShowSidebar(true);
          // refresh list to keep it up-to-date
          await fetchTickets();
        }
      } catch (err) {
        console.warn('openTicketFromQuery failed', err);
        // remove bad query param so user doesn't keep seeing error on reload
        // (optional) - we won't modify URL here but you can if desired
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTicketFromQuery]);

  // Fetch tickets list (server returns targetSnapshot for each ticket)
  async function fetchTickets() {
    setLoading(true);
    try {
      const res = await axios.get('/support', {
        params: {
          limit: 100,
          status: statusFilter || undefined,
          q: searchQ || undefined
        }
      });
      const list = res.data.tickets || [];

      // ensure each ticket has targetSnapshot (server-side). If not, show fallback.
      setTickets(list);
    } catch (err) {
      console.error('fetchTickets', err);
      setToast({ show: true, message: 'Failed to load your tickets', variant: 'danger' });
    } finally {
      setLoading(false);
    }
  }

  // Open detailed ticket
  async function openTicket(t) {
    try {
      setSelected(null);
      setMessages([]);
      const res = await axios.get(`/support/${t.id}`);
      const ticket = res.data.ticket || t;
      const msgs = res.data.messages || [];
      if (res.data.targetSnapshot) ticket.targetSnapshot = res.data.targetSnapshot;
      setSelected(ticket);
      setMessages(msgs);
      setShowSidebar(true);
      // update URL with ?openTicket= to allow refresh/deep link
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('openTicket', String(ticket.id));
        window.history.replaceState({}, '', url.toString());
      } catch (e) { /* ignore */ }
      // refresh list
      fetchTickets().catch(() => {});
    } catch (err) {
      console.error('openTicket', err);
      setToast({ show: true, message: 'Failed to open ticket', variant: 'danger' });
    }
  }

  // Reply / attachments handling
  function onFilesChange(e) {
    const incoming = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...incoming]);
    if (fileInputRef.current) fileInputRef.current.value = null;
  }

  function removeFile(i) {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
  }

  async function sendReply() {
    if (!reply && files.length === 0) {
      setToast({ show: true, message: 'Please add a message or attachment', variant: 'warning' });
      return;
    }
    if (!selected) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append('body', reply);
      files.forEach(f => form.append('attachments', f));
      await axios.post(`/support/${selected.id}/messages`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setReply('');
      setFiles([]);
      // refresh thread and list
      await openTicket(selected);
      await fetchTickets();
      setToast({ show: true, message: 'Message sent', variant: 'success' });
    } catch (err) {
      console.error('sendReply', err);
      setToast({ show: true, message: 'Failed to send message', variant: 'danger' });
    } finally {
      setSending(false);
    }
  }

  function statusBadge(s) {
    const bg = s === 'open' ? 'success' : s === 'pending' ? 'warning' : s === 'resolved' ? 'secondary' : s === 'spam' ? 'danger' : 'secondary';
    return <Badge bg={bg} pill style={{ textTransform: 'capitalize' }}>{s}</Badge>;
  }

  function renderTargetCell(t) {
    if (t.targetSnapshot && t.targetSnapshot.title) {
      const snap = t.targetSnapshot;
      if (snap.type === 'track') return <div><strong>Track</strong> — {snap.title}</div>;
      if (snap.type === 'event') return <div><strong>Event</strong> — {snap.title}</div>;
      if (snap.type === 'artist') return <div><strong>Artist</strong> — {snap.title}</div>;
    }
    if (t.target_type && t.target_type !== 'none' && t.target_id) {
      return <div className="text-muted">{`${t.target_type}:${t.target_id}`}</div>;
    }
    return <div className="text-muted">-</div>;
  }

  function onSearchKeyDown(e) {
    if (e.key === 'Enter') {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      fetchTickets();
    }
  }

  return (
    <div>
      <Row className="mb-2 align-items-center">
        <Col xs="auto">
          <Form.Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="spam">Spam</option>
          </Form.Select>
        </Col>

        <Col>
          <InputGroup>
            <FormControl
              placeholder="Search subject or message..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            <Button onClick={() => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); fetchTickets(); }} variant="outline-secondary">Search</Button>
          </InputGroup>
        </Col>

        <Col xs="auto">
          <Button onClick={() => fetchTickets()} variant="secondary">Refresh</Button>
        </Col>
      </Row>

      {loading ? <LoadingSpinner /> : (
        <Table hover responsive>
          <thead>
            <tr><th>#</th><th>Subject</th><th>Status</th><th>Updated</th><th>Target</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {tickets.map(t => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject}</td>
                <td>{statusBadge(t.status)}</td>
                <td>{t.updated_at ? new Date(t.updated_at).toLocaleString() : '-'}</td>
                <td>{renderTargetCell(t)}</td>
                <td>
                  <div className="d-flex gap-2">
                    <Button size="sm" onClick={() => openTicket(t)}>Open</Button>
                    <Button size="sm" variant="outline-primary" onClick={() => openTicket(t)}>Review files</Button>
                  </div>
                </td>
              </tr>
            ))}
            {tickets.length === 0 && <tr><td colSpan={6} className="text-center text-muted">No tickets</td></tr>}
          </tbody>
        </Table>
      )}

      <Offcanvas show={showSidebar} onHide={() => { setShowSidebar(false); setSelected(null); setMessages([]); try { const url = new URL(window.location.href); url.searchParams.delete('openTicket'); window.history.replaceState({}, '', url.toString()); } catch (e) {} }} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Ticket #{selected?.id || ''} {selected ? `— ${selected.subject}` : ''}</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {selected ? (
            <>
              <div className="mb-2"><strong>Status:</strong> {statusBadge(selected.status)}</div>

              {selected.targetSnapshot && (
                <div className="mb-3 p-2 border rounded">
                  <strong>Target:</strong> {selected.targetSnapshot.type} — <strong>{selected.targetSnapshot.title}</strong>
                  {selected.targetSnapshot.extra?.event_date && <div><small>{selected.targetSnapshot.extra.event_date}</small></div>}
                  {selected.targetSnapshot.extra?.venue && <div><small>{selected.targetSnapshot.extra.venue}</small></div>}
                  {selected.targetSnapshot.extra?.is_rejected && selected.targetSnapshot.extra?.rejection_reason && (
                    <div className="mt-1 text-danger"><small>Rejection reason: {selected.targetSnapshot.extra.rejection_reason}</small></div>
                  )}
                </div>
              )}

              <div className="mb-2"><strong>Messages</strong></div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {messages.map(m => (
                  <div key={m.id} className={`border rounded p-2 my-2 ${m.sender_role === 'admin' ? 'bg-light' : ''}`}>
                    <div><small className="text-muted">{m.sender_role} — {new Date(m.created_at).toLocaleString()}</small></div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                    {m.attachments && m.attachments.length > 0 && (
                      <ListGroup className="mt-2">
                        {m.attachments.map(a => (
                          <ListGroup.Item key={a.id}>
                            <a href={a.path} target="_blank" rel="noreferrer">{a.filename || a.path}</a>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    )}
                  </div>
                ))}
              </div>

              {selected.attachments && selected.attachments.length > 0 && (
                <div className="mt-3">
                  <strong>Ticket attachments</strong>
                  <ListGroup className="mt-2">
                    {selected.attachments.map(a => (
                      <ListGroup.Item key={a.id}>
                        <a href={a.path} target="_blank" rel="noreferrer">{a.filename || a.path}</a>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </div>
              )}

              <Form.Group className="mt-3">
                <Form.Label>Your reply</Form.Label>
                <Form.Control as="textarea" rows={4} value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply — attach screenshots or files if helpful." />
              </Form.Group>

              <Form.Group className="mt-2">
                <Form.Label>Attachments</Form.Label>
                <Form.Control type="file" multiple ref={fileInputRef} onChange={onFilesChange} />
                {files.length > 0 && (
                  <ListGroup className="mt-2">
                    {files.map((f, i) => (
                      <ListGroup.Item key={i} className="d-flex justify-content-between align-items-center">
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{f.name}</div>
                        <div><Button size="sm" variant="outline-danger" onClick={() => removeFile(i)}>Remove</Button></div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
                <Form.Text className="text-muted">Attach files for the staff handling your ticket.</Form.Text>
              </Form.Group>

              <div className="d-flex justify-content-end gap-2 mt-3">
                <Button variant="secondary" onClick={() => { setShowSidebar(false); setSelected(null); setMessages([]); try { const url = new URL(window.location.href); url.searchParams.delete('openTicket'); window.history.replaceState({}, '', url.toString()); } catch (e) {} }}>Close</Button>
                <Button onClick={sendReply} disabled={sending || (!reply && files.length === 0)}>
                  {sending ? <><Spinner size="sm" animation="border" /> Sending...</> : 'Send Reply'}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center"><LoadingSpinner /></div>
          )}
        </Offcanvas.Body>
      </Offcanvas>

      <ToastMessage show={toast.show} onClose={() => setToast(s => ({ ...s, show: false }))} message={toast.message} variant={toast.variant} />
    </div>
  );
}