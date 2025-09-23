import React from 'react';
import { Card, Row, Col, Button, Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function Orientation() {
  return (
    <Container>
      <h2 className="mb-3">Welcome to BackyardBeats — Quick tour</h2>

      <Row className="g-3">
        <Col md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <Card.Title>1. Discover</Card.Title>
              <Card.Text>
                Use the Map or List view to find artists by district, genre or mood. Tap any marker or card to view a full artist profile and listen to previews.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <Card.Title>2. Create your profile</Card.Title>
              <Card.Text>
                Artists: create a profile, add a photo and upload a preview. Fans: register to follow artists, rate tracks, and RSVP to local gigs.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <Card.Title>3. Engage & Support</Card.Title>
              <Card.Text>
                Rate tracks, leave comments, and attend events. Later you'll be able to tip artists using mobile money during nationwide rollouts.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div className="mt-4 d-flex gap-2">
        <Button as={Link} to="/" variant="success">Take me to Discover</Button>
        <Button as={Link} to="/register" variant="outline-secondary">Create an account</Button>
      </div>

      <div className="mt-4 text-muted small">
        Want a walkthrough video or a live onboarding session? You can add those as next steps.
      </div>
    </Container>
  );
}
