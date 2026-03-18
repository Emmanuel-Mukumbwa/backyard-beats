// File: src/components/ArtistCard.js
import React, { useEffect, useState, useMemo } from 'react';
import { Card, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from '../api/axiosConfig';
import { FaStar, FaMapMarkerAlt } from 'react-icons/fa';

/**
 * Compact artist card used in lists/grid.
 * Robustly supports several possible field names returned by the backend.
 *
 * Images are set to object-fit: contain so they DO NOT crop/zoom/stretch.
 */
export default function ArtistCard({ artist = {}, selected }) {
  const cardClass = `artist-card ${selected ? 'mb-3 shadow-sm border-success' : 'mb-3 shadow-sm'}`;

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
  const genreList = useMemo(() => {
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
  }, [artist]);

  const moodList = useMemo(() => {
    if (!artist) return [];
    if (Array.isArray(artist.moods) && artist.moods.length) {
      return artist.moods.map(m => (typeof m === 'object' ? (m.name || String(m.id)) : String(m)));
    }
    if (artist.mood) return [String(artist.mood)];
    return [];
  }, [artist]);

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
  const previewRaw = useMemo(() => {
    const t = (Array.isArray(artist.tracks) && artist.tracks[0]) || (Array.isArray(artist.tracks_list) && artist.tracks_list[0]) || null;
    if (!t) return null;
    return t.previewUrl || t.preview_url || t.file_url || t.url || t.preview || null;
  }, [artist]);
  const previewSrc = previewRaw ? resolveToBackend(previewRaw) || previewRaw : null;
  const [hasAudio, setHasAudio] = useState(Boolean(previewSrc));
  useEffect(() => setHasAudio(Boolean(previewSrc)), [previewSrc]);

  // short bio (kept long here; we'll clamp visually on small screens via CSS)
  const shortBio = bio ? (bio.length > 120 ? bio.slice(0, 117) + '...' : bio) : '';

  // Image styles: contain to avoid cropping/zooming, centered with letterbox
  const imgContainerStyle = { overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' };
  const imgStyle = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' };

  // badges: show up to 4 then "+N" indicator
  const visibleGenreBadges = genreList.slice(0, 4);
  const extraGenreCount = Math.max(0, genreList.length - visibleGenreBadges.length);
  const visibleMoodBadges = moodList.slice(0, 4);
  const extraMoodCount = Math.max(0, moodList.length - visibleMoodBadges.length);

  // main genre for small screens
  const mainGenre = genreList.length ? genreList[0] : null;

  return (
    <>
      <style>{`
        /* responsive tweaks for ArtistCard */
        .artist-card .artist-card-img { height: 180px; }
        @media (max-width: 576px) {
          .artist-card .artist-card-img { height: 120px; } /* shorten image height on phones */
          .artist-card .card-body { padding: .5rem; }
          .artist-card .name { font-size: 1rem; }
          /* hide the full badges block on small screens to save vertical space */
          .artist-card .badges { display: none !important; }
          /* show single main genre badge beside status on small screens */
          .artist-card .main-genre { display: inline-block; margin-left: .5rem; vertical-align: middle; }
          /* clamp bio to 2 lines */
          .artist-card .card-text {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .artist-card .followers-district { text-align: left; margin-top: .4rem; font-size: .78rem; }
        }
        /* desktop keeps full badges */
        .artist-card .main-genre { display: none; }
        .artist-card .name { font-weight: 600; font-size: 1.05rem; margin-bottom: 0; }
        .artist-card .meta { font-size: .82rem; color: #6c757d; }
        .artist-card .badges { display:flex; flex-wrap:wrap; gap:.25rem .25rem; margin-top:.3rem; }
        .artist-card .followers-district { font-size: .78rem; color: #6c757d; text-align:right; }
        .artist-card .audio-preview { width: 100%; max-width: 100%; }
        .artist-card .card-footer-row { gap: .5rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; }
      `}</style>

      <Card className={cardClass}>
        <div className="artist-card-img" style={imgContainerStyle}>
          {imgSrc ? (
            <img src={imgSrc} alt={name} style={imgStyle} onError={handleImgError} />
          ) : (
            <div style={{ color: '#777' }}>No image</div>
          )}
        </div>

        <Card.Body>
          {/* Header: stacks on small screens, aligns horizontally on md+ */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start mb-2">
            <div style={{ minWidth: 0 }}>
              <Card.Title className="name">{name}</Card.Title>
              <div className="meta text-truncate" style={{ maxWidth: '100%' }}>
                {/* On md+ show up to two genres and district as before */}
                <span className="d-none d-md-inline">{genreList.slice(0,2).join(', ')}{genreList.length && district ? ' • ' : ''}</span>
                <span className="d-none d-md-inline">{district}</span>

                {/* small screens: show main genre and district inline under the name */}
                <span className="d-inline d-md-none text-muted">
                  {mainGenre ? `${mainGenre}${district ? ' • ' : ''}` : ''}{district ? district : ''}
                </span>
              </div>
            </div>

            <div className="text-md-end mt-2 mt-md-0" style={{ minWidth: 90 }}>
              {statusBadge(status)}
              {/* main genre badge shown only on small screens via CSS (.main-genre visible at max-width:576px) */}
              {mainGenre && <span className="main-genre"><Badge bg="info" text="dark">{mainGenre}</Badge></span>}

              <div className="small text-muted mt-1">
                <FaStar className="me-1 text-warning" />
                {rating ? Number(rating).toFixed(1) : '—'} ★
              </div>
            </div>
          </div>

          <Card.Text className="mb-2" style={{ minHeight: 44 }}>{shortBio}</Card.Text>

          <div className="badges">
            {visibleGenreBadges.map(g => <Badge bg="success" className="me-1 mb-1" key={`g-${g}`}>{g}</Badge>)}
            {extraGenreCount > 0 && <Badge bg="secondary" className="me-1 mb-1">+{extraGenreCount}</Badge>}
            {visibleMoodBadges.map(m => <Badge bg="info" text="dark" className="me-1 mb-1" key={`m-${m}`}>{m}</Badge>)}
            {extraMoodCount > 0 && <Badge bg="secondary" className="me-1 mb-1">+{extraMoodCount}</Badge>}
          </div>

          {hasAudio && previewSrc && (
            <div className="mb-2 mt-2">
              <audio
                controls
                preload="none"
                className="audio-preview"
                onError={() => setHasAudio(false)}
                aria-label={`Preview for ${name}`}
              >
                <source src={previewSrc} />
              </audio>
            </div>
          )}

          <div className="card-footer-row mt-2">
            <div>
              <Button as={Link} to={`/artist/${artist.id}`} variant="success" size="sm">View Profile</Button>
            </div>

            <div className="followers-district">
              <div>
                {typeof followers === 'number' ? `${followers} follower${followers !== 1 ? 's' : ''}` : '—'}
              </div>
              {district ? (
                <div className="mt-1 d-none d-md-block">
                  <FaMapMarkerAlt className="me-1" />
                  <span>{district}</span>
                </div>
              ) : null}
            </div>
          </div>
        </Card.Body>
      </Card>
    </>
  );
}