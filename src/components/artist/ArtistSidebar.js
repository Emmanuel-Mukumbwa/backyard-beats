// src/components/artist/ArtistSidebar.jsx
import React from 'react';
import { Card, Button } from 'react-bootstrap';

export default function ArtistSidebar({ artist, events_count, tracks_count, followerCount, isOwner, onEdit }) {
  // ensure we show readable names whether server returns strings or objects
  const rawGenres = artist?.genres || [];
  const rawMoods  = artist?.moods || [];

  const genresArr = Array.isArray(rawGenres) ? rawGenres.map(g => (typeof g === 'object' ? (g.name || String(g.id)) : String(g))) : [];
  const moodsArr  = Array.isArray(rawMoods)  ? rawMoods.map(m => (typeof m === 'object' ? (m.name || String(m.id)) : String(m))) : [];

  return (
    <Card>
      <Card.Body>
        <div className="small text-muted mb-2">Artist details</div>
        <div><strong>Location:</strong> {artist?.district || artist?.district_name || (artist.user && (artist.user.district || artist.user.district_name)) || 'Unspecified'}</div>
        <div><strong>Genres:</strong> {genresArr.length ? genresArr.join(', ') : '—'}</div>
        <div><strong>Moods:</strong> {moodsArr.length ? moodsArr.join(', ') : '—'}</div>
        <div><strong>Tracks:</strong> {tracks_count ?? '—'}</div>
        <div><strong>Active events:</strong> {events_count ?? 0}</div>
        <div><strong>Followers:</strong> {followerCount ?? '—'}</div>

        {artist?.is_rejected && artist?.rejection_reason && <div className="mt-2 small text-danger">Profile rejection reason: {artist.rejection_reason}</div>}
        {artist?.is_rejected && <div className="mt-2"><a href="/support">Appeal / Contact support</a></div>}
        <div className="mt-2">{isOwner && <Button variant="outline-primary" size="sm" onClick={onEdit}>Go to Onboard / Edit</Button>}</div>
      </Card.Body>
    </Card>
  );
}