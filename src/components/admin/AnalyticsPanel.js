// src/components/admin/AnalyticsPanel.jsx
import React from 'react';
import { Card, Row, Col, Table } from 'react-bootstrap';

export default function AnalyticsPanel({ analytics = {} }) {
  // safe fallbacks
  const {
    totalUsers,
    totalArtists,
    totalTracks,
    totalPlaylists,
    totalEvents,
    upcomingEvents,
    totalListens,
    uniqueListenersLast30,
    totalFavorites,
    avgRating,
    userGrowth,
    engagementRate,
    topArtistsByPlays = []
  } = analytics;

  const cardsFirstRow = [
    { title: 'Total Users', value: totalUsers },
    { title: 'Total Artists', value: totalArtists },
    { title: 'Total Tracks', value: totalTracks },
    { title: 'Total Playlists', value: totalPlaylists }
  ];

  const cardsSecondRow = [
    { title: 'Total Events', value: totalEvents },
    { title: 'Upcoming Events', value: upcomingEvents },
    { title: 'Total Listens', value: totalListens },
    { title: 'Unique Listeners (30d)', value: uniqueListenersLast30 }
  ];

  return (
    <div className="mt-3">
      <Row className="g-3">
        {cardsFirstRow.map((c, i) => (
          <Col md={3} sm={6} xs={12} key={`r1-${i}`}>
            <Card className="h-100">
              <Card.Body>
                <Card.Title className="mb-2">{c.title}</Card.Title>
                <h3 className="m-0">{c.value ?? '—'}</h3>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-3 mt-3">
        {cardsSecondRow.map((c, i) => (
          <Col md={3} sm={6} xs={12} key={`r2-${i}`}>
            <Card className="h-100">
              <Card.Body>
                <Card.Title className="mb-2">{c.title}</Card.Title>
                <h3 className="m-0">{c.value ?? '—'}</h3>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-3 mt-3">
        <Col md={4} sm={12}>
          <Card>
            <Card.Body>
              <Card.Title>User Growth (30d vs prev 30d)</Card.Title>
              <h3>{userGrowth ?? '—'}</h3>
              <small className="text-muted d-block mt-2">Shows registrations in last 30 days vs previous 30 days.</small>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4} sm={12}>
          <Card>
            <Card.Body>
              <Card.Title>Engagement Rate (30d)</Card.Title>
              <h3>{engagementRate ?? '—'}</h3>
              <small className="text-muted d-block mt-2">
                {uniqueListenersLast30 ?? 0} unique listeners in last 30 days.
              </small>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4} sm={12}>
          <Card>
            <Card.Body>
              <Card.Title>Favorites & Avg Rating</Card.Title>
              <h3 className="mb-1">{totalFavorites ?? '—'} favorites</h3>
              <div className="text-muted">Avg rating: {avgRating !== null && avgRating !== undefined ? avgRating : '—'}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mt-3">
        <Col md={8}>
          <Card>
            <Card.Body>
              <Card.Title>Top artists (last 30 days by plays)</Card.Title>

              {topArtistsByPlays.length === 0 ? (
                <div className="text-muted py-3">No plays recorded in the last 30 days.</div>
              ) : (
                <Table hover size="sm" className="mt-2 mb-0">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Artist</th>
                      <th>Plays (30d)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topArtistsByPlays.map((a, idx) => (
                      <tr key={a.id || idx}>
                        <td>{idx + 1}</td>
                        <td>{a.name}</td>
                        <td>{a.plays}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card>
            <Card.Body>
              <Card.Title>Quick summary</Card.Title>
              <div className="mb-2"><strong>Total listens:</strong> {totalListens ?? '—'}</div>
              <div className="mb-2"><strong>Tracks:</strong> {totalTracks ?? '—'}</div>
              <div className="mb-2"><strong>Playlists:</strong> {totalPlaylists ?? '—'}</div>
              <div className="mb-2"><strong>Upcoming events:</strong> {upcomingEvents ?? '—'}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}