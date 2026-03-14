// src/components/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-light text-center py-3 mt-auto border-top">
      <div className="container d-flex flex-column flex-md-row justify-content-between align-items-center">

        <small className="text-muted">
          © {new Date().getFullYear()} BackyardBeats — Built with ♥
        </small>

        <div className="mt-2 mt-md-0">
          <Link to="/support" className="text-decoration-none text-muted small me-3">
            Support
          </Link>
          <Link to="/terms" className="text-decoration-none text-muted small me-3">
            Terms & Conditions
          </Link>
          <Link to="/privacy" className="text-decoration-none text-muted small">
            Privacy
          </Link>
        </div>

      </div>
    </footer>
  );
}