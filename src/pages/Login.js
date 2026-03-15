// src/pages/Login.jsx
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Form, Button, Card, InputGroup, Spinner } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import { AuthContext } from '../context/AuthContext';
import ToastMessage from '../components/ToastMessage';

export default function Login() {
  const [identifier, setIdentifier] = useState(''); // accepts email or username
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // field-specific validation state (used to highlight fields on server errors)
  const [fieldErrors, setFieldErrors] = useState({ identifier: false, password: false });

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useContext(AuthContext);

  // Basic client-side validation
  const identifierTrim = identifier.trim();
  const isEmail = identifierTrim.includes('@');
  const emailValid = isEmail ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifierTrim) : true;
  const identifierValid = identifierTrim.length >= 3;
  const passwordValid = password.length >= 8;

  const formValid = identifierValid && emailValid && passwordValid;

  // Autofill email from query param (optional)
  useEffect(() => {
    const pre = new URLSearchParams(location.search).get('email');
    if (pre && pre.includes('@')) setIdentifier(pre);
  }, [location.search]);

  // Clear field-level errors as user types
  useEffect(() => {
    if (identifierTrim.length > 0) {
      setFieldErrors(prev => (prev.identifier ? { ...prev, identifier: false } : prev));
    }
  }, [identifierTrim, setFieldErrors]);

  useEffect(() => {
    if (password.length > 0) {
      setFieldErrors(prev => (prev.password ? { ...prev, password: false } : prev));
    }
  }, [password, setFieldErrors]);

  // Persist to localStorage (always)
  const persistAuth = ({ token, user }) => {
    try {
      const payload = { token, user };
      localStorage.setItem('bb_token', token);
      localStorage.setItem('bb_user', JSON.stringify(user));
      localStorage.setItem('bb_auth', JSON.stringify(payload));
    } catch (e) {
      console.error('Error persisting auth to storage', e);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();

    setError(null);
    setSuccess(null);
    setFieldErrors({ identifier: false, password: false });

    if (!formValid) {
      setFieldErrors({
        identifier: !identifierValid || !emailValid,
        password: !passwordValid,
      });
      setError('Please fix the highlighted fields before signing in.');
      return;
    }

    setLoading(true);

    try {
      const body = { identifier: identifierTrim, password };

      const base = axios?.defaults?.baseURL || '';
      const url = `${base.replace(/\/$/, '')}/auth/login`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include'
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          setFieldErrors({ identifier: true, password: true });
          setError(data?.error || 'Incorrect email/username or password. Use "Forgot password?" if needed.');
        } else if (res.status === 410) {
          setError(data?.error || 'This account has been deleted. Contact support if this is an error.');
        } else if (res.status === 403) {
          setError(data?.error || 'Account access denied. Contact support for help.');
        } else {
          setError(data?.error || data?.message || 'Login failed — please try again.');
        }
        setLoading(false);
        return;
      }

      // Successful login
      const token = data?.token;
      const user = data?.user;

      if (!token || !user || !user.id) {
        setError('Authentication failed: invalid server response.');
        setLoading(false);
        return;
      }

      if (user.deleted_at) {
        setError('This account has been deleted. Contact support if you believe this is an error.');
        setLoading(false);
        return;
      }
      if (user.banned) {
        setError('This account has been banned. Contact support for assistance.');
        setLoading(false);
        return;
      }

      persistAuth({ token, user });

      try {
        const maybePromise = login ? login({ ...user, token }) : null;
        if (maybePromise && typeof maybePromise.then === 'function') {
          await maybePromise;
        }
      } catch (ctxErr) {
        console.warn('AuthContext.login threw (non-fatal):', ctxErr);
      }

      setSuccess('Login successful — redirecting...');
      const NAV_DELAY_MS = 600;

      const rawRedirect = new URLSearchParams(location.search).get('redirectTo');
      const safeRedirect = (rawRedirect && rawRedirect.startsWith('/')) ? rawRedirect : null;

      setTimeout(() => {
        if (safeRedirect) {
          navigate(safeRedirect, { replace: true });
          return;
        }

        if (user.role === 'artist') {
          const hasProfile = !!user.has_profile;
          navigate(hasProfile ? '/artist/dashboard' : '/onboard', { replace: true });
        } else if (user.role === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/fan/dashboard', { replace: true });
        }
      }, NAV_DELAY_MS);
    } catch (err) {
      console.error('Login error (network/unknown):', err);
      setError(err?.message || 'Login failed — network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ToastMessage show={!!error} onClose={() => setError(null)} message={error} variant="danger" />
      <ToastMessage show={!!success} onClose={() => setSuccess(null)} message={success} variant="success" />

      <Card className="mx-auto mt-4" style={{ maxWidth: 520 }}>
        <Card.Body>
          <h3 className="mb-3">Sign in</h3>

          <Form onSubmit={handleSubmit} noValidate>
            <Form.Group className="mb-2">
              <Form.Label>Email or username</Form.Label>
              <Form.Control
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="eg. yourname@gmail.com "
                required
                isInvalid={(identifier.length > 0 && !identifierValid) || fieldErrors.identifier}
                autoComplete="username"
              />
              <Form.Control.Feedback type="invalid">
                {fieldErrors.identifier ? 'Check your email/username.' : 'Enter a valid email or username (min 3 characters).'}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Password</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  isInvalid={(password.length > 0 && !passwordValid) || fieldErrors.password}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="outline-secondary"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </Button>
                <Form.Control.Feedback type="invalid">
                  {fieldErrors.password ? 'Password may be incorrect. Use "Forgot password?" to reset.' : 'Password must be at least 8 characters.'}
                </Form.Control.Feedback>
              </InputGroup>
            </Form.Group>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <div /> {/* placeholder to keep spacing */}
              <Link to="/forgot-password" className="small">Forgot password?</Link>
            </div>

            <div className="d-grid">
              <Button type="submit" variant="success" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />{' '}
                    Signing in...
                  </>
                ) : 'Sign in'}
              </Button>
            </div>
          </Form>

          <div className="mt-3 small">
            Don't have an account? <Link to="/register">Create account</Link>
          </div>

          <div className="mt-2 text-muted small">
            Need help? Contact <Link to="/support">support</Link>.
          </div>
        </Card.Body>
      </Card>
    </>
  );
}