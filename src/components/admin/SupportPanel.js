import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Badge, Modal, Form, Spinner, Row, Col, InputGroup, FormControl, ListGroup } from 'react-bootstrap';
import axios from '../../api/axiosConfig';
import ToastMessage from '../ToastMessage';
import LoadingSpinner from '../LoadingSpinner';

export default function SupportPanel() {
  // show pending by default
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // full ticket object returned by adminGetTicket
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [searchQ, setSearchQ] = useState('');
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  // toast
  const [toast, setToast] = useState({ show:false, message:'', variant:'success' });

  useEffect(() => { fetchTickets(); }, [filterStatus]);

  async function fetchTickets() {
    setLoading(true);
    try {
      // NOTE: assuming server routes mounted at /support -> admin path is /support/admin
      const res = await axios.get('/support/admin', { params: { limit: 100, status: filterStatus, q: searchQ } });
      setTickets(res.data.tickets || []);
    } catch (err) {
      console.error('fetchTickets', err);
      setToast({ show:true, message:'Failed to load tickets', variant:'danger' });
    } finally { setLoading(false); }
  }

  async function openTicket(t) {
    try {
      setSelected(null);
      setMessages([]);
      setStatus('');
      const res = await axios.get(`/support/admin/${t.id}`);
      // server returns { ticket, user, messages, attachments, targetSnapshot }
      setSelected(res.data.ticket || t);
      setMessages(res.data.messages || []);
      setStatus((res.data.ticket && res.data.ticket.status) || '');
    } catch (err) {
      console.error('openTicket', err);
      setToast({ show:true, message:'Failed to open ticket', variant:'danger' });
    }
  }

  function onFilesChange(e) {
    const incoming = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...incoming]);
    // reset input so same files can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = null;
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function sendReply() {
    if (!reply && files.length === 0) {
      setToast({ show:true, message:'Reply text or attachment required', variant:'warning' });
      return;
    }
    if (!selected) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append('body', reply);
      // backend multer expects field 'attachments' (see attachmentsMiddleware.array('attachments', 6))
      files.forEach(f => form.append('attachments', f));
      await axios.post(`/support/admin/${selected.id}/reply`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setReply('');
      setFiles([]);
      // re-open to refresh messages & attachments
      await openTicket(selected);
      await fetchTickets();
      setToast({ show:true, message:'Reply sent', variant:'success' });
    } catch (err) {
      console.error('sendReply', err);
      setToast({ show:true, message:'Failed to send reply', variant:'danger' });
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(s) {
    if (!selected) return;
    try {
      await axios.post(`/support/admin/${selected.id}/status`, { status: s });
      setStatus(s);
      // optionally add a system message locally
      setMessages(prev => [...prev, { id: `sys-${Date.now()}`, sender_role: 'system', body: `Status changed to "${s}" by admin`, created_at: new Date().toISOString() }]);
      await fetchTickets();
      setToast({ show:true, message:`Marked ${s}`, variant:'success' });
    } catch (err) {
      console.error('changeStatus', err);
      setToast({ show:true, message:'Failed to change status', variant:'danger' });
    }
  }

  const statusBadge = (s) => {
    const bg = s === 'open' ? 'success' : s === 'pending' ? 'warning' : s === 'resolved' ? 'secondary' : s === 'spam' ? 'danger' : 'secondary';
    return <Badge bg={bg} pill style={{ textTransform: 'capitalize' }}>{s}</Badge>;
  };

  return (
    <div className="p-3">
      <h4>Support Tickets</h4>

      <Row className="mb-2 align-items-center">
        <Col xs="auto">
          <Form.Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="spam">Spam</option>
            <option value="closed">Closed</option>
          </Form.Select>
        </Col>
        <Col>
          <InputGroup>
            <FormControl placeholder="Search subject or body..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
            <Button onClick={fetchTickets} variant="outline-secondary">Search</Button>
          </InputGroup>
        </Col>
        <Col xs="auto">
          <Button onClick={fetchTickets} variant="secondary">Refresh</Button>
        </Col>
      </Row>

      {loading ? <LoadingSpinner /> : (
        <Table hover responsive>
          <thead>
            <tr>
              <th>#</th><th>Subject</th><th>Type</th><th>Status</th><th>User</th><th>Target</th><th>Updated</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td style={{ maxWidth: 300 }}>{t.subject}</td>
                <td>{t.type}</td>
                <td>{statusBadge(t.status)}</td>
                <td>{t.user_username || t.user_email || t.user_id}</td>
                <td>{t.target_type && t.target_type !== 'none' ? `${t.target_type}:${t.target_id}` : '-'}</td>
                <td>{new Date(t.updated_at).toLocaleString()}</td>
                <td>
                  <Button size="sm" onClick={() => openTicket(t)}>Open</Button>
                </td>
              </tr>
            ))}
            {tickets.length === 0 && <tr><td colSpan={8} className="text-center text-muted">No tickets</td></tr>}
          </tbody>
        </Table>
      )}

      <Modal size="lg" show={!!selected} onHide={() => setSelected(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Ticket #{selected?.id} — {selected?.subject}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-2"><strong>Status: </strong>{statusBadge(status)}</div>
          <div className="mb-2"><strong>From: </strong>{selected?.user_username || selected?.user_email || selected?.user_id}</div>

          {selected?.targetSnapshot && (
            <div className="mb-3 p-2 border rounded">
              <strong>Target:</strong> {selected.targetSnapshot.type} — {selected.targetSnapshot.title || selected.targetSnapshot.id}
              {selected.targetSnapshot.extra?.event_date && <div><small>{selected.targetSnapshot.extra.event_date}</small></div>}
            </div>
          )}

          <div className="mb-2"><strong>Messages</strong></div>
          <div style={{ maxHeight: 350, overflowY: 'auto' }}>
            {messages.map(m => (
              <div key={m.id} className={`border rounded p-2 my-2 ${m.sender_role === 'admin' ? 'bg-light' : ''}`}>
                <div><small className="text-muted">{m.sender_role} — {new Date(m.created_at).toLocaleString()}</small></div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                {/* show message attachments if provided by server in message object */}
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

          <Form.Group className="mt-3">
            <Form.Label>Reply</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              placeholder="Type your reply — be concise and polite. You can attach screenshots or files if helpful."
              value={reply}
              onChange={e => setReply(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mt-2">
            <Form.Label>Attachments</Form.Label>
            <Form.Control type="file" multiple ref={fileInputRef} onChange={onFilesChange} />
            <Form.Text className="text-muted">
              These attachments will be included with your reply. Remove any you don't want to send.
            </Form.Text>

            {files.length > 0 && (
              <ListGroup className="mt-2">
                {files.map((f, i) => (
                  <ListGroup.Item key={i} className="d-flex justify-content-between align-items-center">
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{f.name}</div>
                    <div>
                      <Button size="sm" variant="outline-danger" onClick={() => removeFile(i)}>Remove</Button>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Form.Group>

          {/* show ticket-level attachments (files copied or referenced when ticket created) */}
          {selected?.attachments && selected.attachments.length > 0 && (
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
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => changeStatus('resolved')}>Mark Resolved</Button>
          <Button variant="danger" onClick={() => changeStatus('spam')}>Mark Spam</Button>
          <Button onClick={sendReply} disabled={sending || (!reply && files.length === 0)}>
            {sending ? <><Spinner size="sm" animation="border" /> Sending...</> : 'Send Reply'}
          </Button>
        </Modal.Footer>
      </Modal>

      <ToastMessage show={toast.show} onClose={() => setToast(s => ({...s, show:false}))} message={toast.message} variant={toast.variant} />
    </div>
  );
}