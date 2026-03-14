// src/components/AudioPlayer.jsx
import React, { useRef, useState, useEffect, useRef as useRefHook } from 'react';
import axios from '../api/axiosConfig';
import { FaPlay, FaPause, FaStepForward, FaStepBackward } from 'react-icons/fa';
import { Image } from 'react-bootstrap';

/**
 * Props:
 * - tracks: []
 * - onPlay?: function(track)  // called when playback starts for a track (use to record listen)
 */
export default function AudioPlayer({ tracks = [], onPlay = null }) {
  const audioRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const prevPlayingRef = useRefHook(false);

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
  const getArtworkRaw = (t) => {
    if (!t) return '';
    return t.artwork_url || t.preview_artwork || t.artworkUrl || t.cover_url || t.cover || '';
  };
  const resolveToBackend = (raw) => {
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `${backendBase}${raw}`;
    if (raw.startsWith('uploads/')) return `${backendBase}/${raw}`;
    return `${backendBase}/uploads/${raw}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    setError(null);
    setProgress(0);
    setDuration(0);

    if (!audio) return;

    const raw = getPreviewRaw(current);
    const src = resolveToBackend(raw);

    if (!src) {
      audio.removeAttribute('src');
      audio.load();
      setPlaying(false);
      return;
    }

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
      if (playing) {
        audio.play().catch(err => {
          console.warn('Auto-play blocked or failed', err);
          setPlaying(false);
        });
      }
    } catch (e) {
      console.error('audio.load() error', e);
      setError('Unable to load audio metadata (possible CORS or invalid URL).');
      setPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, current?.id, backendBase]);

  // audio event listeners
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
  }, [audioRef, currentIndex, tracks]);

  // call onPlay when playback starts for the current track
  useEffect(() => {
    // Detect transition from not-playing -> playing, and only then call onPlay
    if (playing && !prevPlayingRef.current && typeof onPlay === 'function' && current) {
      try {
        // call onPlay async, but don't block UI
        onPlay(current).catch?.(() => {});
      } catch (e) {
        // if onPlay is sync, ignore errors
      }
    }
    prevPlayingRef.current = playing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, currentIndex, current]);

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
    setPlaying(true);
  }
  function next() {
    setError(null);
    setCurrentIndex(i => Math.min(tracks.length - 1, i + 1));
    setPlaying(true);
  }

  

  const artworkRaw = getArtworkRaw(current);
  const artworkUrl = artworkRaw ? resolveToBackend(artworkRaw) : null;
  const artworkFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(current?.title || 'Track')}&background=ddd&color=333&size=256`;

  return (
    <div className="card p-3">
      <div className="d-flex align-items-center">
        <div style={{ width: 96, height: 96, flexShrink: 0, marginRight: 16 }}>
          <Image
            src={artworkUrl || artworkFallback}
            rounded
            style={{ width: 96, height: 96, objectFit: 'cover' }}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = artworkFallback;
            }}
            alt={`${current?.title || 'Track'} artwork`}
          />
        </div>

        <div className="flex-grow-1">
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <div className="fw-bold">{current?.title || 'No track selected'}</div>
              <div className="small text-muted">
                {current?.genre || ''} {current?.duration ? `• ${current.duration}s` : ''}
              </div>
            </div>

            <div className="d-flex align-items-center">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary me-2"
                onClick={prev}
                disabled={tracks.length <= 1 || currentIndex === 0}
                aria-label="Previous"
              >
                <FaStepBackward />
              </button>

              <button
                type="button"
                className={`btn btn-sm me-2 ${playing ? 'btn-danger' : 'btn-success'}`}
                onClick={togglePlay}
                aria-pressed={playing}
              >
                {playing ? <><FaPause className="me-1" /> Pause</> : <><FaPlay className="me-1" /> Play</>}
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={next}
                disabled={tracks.length <= 1 || currentIndex === tracks.length - 1}
                aria-label="Next"
              >
                <FaStepForward />
              </button>
            </div>
          </div>

          <div className="mt-3">
            <div className="progress" style={{ height: 8 }}>
              <div
                className="progress-bar"
                role="progressbar"
                style={{
                  width: duration && progress ? `${Math.min(100, (progress / duration) * 100)}%` : '0%'
                }}
              />
            </div>

            <div className="d-flex justify-content-between small text-muted mt-1">
              <div>{Math.floor(progress)}s</div>
              <div>{duration || current?.duration || 0}s</div>
            </div>

            {error && <div className="mt-2 alert alert-danger py-1">{error}</div>}
          </div>
        </div>
      </div>

      <audio ref={audioRef} preload="auto" />
    </div>
  );
}