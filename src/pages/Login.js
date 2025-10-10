// File: src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Button, Card } from 'react-bootstrap';
import axios from '../api/axiosConfig';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post('/auth/login', { username, password });
      localStorage.setItem('bb_token', res.data.token);
      localStorage.setItem('bb_user', JSON.stringify(res.data.user));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto" style={{maxWidth:480}}>
      <Card.Body>
        <h3 className="mb-3">Login</h3>
        {error && <div className="alert alert-danger">{error}</div>}
        <Form onSubmit={submit}>
          <Form.Group className="mb-2">
            <Form.Label>Username</Form.Label>
            <Form.Control value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter your username" />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </Form.Group>
          <div className="d-grid">
            <Button type="submit" variant="success" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
          </div>
        </Form>
        <div className="mt-3 small">No account? <Link to="/register">Register</Link></div>
      </Card.Body>
    </Card>
  );
}




// End of appended pages & server hints

