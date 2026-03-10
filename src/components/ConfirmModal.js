// File: src/components/ConfirmModal.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Modal, Button } from 'react-bootstrap';

/**
 * ConfirmModal - reusable confirmation/message modal
 *
 * Props:
 * - show, onHide
 * - title, message
 * - onConfirm: called when user confirms
 * - confirmText, cancelText
 * - variant: bootstrap variant for confirm button
 * - recommendation: optional JSX or string with recommendation / extra guidance
 */
export default function ConfirmModal({
  show,
  onHide,
  title,
  message,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  recommendation = null,
  centered = true,
}) {
  return (
    <Modal show={!!show} onHide={onHide} centered={centered}>
      {title && <Modal.Header closeButton><Modal.Title>{title}</Modal.Title></Modal.Header>}
      <Modal.Body>
        <div>{message}</div>
        {recommendation && (
          <div className="mt-3 p-2 bg-light border rounded">
            <small className="text-muted">Recommendation:</small>
            <div>{recommendation}</div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>{cancelText}</Button>
        <Button variant={variant} onClick={() => { onConfirm?.(); onHide?.(); }}>{confirmText}</Button>
      </Modal.Footer>
    </Modal>
  );
}

ConfirmModal.propTypes = {
  show: PropTypes.bool,
  onHide: PropTypes.func,
  title: PropTypes.string,
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  onConfirm: PropTypes.func,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  variant: PropTypes.string,
  recommendation: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  centered: PropTypes.bool,
};