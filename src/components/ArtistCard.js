import React, { useState, useEffect } from 'react';
import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from '../api/axiosConfig';
import { FaStar } from 'react-icons/fa';

export default function ArtistCard({ artist, selected }) {
  const cardClass = selected ? 'mb-3 shadow-sm border-success' : 'mb-3 shadow-sm';

  // Normalize fields (support several naming conventions)
  const name = artist.displayName || artist.display_name || artist.username || 'Unknown Artist';
  const genres = Array.isArray(artist.genres) ? artist.genres.join(', ') : (artist.genres || artist.genre || '');
  const district = artist.district || artist.district_name || artist.location || '';
  const bio = artist.bio || artist.description || '';

  // resolve backend base for relative asset paths
  const backendBase = (() => {
    try {
      return (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || '';
    } catch {
      return process.env.REACT_APP_API_URL || '';
    }
  })().replace(/\/$/, '');

  function resolveToBackend(raw) {
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `${backendBase}${raw}`;
    if (raw.startsWith('uploads/')) return `${backendBase}/${raw}`;
    return `${backendBase}/uploads/${raw}`;
  }

  // Photo fallback handling
  const initialPhoto = artist.photoUrl || artist.photo_url || artist.photo || artist.avatar || '/assets/placeholder.png';
  const [imgSrc, setImgSrc] = useState(resolveToBackend(initialPhoto) || initialPhoto);

  useEffect(() => {
    // if artist prop changes, update src
    const newPhoto = artist.photoUrl || artist.photo_url || artist.photo || artist.avatar || '/assets/placeholder.png';
    setImgSrc(resolveToBackend(newPhoto) || newPhoto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artist?.id]);

  function handleImgError() {
    // avoid infinite loop — set to ui-avatars and stop
    const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=384`;
    if (imgSrc !== avatarFallback) {
      setImgSrc(avatarFallback);
    }
  }

  // Audio preview handling
  const previewRaw = artist.tracks && artist.tracks[0] && (artist.tracks[0].previewUrl || artist.tracks[0].preview_url || artist.tracks[0].url);
  const previewSrc = previewRaw ? resolveToBackend(previewRaw) || previewRaw : null;
  const [hasAudio, setHasAudio] = useState(Boolean(previewSrc));
  useEffect(() => setHasAudio(Boolean(previewSrc)), [previewSrc]);

  function handleAudioError() {
    setHasAudio(false);
  }

  const rating = typeof artist.avgRating === 'number' ? artist.avgRating : (typeof artist.avg_rating === 'number' ? artist.avg_rating : null);

  return (
    <Card className={cardClass}>
      <div style={{ height: 180, overflow: 'hidden' }}>
        <Card.Img
          variant="top"
          src={imgSrc}
          alt={`${name} photo`}
          style={{ height: 180, objectFit: 'cover' }}
          onError={handleImgError}
        />
      </div>

      <Card.Body>
        <Card.Title>{name}</Card.Title>
        <Card.Text className="small text-muted">{genres}{genres && district ? ' • ' : ''}{district}</Card.Text>

        <Card.Text>{bio ? (bio.slice(0, 90) + (bio.length > 90 ? '...' : '')) : ''}</Card.Text>

        {hasAudio && previewSrc && (
          <div className="mb-2">
            <audio controls preload="none" style={{ width: '100%' }} onError={handleAudioError}>
              <source src={previewSrc} />
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        <div className="d-flex justify-content-between align-items-center">
          <Button as={Link} to={`/artist/${artist.id}`} variant="success" size="sm">View Profile</Button>
          <small className="text-muted d-flex align-items-center">
            <FaStar className="me-1 text-warning" />
            {rating ? rating.toFixed(1) : '—'} ★
          </small>
        </div>
      </Card.Body> 
    </Card>
  );
}
