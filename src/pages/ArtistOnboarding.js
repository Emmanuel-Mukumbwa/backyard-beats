// src/pages/ArtistOnboarding.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Button, Alert, Badge, Image } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import DISTRICTS from '../data/districts';
import { AuthContext } from '../context/AuthContext';

export default function ArtistOnboarding() {
  const { user, updateUser, fetchArtistProfile } = useContext(AuthContext);
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [district, setDistrict] = useState(''); // could be name or id string
  const [districtId, setDistrictId] = useState(null); // numeric id if available
  const [genres, setGenres] = useState([]);
  const [photoFile, setPhotoFile] = useState(null); // File object
  const [photoPreview, setPhotoPreview] = useState(null); // object URL or absolute server URL
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const GENRES = [
    "Afropop","Gospel","Hip-hop","R&B","Reggae","Highlife",
    "Traditional","Dancehall","Jazz","Blues","Electronic"
  ];

  // Resolve preview URL (make uploads path absolute if needed)
  const resolvePreviewUrl = (raw) => {
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:3001';
    if (raw.startsWith('/')) return `${base}${raw}`;
    if (raw.startsWith('uploads/')) return `${base}/${raw}`;
    // fallback
    return `${base}/uploads/${raw}`;
  };

  useEffect(() => {
    // Prefill from AuthContext.user if available, otherwise fall back to localStorage legacy keys
    try {
      if (user) {
        if (user.username) setDisplayName(user.username);
        if (user.display_name) setDisplayName(user.display_name);
        if (user.displayName) setDisplayName(user.displayName);

        if (user.district) setDistrict(user.district);
        if (user.district_id) {
          setDistrictId(Number(user.district_id));
          setDistrict(String(user.district_id));
        }
        if (user.photo_url) {
          setPhotoPreview(resolvePreviewUrl(user.photo_url));
        } else if (user.photo) {
          setPhotoPreview(resolvePreviewUrl(user.photo));
        }
      } else {
        const stored = JSON.parse(localStorage.getItem('bb_user') || 'null');
        if (stored) {
          if (stored.username) setDisplayName(stored.username);
          if (stored.displayName) setDisplayName(stored.displayName);
          if (stored.display_name) setDisplayName(stored.display_name);
          if (stored.district) setDistrict(stored.district);
          if (stored.district_id) {
            setDistrictId(Number(stored.district_id));
            setDistrict(String(stored.district_id));
          }
          if (stored.photo_url) setPhotoPreview(resolvePreviewUrl(stored.photo_url));
        }
      }

      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('ArtistOnboarding prefill — user:', user);
        // eslint-disable-next-line no-console
        console.log('Legacy bb_user:', localStorage.getItem('bb_user'));
        // eslint-disable-next-line no-console
        console.log('Token present?', !!localStorage.getItem('bb_token'));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error reading initial user state for onboarding:', e);
    }
  }, [user]);

  // Cleanup preview URL on unmount / when photoFile changes
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const toggleGenre = (g) => {
    setGenres(gs => gs.includes(g) ? gs.filter(x => x !== g) : [...gs, g]);
  };

  // File validation: image and max size 5MB
  const handleFileSelect = (file) => {
    setError(null);

    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }

    if (!file.type || !file.type.startsWith('image/')) {
      setError('Selected file must be an image.');
      return;
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      setError('Image is too large. Max size is 5 MB.');
      return;
    }

    // create preview (blob)
    const previewUrl = URL.createObjectURL(file);
    // revoke previous blob URL if any
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(file);
    setPhotoPreview(previewUrl);
  };

  const removeSelectedPhoto = () => {
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!displayName.trim()) {
      setError('Display name is required.');
      setLoading(false);
      return;
    }
    if (genres.length === 0) {
      setError('Please select at least one genre.');
      setLoading(false);
      return;
    }

    try {
      // Resolve district_id if DISTRICTS contains objects
      let resolvedDistrictId = null;
      if (district) {
        const firstElem = DISTRICTS && DISTRICTS.length ? DISTRICTS[0] : null;
        if (firstElem && typeof firstElem === 'object' && ('id' in firstElem || 'name' in firstElem)) {
          const found = DISTRICTS.find(d => String(d.id) === String(district) || String(d.name) === String(district));
          if (found) resolvedDistrictId = found.id;
        }
      }

      const form = new FormData();
      form.append('display_name', displayName.trim());
      form.append('bio', bio.trim() || '');
      form.append('genres', JSON.stringify(genres));
      if (resolvedDistrictId) form.append('district_id', String(resolvedDistrictId));
      else if (district) form.append('district', String(district));
      // Attach file if present
      if (photoFile) {
        form.append('photo', photoFile, photoFile.name);
      }

      // Debug log (dev)
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('Submitting onboarding form:', {
          display_name: displayName.trim(),
          bio: bio.trim(),
          district_id: resolvedDistrictId,
          district,
          genres,
          photoFileName: photoFile ? photoFile.name : null
        });
      }

      const response = await axios.post('/artistOnboard/onboard', form);

      const msg = response?.data?.message || 'Profile saved successfully!';
      setSuccess(msg);

      // Prefer server-provided user + artist to keep client state authoritative
      const returnedUser = response?.data?.user || null;
      const returnedArtist = response?.data?.artist || null;
      const returnedPhotoUrl = response?.data?.photo_url || returnedArtist?.photo_url || returnedUser?.photo_url || null;

      // Update context user: if server returned user object use it (likely contains has_profile/role)
      if (returnedUser) {
        // merge returned user with any existing token in local storage
        updateUser({ ...returnedUser });
      } else {
        // no user returned — apply minimal flags client-side
        updateUser({ has_profile: true, role: 'artist', photo_url: returnedPhotoUrl || undefined, display_name: displayName.trim() });
      }

      // Refresh artist profile in context (if server saved one)
      try {
        const freshArtist = await fetchArtistProfile();
        if (freshArtist) {
          // set photo preview to returned/artist path if available
          if (freshArtist.photo_url) {
            setPhotoPreview(resolvePreviewUrl(freshArtist.photo_url));
          } else if (returnedPhotoUrl) {
            setPhotoPreview(resolvePreviewUrl(returnedPhotoUrl));
          }
        } else if (returnedPhotoUrl) {
          setPhotoPreview(resolvePreviewUrl(returnedPhotoUrl));
        }
      } catch (err) {
        // ignore fetch errors — we already updated user
        if (returnedPhotoUrl) setPhotoPreview(resolvePreviewUrl(returnedPhotoUrl));
      }

      // Navigate after a short moment so user sees success
      setTimeout(() => {
        navigate('/artist/dashboard');
      }, 700);
    } catch (err) {
  console.error('Artist onboarding error:', err);
  // More verbose debug info
  console.error('Error message:', err.message);
  if (err.response) {
    console.error('Response status:', err.response.status);
    console.error('Response headers:', err.response.headers);
    console.error('Response body:', err.response.data);
    setError(err.response.data?.error || err.response.data?.message || String(err.response.data) || err.message);
  } else if (err.request) {
    console.error('No response received. Request:', err.request);
    setError('No response from server. Check your network or server logs.');
  } else {
    setError(err.message || 'An error occurred');
  }
} finally {
  setLoading(false);
}
  };

  return (
    <Card className="mx-auto" style={{ maxWidth: 900 }}>
      <Card.Body>
        <h3>Artist Onboarding</h3>
        <p className="text-muted">Complete your artist profile to start sharing your music.</p>

        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <Form onSubmit={submit} encType="multipart/form-data">
          <Form.Group className="mb-3">
            <Form.Label>Display Name <span className="text-danger">*</span></Form.Label>
            <Form.Control
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your artist name"
              required
            />
            <Form.Text className="text-muted">This is how fans will see you</Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Bio</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell fans about yourself, your music journey, and what inspires you..."
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>District</Form.Label>
            <Form.Select
              value={district || ''}
              onChange={e => {
                const val = e.target.value;
                setDistrict(val);
                const first = DISTRICTS && DISTRICTS.length ? DISTRICTS[0] : null;
                if (first && typeof first === 'object' && ('id' in first || 'name' in first)) {
                  const found = DISTRICTS.find(d => String(d.id) === String(val) || String(d.name) === String(val));
                  if (found) {
                    setDistrictId(found.id);
                  } else {
                    setDistrictId(null);
                  }
                } else {
                  setDistrictId(null);
                }
              }}
            >
              <option value="">Select your district (optional)</option>
              {DISTRICTS.map((d, idx) => {
                if (typeof d === 'object') {
                  return <option key={d.id ?? idx} value={d.id ?? d.name}>{d.name ?? d.id}</option>;
                }
                return <option key={d} value={d}>{d}</option>;
              })}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Genres <span className="text-danger">*</span></Form.Label>
            <div className="mb-2">
              {GENRES.map(g => (
                <button
                  type="button"
                  key={g}
                  className={`btn btn-sm me-2 mb-2 ${genres.includes(g) ? 'btn-success' : 'btn-outline-secondary'}`}
                  onClick={() => toggleGenre(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            <Form.Text className="text-muted">
              Selected: {genres.length > 0 ? genres.join(', ') : 'None'}
            </Form.Text>

            {genres.length > 0 && (
              <div className="mt-2">
                {genres.map(g => <Badge bg="success" className="me-2" key={g}>{g}</Badge>)}
              </div>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Profile Photo (optional)</Form.Label>
            <div className="d-flex align-items-center mb-2">
              <div>
                <input
                  id="photoInput"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e.target.files && e.target.files[0])}
                  style={{ display: 'inline-block' }}
                />
              </div>

              {photoPreview && (
                <div className="ms-3 d-flex align-items-center">
                  <Image
                    src={photoPreview}
                    rounded
                    thumbnail
                    style={{ width: 96, height: 96, objectFit: 'cover' }}
                    alt="Preview"
                    onError={(ev) => {
                      ev.currentTarget.onerror = null;
                      ev.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || user?.username || 'Artist')}&background=0D8ABC&color=fff&size=256`;
                    }}
                  />
                  <div className="ms-2">
                    <div>
                      <Button size="sm" variant="outline-danger" onClick={removeSelectedPhoto}>
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Form.Text className="text-muted">Accepted: JPG, PNG. Max 5 MB.</Form.Text>
          </Form.Group>

          <div className="d-grid mt-4">
            <Button type="submit" variant="success" size="lg" disabled={loading}>
              {loading ? 'Saving...' : 'Complete Profile'}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}