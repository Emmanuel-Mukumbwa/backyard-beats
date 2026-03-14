// src/components/MyRatings.jsx
import React, { useEffect, useState} from 'react';
import { ListGroup, Button, Spinner, Modal } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import { useNavigate } from 'react-router-dom';

export default function MyRatings() {
  const navigate = useNavigate();
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({}); // id => boolean
  const [showConfirm, setShowConfirm] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await axios.get('/user');
      setRatings(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load user ratings', err);
      setRatings([]);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(rating) {
    // user requested edit -> navigate to artist detail page where they can edit the rating
    if (rating && rating.artist_id) {
      navigate(`/artist/${rating.artist_id}`);
    } else {
      // fallback: nothing to edit
      alert('Cannot edit this rating: missing artist reference.');
    }
  }

  function confirmDelete(rating) {
    setToDelete(rating);
    setShowConfirm(true);
  }

  async function doDelete() {
    if (!toDelete) return setShowConfirm(false);
    const id = toDelete.id;
    setProcessing(p => ({ ...p, [id]: true }));
    try {
      await axios.delete(`/ratings/${id}`);
      // refresh list
      await load();
      setShowConfirm(false);
      setToDelete(null);
    } catch (err) {
      console.error('Delete failed', err);
      alert(err.response?.data?.error || 'Delete failed');
    } finally {
      setProcessing(p => { const cp = { ...p }; delete cp[id]; return cp; });
    }
  }

  if (loading) return <div className="text-center py-3"><Spinner animation="border" /></div>;
  if (!ratings || ratings.length === 0) return <div className="text-muted">You have not rated any artists yet.</div>;

  return (
    <>
      <ListGroup>
        {ratings.map(r => (
          <ListGroup.Item key={r.id} className="d-flex justify-content-between align-items-start">
            <div>
              <div style={{ fontWeight: 600 }}>{r.artist_name || 'Unknown Artist'}</div>
              <div className="small text-muted">
                {'★'.repeat(r.rating || 0)} {r.rating ? `(${r.rating}/5)` : '(no stars)'} • {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
              </div>
              {r.comment ? <div style={{ marginTop: 6 }}>{r.comment}</div> : null}
            </div>

            <div className="d-flex flex-column align-items-end">
              <div>
                <Button variant="outline-primary" size="sm" onClick={() => handleEdit(r)} className="me-2">Edit</Button>
                <Button variant="outline-danger" size="sm" onClick={() => confirmDelete(r)} disabled={!!processing[r.id]}>
                  {processing[r.id] ? <Spinner animation="border" size="sm" /> : 'Delete'}
                </Button>
              </div>
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>

      <Modal show={showConfirm} onHide={() => setShowConfirm(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete your rating for <strong>{toDelete?.artist_name}</strong>? This action cannot be undone.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={doDelete}>Delete rating</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}