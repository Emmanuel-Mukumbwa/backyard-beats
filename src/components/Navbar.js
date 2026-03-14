// src/components/Navbar.jsx
import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar as RBNavbar, Nav as RBNav, Container as RBContainer, NavDropdown, Image } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import LogoutConfirmModal from './LogoutConfirmModal';
import ToastMessage from './ToastMessage';

// icons
import { FaHome, FaCalendarAlt, FaMusic, FaTools, FaSignInAlt, FaUserPlus } from 'react-icons/fa';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [showLogout, setShowLogout] = useState(false);
  const [processingLogout, setProcessingLogout] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });
  const [expanded, setExpanded] = useState(false);

  async function handleConfirmLogout() {
    setProcessingLogout(true);
    try {
      await logout();
      try { localStorage.removeItem('bb_user'); localStorage.removeItem('bb_token'); } catch {}
      setShowLogout(false);
      setToast({ show: true, message: 'You have signed out', variant: 'success' });
      setExpanded(false);
      navigate('/login', { replace: true });
    } catch {
      setToast({ show: true, message: 'Could not sign out. Try again.', variant: 'danger' });
    } finally {
      setProcessingLogout(false);
    }
  }

  function handleCancelLogout() { setShowLogout(false); }

  const userDisplay = user?.displayName || user?.username || '';

  return (
    <>
      <ToastMessage show={toast.show} onClose={() => setToast(s => ({ ...s, show: false }))} message={toast.message} variant={toast.variant} />

      <RBNavbar bg="success" variant="dark" expand="lg" sticky="top" expanded={expanded} onToggle={setExpanded} className="shadow-soft">
        <RBContainer>
          <RBNavbar.Brand as={Link} to="/">BackyardBeats</RBNavbar.Brand>
          <RBNavbar.Toggle aria-controls="navbar-nav" />
          <RBNavbar.Collapse id="navbar-nav">
            <RBNav className="ms-auto" onSelect={() => setExpanded(false)}>
              <RBNav.Link as={Link} to="/"><FaHome className="me-1" />Home</RBNav.Link>
              <RBNav.Link as={Link} to="/events"><FaCalendarAlt className="me-1" />Events</RBNav.Link>

              {/* NEW: Music / Browse link */}
              <RBNav.Link as={Link} to="/music"><FaMusic className="me-1" />Music</RBNav.Link>

              {user?.role === 'admin' && (
                <RBNav.Link as={Link} to="/admin"><FaTools className="me-1" />Admin</RBNav.Link>
              )}

              {user?.role === 'artist' && (
                <>
                  <RBNav.Link as={Link} to="/artist/dashboard"><FaMusic className="me-1" />My Dashboard</RBNav.Link>
                  {!user?.has_profile && (
                    <RBNav.Link as={Link} to="/onboard">Onboard</RBNav.Link>
                  )}
                </>
              )}

              {user?.role === 'fan' && (
                <RBNav.Link as={Link} to="/fan/dashboard">My Dashboard</RBNav.Link>
              )}

              {user ? (
                <NavUserDropdown
                  user={user}
                  display={userDisplay}
                  onLogout={() => setShowLogout(true)}
                />
              ) : (
                <>
                  <RBNav.Link as={Link} to="/login"><FaSignInAlt className="me-1" />Login</RBNav.Link>
                  <RBNav.Link as={Link} to="/register"><FaUserPlus className="me-1" />Register</RBNav.Link>
                </>
              )}
            </RBNav>
          </RBNavbar.Collapse>
        </RBContainer>
      </RBNavbar>

      <LogoutConfirmModal
        show={showLogout}
        onCancel={handleCancelLogout}
        onConfirm={handleConfirmLogout}
        unsavedChanges={false}
        processing={processingLogout}
      />
    </>
  );
}

function NavUserDropdown({ user, display, onLogout }) {
  const avatarUrl = user?.photo_url || user?.photo || null;
  const avatarSrc = avatarUrl && /^https?:\/\//i.test(avatarUrl) ? avatarUrl : (avatarUrl ? `${process.env.REACT_APP_API_URL?.replace(/\/$/, '') || ''}/${avatarUrl}` : null);
  return (
    <NavDropdown align="end" title={
      <span className="d-inline-flex align-items-center">
        {avatarSrc ? (
          <Image src={avatarSrc} roundedCircle style={{ width: 30, height: 30, objectFit: 'cover', marginRight: 8 }} />
        ) : (
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: '#fff', display: 'inline-block', marginRight: 8, textAlign: 'center',
            lineHeight: '30px', color: '#198754', fontWeight: '700'
          }}>
            {String(display || 'U').charAt(0).toUpperCase()}
          </div>
        )}
        <span className="small">{display}</span>
      </span>
    } id="user-dropdown">
      <NavDropdown.Item as={Link} to="/profile">Profile</NavDropdown.Item>
      {user?.role === 'artist' && <NavDropdown.Item as={Link} to="/artist/dashboard">Dashboard</NavDropdown.Item>}
      <NavDropdown.Divider />
      <NavDropdown.Item as="button" onClick={onLogout}>Logout</NavDropdown.Item>
    </NavDropdown>
  );
}