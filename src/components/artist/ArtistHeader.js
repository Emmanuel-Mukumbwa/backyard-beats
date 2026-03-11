// src/components/artist/ArtistHeader.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Button } from 'react-bootstrap';
import LoadingSpinner from '../LoadingSpinner';

export default function ArtistHeader({
  artist,
  genres = [],
  moods = [],
  isOwner,
  following,
  processingFollow,
  onFollowClick,
  followerCount,
}) {
  const name = artist?.displayName || artist?.display_name || artist?.username || 'Artist';

  // try a few places for created date — be defensive
  const joinedAtRaw = artist?.user?.created_at || artist?.user_created_at || artist?.created_at || null;
  let joinedText = '—';
  try {
    if (joinedAtRaw) {
      const d = new Date(joinedAtRaw);
      if (!Number.isNaN(d.getTime())) joinedText = d.toLocaleDateString();
    }
  } catch (e) {
    joinedText = '—';
  }

  const followersDisplay = (typeof followerCount === 'number') ? `${followerCount} follower${followerCount !== 1 ? 's' : ''}` : (artist?.follower_count ? `${artist.follower_count} follower${artist.follower_count !== 1 ? 's' : ''}` : null);
  const totalReviews = Number(artist?.total_reviews || 0);

  return (
    <div className="d-flex align-items-start justify-content-between">
      <div style={{ flex: 1 }}>
        <h2 style={{ marginBottom: 6 }}>{name}</h2>

        <div className="text-muted small mb-2">
          {(artist?.district || artist?.district_name || (artist.user && (artist.user.district || artist.user.district_name))) || 'Unspecified'}
          {(genres && genres.length) ? ' • ' + genres.join(', ') : ''}
        </div>

        <div style={{ marginBottom: 10, whiteSpace: 'pre-wrap' }}>
          {artist?.bio || artist?.description || 'No bio yet.'}
        </div>

        <div className="d-flex align-items-center" style={{ gap: 12 }}>
          <Badge bg="success" pill style={{ fontSize: 14 }}>
            {artist?.avg_rating ? `${Number(artist.avg_rating).toFixed(1)} ★` : 'No ratings'}
          </Badge>

          <div className="text-muted small">
            {totalReviews > 0 ? `${totalReviews} review${totalReviews > 1 ? 's' : ''}` : 'Be the first to review'}
          </div>
        </div>

        <div className="mt-3">
          {genres.map(g => <Badge bg="success" key={`g-${g}`} className="me-1 mb-1">{g}</Badge>)}
          {moods.map(m => <Badge bg="info" text="dark" key={`m-${m}`} className="me-1 mb-1">{m}</Badge>)}
        </div>
      </div>

      <div className="text-end ms-3">
        <div style={{ marginBottom: 8 }}>
          {isOwner ? (
            <div className="d-flex flex-column align-items-end">
              <Button variant="outline-primary" size="sm" className="mb-2" href="/onboard">
                Edit profile (Onboard)
              </Button>
              <Button variant="outline-secondary" size="sm" href="/artist/dashboard">Go to Dashboard</Button>
            </div>
          ) : (
            <>
              <Button
                variant={following ? 'outline-success' : 'primary'}
                size="sm"
                className="me-2"
                onClick={onFollowClick}
                disabled={processingFollow}
                aria-busy={processingFollow}
                aria-label={processingFollow ? 'Processing follow' : (following ? 'Unfollow' : 'Follow')}
              >
                {processingFollow ? <LoadingSpinner size="sm" inline /> : (following ? 'Following ✓' : 'Follow')}
              </Button>
            </>
          )}
        </div>

        <div className="small text-muted">Joined: {joinedText}</div>
        <div className="small text-muted mt-2">{followersDisplay}</div>
      </div>
    </div>
  );
}

ArtistHeader.propTypes = {
  artist: PropTypes.object,
  genres: PropTypes.array,
  moods: PropTypes.array,
  isOwner: PropTypes.bool,
  following: PropTypes.bool,
  processingFollow: PropTypes.bool,
  onFollowClick: PropTypes.func,
  followerCount: PropTypes.number,
};