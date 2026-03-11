import React, { useRef } from 'react';
import { Button } from 'react-bootstrap';
import { FaDownload } from 'react-icons/fa';

export default function TracksPanel({ tracks = [], resolveToBackend, fmtDuration, onDownload }) {
  const playingRef = useRef(null);

  function handlePlay(el, t) {
    if (playingRef.current && playingRef.current !== el) {
      try { playingRef.current.pause(); } catch (e) {}
    }
    playingRef.current = el;
    if (t && t.id) {
      // intentionally fire-and-forget; backend records listens
      // caller might pass a handler, but keep it simple here
    }
  }

  function handlePause(el) {
    if (playingRef.current === el) playingRef.current = null;
  }

  return (
    <div>
      {tracks && tracks.length > 0 ? (
        <div className="list-group mt-2">
          {tracks.map(t => {
            const previewRaw = t.preview_url || t.previewUrl || t.file_url || t.preview || t.file || null;
            const previewUrl = previewRaw ? resolveToBackend(previewRaw) : null;
            return (
              <div key={t.id} className="list-group-item d-flex justify-content-between align-items-center">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fw-bold text-truncate">{t.title}</div>
                  <div className="small text-muted">{t.genre ? `${t.genre} · ` : ''}{fmtDuration(t.duration)}</div>
                  {t.is_rejected && <div className="small text-danger">Track rejected{t.rejection_reason ? `: ${t.rejection_reason}` : ''}. <a href="/support">Appeal</a></div>}
                  {!t.is_approved && !t.is_rejected && <div className="small text-muted">Pending approval</div>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {previewUrl ? (
                    <>
                      <audio
                        controls
                        preload="none"
                        controlsList="nodownload"
                        style={{ width: 320, maxWidth: '40vw' }}
                        src={previewUrl}
                        onPlay={(e) => handlePlay(e.target, t)}
                        onPause={(e) => handlePause(e.target)}
                        onEnded={() => handlePause(null)}
                      />
                      <Button size="sm" variant="outline-secondary" onClick={() => onDownload?.(t.id)} title="Download track">
                        <FaDownload />
                      </Button>
                    </>
                  ) : (
                    <div className="small text-muted">No preview</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-muted">No tracks uploaded yet.</div>
      )}
    </div>
  );
}