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
          <Link to="/support" className="text-decoration-none text-muted small">
            Support
          </Link>
        </div>

      </div>
    </footer>
  );
}