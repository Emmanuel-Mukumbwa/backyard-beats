// File: src/pages/Login.jsx
import React, { useState, useContext } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Form, Button, Card } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import { AuthContext } from '../context/AuthContext';
import ToastMessage from '../components/ToastMessage';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useContext(AuthContext);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
  const res = await axios.post('/auth/login', { email, password });
      // Save user in AuthContext and localStorage
      login({ ...res.data.user, token: res.data.token });
      setSuccess('Login successful! Redirecting...');
      setTimeout(() => {
        // Role-based redirect
        const redirectTo = new URLSearchParams(location.search).get('redirectTo');
        if (redirectTo) {
          navigate(redirectTo, { replace: true });
          return;
        }
        if (res.data.user.role === 'artist') {
          // If artist has no profile, redirect to onboarding
          if (!res.data.user.hasProfile) {
            navigate('/onboard', { replace: true });
          } else {
            navigate('/artist/dashboard', { replace: true });
          }
        } else if (res.data.user.role === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }, 1200);
    } catch (err) {
  setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ToastMessage show={!!error} onClose={() => setError(null)} message={error} variant="danger" />
      <ToastMessage show={!!success} onClose={() => setSuccess(null)} message={success} variant="success" />
      <Card className="mx-auto" style={{maxWidth:480}}>
        <Card.Body>
          <h3 className="mb-3">Login</h3>
          <Form onSubmit={submit}>
            <Form.Group className="mb-2">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </Form.Group>
            <div className="d-grid">
              <Button type="submit" variant="success" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
            </div>
          </Form>
          <div className="mt-3 small">No account? <Link to="/register">Register</Link></div>
          <div className="mt-2 text-muted small">
            Forgot your password? Contact support or try registering with a different email.
          </div>
        </Card.Body>
      </Card>
    </>
  );
}




// End of appended pages & server hints

