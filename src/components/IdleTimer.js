import { useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

export default function IdleTimer({ children }) {
  const { logout } = useContext(AuthContext);
  const timerRef = useRef(null);

  const resetTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      logout(); // automatically log out when idle
    }, IDLE_TIMEOUT);
  };

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    const handleActivity = () => resetTimer();

    // Set initial timer
    resetTimer();

    // Add event listeners
    events.forEach(event => window.addEventListener(event, handleActivity));

    // Cleanup
    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [logout]); // eslint-disable-line react-hooks/exhaustive-deps

  return children;
}