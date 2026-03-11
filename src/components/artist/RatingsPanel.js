import React from 'react';
import RatingsList from '../RatingsList';
import RatingsForm from '../RatingsForm';

export default function RatingsPanel({ artistId, onRatingSubmitted }) {
  return (
    <>
      <div className="mb-3">
        <h6>Ratings & Reviews</h6>
        <RatingsList artistId={artistId} />
      </div>

      <div className="mb-3">
        <h6 className="mb-2">Leave a rating</h6>
        <RatingsForm artistId={artistId} onSubmitted={onRatingSubmitted} />
      </div>
    </>
  );
}