import React, { useEffect, useState } from 'react';
import {
  Container, Form, Button, Alert, Row, Col, Spinner, ListGroup, Image, Badge, Nav
} from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../api/axiosConfig';
import ToastMessage from '../components/ToastMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import UserSupportPanel from '../components/UserSupportPanel';

/**
 * SupportPage — improved previews + prefill + user items fetch
 *
 * Now supports deep-linking by query param: /support?openTicket=123
 */

export default function SupportPage({ prefill: propsPrefill = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const openTicketFromQuery = params.get('openTicket');

  const prefillFromLocation = location?.state?.prefill || null;
  const prefill = propsPrefill || prefillFromLocation || null;

  // view toggle: 'create' or 'my'
  const [view, setView] = useState('create');

  // form
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('appeal');
  const [targetType, setTargetType] = useState('none');
  const [targetId, setTargetId] = useState('');
  const [localFiles, setLocalFiles] = useState([]); // File objects
  const [existingFiles, setExistingFiles] = useState([]); // { url, filename, mimeType? }
  const [includeTargetFile, setIncludeTargetFile] = useState(false);

  // user items
  const [userTracks, setUserTracks] = useState([]);
  const [userEvents, setUserEvents] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // ui
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

  // constraints (client-side)
  const MAX_FILES = 6;
  const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

  // Helpers (same as previous)
  const guessMimeFromUrl = (url = '') => {
    const lower = (url || '').split('?')[0].toLowerCase();
    if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.m4a')) return 'audio';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.gif')) return 'image';
    if (lower.endsWith('.pdf')) return 'pdf';
    return 'other';
  };

  function getBasename(url) {
    try {
      return url.split('/').pop().split('?')[0];
    } catch (e) {
      return url || '';
    }
  }

  function trimUrl(url) {
    if (!url) return '';
    return url.length > 60 ? `${url.slice(0, 40)}…${url.slice(-15)}` : url;
  }

  function niceBytes(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderExistingFilePreview(ef) {
    const type = ef.mimeType || guessMimeFromUrl(ef.url || ef.filename || '');
    if (type === 'image') {
      return (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Image src={ef.url} alt={ef.filename || 'attachment'} rounded style={{ width: 96, height: 64, objectFit: 'cover' }} />
          <div>
            <div><strong>{ef.filename || getBasename(ef.url)}</strong></div>
            <div className="small text-muted">{getBasename(ef.url)}</div>
          </div>
        </div>
      );
    }
    if (type === 'audio') {
      return (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <audio controls preload="none" src={ef.url} style={{ width: 240 }} />
          <div>
            <div><strong>{ef.filename || getBasename(ef.url)}</strong></div>
            <div className="small text-muted">Audio file</div>
          </div>
        </div>
      );
    }
    if (type === 'pdf') {
      return (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div>
            <div><strong>{ef.filename || getBasename(ef.url)}</strong></div>
            <a href={ef.url} target="_blank" rel="noreferrer" className="small">{trimUrl(ef.url)}</a>
            <div className="small text-muted">PDF document</div>
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div>
          <div><strong>{ef.filename || getBasename(ef.url)}</strong></div>
          <a href={ef.url} target="_blank" rel="noreferrer" className="small">{trimUrl(ef.url)}</a>
        </div>
      </div>
    );
  }

  // --- load user's tracks/events with endpoint fallbacks ---
  useEffect(() => {
    let mounted = true;
    async function loadItemsAndPrefill() {
      setLoadingItems(true);
      try {
        const trackEndpoints = ['/tracks/mine', '/minetracks/mine', '/tracks/mine/','/mine/tracks'];
        const eventEndpoints = ['/events/mine', '/mineevents/mine', '/events/mine/','/mine/events'];

        const tryFirst = async (endpoints) => {
          for (const p of endpoints) {
            try {
              const r = await axios.get(p);
              return r;
            } catch (e) { /* try next */ }
          }
          throw new Error('no endpoints succeeded');
        };

        const [tracksRes, eventsRes] = await Promise.allSettled([tryFirst(trackEndpoints), tryFirst(eventEndpoints)]);

        if (!mounted) return;

        if (tracksRes.status === 'fulfilled' && Array.isArray(tracksRes.value.data.tracks)) {
          setUserTracks(tracksRes.value.data.tracks);
        } else {
          setUserTracks([]);
        }

        if (eventsRes.status === 'fulfilled' && Array.isArray(eventsRes.value.data.events)) {
          setUserEvents(eventsRes.value.data.events);
        } else {
          setUserEvents([]);
        }

        // prefill existing files if prefill given (same logic as before)
        if (prefill && (!Array.isArray(prefill.existingFiles) || prefill.existingFiles.length === 0) && prefill.targetType && prefill.targetId) {
          try {
            if (prefill.targetType === 'track') {
              const trackEndpointCandidates = [`/tracks/${prefill.targetId}`, `/minetracks/${prefill.targetId}`, `/tracks/${prefill.targetId}/`, `/mine/tracks/${prefill.targetId}`];
              let tr = null;
              for (const p of trackEndpointCandidates) {
                try {
                  const r = await axios.get(p);
                  if (r?.data?.track) { tr = r.data.track; break; }
                } catch (e) { /* try next */ }
              }
              if (tr) {
                const candidates = [];
                if (tr.preview_artwork) candidates.push({ url: tr.preview_artwork, filename: `${tr.title || 'track'}-art.jpg` });
                if (tr.preview_url) candidates.push({ url: tr.preview_url, filename: `${tr.title || 'track'}.mp3` });
                if (candidates.length) setExistingFiles(candidates);
              }
            } else if (prefill.targetType === 'event') {
              const evEndpointCandidates = [`/events/${prefill.targetId}`, `/mineevents/${prefill.targetId}`, `/events/${prefill.targetId}/`, `/mine/events/${prefill.targetId}`];
              let er = null;
              for (const p of evEndpointCandidates) {
                try {
                  const r = await axios.get(p);
                  if (r?.data?.event) { er = r.data.event; break; }
                } catch (e) { /* try next */ }
              }
              if (er && er.image_url) setExistingFiles([{ url: er.image_url, filename: `${er.title || 'event'}.jpg` }]);
            }
          } catch (err) {
            // non-fatal
          }
        } else if (prefill && Array.isArray(prefill.existingFiles) && prefill.existingFiles.length) {
          setExistingFiles(prefill.existingFiles.map(f => ({ url: f.url, filename: f.filename || getBasename(f.url) })));
        }
      } catch (err) {
        // ignore
      } finally {
        if (mounted) setLoadingItems(false);
      }
    }
    loadItemsAndPrefill();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  // apply prefill subject/body on mount
  useEffect(() => {
    if (!prefill) return;
    if (prefill.subject) setSubject(String(prefill.subject));
    if (prefill.body) setBody(String(prefill.body));
    if (prefill.type) setType(String(prefill.type));
    if (prefill.targetType) setTargetType(String(prefill.targetType));
    if (prefill.targetId) setTargetId(String(prefill.targetId));
    if (prefill.includeTargetFile) setIncludeTargetFile(true);
    // existingFiles handled in load effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  // If the query param asked to open a ticket, switch to the "my" tab
  useEffect(() => {
    if (openTicketFromQuery) setView('my');
  }, [openTicketFromQuery]);

  // --- local file handling ---
  function handleLocalFilesChange(e) {
    const incoming = Array.from(e.target.files || []);
    const combined = [...localFiles, ...incoming];

    if (combined.length > MAX_FILES) {
      setToast({ show: true, message: `Max ${MAX_FILES} files allowed.`, variant: 'danger' });
      return;
    }

    for (const f of incoming) {
      if (f.size > MAX_FILE_BYTES) {
        setToast({ show: true, message: `${f.name} is larger than ${niceBytes(MAX_FILE_BYTES)}.`, variant: 'danger' });
        return;
      }
    }

    setLocalFiles(combined);
  }

  function removeLocalFile(idx) {
    setLocalFiles(prev => prev.filter((_, i) => i !== idx));
  }

  function removeExistingFile(idx) {
    setExistingFiles(prev => prev.filter((_, i) => i !== idx));
  }

  // submit
  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);

    if (!subject.trim() || !body.trim()) {
      setMsg({ variant: 'danger', text: 'Subject and message are required.' });
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('subject', subject);
      form.append('body', body);
      form.append('type', type);
      form.append('target_type', targetType);
      if (targetId) form.append('target_id', targetId);
      if (includeTargetFile) form.append('include_target_file', '1');

      // local uploads
      localFiles.forEach(f => form.append('attachments', f));

      // existing server URLs
      existingFiles.forEach(ef => form.append('existing_attachments[]', ef.url));

      const res = await axios.post('/support', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMsg({ variant: 'success', text: 'Ticket created — support will respond shortly.' });

      // reset
      setSubject('');
      setBody('');
      setType('appeal');
      setTargetType('none');
      setTargetId('');
      setLocalFiles([]);
      setExistingFiles([]);
      setIncludeTargetFile(false);

      // deep-link to the ticket via query param (if backend returned ticketId)
      const createdTicketId = res?.data?.ticketId || res?.data?.ticket?.id || null;
      if (createdTicketId) {
        // navigate to same route but add ?openTicket=<id>
        navigate(`/support?openTicket=${createdTicketId}`, { replace: false });
        setView('my');
      } else {
        setView('my');
      }
    } catch (err) {
      console.error('support submit error', err);
      setMsg({ variant: 'danger', text: err?.response?.data?.error || 'Failed to create ticket' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container className="py-4">
      <h3>Contact Support</h3>
      <p className="text-muted">
        Use this form to appeal a rejection, report a bug, or ask a question. You can attach files (screenshots, audio, PDFs) or include files already on your account.
      </p>

      <Nav variant="tabs" activeKey={view} onSelect={k => setView(k)}>
        <Nav.Item>
          <Nav.Link eventKey="create">Create Ticket</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="my">My Tickets</Nav.Link>
        </Nav.Item>
      </Nav>

      <div className="mt-3">
        {view === 'create' && (
          <>
            {msg && <Alert variant={msg.variant}>{msg.text}</Alert>}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-2">
                <Form.Label>Subject</Form.Label>
                <Form.Control
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  required
                  placeholder="Short subject — e.g. 'Appeal: Track rejected without reason'"
                />
                <Form.Text className="text-muted">Make the subject short and descriptive so support can triage quickly.</Form.Text>
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Type</Form.Label>
                <Form.Select value={type} onChange={e => setType(e.target.value)}>
                  <option value="appeal">Appeal (rejection)</option>
                  <option value="bug">Bug report</option>
                  <option value="question">Question</option>
                  <option value="other">Other</option>
                </Form.Select>
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Link to (optional)</Form.Label>
                    <Form.Select value={targetType} onChange={e => { setTargetType(e.target.value); setTargetId(''); }}>
                      <option value="none">None</option>
                      <option value="track">Track</option>
                      <option value="event">Event</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  {targetType === 'track' && (
                    <Form.Group className="mb-2">
                      <Form.Label>Select Track</Form.Label>
                      {loadingItems ? (
                        <div><Spinner animation="border" size="sm" /> Loading your tracks...</div>
                      ) : (
                        <Form.Select value={targetId} onChange={e => setTargetId(e.target.value)}>
                          <option value="">-- select --</option>
                          {userTracks.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.title}{t.is_rejected ? ' (rejected)' : ''}
                            </option>
                          ))}
                        </Form.Select>
                      )}
                      <Form.Text className="text-muted">Shows tracks you uploaded. Selecting one helps us find the right item faster.</Form.Text>
                    </Form.Group>
                  )}

                  {targetType === 'event' && (
                    <Form.Group className="mb-2">
                      <Form.Label>Select Event</Form.Label>
                      {loadingItems ? (
                        <div><Spinner animation="border" size="sm" /> Loading your events...</div>
                      ) : (
                        <Form.Select value={targetId} onChange={e => setTargetId(e.target.value)}>
                          <option value="">-- select --</option>
                          {userEvents.map(ev => (
                            <option key={ev.id} value={ev.id}>
                              {ev.title}{ev.is_rejected ? ' (rejected)' : ''}{ev.event_date ? ` — ${new Date(ev.event_date).toLocaleDateString()}` : ''}
                            </option>
                          ))}
                        </Form.Select>
                      )}
                      <Form.Text className="text-muted">Shows events you created. Selecting one helps us identify the correct item.</Form.Text>
                    </Form.Group>
                  )}
                </Col>
              </Row>

              <Form.Group className="mb-2">
                <Form.Label>Message</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={6}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  required
                  placeholder="Describe the issue or what you'd like us to do. Include dates, track/event names, and any error messages if possible."
                />
              </Form.Group>

              {/* existing server-side file previews */}
              {existingFiles.length > 0 && (
                <div className="mb-3">
                  <Form.Label>Included attachments</Form.Label>
                  <ListGroup>
                    {existingFiles.map((ef, idx) => (
                      <ListGroup.Item key={idx} className="d-flex justify-content-between align-items-start">
                        <div style={{ flex: 1 }}>
                          {renderExistingFilePreview(ef)}
                        </div>
                        <div style={{ marginLeft: 12 }}>
                          <Button size="sm" variant="outline-danger" onClick={() => removeExistingFile(idx)}>Remove</Button>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                  <Form.Text className="text-muted">
                    These are files from your account that can be included with this ticket. Remove any you don't want to send.
                  </Form.Text>
                </div>
              )}

              {/* include original target file option */}
              {(prefill?.includeTargetFile || targetId) && (
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label={<span>Include original {targetType === 'track' ? 'track file' : targetType === 'event' ? 'event image' : 'file'} (if available)</span>}
                    checked={includeTargetFile}
                    onChange={e => setIncludeTargetFile(e.target.checked)}
                  />
                  <Form.Text className="text-muted">
                    If checked, the original file for the selected item will be included in the ticket (when available on the server).
                  </Form.Text>
                </Form.Group>
              )}

              <Form.Group className="mb-3">
                <Form.Label>Attachments (optional)</Form.Label>
                <Form.Control type="file" multiple onChange={handleLocalFilesChange} />
                {localFiles.length > 0 && (
                  <div className="mt-2">
                    <div className="small text-muted">Files ready to upload:</div>
                    <ListGroup>
                      {localFiles.map((f, i) => (
                        <ListGroup.Item key={i} className="d-flex justify-content-between align-items-center">
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                            {f.name}
                            <div className="small text-muted"> {niceBytes(f.size)}</div>
                          </div>
                          <div>
                            <Button size="sm" variant="outline-danger" onClick={() => removeLocalFile(i)}>Remove</Button>
                          </div>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  </div>
                )}
                <div className="mt-1">
                  <small className="text-muted">
                    Allowed examples: images (jpg/png), audio (mp3/wav), PDF. Max {MAX_FILES} files, {niceBytes(MAX_FILE_BYTES)} each. Server will validate final limits.
                  </small>
                </div>
              </Form.Group>

              <Button type="submit" disabled={loading}>
                {loading ? <><Spinner as="span" animation="border" size="sm" /> Sending...</> : 'Send to Support'}
              </Button>
            </Form>
          </>
        )}

        {view === 'my' && (
          <div className="mt-2">
            <UserSupportPanel openTicketIdFromQuery={openTicketFromQuery} />
          </div>
        )}
      </div>

      <ToastMessage
        show={toast.show}
        onClose={() => setToast(s => ({ ...s, show: false }))}
        message={toast.message}
        variant={toast.variant}
      />
      {loadingItems && <div className="mt-3"><LoadingSpinner /></div>}
    </Container>
  );
}