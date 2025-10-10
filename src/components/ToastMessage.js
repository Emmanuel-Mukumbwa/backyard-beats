import React from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';

export default function ToastMessage({ show, onClose, message, variant = 'danger' }) {
  return (
    <ToastContainer position="top-end" className="p-3">
      <Toast show={show} onClose={onClose} bg={variant} delay={4000} autohide>
        <Toast.Body className="text-white">{message}</Toast.Body>
      </Toast>
    </ToastContainer>
  );
}
