// File: src/pages/Register.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Button } from 'react-bootstrap';
import DISTRICTS from '../data/districts';
import axios from '../api/axiosConfig';
import ToastMessage from '../components/ToastMessage';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('fan');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
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
      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 1200);
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
  <ToastMessage show={!!error} onClose={() => setError(null)} message={error} variant="danger" />
  <ToastMessage show={!!success} onClose={() => setSuccess(null)} message={success} variant="success" />
        <Form onSubmit={submit}>
          <Form.Group className="mb-2">
            <Form.Label>Username</Form.Label>
            <Form.Control value={username} onChange={e => setUsername(e.target.value)} required />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Email</Form.Label>
            <Form.Control type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Enter a valid email" />
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

        

          <div className="d-grid">
            <Button variant="success" type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</Button>
          </div>
        </Form>
        <div className="mt-2 text-muted small">
          Already have an account? <a href="/login">Log in</a>.<br />
          Your email must be unique. If you see an error, try logging in or use a different email.
        </div>
      </Card.Body>
    </Card>
  );
}
