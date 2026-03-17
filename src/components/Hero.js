import React, { useState, useEffect } from 'react';
import { Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './Hero.css'; // optional external CSS for media queries (see below)

export default function Hero() {
  const [greeting, setGreeting] = useState({ text: '', icon: '' });
  const [imageHeight, setImageHeight] = useState(360);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting({ text: 'Good Morning', icon: '🌅' });
    else if (hour < 18) setGreeting({ text: 'Good Afternoon', icon: '☀️' });
    else setGreeting({ text: 'Good Evening', icon: '🌙' });
  }, []);

  useEffect(() => {
    function updateHeight() {
      const w = window.innerWidth;
      if (w < 576) setImageHeight(220);
      else if (w < 768) setImageHeight(260);
      else if (w < 992) setImageHeight(300);
      else setImageHeight(360);
    }
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  return (
    <section className="bb-hero mb-4" aria-labelledby="hero-heading">
      <Row className="align-items-center">
        <Col xs={12} md={6} className="px-3 px-md-4 mb-3 mb-md-0">
          <div
            className="hero-image"
            role="img"
            aria-label="Local Malawian artists performing"
            style={{
              backgroundImage: "url('/assets/background1.png')",
              height: imageHeight,
              backgroundSize: "cover",
              backgroundPosition: "center",
              // Responsive border radius using CSS variable (or you can use media queries)
              borderRadius: "var(--hero-border-radius, 18px 18px 60px 18px)",
              boxShadow: "0 12px 30px rgba(0,0,0,0.15)",
              transition: "transform 0.5s ease",
              // Force GPU acceleration for smoother rendering
              transform: "translateZ(0)",
              // Ensure corners are clipped cleanly
              overflow: "hidden",
            }}
          />
        </Col>
        <Col xs={12} md={6} className="p-4">
          <div className="hero-content">
            <h5 className="mb-2 text-muted">
              <span className="me-2">{greeting.icon}</span>
              {greeting.text}
            </h5>
            <h1 id="hero-heading" className="hero-title mb-3">
              Welcome to BackyardBeats — Malawi’s home for local music
            </h1>
            <p className="lead hero-subtext mb-4">
              Discover songs, events and artists from across Malawi — listen,
              follow and book local talent. Support creators in your district
              and help homegrown music reach new ears.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <Button as={Link} to="/orientation" variant="success">
                Get Started
              </Button>
              <Button as={Link} to="/music" variant="outline-success">
                Browse Music
              </Button>
              <Button as={Link} to="/events" variant="outline-secondary">
                Browse Events
              </Button>
            </div>
          </div>
        </Col>
      </Row>
    </section>
  );
}