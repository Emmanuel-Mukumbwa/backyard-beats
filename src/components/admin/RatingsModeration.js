//src/components/admin/RatingsModeration.js
import React from 'react';
import { Table, Button } from 'react-bootstrap';

/**
 * Presentational component for rating moderation.
 *
 * Props:
 *  - ratings: array of { id, artist, reviewer, rating/score, comment, createdAt }
 *  - onDelete(id) -> called when delete button clicked
 */
export default function RatingsModeration({ ratings = [], onDelete }) {
  return (
    <div className="mt-3">
      <Table striped>
        <thead>
          <tr>
            <th>Artist</th>
            <th>Reviewer</th>
            <th>Rating</th>
            <th>Comment</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {ratings.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center">No ratings</td>
            </tr>
          ) : (
            ratings.map(r => (
              <tr key={r.id}>
                <td>{r.artist}</td>
                <td>{r.reviewer}</td>
                <td>{'★'.repeat(r.rating ?? r.stars ?? 0)}</td>
                <td style={{ maxWidth: 400, whiteSpace: 'normal' }}>{r.comment}</td>
                <td>{r.createdAt || r.created_at || '—'}</td>
                <td>
                  <Button size="sm" variant="danger" onClick={() => onDelete(r.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}