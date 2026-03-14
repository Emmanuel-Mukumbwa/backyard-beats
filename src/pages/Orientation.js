// src/pages/Orientation.js
import React, { useState } from 'react';
import { Card, Row, Col, Button, Container, Modal } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  FaCompass,
  FaUserCircle,
  FaCloudUploadAlt,
  FaCalendarAlt,
  FaHeart,
  FaStar
} from 'react-icons/fa';

export default function Orientation() {
  const [showVideo, setShowVideo] = useState(false);
  const SUPPORT_URL = '/support';

  return (
    <Container className="container-lg py-4">
      {/* Page header */}
      <div className="mb-4">
        <h2 className="mb-1">Welcome to BackyardBeats — Quick tour</h2>
        <p className="text-muted mb-0">
          A short introduction to the core flows: discover artists, create your profile, upload tracks, and join local events.
          Use the global filter bar at the top of Discover to filter by district, genre or mood.
        </p>
      </div>

      {/* Feature cards */}
      <Row className="g-3 mb-3">
        <Col md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="d-flex flex-column">
              <div className="d-flex align-items-start gap-3 mb-2">
                <div className="fs-3 text-success"><FaCompass /></div>
                <div>
                  <Card.Title className="mb-1">Discover</Card.Title>
                  <Card.Text className="small text-muted mb-0">
                    Browse Featured, New Releases and Most Played. Use filters to quickly find artists or events in your district and the vibe you like.
                  </Card.Text>
                </div>
              </div>

              <div className="mt-auto">
                <Button as={Link} to="/" variant="outline-success" size="sm">
                  Go to Discover
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="d-flex flex-column">
              <div className="d-flex align-items-start gap-3 mb-2">
                <div className="fs-3 text-success"><FaUserCircle /></div>
                <div>
                  <Card.Title className="mb-1">Create your profile</Card.Title>
                  <Card.Text className="small text-muted mb-0">
                    Artists: onboard to add photos, bio, genres and upload preview tracks. Note: tracks and events remain private until your artist profile is approved.
                  </Card.Text>
                </div>
              </div>

              <div className="mt-auto d-flex gap-2">
                <Button as={Link} to="/onboard" variant="success" size="sm">Artist Onboard</Button>
                <Button as={Link} to="/register" variant="outline-secondary" size="sm">Register (Fan)</Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="d-flex flex-column">
              <div className="d-flex align-items-start gap-3 mb-2">
                <div className="fs-3 text-success"><FaCloudUploadAlt /></div>
                <div>
                  <Card.Title className="mb-1">Upload & Releases</Card.Title>
                  <Card.Text className="small text-muted mb-0">
                    Upload preview tracks and artwork from your dashboard. New releases and events will be visible publicly after approval.
                  </Card.Text>
                </div>
              </div>

              <div className="mt-auto">
                <Button as={Link} to="/artist/dashboard" variant="outline-success" size="sm">
                  Your Dashboard
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Second row */}
      <Row className="g-3 mb-4">
        <Col md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="d-flex flex-column">
              <div className="d-flex align-items-start gap-3 mb-2">
                <div className="fs-3 text-success"><FaCalendarAlt /></div>
                <div>
                  <Card.Title className="mb-1">Events & RSVPs</Card.Title>
                  <Card.Text className="small text-muted mb-0">
                    Artists can create events (these are private until approved). Fans can RSVP and follow events in their district.
                  </Card.Text>
                </div>
              </div>

              <div className="mt-auto">
                <Button as={Link} to="/events" variant="outline-success" size="sm">Browse Events</Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="d-flex flex-column">
              <div className="d-flex align-items-start gap-3 mb-2">
                <div className="fs-3 text-success"><FaHeart /></div>
                <div>
                  <Card.Title className="mb-1">Playlists & Favorites</Card.Title>
                  <Card.Text className="small text-muted mb-0">
                    Create playlists and save favorite artists and tracks to access them quickly.
                  </Card.Text>
                </div>
              </div>

              <div className="mt-auto">
                <Button as={Link} to="/fan/dashboard" variant="outline-success" size="sm">Your Playlists</Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="d-flex flex-column">
              <div className="d-flex align-items-start gap-3 mb-2">
                <div className="fs-3 text-success"><FaStar /></div>
                <div>
                  <Card.Title className="mb-1">Rate & Support</Card.Title>
                  <Card.Text className="small text-muted mb-0">
                    Rate tracks, leave feedback and support artists. If your profile or content is rejected, use the support link below to appeal.
                  </Card.Text>
                </div>
              </div>
              <div className="mt-auto">
                <Button variant="outline-success" size="sm" onClick={() => setShowVideo(true)}>
                  Watch quick walkthrough
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Footer CTAs */}
      <div className="d-flex flex-column flex-sm-row gap-2 align-items-start align-items-sm-center">
        <Button as={Link} to="/" variant="success">Take me to Discover</Button>
        <Button as={Link} to="/register" variant="outline-secondary">Create an account</Button>
        <div className="ms-auto text-muted small mt-2 mt-sm-0">
          Tip: uploads & events are private until approved — check your dashboard to see status and any rejection reasons.
        </div>
      </div>

      <div className="mt-3">
        <small>Need help? <a href={SUPPORT_URL}>Contact support</a>.</small>
      </div>

      {/* Video modal (lightweight walkthrough) */}
      <Modal show={showVideo} onHide={() => setShowVideo(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>BackyardBeats walkthrough</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0" style={{minHeight: '360px'}}>
          {/* Replace the src with your walkthrough video when available */}
          <div style={{ position: 'relative', paddingTop: '56.25%' }}>
            <iframe
              title="BackyardBeats Walkthrough"
              src="https://www.youtube.com/embed/VIDEO_ID?rel=0"
              style={{ position: 'absolute', top:0, left:0, width:'100%', height:'100%' }}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </Modal.Body>
      </Modal>
    </Container>
  );
}