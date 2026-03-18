import React, { useEffect, useState, useRef, useContext, useCallback } from 'react';
import axios from '../api/axiosConfig';
import ArtistCard from '../components/ArtistCard';
import FilterBar from '../components/FilterBar';
import NewReleases from '../components/NewReleases';
import MostPlayed from '../components/MostPlayed';
import { Button, Alert, Container, Row, Col, Spinner } from 'react-bootstrap';
import Hero from '../components/Hero';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { FaMusic } from 'react-icons/fa';

export default function Home() {
  const [artists, setArtists] = useState([]);
  const [filters, setFilters] = useState({ district: '', genre: '', mood: '', q: '' });
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [noMatch, setNoMatch] = useState(false);

  const [myArtistProfileStatus, setMyArtistProfileStatus] = useState(null);
  const [myArtistProfileReason, setMyArtistProfileReason] = useState(null);
  const [checkingMyProfile, setCheckingMyProfile] = useState(false);

  const unmounted = useRef(false);
  const debounceRef = useRef(null);
  const resizeTimeoutRef = useRef(null);

  const { user } = useContext(AuthContext);

  // Responsive columns:
  // md (>=768) -> 3 columns per row
  // lg (>=992) -> 4 columns per row
  // xs/sm (<768) -> 2 columns per row
  const getCols = () => {
    if (typeof window === 'undefined') return 4;
    const w = window.innerWidth;
    if (w >= 992) return 4;
    if (w >= 768) return 3;
    return 2;
  };

  const [cols, setCols] = useState(getCols());

  // LIMIT = number of items per page = columns per row (one row per page)
  const [limit, setLimit] = useState(() => getCols());

  // update columns on resize (debounced)
  useEffect(() => {
    function onResize() {
      clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(() => {
        const c = getCols();
        if (c !== cols) {
          setCols(c);
        }
      }, 120);
    }

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimeoutRef.current);
    };
  }, [cols]);

  // when cols change, recalc limit (one row) and reset page to 1
  useEffect(() => {
    const newLimit = Math.max(1, cols);
    if (newLimit !== limit) {
      setLimit(newLimit);
      setPage(1);
      loadArtists({ page: 1, limit: newLimit });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols]);

  // build params: DOES NOT depend on `page` (page is passed explicitly)
  const buildParams = useCallback(({ page: p = 1, limit: lim = limit } = {}) => {
    const params = {};
    if (filters.district) params.district_id = filters.district;
    if (filters.genre) params.genre = filters.genre;
    if (filters.mood) params.mood = filters.mood;
    if (filters.q) params.q = filters.q;
    params.limit = lim;
    params.offset = (p - 1) * lim;
    return params;
  }, [filters, limit]);

  // loadArtists accepts explicit page & limit and only depends on buildParams
  const loadArtists = useCallback(({ page: loadPage = 1, limit: forLimit = limit } = {}) => {
    setLoading(true);
    setNoMatch(false);

    const params = buildParams({ page: loadPage, limit: forLimit });

    axios.get('/artists', { params })
      .then(res => {
        const payload = Array.isArray(res.data)
          ? { items: res.data, total: res.data.length }
          : (res.data || { items: [], total: 0 });

        const items = payload.items || [];
        const tot = payload.total || 0;

        setArtists(items);
        setTotal(tot);

        const filtersActive = Object.values(filters).some(v => v && String(v).trim().length > 0);
        if (filtersActive && items.length === 0) {
          setNoMatch(true);
        } else {
          setNoMatch(false);
        }
      })
      .catch(err => {
        console.error('Failed to load artists', err);
        setArtists([]);
        setTotal(0);
        setNoMatch(false);
      })
      .finally(() => {
        if (!unmounted.current) setLoading(false);
      });
  }, [buildParams, filters, limit]);

  // initial mount + whenever limit changes we do an initial load (page 1)
  useEffect(() => {
    unmounted.current = false;
    setPage(1);
    loadArtists({ page: 1, limit });
    return () => {
      unmounted.current = true;
      clearTimeout(debounceRef.current);
    };
  }, [loadArtists, limit]);

  // debounce filters and reset to page 1
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      loadArtists({ page: 1, limit });
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [filters, loadArtists, limit]);

  // when page (or limit) changes, load that page explicitly
  useEffect(() => {
    loadArtists({ page, limit });
  }, [page, limit, loadArtists]);

  // fetch the logged-in artist's own profile status
  useEffect(() => {
    const fetchMyProfileStatus = async () => {
      const isArtist = user?.role === 'artist';
      const hasProfile = user?.has_profile === true || user?.hasProfile === true;

      if (!isArtist || !hasProfile) {
        setMyArtistProfileStatus(null);
        setMyArtistProfileReason(null);
        return;
      }

      const artistId =
        user?.artist_id ||
        user?.artistId ||
        user?.profile_id ||
        user?.artist?.id ||
        null;

      if (!artistId) {
        setMyArtistProfileStatus(null);
        setMyArtistProfileReason(null);
        return;
      }

      try {
        setCheckingMyProfile(true);
        setMyArtistProfileStatus(null);
        setMyArtistProfileReason(null);

        const res = await axios.get(`/artists/${artistId}`);
        if (res.data?.artist) {
          setMyArtistProfileStatus('approved');
        }
      } catch (err) {
        const data = err?.response?.data || {};
        if (data.status === 'pending') {
          setMyArtistProfileStatus('pending');
          setMyArtistProfileReason(null);
        } else if (data.status === 'rejected') {
          setMyArtistProfileStatus('rejected');
          setMyArtistProfileReason(data.rejection_reason || data.message || null);
        } else {
          console.error('Failed to load my artist profile status', err);
          setMyArtistProfileStatus(null);
          setMyArtistProfileReason(null);
        }
      } finally {
        setCheckingMyProfile(false);
      }
    };

    fetchMyProfileStatus();
  }, [user]);

  function clearAllFilters() {
    setFilters({ district: '', genre: '', mood: '', q: '' });
    setPage(1);
    loadArtists({ page: 1, limit });
  }

  function handleArtistSelect(artistId) {
    setSelectedId(artistId);
    const el = document.getElementById(`artist-${artistId}`);

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('card-highlight');
      setTimeout(() => el.classList.remove('card-highlight'), 1500);
    } else {
      window.location.href = `/artist/${artistId}`;
    }
  }

  const artistHasProfile = user && (user.has_profile === true || user.hasProfile === true);
  const totalPages = Math.max(1, Math.ceil((total || 0) / Math.max(1, limit)));

  return (
    <div>
      <Hero />

      <Container fluid className="mt-4 px-lg-5">

        {noMatch && (
          <Alert variant="warning" className="d-flex justify-content-between align-items-center">
            <div>No artists matched your filters.</div>
            <div>
              <Button size="sm" variant="outline-secondary" onClick={clearAllFilters}>Clear filters</Button>
            </div>
          </Alert>
        )}

        {user?.role === 'artist' && !checkingMyProfile && !artistHasProfile && (
          <Alert variant="success" className="d-flex align-items-center justify-content-between">
            <div>
              <strong>Welcome, {user.username || user.displayName || 'artist'}</strong>
              <div className="small">Complete your artist profile to upload tracks and manage events.</div>
            </div>
            <div>
              <Button as={Link} to="/onboard" variant="light">Get started</Button>
            </div>
          </Alert>
        )}

        {user?.role === 'artist' && !checkingMyProfile && artistHasProfile && myArtistProfileStatus === 'pending' && (
          <Alert variant="warning" className="d-flex align-items-center justify-content-between">
            <div>
              <strong>Your artist profile is pending verification</strong>
              <div className="small">
                Thanks for submitting your profile. Our team is reviewing it now, and it will become visible once approved.
              </div>
            </div>
            <div>
              <Button as={Link} to="/onboard" variant="outline-dark">View profile</Button>
            </div>
          </Alert>
        )}

        {user?.role === 'artist' && !checkingMyProfile && artistHasProfile && myArtistProfileStatus === 'rejected' && (
          <Alert variant="danger" className="d-flex align-items-center justify-content-between">
            <div>
              <strong>Your artist profile was not approved</strong>
              <div className="small">
                {myArtistProfileReason
                  ? `Reason: ${myArtistProfileReason}`
                  : 'Please review the feedback, update your profile, and submit again.'}
              </div>
            </div>
            <div>
              <Button as={Link} to="/onboard" variant="light">Edit profile</Button>
            </div>
          </Alert>
        )}

        <h2 className="mb-4">
          <FaMusic className="me-2" />
          Discover Local Artists
        </h2>

        {/* FILTERS */}
        <div className="mb-4 p-3 bg-light rounded shadow-sm">
          <FilterBar filters={filters} setFilters={setFilters} />
        </div>

        {/* ARTISTS GRID */}
        <Row className="mt-4">
          <Col xs={12}>
            <div className="mb-3 d-flex align-items-center justify-content-between">
              <h4 className="mb-1">Artists</h4>
              <div className="small text-muted">Page {page} / {totalPages}</div>
            </div>

            <hr />

            {loading ? (
              <div className="py-4 text-center">
                <Spinner animation="border" />
                <div className="small text-muted mt-2">Loading artists...</div>
              </div>
            ) : (
              <Row>
                {artists.length === 0 ? (
                  <Col xs={12}>
                    <div className="py-5 text-center text-muted">
                      <h5>No artists found.</h5>
                      <div className="mt-2">Try changing filters, or check back later.</div>
                      {user?.role === 'artist' && (
                        <div className="mt-3">
                          <Button as={Link} to="/onboard" variant="outline-success">
                            Create your profile
                          </Button>
                        </div>
                      )}
                    </div>
                  </Col>
                ) : (
                  artists.map(a => (
                    <Col
                      key={a.id}
                      id={`artist-${a.id}`}
                      xs={6}
                      md={4}
                      lg={3}
                      className="mb-4"
                    >
                      <ArtistCard
                        artist={a}
                        selected={selectedId === a.id}
                      />
                    </Col>
                  ))
                )}

                {/* Pagination controls */}
                <Col xs={12} className="d-flex justify-content-between align-items-center mt-2">
                  <div />
                  <div>
                    <Button
                      variant="link"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className="ms-2"
                    >
                      Next
                    </Button>
                  </div>
                </Col>

              </Row>
            )}
          </Col>
        </Row>

        {/* New Releases | Most Played */}
        <Row className="mt-5">
          <Col xs={12} md={6} className="mb-4">
            <h6 className="text-uppercase text-muted mb-2">New Releases</h6>
            <div className="p-3 bg-white rounded shadow-sm">
              <NewReleases onSelect={handleArtistSelect} />
            </div>
          </Col>

          <Col xs={12} md={6} className="mb-4">
            <h6 className="text-uppercase text-muted mb-2">Most Played</h6>
            <div className="p-3 bg-white rounded shadow-sm">
              <MostPlayed onSelect={handleArtistSelect} />
            </div>
          </Col>
        </Row>

      </Container>
    </div>
  );
}