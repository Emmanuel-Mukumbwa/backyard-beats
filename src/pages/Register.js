// File: src/pages/Register.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Button } from 'react-bootstrap';
import DISTRICTS from '../data/districts';
import axios from '../api/axiosConfig';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('fan');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = { username, email, password, role };
      const res = await axios.post('/auth/register', payload);
      // Registration returns user, not token
      localStorage.setItem('bb_user', JSON.stringify(res.data.user));
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto" style={{maxWidth:600}}>
      <Card.Body>
        <h3 className="mb-3">Create an account</h3>
        {error && <div className="alert alert-danger">{error}</div>}
        <Form onSubmit={submit}>
          <Form.Group className="mb-2">
            <Form.Label>Username</Form.Label>
            <Form.Control value={username} onChange={e => setUsername(e.target.value)} required />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Email</Form.Label>
            <Form.Control type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Role</Form.Label>
            <Form.Select value={role} onChange={e => setRole(e.target.value)}>
              <option value="fan">Fan</option>
              <option value="artist">Artist</option>
              <option value="admin">Admin</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Password</Form.Label>
            <Form.Control type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Role</Form.Label>
            <Form.Select value={role} onChange={e => setRole(e.target.value)}>
              <option value="artist">Artist</option>
              <option value="fan">Fan</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>District</Form.Label>
            <Form.Select value={district} onChange={e => setDistrict(e.target.value)}>
              <option value="">Select district (optional)</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </Form.Select>
          </Form.Group>

          <div className="d-grid">
            <Button variant="success" type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
