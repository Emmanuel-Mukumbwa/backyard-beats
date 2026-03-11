import React, { useRef, useState } from 'react';
import { Table, Button, Image, Badge } from 'react-bootstrap';
import { FaMusic, FaEdit, FaTrash, FaDownload } from 'react-icons/fa';
import PropTypes from 'prop-types';
import axios from '../../api/axiosConfig';
import ConfirmModal from '../ConfirmModal';

/**
 * TracksPanel - shows artist-owned tracks with approval status and reason if rejected.
 * - tracks: array of normalized track objects (must include is_approved/is_rejected/rejection_reason)
 * - status: overall artist status (approved/pending/rejected/banned/deleted)
 * - onPlay: optional fn(track) called when a track starts playing (can be used to record listens)
 */
export default function TracksPanel({
  tracks,
  status,
  onEdit,
  onDelete,
  resolveToBackend,
  onPlay = null,
  supportUrl = '/support',
  supportEmail = 'support@backyardbeats.local'
}) {
  const playingRef = useRef(null);

  // Confirm modal state for deletes
  const [confirm, setConfirm] = useState({
    show: false,
    id: null,
    title: 'Confirm delete',
    message: 'Are you sure you want to delete this track? This action cannot be undone.',
    variant: 'danger',
    confirmText: 'Delete'
  });

  function openDeleteConfirm(id) {
    setConfirm(prev => ({ ...prev, show: true, id }));
  }

  function closeConfirm() {
    setConfirm(prev => ({ ...prev, show: false, id: null }));
  }

  async function handleConfirmDelete() {
    const id = confirm.id;
    if (!id) { closeConfirm(); return; }
    try {
      await onDelete(id);
    } catch (e) {
      // onDelete is expected to show errors; nothing else here
      // fallback: console error
      // eslint-disable-next-line no-console
      console.error('Delete failed', e);
    } finally {
      closeConfirm();
    }
  }

  function handlePlay(audioEl, track) {
    if (playingRef.current && playingRef.current !== audioEl) {
      try { playingRef.current.pause(); } catch (e) { /* ignore */ }
    }
    playingRef.current = audioEl;

    if (typeof onPlay === 'function') {
      try { onPlay(track); } catch (e) { /* don't block UI */ }
    }
  }

  function handlePause(audioEl) {
    if (playingRef.current === audioEl) playingRef.current = null;
  }

  function getPreviewRaw(t) {
    return t.previewUrl || t.preview_url || t.file_url || t.preview || t.file || null;
  }

  function getArtworkRaw(t) {
    return t.artwork_url || t.preview_artwork || t.artworkUrl || t.cover_url || t.cover || null;
  }

  // Try to extract a usable token from common storage keys / formats
  function getStoredToken() {
    const keys = ['token', 'accessToken', 'authToken', 'auth', 'app_token'];
    for (let k of keys) {
      const v = localStorage.getItem(k);
      if (!v) continue;
      // raw token string
      if (v.startsWith('eyJ') || v.split('.').length === 3) return v;
      // maybe stored as "Bearer <token>"
      if (v.startsWith('Bearer ')) return v.substring(7);
      // maybe JSON string: {"token":"..."} or {"accessToken":"..."}
      try {
        const parsed = JSON.parse(v);
        if (parsed) {
          if (parsed.token) return parsed.token;
          if (parsed.accessToken) return parsed.accessToken;
          if (parsed.authToken) return parsed.authToken;
          // fallback: first string value
          const firstStr = Object.values(parsed).find(x => typeof x === 'string' && (x.startsWith('eyJ') || x.split?.('.').length === 3));
          if (firstStr) return firstStr;
        }
      } catch (e) {
        // not JSON, continue
      }
      // fallback: return raw anyway
      return v;
    }
    return null;
  }

  /**
   * Download via axios so we reuse baseURL and interceptors (and send cookies if configured).
   * We still attach Authorization header if we can find a token in localStorage.
   */
  async function downloadTrack(trackId) {
    try {
      const token = getStoredToken();
      const headers = {};
      if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const res = await axios.get(`/tracks/${trackId}/download`, {
        responseType: 'blob',
        headers
      });

      // axios returns headers in lower-case keys
      const disposition = res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition']);
      let filename = 'track.mp3';
      if (disposition) {
        const m = disposition.match(/filename="(.+)"/);
        if (m && m[1]) filename = m[1];
      }

      // If content is JSON (error), attempt to parse and show message
      // But since we used responseType: 'blob', res.data is a Blob.
      const blob = res.data;
      const blobType = blob.type || '';
      if (blobType.includes('application/json')) {
        // parse JSON text to show error
        const text = await blob.text();
        let parsed;
        try { parsed = JSON.parse(text); } catch (e) { parsed = text; }
        alert(`Download failed: ${JSON.stringify(parsed)}`);
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      // If axios receives a non-2xx, err.response may contain a blob or json/text
      let message = err.message;
      try {
        if (err.response && err.response.data) {
          // responseType was 'blob' — attempt to read text
          const data = err.response.data;
          if (data instanceof Blob) {
            const txt = await data.text();
            try {
              const parsed = JSON.parse(txt);
              message = parsed.error || JSON.stringify(parsed);
            } catch (e) {
              message = txt;
            }
          } else if (typeof data === 'object') {
            message = data.error || JSON.stringify(data);
          } else {
            message = String(data);
          }
        }
      } catch (e2) {
        // ignore parsing errors
      }
      alert(`Download failed: ${message}`);
    }
  }

  return (
    <div className="mt-3">
      <Table striped hover responsive className="mb-3">
        <thead>
          <tr>
            <th style={{ width: 80 }}>Artwork</th>
            <th>Title & status</th>
            <th style={{ width: 380 }}>Preview</th>
            <th style={{ width: 100 }}>Duration</th>
            <th style={{ width: 160 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map(track => {
            const itemStatus = track.is_approved ? 'approved' : (track.is_rejected ? 'rejected' : 'pending');
            const previewRaw = getPreviewRaw(track);
            const previewUrl = previewRaw ? resolveToBackend(previewRaw) : null;
            const artworkRaw = getArtworkRaw(track);
            const artworkUrl = artworkRaw ? resolveToBackend(artworkRaw) : null;

            return (
              <tr key={track.id}>
                <td className="align-middle">
                  {artworkUrl ? (
                    <Image
                      src={artworkUrl}
                      rounded
                      style={{ width: 64, height: 64, objectFit: 'cover' }}
                      alt={`${track.title || 'Track'} artwork`}
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(track.title || 'Track')}&background=ccc&color=333&size=128`; }}
                    />
                  ) : (
                    <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f3f5', color: '#6c757d', borderRadius: 6 }}>
                      <FaMusic />
                    </div>
                  )}
                </td>

                <td className="align-middle">
                  <div><strong className="text-truncate d-block" style={{ maxWidth: 280 }}>{track.title}</strong></div>
                  <div>
                    {itemStatus === 'approved' && <Badge bg="success" className="me-2">Approved</Badge>}
                    {itemStatus === 'pending' && <Badge bg="warning" text="dark" className="me-2">Pending</Badge>}
                    {itemStatus === 'rejected' && <Badge bg="danger" className="me-2">Rejected</Badge>}
                    {status !== 'approved' && <small className="text-muted"> ● Visible only to you until profile is approved</small>}
                  </div>
                  {track.is_rejected && track.rejection_reason && (
                    <div className="mt-1"><small className="text-danger">Reason: {track.rejection_reason}</small></div>
                  )}
                </td>

                <td className="align-middle">
                  {previewUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <audio
                        controls
                        preload="none"
                        controlsList="nodownload"
                        style={{ width: 320, maxWidth: '100%' }}
                        src={previewUrl}
                        onPlay={(e) => handlePlay(e.target, track)}
                        onPause={(e) => handlePause(e.target)}
                        onEnded={() => handlePause(null)}
                      />
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => downloadTrack(track.id)}
                        >
                          <FaDownload />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="small text-muted">No preview available</div>
                  )}
                </td>

                <td className="align-middle">{track.duration ? `${track.duration}s` : '-'}</td>

                <td className="align-middle">
                  <div className="d-flex gap-2">
                    <Button size="sm" variant="outline-primary" onClick={() => onEdit(track)}>
                      <FaEdit className="me-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => openDeleteConfirm(track.id)}>
                      <FaTrash className="me-1" /> Delete
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}

          {tracks.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-muted">No tracks yet — add your first track.</td>
            </tr>
          )}
        </tbody>
      </Table>

      <ConfirmModal
        show={confirm.show}
        onHide={closeConfirm}
        title={confirm.title}
        message={confirm.message}
        onConfirm={handleConfirmDelete}
        confirmText={confirm.confirmText}
        variant={confirm.variant}
      />
    </div>
  );
}

TracksPanel.propTypes = {
  tracks: PropTypes.array.isRequired,
  status: PropTypes.string,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  resolveToBackend: PropTypes.func.isRequired,
  onPlay: PropTypes.func,
  supportUrl: PropTypes.string,
  supportEmail: PropTypes.string
};