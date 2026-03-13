// src/pages/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import { Tabs, Tab, Alert, Modal, Form, Button } from 'react-bootstrap';
import axios from '../api/axiosConfig';

import AnalyticsPanel from '../components/admin/AnalyticsPanel'; 
import UsersTable from '../components/admin/UsersTable';
import PendingApprovals from '../components/admin/PendingApprovals';
import RatingsModeration from '../components/admin/RatingsModeration';
import SupportPanel from '../components/admin/SupportPanel';
import SettingsPanel from '../components/admin/SettingsPanel';


export default function AdminDashboard() {
  /* ---------------- STATE ---------------- */
  const [users, setUsers] = useState([]);
  const [usersMeta, setUsersMeta] = useState({ page: 1, pages: 1 });

  const [pendingArtists, setPendingArtists] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [pendingTracks, setPendingTracks] = useState([]);

  const [ratings, setRatings] = useState([]);
  const [analytics, setAnalytics] = useState({});

  const [settings, setSettings] = useState({
    siteName: 'BackyardBeats',
    maintenanceMode: false
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* modals */
  const [showUserModal, setShowUserModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userForm, setUserForm] = useState({
    displayName: '',
    email: '',
    role: 'fan',
    banned: false
  });

  /* ---------------- LOAD DATA ---------------- */
  useEffect(() => {
    loadDashboardData();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);

    const endpoints = [
      { name: 'analytics', url: '/admin/analytics' },
      { name: 'pendingArtists', url: '/admin/pending/artists' },
      { name: 'pendingTracks', url: '/admin/pending/tracks' },
      { name: 'pendingEvents', url: '/admin/pending/events' },
      { name: 'settings', url: '/admin/settings' },
      { name: 'ratings', url: '/admin/ratings' } // ratings list
    ];

    try {
      const results = await Promise.allSettled(endpoints.map(e => axios.get(e.url)));

      const failed = [];

      results.forEach((res, idx) => {
        const name = endpoints[idx].name;
        if (res.status === 'fulfilled') {
          const data = res.value.data;
          switch (name) {
            case 'analytics':
              if (data.analytics) setAnalytics(data.analytics);
              break;
            case 'pendingArtists':
              if (data.pending) setPendingArtists(data.pending);
              break;
            case 'pendingTracks':
              if (data.pending) setPendingTracks(data.pending);
              break;
            case 'pendingEvents':
              if (data.pending) setPendingEvents(data.pending);
              break;
            case 'settings':
              if (data.settings) setSettings(data.settings);
              break;
            case 'ratings':
              if (data.ratings) setRatings(data.ratings);
              break;
            default:
              break;
          }
        } else {
          failed.push(name);
          console.error(name, res.reason);
        }
      });

      if (failed.length) {
        setError(`Failed loading: ${failed.join(', ')}`);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- USERS ---------------- */
  const fetchUsers = async (page = 1, limit = 25, q = '') => {
    try {
      const res = await axios.get('/admin/users', { params: { page, limit, q } });
      setUsers(res.data.users || []);
      setUsersMeta(res.data.meta || {});
    } catch (err) {
      console.error('Failed loading users', err);
      setError('Failed to load users');
    }
  };

  const handleBanToggle = async (user, ban) => {
    try {
      await axios.post(`/admin/users/${user.id}/ban`, { ban });
      fetchUsers(usersMeta.page);
    } catch (err) {
      console.error(err);
      setError('Failed to update user status');
    }
  };

  const handleSoftDelete = async (user) => {
    try {
      await axios.delete(`/admin/users/${user.id}`);
      fetchUsers(usersMeta.page);
    } catch (err) {
      console.error(err);
      setError('Failed to delete user');
    }
  };

  const handleRestore = async (user) => {
    try {
      await axios.post(`/admin/users/${user.id}/restore`);
      fetchUsers(usersMeta.page);
    } catch (err) {
      console.error(err);
      setError('Failed to restore user');
    }
  };

  const handleUserAction = (user, action) => {
    if (action === 'edit') {
      setSelectedUser(user);
      setUserForm({
        displayName: user.username,
        email: user.email,
        role: user.role,
        banned: !!user.banned
      });
      setShowUserModal(true);
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/admin/users/${selectedUser.id}`, {
        displayName: userForm.displayName,
        email: userForm.email,
        role: userForm.role
      });

      if (userForm.banned !== selectedUser.banned) {
        await handleBanToggle(selectedUser, userForm.banned);
      }

      fetchUsers(usersMeta.page);
      setShowUserModal(false);
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
      setError('Failed updating user');
    }
  };

  /* ---------------- ARTIST / TRACK / EVENT approvals are handled inside PendingApprovals component via passed props (which call API directly) ---------------- */

  /* ---------------- RATINGS (delete via controller) ---------------- */
  const moderateRating = async (id) => {
    try {
      await axios.delete(`/admin/ratings/${id}`);
      setRatings(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error(err);
      setError('Failed to delete rating');
    }
  };

  /* ---------------- SETTINGS (handled by SettingsPanel + parent modal) ---------------- */
  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/admin/settings', settings);
      setShowSettingsModal(false);
      // reload settings
      const res = await axios.get('/admin/settings');
      if (res?.data?.settings) setSettings(res.data.settings);
    } catch (err) {
      console.error(err);
      setError('Failed to update settings');
    }
  };

  /* ---------------- RENDER ---------------- */
  if (loading) return <div className="text-center py-5">Loading dashboard...</div>;

  return (
    <div>
      <h2 className="mb-4">Admin Dashboard</h2>

      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}

      <Tabs defaultActiveKey="analytics">
        <Tab eventKey="analytics" title="Analytics">
          <AnalyticsPanel analytics={analytics} />
        </Tab>

        <Tab eventKey="users" title="User Management">
          <UsersTable
            users={users}
            onEdit={(u) => handleUserAction(u, 'edit')}
            onToggleBan={(u, ban) => handleBanToggle(u, ban)}
            onSoftDelete={(u) => handleSoftDelete(u)}
            onRestore={(u) => handleRestore(u)}
            pagination={{
              page: usersMeta.page,
              pages: usersMeta.pages,
              onPageChange: (p) => fetchUsers(p)
            }}
          />
        </Tab>

        <Tab eventKey="artists" title="Artist Approval">
          <PendingApprovals
            items={pendingArtists}
            type="artist"
            onDone={() => loadDashboardData()}
          />
        </Tab>

        <Tab eventKey="tracks" title="Track Approval">
          <PendingApprovals
            items={pendingTracks}
            type="track"
            onDone={() => loadDashboardData()}
          />
        </Tab>

        <Tab eventKey="events" title="Event Approval">
          <PendingApprovals
            items={pendingEvents}
            type="event"
            onDone={() => loadDashboardData()}
          />
        </Tab>

        <Tab eventKey="moderation" title="Moderation">
          <RatingsModeration ratings={ratings} onDelete={moderateRating} />
        </Tab>
       
        <Tab eventKey="support" title="Support">
          <SupportPanel />
        </Tab>

        <Tab eventKey="settings" title="System Settings">
          <SettingsPanel settings={settings} onEdit={() => setShowSettingsModal(true)} />
        </Tab>
      </Tabs>

      {/* ---------------- USER EDIT MODAL ---------------- */}
      <Modal show={showUserModal} onHide={() => setShowUserModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Edit User</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUserSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Display Name</Form.Label>
              <Form.Control value={userForm.displayName} onChange={e => setUserForm({ ...userForm, displayName: e.target.value })} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                <option value="fan">Fan</option>
                <option value="artist">Artist</option>
                <option value="admin">Admin</option>
              </Form.Select>
            </Form.Group>

            <Form.Check type="checkbox" label="Banned" checked={userForm.banned} onChange={e => setUserForm({ ...userForm, banned: e.target.checked })} />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowUserModal(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ---------------- SETTINGS MODAL ---------------- */}
      <Modal show={showSettingsModal} onHide={() => setShowSettingsModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>System Settings</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSettingsSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Site Name</Form.Label>
              <Form.Control value={settings.siteName} onChange={e => setSettings({ ...settings, siteName: e.target.value })} />
            </Form.Group>

            <Form.Check type="checkbox" label="Maintenance Mode" checked={settings.maintenanceMode} onChange={e => setSettings({ ...settings, maintenanceMode: e.target.checked })} />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowSettingsModal(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}