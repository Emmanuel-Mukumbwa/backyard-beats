import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from '../api/axiosConfig';
import { FaStar, FaMapMarkerAlt } from 'react-icons/fa';

/**
 * Compact artist card used in lists/grid.
 * Robustly supports several possible field names returned by the backend.
 */
export default function ArtistCard({ artist = {}, selected }) {
  const cardClass = selected ? 'mb-3 shadow-sm border-success' : 'mb-3 shadow-sm';

  // Helpers
  const backendBase = (() => {
    try {
      return (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || '';
    } catch {
      return process.env.REACT_APP_API_URL || '';
    }
  })().replace(/\/$/, '');

  const resolveToBackend = (raw) => {
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `${backendBase}${raw}`;
    if (raw.startsWith('uploads/')) return `${backendBase}/${raw}`;
    return `${backendBase}/uploads/${raw}`;
  };

  const normBool = (v) => {
    if (v === true || v === 1 || v === '1' || v === 'true') return true;
    return false;
  };

  // Basic fields normalization
  const name = artist.displayName || artist.display_name || artist.username || 'Unknown Artist';

  // Genres / moods
  const genreList = (() => {
    if (!artist) return [];
    if (Array.isArray(artist.genres) && artist.genres.length) {
      return artist.genres.map(g => (typeof g === 'object' ? (g.name || String(g.id)) : String(g)));
    }
    if (artist.genre) {
      if (Array.isArray(artist.genre)) return artist.genre.map(String);
      if (typeof artist.genre === 'string' && artist.genre.includes(',')) return artist.genre.split(',').map(s => s.trim());
      return [String(artist.genre)];
    }
    if (artist.genre_list) {
      return Array.isArray(artist.genre_list) ? artist.genre_list.map(String) : [String(artist.genre_list)];
    }
    return [];
  })();

  const moodList = (() => {
    if (!artist) return [];
    if (Array.isArray(artist.moods) && artist.moods.length) {
      return artist.moods.map(m => (typeof m === 'object' ? (m.name || String(m.id)) : String(m)));
    }
    if (artist.mood) return [String(artist.mood)];
    return [];
  })();

  // district resolution (artist.district, artist.district_name or user.district)
  const district = artist.district || artist.district_name || (artist.user && (artist.user.district || artist.user.district_name)) || '';

  // short bio
  const bio = artist.bio || artist.description || '';

  // rating & followers (defensive)
  const ratingRaw = (typeof artist.avgRating !== 'undefined' ? artist.avgRating : (typeof artist.avg_rating !== 'undefined' ? artist.avg_rating : null));
  const rating = ratingRaw !== null && !Number.isNaN(Number(ratingRaw)) ? Number(ratingRaw) : null;
  const followers = (typeof artist.follower_count !== 'undefined' ? artist.follower_count : (typeof artist.followers_count !== 'undefined' ? artist.followers_count : (typeof artist.followers !== 'undefined' ? artist.followers : null)));

  // status detection
  const computeStatus = () => {
    if (!artist) return 'unknown';

    // Normalize flags (backend may send is_approved / artist_is_approved / status)
    const userDeleted = !!(artist.user && (artist.user.deleted_at || artist.user_deleted_at));
    const userBanned = !!(artist.user && (artist.user.banned || artist.user_banned));
    const isRejected = normBool(artist.is_rejected) || normBool(artist.artist_is_rejected) || (artist.status === 'rejected');
    const isApproved = normBool(artist.is_approved) || normBool(artist.artist_is_approved) || (artist.status === 'approved');

    if (userDeleted) return 'deleted';
    if (userBanned) return 'banned';
    if (isRejected) return 'rejected';
    if (isApproved) return 'approved';
    return 'pending';
  };

  const status = computeStatus();

  function statusBadge(s) {
    switch (s) {
      case 'approved': return <Badge bg="success">Artist</Badge>;
      case 'pending': return <Badge bg="warning" className="text-dark">Pending</Badge>;
      case 'rejected': return <Badge bg="danger">Rejected</Badge>;
      case 'banned': return <Badge bg="danger">Banned</Badge>;
      case 'deleted': return <Badge bg="secondary">Deleted</Badge>;
      default: return null;
    }
  }

  // Photo fallback
  const initialPhoto = artist.photoUrl || artist.photo_url || artist.photo || artist.avatar || '/assets/placeholder.png';
  const [imgSrc, setImgSrc] = useState(resolveToBackend(initialPhoto) || initialPhoto);

  useEffect(() => {
    const newPhoto = artist.photoUrl || artist.photo_url || artist.photo || artist.avatar || '/assets/placeholder.png';
    setImgSrc(resolveToBackend(newPhoto) || newPhoto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artist?.id, artist?.photo_url, artist?.photo, artist?.photoUrl]);

  function handleImgError() {
    const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=384`;
    if (imgSrc !== avatarFallback) setImgSrc(avatarFallback);
  }

  // Audio preview handling
  const previewRaw = (() => {
    const t = (Array.isArray(artist.tracks) && artist.tracks[0]) || (Array.isArray(artist.tracks_list) && artist.tracks_list[0]) || null;
    if (!t) return null;
    return t.previewUrl || t.preview_url || t.file_url || t.url || t.preview || null;
  })();
  const previewSrc = previewRaw ? resolveToBackend(previewRaw) || previewRaw : null;
  const [hasAudio, setHasAudio] = useState(Boolean(previewSrc));
  useEffect(() => setHasAudio(Boolean(previewSrc)), [previewSrc]);

  // short bio
  const shortBio = bio ? (bio.length > 120 ? bio.slice(0, 117) + '...' : bio) : '';

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
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <Card.Title className="mb-0" style={{ fontSize: 18 }}>{name}</Card.Title>
            <div className="small text-muted">
              {genreList.slice(0, 2).join(', ')}{genreList.length && district ? ' • ' : ''}{district}
            </div>
          </div>
          <div className="text-end">
            {statusBadge(status)}
            <div className="small text-muted mt-1">
              <FaStar className="me-1 text-warning" />
              {rating ? Number(rating).toFixed(1) : '—'} ★
            </div>
          </div>
        </div>

        <Card.Text className="mb-2" style={{ minHeight: 44 }}>{shortBio}</Card.Text>

        <div className="mb-2">
          {genreList.slice(0, 6).map(g => <Badge bg="success" className="me-1 mb-1" key={`g-${g}`}>{g}</Badge>)}
          {moodList.slice(0, 6).map(m => <Badge bg="info" text="dark" className="me-1 mb-1" key={`m-${m}`}>{m}</Badge>)}
        </div>

        {hasAudio && previewSrc && (
          <div className="mb-2">
            <audio controls preload="none" style={{ width: '100%' }} onError={() => setHasAudio(false)}>
              <source src={previewSrc} />
            </audio>
          </div>
        )}

        <div className="d-flex justify-content-between align-items-center">
          <Button as={Link} to={`/artist/${artist.id}`} variant="success" size="sm">View Profile</Button>
          <div className="text-end small text-muted">
            {typeof followers === 'number' ? `${followers} follower${followers !== 1 ? 's' : ''}` : '—'}
            {district ? <div className="mt-1"><FaMapMarkerAlt className="me-1" />{district}</div> : null}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}