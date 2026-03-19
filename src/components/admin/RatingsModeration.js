// src/components/admin/RatingsModeration.js
import React from 'react';
import { Table, Button, Card, Stack, Badge } from 'react-bootstrap';

/**
 * Presentational component for rating moderation.
 *
 * Props:
 *  - ratings: array of { id, artist, reviewer, rating/score, comment, createdAt }
 *  - onDelete(id) -> called when delete button clicked
 */
export default function RatingsModeration({ ratings = [], onDelete }) {
  const getScore = (r) => Number(r.rating ?? r.stars ?? r.score ?? 0);
  const renderStars = (count) => '★'.repeat(Math.max(0, count));

  return (
    <div className="mt-3">
      <style>{`
        .ratings-card {
          border-radius: 1rem;
          box-shadow: 0 0.125rem 0.5rem rgba(0,0,0,.06);
        }
        .ratings-comment {
          white-space: pre-wrap;
          word-break: break-word;
        }
      `}</style>

      {/* Desktop table */}
      <div className="d-none d-md-block">
        <Table striped hover responsive className="align-middle">
          <thead>
            <tr>
              <th>Artist</th>
              <th>Reviewer</th>
              <th>Rating</th>
              <th>Comment</th>
              <th>Date</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ratings.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center text-muted py-4">
                  No ratings
                </td>
              </tr>
            ) : (
              ratings.map(r => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.artist || '—'}</td>
                  <td>{r.reviewer || '—'}</td>
                  <td>
                    <Badge bg="warning" text="dark">
                      {renderStars(getScore(r)) || '—'}
                    </Badge>
                  </td>
                  <td style={{ maxWidth: 420, whiteSpace: 'normal' }} className="ratings-comment">
                    {r.comment || '—'}
                  </td>
                  <td>{r.createdAt || r.created_at || '—'}</td>
                  <td>
                    <Button size="sm" variant="danger" onClick={() => onDelete?.(r.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="d-md-none">
        {ratings.length === 0 ? (
          <Card className="ratings-card border-0">
            <Card.Body className="text-center text-muted py-4">
              No ratings
            </Card.Body>
          </Card>
        ) : (
          <Stack gap={3}>
            {ratings.map(r => {
              const score = getScore(r);

              return (
                <Card key={r.id} className="ratings-card border-0">
                  <Card.Body className="p-3">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <div>
                        <div className="fw-semibold">{r.artist || 'Unknown artist'}</div>
                        <div className="small text-muted">
                          by {r.reviewer || 'Unknown reviewer'}
                        </div>
                      </div>
                      <Badge bg="warning" text="dark">
                        {renderStars(score) || '—'}
                      </Badge>
                    </div>

                    <div className="ratings-comment small mb-2">
                      {r.comment || 'No comment'}
                    </div>

                    <div className="small text-muted mb-3">
                      {r.createdAt || r.created_at || '—'}
                    </div>

                    <Button
                      size="sm"
                      variant="danger"
                      className="w-100"
                      onClick={() => onDelete?.(r.id)}
                    >
                      Delete Rating
                    </Button>
                  </Card.Body>
                </Card>
              );
            })}
          </Stack>
        )}
      </div>
    </div>
  );
}