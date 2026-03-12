// src/components/RatingsForm.jsx
import React, { useState, useEffect, useContext } from 'react';
import axios from '../api/axiosConfig';
import { AuthContext } from '../context/AuthContext';

/**
 * RatingsForm
 * Props:
 *  - artistId (number|string) required
 *  - onSubmitted(responseData) optional: called with server response { rating, avg_rating, total_reviews }
 *
 * Notes:
 *  - Sends payload { rating, comment, reviewerName } to POST /artists/:id/ratings
 *  - If user is logged in, reviewerName is prefilled from AuthContext.user.username and the input becomes read-only.
 *  - If not logged in, the form is disabled and a notice is shown (server requires auth).
 */

export default function RatingsForm({ artistId, onSubmitted }) {
  const { user } = useContext(AuthContext);

  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    // Prefill reviewer name when logged in
    if (user && (user.username || user.name || user.userName)) {
      setReviewerName(user.username || user.name || user.userName);
    }
  }, [user]);

  // keyboard: allow arrow left/right to change stars
  const onKeyStars = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      setStars(s => Math.max(1, s - 1));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      setStars(s => Math.min(5, s + 1));
    } else if (e.key >= '1' && e.key <= '5') {
      setStars(Number(e.key));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // ensure rating is between 1 and 5
      const ratingVal = Number(stars);
      if (!ratingVal || ratingVal < 1 || ratingVal > 5) {
        setError('Please select a rating between 1 and 5 stars.');
        setLoading(false);
        return;
      }

      const payload = {
        rating: ratingVal,
        comment: comment ? String(comment).trim() : null,
        // reviewerName is optional — server will prefer req.user when auth is required
        reviewerName: reviewerName ? String(reviewerName).trim() : null
      };

      const res = await axios.post(`/artists/${artistId}/ratings`, payload);

      // server returns { rating, avg_rating, total_reviews }
      if (onSubmitted) onSubmitted(res.data);

      setSuccessMsg('Thanks — your review was submitted.');
      setComment('');
      // keep stars and reviewerName (user may update)
      // hide success after delay
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Ratings submit error:', err);
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to submit rating';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // star rendering helper
  const Star = ({ index }) => {
    const active = index <= stars;
    return (
      <button
        type="button"
        aria-label={`${index} star${index > 1 ? 's' : ''}`}
        title={`${index} star${index > 1 ? 's' : ''}`}
        onClick={() => setStars(index)}
        onKeyDown={onKeyStars}
        style={{
          cursor: 'pointer',
          background: 'transparent',
          border: 'none',
          padding: 4,
          fontSize: 22,
          lineHeight: 1,
        }}
      >
        <span style={{ color: active ? '#FFB400' : '#cfcfcf', fontSize: 22 }}>
          {active ? '★' : '☆'}
        </span>
      </button>
    );
  };

  return (
    <form onSubmit={submit}>
      {!user && (
        <div className="alert alert-warning">
          You must be logged in to leave a rating. <a href="/login">Log in</a> or <a href="/register">register</a>.
        </div>
      )}

      <div className="mb-2">
        <label className="form-label d-block">Your rating</label>
        <div
          role="radiogroup"
          aria-label="Star rating"
          onKeyDown={onKeyStars}
          tabIndex={0}
          style={{ display: 'flex', gap: 4 }}
        >
          {[1, 2, 3, 4, 5].map(i => <Star key={i} index={i} />)}
        </div>
        <div className="small text-muted mt-1">{stars} / 5</div>
      </div>

      <div className="mb-2">
        <label className="form-label">Your name</label>
        <input
          className="form-control"
          value={reviewerName}
          onChange={e => setReviewerName(e.target.value)}
          placeholder="e.g. Anna"
          readOnly={!!user} // read-only when logged in (prefilled)
          aria-readonly={!!user}
        />
        {user && <div className="small text-muted">Submitting as <strong>{reviewerName}</strong></div>}
      </div>

      <div className="mb-2">
        <label className="form-label">Comment (optional)</label>
        <textarea
          className="form-control"
          rows={3}
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Write a short review..."
        />
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="d-grid">
        <button
          className="btn btn-success"
          type="submit"
          disabled={loading || !user}
        >
          {loading ? 'Submitting...' : (user ? 'Submit Review' : 'Log in to Submit')}
        </button>
      </div>
    </form>
  );
}
 