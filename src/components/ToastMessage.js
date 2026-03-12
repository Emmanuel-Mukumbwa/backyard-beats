// File: src/components/ToastMessage.js
///used globaly throughout the app, so we can easily change the look and feel of all toasts by changing this one component
import React from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import PropTypes from 'prop-types';

/**
 * ToastMessage - lightweight toast wrapper
 * usage: <ToastMessage show={show} onClose={...} message="..." variant="success" />
 */
export default function ToastMessage({
  show,
  onClose,
  message,
  variant = 'success',
  delay = 4000,
  position = 'top-end', 
  title,
}) {
  const bg = variant === 'danger' ? 'danger' : (variant === 'warning' ? 'warning' : 'success');

  const posMap = {
    'top-end': { top: 12, right: 12 },
    'bottom-end': { bottom: 12, right: 12 },
    'top-start': { top: 12, left: 12 },
    'bottom-start': { bottom: 12, left: 12 },
  };

  const style = {
    position: 'fixed',
    zIndex: 1080,
    ...(posMap[position] || posMap['top-end']),
  };

  return (
    <ToastContainer style={style} className="p-0">
      <Toast show={!!show} onClose={onClose} bg={bg} autohide={!!delay} delay={delay}>
        <Toast.Header>
          <strong className="me-auto">{title || (variant === 'danger' ? 'Error' : 'Notice')}</strong>
        </Toast.Header>
        <Toast.Body className="text-white">{message}</Toast.Body>
      </Toast>
    </ToastContainer>
  );
}

ToastMessage.propTypes = {
  show: PropTypes.bool,
  onClose: PropTypes.func,
  message: PropTypes.string,
  variant: PropTypes.oneOf(['success', 'danger', 'warning']),
  delay: PropTypes.number,
  position: PropTypes.string,
  title: PropTypes.string,
};