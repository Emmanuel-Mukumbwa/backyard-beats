// src/components/NewReleases.js
import React, { useEffect, useState, useRef } from 'react';
import axios from '../api/axiosConfig';
import { ListGroup, Spinner, Image, Button } from 'react-bootstrap';
import { FaDownload, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

export default function NewReleases({ limit = 6, onSelect = () => {} }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const playingRef = useRef(null); // currently playing audio element
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    axios.get('/public/tracks/new-releases', { params: { limit, page } })
      .then(res => {
        if (!mountedRef.current) return;
        const data = res.data || {};
        setItems(data.items || []);
        setTotal(data.total || 0);
      })
      .catch(() => {
        if (mountedRef.current) setItems([]);
      })
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [limit, page]);

  function handlePlay(audioEl) {
    if (!audioEl) return;
    if (playingRef.current && playingRef.current !== audioEl) {
      try { playingRef.current.pause(); } catch {}
    }
    playingRef.current = audioEl;
  }

  function handlePause(audioEl) {
    if (playingRef.current === audioEl) playingRef.current = null;
  }

  const totalPages = Math.max(1, Math.ceil((total || 0) / limit));

  if (loading) return <div className="py-2 text-center"><Spinner animation="border" size="sm" /></div>;
  if (!items.length) return <div className="small text-muted">No recent releases.</div>;

  return (
    <div>
      <ListGroup size="sm" variant="flush">
        {items.map(t => {
          const artistName = t.artist?.display_name || t.artist?.displayName || '';
          const artistId = t.artist?.id || null;
          const displayDate = t.release_date || t.created_at || null;
          const artwork = t.artwork_url || t.preview_artwork || null;
          const preview = t.preview_url || t.previewUrl || null;
          const download = t.download_url || preview || null;

          return (
            <ListGroup.Item key={t.id} className="py-2">
              <div className="d-flex align-items-start">
                {/* Artwork */}
                {artwork ? (
                  <Image src={artwork} rounded style={{ width: 56, height: 56, objectFit: 'cover', marginRight: 12 }} />
                ) : (
                  <div style={{ width: 56, height: 56, marginRight: 12, background: '#eee', borderRadius: 6 }} />
                )}

                {/* Title + meta + thin controls under title */}
                <div className="flex-grow-1">
                  <div className="d-flex align-items-start justify-content-between">
                    <div style={{ minWidth: 0 }}>
                      <div
                        className="small fw-bold text-truncate"
                        style={{ maxWidth: '100%', cursor: artistId ? 'pointer' : 'default' }}
                        onClick={() => artistId && onSelect(artistId)}
                        title={t.title}
                      >
                        {t.title}
                      </div>
                      <div className="small text-muted" style={{ marginTop: 4 }}>
                        {artistName ? `${artistName} ` : ''}{t.genre ? `• ${t.genre} ` : ''}{displayDate ? `• ${new Date(displayDate).toLocaleDateString()}` : ''}
                      </div>
                    </div>

                    {/* optional plays count (small) */}
                    <div className="ms-2 text-muted small" style={{ whiteSpace: 'nowrap' }}>
                      {t.plays ? Number(t.plays) : ''}
                    </div>
                  </div>

                  {/* compact audio + download row under title */}
                  <div className="d-flex align-items-center mt-2">
                    {preview ? (
                      <audio
                        controls
                        preload="none"
                        style={{ width: 140, height: 30 }}
                        src={preview}
                        onPlay={e => handlePlay(e.target)}
                        onPause={e => handlePause(e.target)}
                        onEnded={() => { if (playingRef.current) playingRef.current = null; }}
                        aria-label={`Preview for ${t.title}`}
                      />
                    ) : (
                      <div className="small text-muted me-2">No preview</div>
                    )}

                    {download ? (
                      <Button
                        size="sm"
                        variant="link"
                        href={download}
                        download
                        title="Download track"
                        className="ms-3 p-0"
                        aria-label={`Download ${t.title}`}
                      >
                        <FaDownload />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </ListGroup.Item>
          );
        })}
      </ListGroup>

      <div className="d-flex justify-content-between align-items-center mt-2">
        <div className="small text-muted">Page {page} / {totalPages}</div>
        <div>
          <Button variant="link" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><FaChevronLeft /></Button>
          <Button variant="link" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><FaChevronRight /></Button>
        </div>
      </div>
    </div>
  );
}