import React, { useRef, useState, useEffect } from "react";

/**
 * Improved AudioPlayer:
 * - sets audio.src explicitly
 * - listens for loadedmetadata, timeupdate, ended, error
 * - shows helpful error messages and current audio src for debugging
 * - respects user gesture and handles play() promise rejections
 */
export default function AudioPlayer({ tracks = [] }) {
  const audioRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(tracks?.[0]?.duration || 0);
  const [error, setError] = useState(null);
  const current = tracks[currentIndex];

  // update audio src when track changes
  useEffect(() => {
    const audio = audioRef.current;
    setError(null);
    setProgress(0);
    setDuration(current?.duration || 0);

    if (!audio) return;
    // set crossOrigin if you're loading from another origin and need CORS
    // audio.crossOrigin = 'anonymous';

    // Use explicit absolute/relative URL from track.previewUrl
    audio.src = current?.previewUrl || "";
    // Load metadata to obtain true duration if available
    audio.load();
  }, [currentIndex, current?.previewUrl, current?.duration]);

  // attach audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function onTime() {
      setProgress(audio.currentTime || 0);
    }
    function onLoaded() {
      // prefer actual audio.duration if present
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setDuration(Math.floor(audio.duration));
      }
    }
    function onEnd() {
      if (currentIndex < tracks.length - 1) {
        setCurrentIndex(i => i + 1);
        setPlaying(true); // auto-advance then attempt to play next
      } else {
        setPlaying(false);
      }
    }
    function onError(e) {
      setError("Playback error: unable to load audio (check network/URL/CORS).");
      console.error("Audio error", e);
      setPlaying(false);
    }

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onError);
    };
  }, [audioRef, currentIndex, tracks.length]);

  // play/pause toggle with promise handling
  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return setError("Audio element not ready.");

    setError(null);
    try {
      if (playing) {
        audio.pause();
        setPlaying(false);
      } else {
        // attempt to play - handle promise rejection
        await audio.play();
        setPlaying(true);
      }
    } catch (err) {
      // typical reasons: not allowed autoplay (shouldn't happen on user click), CORS, invalid src, network error
      console.error("play() failed:", err);
      setError(err?.message || "Unable to play audio.");
      setPlaying(false);
    }
  }

  // manual prev/next
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
          {/* show current audio src for debugging */}
          <div className="mt-2 small text-muted">src: {current?.previewUrl || "(none)"}</div>
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

      {/* Hidden native audio element */}
      <audio ref={audioRef} preload="auto" />
    </div>
  );
}
