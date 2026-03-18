// src/pages/Profile.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Row, Col, Form, InputGroup } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import { AuthContext } from '../context/AuthContext';
import ToastMessage from '../components/ToastMessage';
import ConfirmModal from '../components/ConfirmModal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Profile() {
  const { user: authUser, artist, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [user, setUser] = useState(authUser || null);
  const [loading, setLoading] = useState(!authUser);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

  // edit username state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  // district name state (friendly name)
  const [districtName, setDistrictName] = useState('');

  // change password state (inline)
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwProcessing, setPwProcessing] = useState(false);

  // confirm modal state (deactivate)
  const [confirmOpen, setConfirmOpen] = useState(false);

  // helper: try to resolve district id to name
  async function fetchDistrictNameById(id) {
    if (!id) return '';
    try {
      // try single-district endpoint first
      const single = await axios.get(`/districts/${id}`).catch(() => null);
      if (single && single.data) {
        // possible shapes: { name: 'Blantyre' } or { district: { id: 2, name: 'Blantyre' } } or { name: 'Blantyre' }
        if (typeof single.data === 'string') return single.data;
        if (single.data.name) return single.data.name;
        if (single.data.district && single.data.district.name) return single.data.district.name;
        if (single.data.district_name) return single.data.district_name;
      }

      // fallback: fetch full list and find the id
      const list = await axios.get('/districts').catch(() => null);
      if (list && list.data && Array.isArray(list.data)) {
        const found = list.data.find(d => Number(d.id) === Number(id) || String(d.id) === String(id));
        if (found) return found.name || found.district_name || found.title || '';
      }
    } catch (e) {
      // ignore and return empty
    }
    return '';
  }

  // fetch current user info (fresh)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!authUser) {
        setLoading(true);
        return;
      }
      setLoading(true);
      try {
        const res = await axios.get('/users/me').catch(() => null);
        if (cancelled) return;
        const payload = res && res.data ? (res.data.user || res.data) : authUser;
        setUser(payload);
        setNameValue(payload?.username || '');

        // resolve district friendly name if available or if we just have district_id
        const dName =
          payload?.district_name ||
          (payload?.district && (payload.district.name || payload.district.district_name)) ||
          '';
        if (dName) {
          setDistrictName(dName);
        } else if (payload?.district_id) {
          const resolved = await fetchDistrictNameById(payload.district_id);
          if (!cancelled) setDistrictName(resolved || '');
        } else {
          setDistrictName('');
        }
      } catch (err) {
        setUser(authUser);
        setNameValue(authUser?.username || '');
        // try resolve from authUser if it has district_id
        if (authUser?.district_id) {
          const resolved = await fetchDistrictNameById(authUser.district_id);
          if (!cancelled) setDistrictName(resolved || '');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [authUser]);

  if (!authUser) return null; // should be wrapped by RequireAuth

  if (loading) return <div className="text-center py-5"><LoadingSpinner size="lg" /></div>;

  // Helper: update sessionStorage cached user so Navbar shows new name
  function persistLocalUser(updatedUser) {
    try {
      const existing = JSON.parse(sessionStorage.getItem('bb_user') || 'null');
      const merged = { ...(existing || {}), ...(updatedUser || {}) };
      sessionStorage.setItem('bb_user', JSON.stringify(merged));
      const bbAuth = JSON.parse(sessionStorage.getItem('bb_auth') || 'null');
      if (bbAuth && bbAuth.user) {
        bbAuth.user = { ...(bbAuth.user || {}), ...(updatedUser || {}) };
        sessionStorage.setItem('bb_auth', JSON.stringify(bbAuth));
      }
    } catch (e) {
      // ignore storage errors
    }
  }

  // Save username (inline edit)
  async function saveName() {
    const newUsername = String(nameValue || '').trim();
    if (!newUsername || newUsername.length < 3 || newUsername.length > 50) {
      setToast({ show: true, message: 'Username must be 3–50 characters.', variant: 'danger' });
      return;
    }

    setProcessing(true);
    try {
      const res = await axios.put(`/users/${user.id}`, { username: newUsername });
      const updated = res?.data || res?.data?.user || ({ ...user, username: newUsername });
      setUser(updated);

      // if the server returned district info, update districtName too
      if (updated?.district_name) setDistrictName(updated.district_name);
      if (updated?.district && (updated.district.name || updated.district.district_name)) {
        setDistrictName(updated.district.name || updated.district.district_name);
      }
      persistLocalUser({ username: updated.username });
      setEditingName(false);
      setToast({ show: true, message: 'Username updated.', variant: 'success' });
    } catch (err) {
      console.error('Name update error', err);
      const msg = err?.response?.data?.error || err?.message || 'Could not update username';
      setToast({ show: true, message: msg, variant: 'danger' });
    } finally {
      setProcessing(false);
    }
  }

  // Password strength check: at least 8 chars, contains a number
  function isPasswordStrong(password) {
    return password.length >= 8 && /\d/.test(password);
  }

  // Inline change password handler — calls POST /users/me/change-password
  async function handleChangePassword(e) {
    e?.preventDefault();
    // Password strength check
    if (!isPasswordStrong(pwNew)) {
      setToast({ show: true, message: 'New password must be at least 8 characters and contain at least one number.', variant: 'danger' });
      return;
    }
    if (pwNew !== pwConfirm) {
      setToast({ show: true, message: 'New password and confirmation do not match.', variant: 'danger' });
      return;
    }

    setPwProcessing(true);
    try {
      await axios.post('/users/me/change-password', {
        current_password: pwCurrent,
        new_password: pwNew
      });
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
      setToast({ show: true, message: 'Password changed successfully.', variant: 'success' });
    } catch (err) {
      console.error('Change password error', err);
      const msg = err?.response?.data?.error || err?.message || 'Could not change password';
      setToast({ show: true, message: msg, variant: 'danger' });
    } finally {
      setPwProcessing(false);
    }
  }

  // Deactivate account (soft delete)
  async function handleDeleteConfirm() {
    setProcessing(true);
    try {
      await axios.delete('/users/me'); // auth required
      setToast({ show: true, message: 'Your account has been deactivated. You will be signed out shortly.', variant: 'success' });
      try { await logout(); } catch (e) { /* ignore */ }
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Delete error', err);
      const msg = err?.response?.data?.error || err?.message || 'Could not deactivate account';
      setToast({ show: true, message: msg, variant: 'danger' });
    } finally {
      setProcessing(false);
      setConfirmOpen(false);
    }
  }

  // Determine if artist profile is verified (approved) and artist exists
  const isArtistVerified = artist && artist.is_approved && user?.role === 'artist';

  return (
    <>
      <div className="mb-3">
        <Card>
          <Card.Body>
            <Row className="align-items-center">
              <Col xs="auto">
                <img
                  src={user?.photo_url || user?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || 'User')}&background=0D8ABC&color=fff&size=256`}
                  alt="avatar"
                  style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: '50%' }}
                  loading="lazy"
                />
              </Col>

              <Col>
                {!editingName ? (
                  <>
                    <h4 className="mb-0">{user?.username}</h4>
                    <div className="small text-muted">{user?.email}</div>
                    <div className="mt-2">
                      <small className="text-muted">Role:</small> <strong>{user?.role}</strong>
                      { (districtName) ? (
                        <span className="ms-3"><small className="text-muted">District:</small> <strong>{districtName}</strong></span>
                      ) : (user?.district_id ? (
                        <span className="ms-3"><small className="text-muted">District:</small> <strong>{user.district_id}</strong></span>
                      ) : null) }
                    </div>
                  </>
                ) : (
                  <Form onSubmit={(e) => { e.preventDefault(); saveName(); }}>
                    <Form.Group className="mb-2" controlId="username">
                      <Form.Label className="small text-muted">Username</Form.Label>
                      <InputGroup>
                        <Form.Control
                          type="text"
                          value={nameValue}
                          onChange={(e) => setNameValue(e.target.value)}
                          placeholder="Enter username"
                          disabled={processing}
                        />
                        <Button variant="outline-primary" onClick={saveName} disabled={processing}>
                          {processing ? 'Saving…' : 'Save'}
                        </Button>
                        <Button variant="outline-secondary" onClick={() => { setEditingName(false); setNameValue(user?.username || ''); }} disabled={processing}>
                          Cancel
                        </Button>
                      </InputGroup>
                    </Form.Group>
                  </Form>
                )}
              </Col>

              <Col xs="auto" className="text-end">
                <div className="d-grid gap-2">
                  {!editingName ? (
                    <Button variant="outline-primary" size="sm" onClick={() => setEditingName(true)}>Edit username</Button>
                  ) : null}
                  {isArtistVerified && (
                    <Button variant="outline-success" size="sm" onClick={() => navigate(`/artist/${artist.id}`)}>
                      View Artist Profile
                    </Button>
                  )}
                  <Button variant="outline-danger" size="sm" onClick={() => setConfirmOpen(true)}>Deactivate account</Button>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      </div>

      {/* Inline change-password card */}
      <Row>
        <Col md={8}>
          <Card className="mb-3">
            <Card.Body>
              <h5 className="mb-3">Change password</h5>
              <Form onSubmit={handleChangePassword}>
                <Form.Group className="mb-2" controlId="currentPassword">
                  <Form.Label className="small text-muted">Current password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showCurrent ? 'text' : 'password'}
                      value={pwCurrent}
                      onChange={(e) => setPwCurrent(e.target.value)}
                      required
                      autoComplete="current-password"
                      disabled={pwProcessing}
                    />
                    <Button
                      type="button"
                      variant="outline-secondary"
                      onClick={() => setShowCurrent(!showCurrent)}
                      aria-label={showCurrent ? 'Hide password' : 'Show password'}
                    >
                      {showCurrent ? 'Hide' : 'Show'}
                    </Button>
                  </InputGroup>
                </Form.Group>

                <Form.Group className="mb-2" controlId="newPassword">
                  <Form.Label className="small text-muted">New password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showNew ? 'text' : 'password'}
                      value={pwNew}
                      onChange={(e) => setPwNew(e.target.value)}
                      required
                      autoComplete="new-password"
                      disabled={pwProcessing}
                    />
                    <Button
                      type="button"
                      variant="outline-secondary"
                      onClick={() => setShowNew(!showNew)}
                      aria-label={showNew ? 'Hide password' : 'Show password'}
                    >
                      {showNew ? 'Hide' : 'Show'}
                    </Button>
                  </InputGroup>
                  <Form.Text className="text-muted">
                    Minimum 8 characters, must include at least one number.
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3" controlId="confirmPassword">
                  <Form.Label className="small text-muted">Confirm new password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showConfirm ? 'text' : 'password'}
                      value={pwConfirm}
                      onChange={(e) => setPwConfirm(e.target.value)}
                      required
                      minLength={8}
                      disabled={pwProcessing}
                    />
                    <Button
                      type="button"
                      variant="outline-secondary"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? 'Hide' : 'Show'}
                    </Button>
                  </InputGroup>
                </Form.Group>

                <div className="d-flex gap-2">
                  <Button type="submit" variant="success" disabled={pwProcessing}>
                    {pwProcessing ? 'Updating…' : 'Update password'}
                  </Button>
                  <Button variant="outline-secondary" onClick={() => { setPwCurrent(''); setPwNew(''); setPwConfirm(''); }} disabled={pwProcessing}>Clear</Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="mb-3">
            <Card.Body>
              <h6>Quick info</h6>
              <div className="small text-muted">Username</div>
              <div className="mb-2">{user?.username}</div>

              <div className="small text-muted">Email</div>
              <div className="mb-2">{user?.email}</div>

              <div className="small text-muted">Status</div>
              <div className="mb-2">{user?.deleted_at ? 'Deactivated' : 'Active'}</div>

              <hr />

              <div className="small text-muted">Need help?</div>
              <div><Button variant="link" onClick={() => navigate('/support')}>Contact support</Button></div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Confirm modal */}
      <ConfirmModal
        show={confirmOpen}
        onHide={() => setConfirmOpen(false)}
        title="Deactivate account"
        message="This will deactivate your account. You will be signed out immediately. You may restore your account within 30 days if you change your mind. Do you want to continue?"
        onConfirm={handleDeleteConfirm}
        confirmText={processing ? 'Processing…' : 'Yes, deactivate'}
        cancelText="Cancel"
        variant="danger"
      />

      {/* Toasts */}
      <ToastMessage show={toast.show} onClose={() => setToast(s => ({ ...s, show: false }))} message={toast.message} variant={toast.variant} />
      {(processing || pwProcessing) && <div style={{ position: 'fixed', bottom: 12, right: 12, zIndex: 2000 }}><LoadingSpinner size="sm" /></div>}
    </>
  );
}