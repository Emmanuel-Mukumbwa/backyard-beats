// src/components/AudioPlayer.jsx
import React, { useRef, useState, useEffect } from "react";
import axios from '../api/axiosConfig';

/**
 * AudioPlayer (single-file)
 * - Resolves preview paths to backend baseURL (axios.defaults.baseURL)
 * - Inline playback only (no visible backend URL)
 * - Handles previewUrl / preview_url / file_url shapes
 */
export default function AudioPlayer({ tracks = [] }) {
  const audioRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const current = tracks && tracks.length > 0 ? tracks[currentIndex] : null;

  const backendBase = (() => {
    try {
      return (axios && axios.defaults && axios.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:3001';
    } catch {
      return process.env.REACT_APP_API_URL || 'http://localhost:3001';
    }
  })().replace(/\/$/, '');

  const getPreviewRaw = (t) => {
    if (!t) return '';
    return t.previewUrl || t.preview_url || t.file_url || t.preview || '';
  };

  const resolveToBackend = (raw, trackId) => {
    if (!raw && !trackId) return '';
    // if trackId present, prefer predictable backend uploads path for that id if your server stores mapping by preview_url.
    // We won't add a new streaming endpoint; we'll resolve raw paths.
    if (trackId && !raw) {
      // fallback to convention: /uploads/tracks/<maybe-existing-filename> - but if you don't store filename, require preview_url
      return '';
    }
    if (!raw) return '';
    // absolute URL?
    if (/^https?:\/\//i.test(raw)) return raw;
    // starts with slash -> treat as absolute path on backend
    if (raw.startsWith('/')) return `${backendBase}${raw}`;
    // starts with 'uploads/'
    if (raw.startsWith('uploads/')) return `${backendBase}/${raw}`;
    // otherwise assume it's under uploads/ (filename)
    return `${backendBase}/uploads/${raw}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    setError(null);
    setProgress(0);
    setDuration(current?.duration || 0);

    if (!audio) return;

    const raw = getPreviewRaw(current);
    const src = resolveToBackend(raw, current?.id);

    if (!src) {
      audio.removeAttribute('src');
      audio.load();
      return;
    }

    // set crossOrigin if backend origin differs
    try {
      const backendOrigin = new URL(backendBase).origin;
      if (window.location.origin !== backendOrigin) audio.crossOrigin = 'anonymous';
      else audio.removeAttribute('crossOrigin');
    } catch (e) {
      audio.removeAttribute('crossOrigin');
    }

    audio.src = src;
    try {
      audio.load();
    } catch (e) {
      console.error('audio.load() error', e);
      setError('Unable to load audio metadata (possible CORS or invalid URL).');
    }
  }, [currentIndex, current, backendBase]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function onTime() {
      setProgress(audio.currentTime || 0);
    }
    function onLoaded() {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setDuration(Math.floor(audio.duration));
      }
    }
    function onEnd() {
      if (currentIndex < tracks.length - 1) {
        setCurrentIndex(i => i + 1);
        setPlaying(true);
      } else {
        setPlaying(false);
      }
    }
    function onError(ev) {
      console.error('Audio error event', ev);
      setError('Playback error: unable to load audio (check network/URL/CORS).');
      setPlaying(false);
    }

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onError);
    };
  }, [audioRef, currentIndex, tracks, current]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return setError('Audio element not ready.');
    setError(null);
    try {
      if (playing) {
        audio.pause();
        setPlaying(false);
      } else {
        await audio.play();
        setPlaying(true);
      }
    } catch (err) {
      console.error('play() failed:', err);
      setError(err?.message || 'Unable to play audio. Check the console for details.');
      setPlaying(false);
    }
  }

  function prev() {
    setError(null);
    setCurrentIndex(i => Math.max(0, i - 1));
  }
  function next() {
    setError(null);
    setCurrentIndex(i => Math.min(tracks.length - 1, i + 1));
  }

  return (
    <div className="card p-3">
      <div className="d-flex align-items-center">
        <div className="me-3">
          <button
            className={`btn btn-sm ${playing ? "btn-danger" : "btn-success"}`}
            onClick={togglePlay}
            aria-pressed={playing}
          >
            {playing ? "Pause" : "Play"}
          </button>
        </div>

        <div className="flex-grow-1">
          <div className="fw-bold">{current?.title || "No track selected"}</div>
          <div className="small text-muted">Preview</div>

          <div className="progress mt-2" style={{ height: 6 }}>
            <div
              className="progress-bar"
              role="progressbar"
              style={{
                width:
                  duration && progress ? `${Math.min(100, (progress / duration) * 100)}%` : "0%"
              }}
            />
          </div>

          <div className="small mt-1 text-muted">
            {Math.floor(progress)}s / {duration || current?.duration || 0}s
          </div>

          {error && <div className="mt-2 alert alert-danger py-1">{error}</div>}
        </div>

        <div className="ms-3">
          <div className="btn-group-vertical">
            <button className="btn btn-outline-secondary btn-sm" onClick={prev}>
              Prev
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={next}>
              Next
            </button>
          </div>
        </div>
      </div>

      <audio ref={audioRef} preload="auto" />
    </div>
  );
}
