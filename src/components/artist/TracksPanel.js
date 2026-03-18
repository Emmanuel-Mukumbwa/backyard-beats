import React, { useRef, useState, useEffect, useContext } from 'react';
import { Table, Button, Image, Badge, Spinner, Card, Row, Col, Dropdown } from 'react-bootstrap';
import { FaMusic, FaEdit, FaTrash, FaDownload, FaChevronRight, FaEllipsisV } from 'react-icons/fa';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axiosConfig';
import ConfirmModal from '../ConfirmModal';
import ToastMessage from '../ToastMessage';
import { AuthContext } from '../../context/AuthContext';
import './tracks-panel.css';

/**
 * TracksPanel - shows artist-owned tracks with approval status and reason if rejected.
 * - switches to a card/list UI for small screens to avoid horizontal scrolling
 * - keeps a table UI for larger screens
 * - preserves previous API behaviour (downloads, appeals, tickets)
 */

export default function TracksPanel({
  tracks,
  status,
  onEdit,
  onDelete,
  resolveToBackend,
  onPlay = null,
  supportUrl = '/support'
}) {
  const navigate = useNavigate();
  const playingRef = useRef(null);
  const { user, artist: myArtist } = useContext(AuthContext);

  // Toast and download state
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });
  const [downloadingId, setDownloadingId] = useState(null);

  // Confirm modal state for deletes
  const [confirm, setConfirm] = useState({
    show: false,
    id: null,
    title: 'Confirm delete',
    message: 'Are you sure you want to delete this track? This action cannot be undone.',
    variant: 'danger',
    confirmText: 'Delete'
  });

  // tickets map: { 'track:123': ticket }
  const [ticketsMap, setTicketsMap] = useState({});

  // wrapper ref and scroll hint state
  const wrapperRef = useRef(null);
  const [showHint, setShowHint] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const hideHintTimeoutRef = useRef(null);

  // mobile switch (used to render card/list view)
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));

  useEffect(() => {
    let mounted = true;
    async function loadUserTickets() {
      try {
        const res = await axios.get('/support', { params: { limit: 200 } });
        if (!mounted) return;
        const t = res.data.tickets || [];
        const map = {};
        for (const ticket of t) {
          if (ticket.target_type && ticket.target_type !== 'none' && ticket.target_id) {
            const key = `${ticket.target_type}:${String(ticket.target_id)}`;
            if (!map[key]) map[key] = ticket;
            else {
              const prev = new Date(map[key].updated_at).getTime();
              const cur = new Date(ticket.updated_at).getTime();
              if (cur >= prev) map[key] = ticket;
            }
          }
        }
        setTicketsMap(map);
      } catch (e) {
        // fail silently
      }
    }
    loadUserTickets();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    function updateHintOnResize() {
      const mobile = window.innerWidth < 768;
      setShowHint(mobile);
      setIsMobile(mobile);
    }

    function onScroll() {
      if (!showHint) return;
      setShowHint(false);
      if (wrapper.classList) wrapper.classList.add('no-hint');
      if (hideHintTimeoutRef.current) {
        clearTimeout(hideHintTimeoutRef.current);
        hideHintTimeoutRef.current = null;
      }
    }

    wrapper.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateHintOnResize);

    hideHintTimeoutRef.current = setTimeout(() => {
      setShowHint(false);
      if (wrapper.classList) wrapper.classList.add('no-hint');
    }, 3500);

    return () => {
      wrapper.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateHintOnResize);
      if (hideHintTimeoutRef.current) clearTimeout(hideHintTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      console.error('Delete failed', e);
      setToast({ show: true, message: 'Delete failed', variant: 'danger' });
    } finally {
      closeConfirm();
    }
  }

  function handlePlay(audioEl, track) {
    if (playingRef.current && playingRef.current !== audioEl) {
      try { playingRef.current.pause(); } catch (e) { }
    }
    playingRef.current = audioEl;

    if (typeof onPlay === 'function') {
      try { onPlay(track); } catch (e) { }
    }

    if (user && user.id && track && track.id) {
      if (myArtist && track.artist && Number(myArtist.id) === Number(track.artist.id)) {
        // skip owner plays
      } else {
        axios.post('/fan/listens', { track_id: track.id, artist_id: track.artist?.id || null }).catch(() => {});
      }
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

  function sanitizeFilename(s) {
    if (!s) return '';
    return String(s)
      .replace(/["'<>:\\/|?*]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 190);
  }

  async function downloadTrack(trackId, setToastCb, setDownloadingCb) {
    try {
      const res = await axios.get(`/download/${trackId}`, { responseType: 'blob' });

      const disposition = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
      let filename = null;

      if (disposition) {
        const fnStar = disposition.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i);
        if (fnStar && fnStar[1]) {
          try { filename = decodeURIComponent(fnStar[1].replace(/['"]/g, '')); } catch (e) { filename = fnStar[1].replace(/['"]/g, ''); }
        }
        if (!filename) {
          const quoted = disposition.match(/filename\s*=\s*"([^"]+)"/i);
          if (quoted && quoted[1]) filename = quoted[1];
        }
        if (!filename) {
          const unq = disposition.match(/filename\s*=\s*([^;]+)/i);
          if (unq && unq[1]) filename = unq[1].replace(/['"]/g, '').trim();
        }
      }

      if (!filename) {
        const title = (res.headers && (res.headers['x-track-title'] || res.headers['X-Track-Title'])) || '';
        const mime = (res.data && res.data.type) || '';
        let ext = '.mp3';
        if (mime.includes('mpeg')) ext = '.mp3';
        else if (mime.includes('audio/mp4') || mime.includes('m4a')) ext = '.m4a';
        else if (mime.includes('ogg')) ext = '.ogg';
        else if (mime.includes('wav')) ext = '.wav';
        else if (mime.includes('flac')) ext = '.flac';
        filename = `${sanitizeFilename(title || `track-${trackId}`)}${ext}`;
      }

      filename = filename && sanitizeFilename(filename) ? filename : `track-${trackId}.mp3`;

      const blob = res.data;
      if ((blob.type || '').includes('application/json')) {
        const txt = await blob.text();
        let parsed;
        try { parsed = JSON.parse(txt); } catch (e) { parsed = txt; }
        setToastCb({ show: true, message: `Download failed: ${JSON.stringify(parsed)}`, variant: 'danger' });
        setDownloadingCb(null);
        return;
      }

      let fileToSave;
      try { fileToSave = new File([blob], filename, { type: blob.type || 'application/octet-stream' }); } catch (e) { fileToSave = blob; }

      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(fileToSave, filename);
      } else {
        const url = window.URL.createObjectURL(fileToSave);
        const a = document.createElement('a');
        a.href = url;
        a.setAttribute('download', filename);
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
      setToastCb({ show: true, message: `Download started: ${filename}`, variant: 'success' });
      setDownloadingCb(null);
    } catch (err) {
      let message = err.message || 'Download failed';
      try {
        if (err.response && err.response.data) {
          const data = err.response.data;
          if (data instanceof Blob) {
            const txt = await data.text();
            try { const parsed = JSON.parse(txt); message = parsed.error || JSON.stringify(parsed); } catch (_) { message = txt; }
          } else if (typeof data === 'object') { message = data.error || JSON.stringify(data); } else { message = String(data); }
        }
      } catch (_) {}
      setToastCb({ show: true, message: `Download failed: ${message}`, variant: 'danger' });
      setDownloadingCb(null);
    }
  }

  const handleDownload = (trackId) => {
    setDownloadingId(trackId);
    setToast({ show: true, message: 'Preparing your download...', variant: 'info' });
    downloadTrack(trackId, setToast, setDownloadingId);
  };

  function openAppealForTrack(track) {
    const previewRaw = getPreviewRaw(track);
    const existingFiles = [];
    if (previewRaw && typeof resolveToBackend === 'function') {
      try {
        const url = resolveToBackend(previewRaw);
        if (url) existingFiles.push({ url, filename: `${(track.title || 'track').replace(/\s+/g, '_')}.mp3` });
      } catch (e) { }
    }

    const subject = `Appeal: ${track.title || 'untitled track'}`;
    const body = `Hi support,\n\nMy track "${track.title || 'untitled'}" was rejected.${track.rejection_reason ? `\n\nRejection reason: ${track.rejection_reason}` : ''}\n\nPlease review the decision and attached file.\n\nThanks.`;

    const prefill = {
      subject,
      body,
      type: 'appeal',
      targetType: 'track',
      targetId: String(track.id),
      includeTargetFile: true,
      existingFiles
    };

    navigate('/support', { state: { prefill } });
  }

  function handleViewTicket(ticket) {
    if (!ticket) return;
    navigate(`/support?openTicket=${ticket.id}`);
  }

  // render helpers
  function renderBadges(track) {
    const itemStatus = track.is_approved ? 'approved' : (track.is_rejected ? 'rejected' : 'pending');
    return (
      <>
        {itemStatus === 'approved' && <Badge bg="success" className="me-2">Approved</Badge>}
        {itemStatus === 'pending' && <Badge bg="warning" text="dark" className="me-2">Pending</Badge>}
        {itemStatus === 'rejected' && <Badge bg="danger" className="me-2">Rejected</Badge>}
        {status !== 'approved' && <small className="text-muted"> ● Visible only to you until profile is approved</small>}
      </>
    );
  }

  // --- component render ---
  return (
    <>
      <ToastMessage
        show={toast.show}
        onClose={() => setToast(s => ({ ...s, show: false }))}
        message={toast.message}
        variant={toast.variant}
        delay={3500}
        position="top-end"
      />

      <div className="mt-3">
        <div ref={wrapperRef} className={`tracks-table-wrapper ${showHint ? '' : 'no-hint'}`} aria-hidden="false">
          {showHint && (
            <div className="scroll-hint" role="status" aria-live="polite">
              <span className="hint-text">Swipe to see actions</span>
              <FaChevronRight aria-hidden />
            </div>
          )}

          {/* mobile: card/list view */}
          {isMobile ? (
            <div className="tracks-card-list">
              {tracks.length === 0 && (
                <div className="text-center text-muted py-4">No tracks yet — add your first track.</div>
              )}

              {tracks.map(track => {
                const previewRaw = getPreviewRaw(track);
                const previewUrl = previewRaw ? resolveToBackend(previewRaw) : null;
                const artworkRaw = getArtworkRaw(track);
                const artworkUrl = artworkRaw ? resolveToBackend(artworkRaw) : null;
                const isDownloading = downloadingId === track.id;

                const ticketKey = `track:${String(track.id)}`;
                const ticket = ticketsMap[ticketKey];

                return (
                  <Card key={track.id} className="mb-3">
                    <Card.Body>
                      <Row className="g-2 align-items-center">
                        <Col xs={3} className="text-center">
                          {artworkUrl ? (
                            <Image
                              src={artworkUrl}
                              rounded
                              style={{ width: 64, height: 64, objectFit: 'cover' }}
                              alt={`${track.title || 'Track'} artwork`}
                              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(track.title || 'Track')}&background=ccc&color=333&size=128`; }}
                            />
                          ) : (
                            <div className="mobile-artwork-fallback"><FaMusic /></div>
                          )}
                        </Col>

                        <Col xs={9}>
                          <div className="d-flex justify-content-between align-items-start">
                            <div style={{ minWidth: 0 }}>
                              <strong className="d-block text-truncate">{track.title}</strong>
                              <div className="small mt-1">{renderBadges(track)}</div>
                              {track.is_rejected && track.rejection_reason && (
                                <div className="mt-1"><small className="text-danger">Reason: {track.rejection_reason}</small></div>
                              )}
                            </div>

                            <div className="ms-2 text-end">
                              <Dropdown align="end">
                                <Dropdown.Toggle variant="light" size="sm" aria-label={`More actions for ${track.title}`}>
                                  <FaEllipsisV />
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                  <Dropdown.Item onClick={() => onEdit(track)} aria-label={`Edit ${track.title}`}>
                                    <FaEdit className="me-2" /> Edit
                                  </Dropdown.Item>
                                  {track.is_rejected && (
                                    <Dropdown.Item onClick={() => openAppealForTrack(track)} aria-label={`Appeal ${track.title}`}>
                                      Appeal
                                    </Dropdown.Item>
                                  )}
                                  <Dropdown.Item onClick={() => openDeleteConfirm(track.id)} aria-label={`Delete ${track.title}`}>
                                    <FaTrash className="me-2" /> Delete
                                  </Dropdown.Item>
                                </Dropdown.Menu>
                              </Dropdown>
                            </div>
                          </div>

                          <div className="mt-2 d-flex align-items-center justify-content-between">
                            <div style={{ width: '62%' }}>
                              {previewUrl ? (
                                <audio
                                  controls
                                  controlsList="nodownload"
                                  preload="none"
                                  style={{ width: '100%' }}
                                  src={previewUrl}
                                  onPlay={(e) => handlePlay(e.target, track)}
                                  onPause={(e) => handlePause(e.target)}
                                  onEnded={() => handlePause(null)}
                                />
                              ) : (
                                <div className="small text-muted">No preview available</div>
                              )}
                            </div>

                            <div className="ms-2 d-flex gap-2 align-items-center">
                              <Button size="sm" variant="outline-secondary" onClick={() => handleDownload(track.id)} disabled={isDownloading} aria-label={`Download ${track.title}`}>
                                {isDownloading ? <Spinner animation="border" size="sm" /> : <FaDownload />}
                              </Button>

                              {track.is_rejected && ticket && (
                                <Button size="sm" variant="outline-primary" onClick={() => handleViewTicket(ticket)} aria-label={`View ticket for ${track.title}`}>
                                  View ticket
                                </Button>
                              )}

                              {track.is_rejected && !ticket && (
                                <Button size="sm" variant="link" onClick={() => openAppealForTrack(track)} aria-label={`Contact support about ${track.title}`}>
                                  Contact support
                                </Button>
                              )}
                            </div>
                          </div>

                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* desktop: table view (keeps original behaviour) */
            <Table striped hover responsive className="mb-3">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Artwork</th>
                  <th>Title & status</th>
                  <th style={{ width: 380 }}>Preview</th>
                  <th style={{ width: 100 }}>Duration</th>
                  <th style={{ width: 200 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map(track => {
                  const previewRaw = getPreviewRaw(track);
                  const previewUrl = previewRaw ? resolveToBackend(previewRaw) : null;
                  const artworkRaw = getArtworkRaw(track);
                  const artworkUrl = artworkRaw ? resolveToBackend(artworkRaw) : null;
                  const isDownloading = downloadingId === track.id;

                  const ticketKey = `track:${String(track.id)}`;
                  const ticket = ticketsMap[ticketKey];

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
                          {renderBadges(track)}
                        </div>
                        {track.is_rejected && track.rejection_reason && (
                          <div className="mt-1"><small className="text-danger">Reason: {track.rejection_reason}</small></div>
                        )}

                        <div className="mt-1">
                          {track.is_rejected && ticket && (
                            <Button size="sm" variant="outline-primary" onClick={() => handleViewTicket(ticket)}>View ticket</Button>
                          )}
                          {track.is_rejected && !ticket && (
                            <Button size="sm" variant="link" onClick={() => openAppealForTrack(track)}>Contact support</Button>
                          )}
                        </div>
                      </td>

                      <td className="align-middle">
                        {previewUrl ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <audio
                              controls
                              controlsList="nodownload"
                              preload="none"
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
                                onClick={() => handleDownload(track.id)}
                                disabled={isDownloading}
                                aria-label={`Download ${track.title || 'track'}`}
                              >
                                {isDownloading ? <Spinner animation="border" size="sm" /> : <FaDownload />}
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

                          {track.is_rejected && (
                            <Button size="sm" variant="outline-warning" onClick={() => openAppealForTrack(track)}>
                              Appeal
                            </Button>
                          )}

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
          )}

        </div>

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
    </>
  );
}

TracksPanel.propTypes = {
  tracks: PropTypes.array.isRequired,
  status: PropTypes.string,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  resolveToBackend: PropTypes.func.isRequired,
  onPlay: PropTypes.func,
  supportUrl: PropTypes.string
};