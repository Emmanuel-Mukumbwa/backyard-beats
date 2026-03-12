// File: src/pages/ArtistOnboarding.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Button, Badge, Image, Spinner } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import { AuthContext } from '../context/AuthContext';
import ToastMessage from '../components/ToastMessage';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ArtistOnboarding() {
  const { user, updateUser, fetchArtistProfile } = useContext(AuthContext);
  const navigate = useNavigate();

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  // removed district state per normalized design

  // now store selected genre/mood IDs (numbers)
  const [genres, setGenres] = useState([]); // array of ids
  const [moods, setMoods] = useState([]); // array of ids

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Lists loaded from server (meta lists)
  const [metaGenres, setMetaGenres] = useState([]); // [{id, name}, ...]
  const [metaMoods, setMetaMoods] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Helpers
  const UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5MB

  // Resolve preview URL (if server returns relative upload path)
  const resolvePreviewUrl = (raw) => {
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:5000';
    if (raw.startsWith('/')) return `${base}${raw}`;
    if (raw.startsWith('uploads/')) return `${base}/${raw}`;
    return `${base}/uploads/${raw}`;
  };

  // Toggle selection helper for ids
  const toggleItem = (list, setList, value) => {
    // ensure value is a number
    const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    setList(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // File select & validation
  const handleFileSelect = (file) => {
    setError(null);

    if (!file) {
      // clearing
      if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }

    if (!file.type || !file.type.startsWith('image/')) {
      setError('Selected file must be an image (jpg/png).');
      return;
    }

    if (file.size > UPLOAD_MAX_BYTES) {
      setError('Image is too large. Max size is 5 MB.');
      return;
    }

    // revoke old blob preview if any
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    const previewUrl = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotoPreview(previewUrl);
  };

  const removeSelectedPhoto = () => {
    if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  // Initial load: meta and existing artist (if any)
  useEffect(() => {
    let mounted = true; 
    async function loadAll() {
      setFetching(true);
      setError(null);

      try {
        // Parallelize meta calls and artist fetch
        const [gRes, mRes, artistRes] = await Promise.allSettled([
          axios.get('/meta/genres'),
          axios.get('/meta/moods'),
          axios.get('/profile/me').catch(() => null) 
        ]);

        if (!mounted) return;

        if (gRes.status === 'fulfilled') setMetaGenres(gRes.value.data || []);
        if (mRes.status === 'fulfilled') setMetaMoods(mRes.value.data || []);

        // display name fallback from user context
        if (user) {
          if (!displayName && (user.display_name || user.username)) {
            setDisplayName(user.display_name || user.username);
          }
        }

        // If artist profile exists, prefill for editing
        if (artistRes && artistRes.status === 'fulfilled' && artistRes.value && artistRes.value.data && artistRes.value.data.artist) {
          const artist = artistRes.value.data.artist;
          setIsEditMode(true);

          if (artist.display_name) setDisplayName(artist.display_name);
          if (artist.bio) setBio(artist.bio);

          // genres may be returned in different shapes:
          // 1) [{id, name}, ...]
          // 2) ["Afrobeat","Hip-Hop"] (legacy)
          // 3) JSON string
          try {
            if (artist.genres) {
              if (Array.isArray(artist.genres)) {
                if (artist.genres.length > 0 && typeof artist.genres[0] === 'object' && artist.genres[0].id !== undefined) {
                  // array of objects with id
                  setGenres(artist.genres.map(g => Number(g.id)));
                } else {
                  // array of names - map to ids if meta available
                  const ids = (gRes.status === 'fulfilled' ? (gRes.value.data || []) : metaGenres)
                    .filter(mg => artist.genres.includes(mg.name))
                    .map(mg => mg.id);
                  setGenres(ids);
                }
              } else if (typeof artist.genres === 'string') {
                try {
                  const parsed = JSON.parse(artist.genres);
                  if (Array.isArray(parsed)) {
                    // handle same as above
                    if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0].id !== undefined) {
                      setGenres(parsed.map(g => Number(g.id)));
                    } else {
                      const ids = (gRes.status === 'fulfilled' ? (gRes.value.data || []) : metaGenres)
                        .filter(mg => parsed.includes(mg.name))
                        .map(mg => mg.id);
                      setGenres(ids);
                    }
                  }
                } catch (e) {
                  // ignore parse errors
                }
              }
            }
          } catch (e) {
            setGenres([]);
          }

          // moods: same handling
          try {
            if (artist.moods) {
              if (Array.isArray(artist.moods)) {
                if (artist.moods.length > 0 && typeof artist.moods[0] === 'object' && artist.moods[0].id !== undefined) {
                  setMoods(artist.moods.map(m => Number(m.id)));
                } else {
                  const ids = (mRes.status === 'fulfilled' ? (mRes.value.data || []) : metaMoods)
                    .filter(mm => artist.moods.includes(mm.name))
                    .map(mm => mm.id);
                  setMoods(ids);
                }
              } else if (typeof artist.moods === 'string') {
                try {
                  const parsed = JSON.parse(artist.moods);
                  if (Array.isArray(parsed)) {
                    if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0].id !== undefined) {
                      setMoods(parsed.map(m => Number(m.id)));
                    } else {
                      const ids = (mRes.status === 'fulfilled' ? (mRes.value.data || []) : metaMoods)
                        .filter(mm => parsed.includes(mm.name))
                        .map(mm => mm.id);
                      setMoods(ids);
                    }
                  }
                } catch (e) {
                  // ignore
                }
              }
            }
          } catch (e) {
            setMoods([]);
          }

          if (artist.photo_url) {
            setPhotoPreview(resolvePreviewUrl(artist.photo_url));
          } else if (artist.photo) {
            setPhotoPreview(resolvePreviewUrl(artist.photo));
          }
        }
      } catch (err) {
        if (mounted) {
          console.error('Error loading onboarding meta/artist', err);
          setError('Failed to load onboarding data. Try refreshing the page.');
        }
      } finally {
        if (mounted) setFetching(false);
      }
    }

    loadAll();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // cleanup blob preview on unmount
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  // Submit handler
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic validations
    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }
    if (!Array.isArray(genres) || genres.length === 0) {
      setError('Please select at least one genre.');
      return;
    }

    setLoading(true);

    try {
      const form = new FormData();
      form.append('display_name', displayName.trim());
      if (bio && bio.trim()) form.append('bio', bio.trim());
      // send arrays of ids to backend
      form.append('genres', JSON.stringify(genres));
      form.append('moods', JSON.stringify(moods || []));
      if (photoFile) form.append('photo', photoFile, photoFile.name);

      const res = await axios.post('/artistOnboard/onboard', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const msg = res?.data?.message || (isEditMode ? 'Profile updated' : 'Profile created');
      setSuccess(msg);

      // If server returned fresh user, update context user
      if (res.data && res.data.user) {
        try { updateUser(res.data.user); } catch (_) {}
      } else {
        // best-effort flag
        try { updateUser({ has_profile: true, role: 'artist' }); } catch (_) {}
      }

      // Use returned artist data to set preview and local state
      const returnedArtist = res.data?.artist;
      const returnedPhoto = res.data?.photo_url || returnedArtist?.photo_url;
      if (returnedPhoto) {
        setPhotoPreview(resolvePreviewUrl(returnedPhoto));
      }

      // optionally re-fetch artist profile in context (if available)
      try {
        await fetchArtistProfile?.();
      } catch (_) {}

      // navigate to dashboard after brief feedback
      setTimeout(() => navigate('/artist/dashboard'), 700);
    } catch (err) {
      console.error('Artist onboarding submit error:', err);
      if (err.response) {
        // backend may return invalid id details in 400
        const serverErr = err.response.data;
        if (serverErr && serverErr.invalid_genres) {
          setError(`Invalid genre IDs: ${serverErr.invalid_genres.join(', ')}`);
        } else if (serverErr && serverErr.invalid_moods) {
          setError(`Invalid mood IDs: ${serverErr.invalid_moods.join(', ')}`);
        } else {
          setError(err.response.data?.error || err.response.data?.message || 'Failed to save artist profile.');
        }
      } else if (err.request) {
        setError('No response from server. Check your network or server logs.');
      } else {
        setError(err.message || 'An error occurred while saving your profile.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Card className="mx-auto" style={{ maxWidth: 900 }}>
        <Card.Body className="text-center py-5">
          <LoadingSpinner size="md" />
          <div className="mt-3">Loading onboarding data...</div>
        </Card.Body>
      </Card>
    );
  }

  // helper to get names for selected ids
  const selectedGenreNames = metaGenres
    .filter(g => genres.includes(g.id))
    .map(g => g.name);

  const selectedMoodNames = metaMoods
    .filter(m => moods.includes(m.id))
    .map(m => m.name);

  return (
    <Card className="mx-auto" style={{ maxWidth: 900 }}>
      <Card.Body>
        <h3>{isEditMode ? 'Edit Artist Profile' : 'Artist Onboarding'}</h3>
        <p className="text-muted">Complete your artist profile to start sharing your music.</p>

        <ToastMessage show={!!error} onClose={() => setError(null)} message={error} variant="danger" />
        <ToastMessage show={!!success} onClose={() => setSuccess(null)} message={success} variant="success" />

        <Form onSubmit={submit} encType="multipart/form-data">
          <Form.Group className="mb-3">
            <Form.Label>Display Name <span className="text-danger">*</span></Form.Label>
            <Form.Control
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your artist name"
              required
            />
            <Form.Text className="text-muted">This is how fans will see you.</Form.Text>
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

          {/* District removed from onboarding form — obtained from user's account */}

          <Form.Group className="mb-3">
            <Form.Label>Genres <span className="text-danger">*</span></Form.Label>
            <div className="mb-2">
              {metaGenres.length === 0 ? (
                <small className="text-muted">No genres available.</small>
              ) : metaGenres.map(g => {
                const id = g.id;
                const name = g.name ?? String(g);
                const active = genres.includes(id);
                return (
                  <button
                    type="button"
                    key={id}
                    className={`btn btn-sm me-2 mb-2 ${active ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => toggleItem(genres, setGenres, id)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <Form.Text className="text-muted">
              Selected: {selectedGenreNames.length > 0 ? selectedGenreNames.join(', ') : 'None'}
            </Form.Text>
            {selectedGenreNames.length > 0 && <div className="mt-2">{selectedGenreNames.map(name => <Badge bg="success" className="me-2" key={name}>{name}</Badge>)}</div>}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Moods</Form.Label>
            <div className="mb-2">
              {metaMoods.length === 0 ? (
                <small className="text-muted">No moods available.</small>
              ) : metaMoods.map(m => {
                const id = m.id;
                const name = m.name ?? String(m);
                const active = moods.includes(id);
                return (
                  <button
                    type="button"
                    key={id}
                    className={`btn btn-sm me-2 mb-2 ${active ? 'btn-outline-primary' : 'btn-outline-secondary'}`}
                    onClick={() => toggleItem(moods, setMoods, id)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <Form.Text className="text-muted">Optional — helps fans find the right vibe.</Form.Text>
            {selectedMoodNames.length > 0 && <div className="mt-2">{selectedMoodNames.map(name => <Badge bg="info" className="me-2" key={name}>{name}</Badge>)}</div>}
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
              {loading ? <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Saving...
              </> : (isEditMode ? 'Update Profile' : 'Complete Profile')}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}