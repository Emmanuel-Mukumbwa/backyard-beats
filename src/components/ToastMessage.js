import React from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import PropTypes from 'prop-types';

/**
 * ToastMessage - lightweight toast wrapper
 * usage: <ToastMessage show={show} onClose={...} message="..." variant="success" />
 *
 * position: 'top-end' | 'bottom-end' | 'top-start' | 'bottom-start'
 * variant: 'success' | 'danger' | 'warning' | 'info'
 */
export default function ToastMessage({
  show,
  onClose,
  message,
  variant = 'success',
  delay = 4000,
  position = 'top-end',
  title,
  autohide = true,
  containerClassName = '',
}) {
  // map to bootstrap bg classes — any new variants should be added here
  const bg = variant === 'danger' ? 'danger' : (variant === 'warning' ? 'warning' : (variant === 'info' ? 'info' : 'success'));

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

  // text color: toast bg uses Bootstrap's bg-* which is dark for danger/warning; set white text by default
  const bodyClass = 'text-white';

  return (
    <ToastContainer style={style} className={`p-0 ${containerClassName}`}>
      <Toast show={!!show} onClose={onClose} bg={bg} autohide={!!autohide} delay={delay}>
        <Toast.Header>
          <strong className="me-auto">{title || (variant === 'danger' ? 'Error' : 'Notice')}</strong>
        </Toast.Header>
        <Toast.Body className={bodyClass}>{message}</Toast.Body>
      </Toast>
    </ToastContainer>
  );
}

ToastMessage.propTypes = {
  show: PropTypes.bool,
  onClose: PropTypes.func,
  message: PropTypes.string,
  variant: PropTypes.oneOf(['success', 'danger', 'warning', 'info']),
  delay: PropTypes.number,
  position: PropTypes.string,
  title: PropTypes.string,
  autohide: PropTypes.bool,
  containerClassName: PropTypes.string,
}; 