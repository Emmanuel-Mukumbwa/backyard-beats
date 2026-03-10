// src/components/MostPlayed.js
import React, { useEffect, useState, useRef } from 'react';
import axios from '../api/axiosConfig';
import { ListGroup, Spinner, Image, Button } from 'react-bootstrap';
import { FaDownload, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

export default function MostPlayed({ limit = 6, onSelect = () => {} }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const playingRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    axios.get('/public/tracks/most-played', { params: { limit, page } })
      .then(res => {
        if (!mounted) return;
        const data = res.data || {};
        setItems(data.items || []);
        setTotal(data.total || 0);
      })
      .catch(() => { if (mounted) setItems([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
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
  if (!items.length) return <div className="small text-muted">No data yet.</div>;

  return (
    <div>
      <ListGroup size="sm" variant="flush">
        {items.map(t => {
          const artistName = t.artist?.display_name || '';
          const artistId = t.artist?.id || null;
          const artwork = t.artwork_url || t.preview_artwork || null;
          const preview = t.preview_url || t.previewUrl || null;
          const download = t.download_url || preview || null;
          const plays = Number(t.plays || 0);

          return (
            <ListGroup.Item key={t.id} className="d-flex align-items-center">
              {artwork ? (
                <Image src={artwork} rounded style={{ width: 56, height: 56, objectFit: 'cover', marginRight: 10 }} />
              ) : (
                <div style={{ width: 56, height: 56, marginRight: 10, background: '#eee', borderRadius: 6 }} />
              )}

              <div className="flex-grow-1">
                <div className="d-flex align-items-center">
                  <div className="small fw-bold text-truncate" style={{ maxWidth: 160 }}>{t.title}</div>
                  <div className="small text-muted ms-2 text-truncate" style={{ maxWidth: 120 }}>{artistName}</div>
                </div>
                <div className="small text-muted">{t.genre ? `${t.genre} • ` : ''}{t.release_date || ''}</div>
              </div>

              <div className="d-flex align-items-center ms-2">
                {preview ? (
                  <audio
                    controls
                    preload="none"
                    style={{ width: 160 }}
                    src={preview}
                    onPlay={e => handlePlay(e.target)}
                    onPause={e => handlePause(e.target)}
                    onEnded={() => { if (playingRef.current) playingRef.current = null; }}
                  />
                ) : <div className="small text-muted me-2">No preview</div>}

                <div className="small text-muted ms-2 me-2" style={{ minWidth: 40, textAlign: 'right' }}>{plays}</div>

                {download ? (
                  <Button
                    size="sm"
                    variant="link"
                    href={download}
                    download
                    title="Download track"
                    className="ms-2"
                  >
                    <FaDownload />
                  </Button>
                ) : null}
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