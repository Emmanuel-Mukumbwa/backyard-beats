import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-light text-center py-3 mt-auto">
      <div className="container">
        <small className="text-muted">© {new Date().getFullYear()} BackyardBeats — Built with ♥</small>
      </div>
    </footer>
  );
}
