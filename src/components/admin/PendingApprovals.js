// src/components/admin/PendingApprovals.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Row, Col, Image, Alert, Spinner } from 'react-bootstrap';
import axios from '../../api/axiosConfig';

/**
 * PendingApprovals component now owns approve/reject actions.
 *
 * Props:
 * - items: array of pending items
 * - type: 'artist' | 'track' | 'event'
 * - onDone: optional callback run after a successful approve/reject (e.g. to refresh parent)
 * - renderMeta: optional function(item) -> string
 */
export default function PendingApprovals({ items = [], type = 'item', onDone, renderMeta }) {
  const [local, setLocal] = useState(items || []);
  const [confirm, setConfirm] = useState({ show: false, id: null, action: null, item: null });
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Keep local copy in sync when parent items change
  useEffect(() => setLocal(items || []), [items]);

  // derive backend base like AudioPlayer does
  const backendBase = (() => {
    try {
      return (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:3001';
    } catch {
      return process.env.REACT_APP_API_URL || 'http://localhost:3001';
    }
  })().replace(/\/$/, '');

  const resolveToBackend = (raw) => {
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `${backendBase}${raw}`;
    if (raw.startsWith('uploads/')) return `${backendBase}/${raw}`;
    return `${backendBase}/uploads/${raw}`;
  };

  const openConfirm = (action, item) => {
    setError(null);
    setRejectReason('');
    setConfirm({ show: true, id: item.id, action, item });
  };
  const closeConfirm = () => setConfirm({ show: false, id: null, action: null, item: null });

  // Build endpoint base, e.g. 'artists', 'tracks', 'events'
  const plural = type === 'artist' ? 'artists' : type === 'track' ? 'tracks' : type === 'event' ? 'events' : `${type}s`;
  const baseUrl = `/admin/pending/${plural}`;

  const removeLocal = (id) => setLocal(prev => prev.filter(i => i.id !== id));

  const handleApprove = async () => {
    if (!confirm.id) return closeConfirm();
    setBusyId(confirm.id);
    setError(null);
    try {
      await axios.post(`${baseUrl}/${confirm.id}/approve`);
      removeLocal(confirm.id);
      setSuccessMsg(`${type} approved`);
      if (typeof onDone === 'function') onDone({ action: 'approve', type, id: confirm.id });
    } catch (err) {
      console.error('approve error', err);
      setError(err?.response?.data?.error || err.message || 'Approve failed');
    } finally {
      setBusyId(null);
      closeConfirm();
      setTimeout(() => setSuccessMsg(null), 2500);
    }
  };

  const handleReject = async () => {
    if (!confirm.id) return closeConfirm();
    setBusyId(confirm.id);
    setError(null);
    try {
      await axios.post(`${baseUrl}/${confirm.id}/reject`, { reason: rejectReason });
      removeLocal(confirm.id);
      setSuccessMsg(`${type} rejected`);
      if (typeof onDone === 'function') onDone({ action: 'reject', type, id: confirm.id });
    } catch (err) {
      console.error('reject error', err);
      setError(err?.response?.data?.error || err.message || 'Reject failed');
    } finally {
      setBusyId(null);
      closeConfirm();
      setTimeout(() => setSuccessMsg(null), 2500);
    }
  };

  function renderPreview(it) {
    if (type === 'track') {
      const artworkUrl = it.preview_artwork ? resolveToBackend(it.preview_artwork) : null;
      const audioUrl = it.previewUrl ? resolveToBackend(it.previewUrl) : null;
      return (
        <div className="d-flex align-items-center mb-2">
          {artworkUrl && <Image src={artworkUrl} rounded width={80} height={80} className="me-3" />}
          {audioUrl ? <audio controls src={audioUrl} className="me-3" /> : null}
          <div>
            <div><strong>{it.artist || it.artist_name || ''}</strong></div>
            <div className="text-muted small">{it.genre || it.release_date || ''}</div>
          </div>
        </div>
      );
    }

    if (type === 'artist') {
      const photo = it.photoUrl ? resolveToBackend(it.photoUrl) : null;
      return (
        <div className="d-flex align-items-center mb-2">
          {photo ? <Image src={photo} roundedCircle width={64} height={64} className="me-3" /> : null}
          <div>
            <div><strong>{it.displayName || it.name || ''}</strong></div>
            <div className="text-muted small">{it.district_name || it.district || ''}</div>
          </div>
        </div>
      );
    }

    if (type === 'event') {
      const img = it.image_url ? resolveToBackend(it.image_url) : null;
      return (
        <div className="d-flex align-items-start mb-2">
          {img ? <Image src={img} rounded width={120} height={80} className="me-3" /> : null}
          <div>
            <div><strong>{it.title}</strong></div>
            <div className="text-muted small">{it.artist || it.artist_name || ''} — {it.district || it.district_name || ''}</div>
            <div className="text-muted small">{it.event_date ? new Date(it.event_date).toLocaleString() : ''}</div>
          </div>
        </div>
      );
    }

    return null;
  }

  if (!local || local.length === 0) return <p>No pending approvals</p>;

  return (
    <div>
      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {successMsg && <Alert variant="success" onClose={() => setSuccessMsg(null)} dismissible>{successMsg}</Alert>}

      {local.map(it => (
        <Card className="mb-3" key={it.id}>
          <Card.Body>
            <Row>
              <Col md={9}>
                <Card.Title>{it.displayName || it.title || it.name}</Card.Title>
                {renderPreview(it)}
                <Card.Text className="mb-1">
                  {it.bio || it.description || it.previewText || ''}
                </Card.Text>
                {renderMeta && <small className="text-muted">{renderMeta(it)}</small>}
              </Col>

              <Col md={3} className="d-flex flex-column align-items-end justify-content-between">
                <div className="w-100 d-flex justify-content-end gap-2">
                  <Button
                    variant="success"
                    onClick={() => openConfirm('approve', it)}
                    disabled={busyId === it.id}
                  >
                    {busyId === it.id ? <Spinner animation="border" size="sm" /> : 'Approve'}
                  </Button>

                  <Button
                    variant="danger"
                    onClick={() => openConfirm('reject', it)}
                    disabled={busyId === it.id}
                  >
                    {busyId === it.id ? <Spinner animation="border" size="sm" /> : 'Reject'}
                  </Button>
                </div>
                <div className="w-100 text-end text-muted small">
                  Submitted: {it.submittedAt || it.created_at || it.createdAt || '—'}
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      ))}

      {/* Approve modal */}
      <Modal show={confirm.show && confirm.action === 'approve'} onHide={() => closeConfirm()} centered>
        <Modal.Header closeButton>
          <Modal.Title>Approve {type}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to approve <strong>{confirm.item?.displayName || confirm.item?.title || confirm.item?.name}</strong>?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => closeConfirm()}>Cancel</Button>
          <Button variant="success" onClick={handleApprove}>Approve</Button>
        </Modal.Footer>
      </Modal>

      {/* Reject modal */}
      <Modal show={confirm.show && confirm.action === 'reject'} onHide={() => closeConfirm()} centered>
        <Modal.Header closeButton>
          <Modal.Title>Reject {type}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div>Are you sure you want to reject <strong>{confirm.item?.displayName || confirm.item?.title || confirm.item?.name}</strong>?</div>
          <div className="mt-3">
            <label className="form-label">Reason (optional)</label>
            <textarea className="form-control" rows="3" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => closeConfirm()}>Cancel</Button>
          <Button variant="danger" onClick={handleReject}>Reject</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}