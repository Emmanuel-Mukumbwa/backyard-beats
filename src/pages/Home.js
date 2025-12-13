import React, { useEffect, useState, useContext, useRef } from 'react';
import axios from '../api/axiosConfig';
import ArtistCard from '../components/ArtistCard';
import MapView from '../components/MapView';
import FeaturedCarousel from '../components/FeaturedCarousel';
import FilterBar from '../components/FilterBar';
import { Button, Alert, Container, Row, Col, Spinner } from 'react-bootstrap';
import Hero from '../components/Hero';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';

// icons
import { FaMusic, FaMapMarkerAlt } from 'react-icons/fa';

export default function Home() {
  const [artists, setArtists] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [showMap, setShowMap] = useState(window.innerWidth >= 992);
  const [filters, setFilters] = useState({ district: '', genre: '', mood: '', q: '' });
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [autoClearMsg, setAutoClearMsg] = useState('');
  const unmounted = useRef(false);

  const debounceRef = useRef(null);
  const autoClearTimerRef = useRef(null);

  const { user } = useContext(AuthContext);

  useEffect(() => {
    loadArtists();
    axios.get('/featured')
      .then(res => setFeatured(res.data || []))
      .catch(() => {});
    const onResize = () => { if (window.innerWidth < 768) setShowMap(false); };
    window.addEventListener('resize', onResize);
    return () => {
      unmounted.current = true;
      window.removeEventListener('resize', onResize);
      clearTimeout(debounceRef.current);
      clearTimeout(autoClearTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Core loader: accepts params (optional)
  function loadArtists(params = {}) {
    setLoading(true);
    axios.get('/artists', { params })
      .then(res => {
        const data = res.data || [];
        setArtists(data);

        // If we requested with filters and got zero results, auto-clear filters after short delay
        const filtersActive = Object.values(filters).some(v => v && String(v).trim().length > 0);
        if (data.length === 0 && filtersActive) {
          // clear any existing pending timer
          clearTimeout(autoClearTimerRef.current);
          autoClearTimerRef.current = setTimeout(() => {
            // Visual feedback
            setAutoClearMsg('No artists matched your filters — clearing filters and showing all artists.');
            // clear filters
            setFilters({ district: '', genre: '', mood: '', q: '' });
            // reload full list
            axios.get('/artists')
              .then(allRes => {
                if (!unmounted.current) {
                  setArtists(allRes.data || []);
                }
              })
              .catch(() => {});
            // hide the message after 3s
            setTimeout(() => setAutoClearMsg(''), 3000);
          }, 1500);
        }
      })
      .catch(err => {
        console.error('Failed to load artists', err);
        setArtists([]);
      })
      .finally(() => {
        if (!unmounted.current) setLoading(false);
      });
  }

  // Auto-apply filters debounce
  useEffect(() => {
    // Debounce behaviour: wait 400ms after last change to apply
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = {};
      if (filters.district) params.district = filters.district;
      if (filters.genre) params.genre = filters.genre;
      if (filters.q) params.q = filters.q;
      // if no filters at all, just load all
      if (!Object.values(filters).some(v => v && String(v).trim().length > 0)) {
        loadArtists();
      } else {
        loadArtists(params);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // legacy functions kept for explicit actions (e.g. FilterBar button)
  function applyFilters() {
    const params = {};
    if (filters.district) params.district = filters.district;
    if (filters.genre) params.genre = filters.genre;
    if (filters.q) params.q = filters.q;
    loadArtists(params);
  }

  function clearFilters() {
    setFilters({ district: '', genre: '', mood: '', q: '' });
    loadArtists();
  }

  function handleMarkerClick(artist) {
    setSelectedId(artist.id);
    const el = document.getElementById(`artist-${artist.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('card-highlight');
      setTimeout(() => el.classList.remove('card-highlight'), 1500);
    } else {
      window.location.href = `/artist/${artist.id}`;
    }
  }

  const artistHasProfile = user && (user.has_profile === true || user.hasProfile === true);

  return (
    <div>
      <Hero />

      <Container className="mt-4">
        {autoClearMsg && <Alert variant="info">{autoClearMsg}</Alert>}

        {user?.role === 'artist' && !artistHasProfile && (
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

        <h2 className="mb-3"><FaMusic className="me-2" />Discover Local Artists</h2>

        <FeaturedCarousel items={featured} />

        <Row className="mt-3 align-items-center">
          <Col xs={12} lg={8}>
            <FilterBar
              filters={filters}
              setFilters={setFilters}
              onApply={applyFilters}
              onClear={clearFilters}
            />
          </Col>
          <Col xs={12} lg={4} className="text-end mt-2 mt-lg-0">
            <Button
              size="sm"
              variant={showMap ? 'outline-success' : 'success'}
              onClick={() => setShowMap(s => !s)}
            >
              <FaMapMarkerAlt className="me-1" />
              {showMap ? 'Hide Map' : 'Show Map'}
            </Button>
          </Col>
        </Row>

        <Row className="mt-3">
          {showMap && (
            <Col xs={12} lg={4} className="mb-3">
              <MapView artists={artists} onMarkerClick={handleMarkerClick} />
            </Col>
          )}

          <Col xs={12} lg={showMap ? 8 : 12}>
            {loading ? (
              <div className="py-4 text-center">
                <Spinner animation="border" /> <div className="small text-muted mt-2">Loading artists...</div>
              </div>
            ) : (
              <Row className="mt-1">
                {artists.length === 0 ? (
                  <Col xs={12}>
                    <div className="py-5 text-center text-muted">
                      <h5>No artists found.</h5>
                      <div className="mt-2">Try changing or clearing filters, or check back later.</div>
                      {user?.role === 'artist' && (
                        <div className="mt-3">
                          <Button as={Link} to="/onboard" variant="outline-success">Create your profile</Button>
                        </div>
                      )}
                    </div>
                  </Col>
                ) : (
                  artists.map(a => (
                    <Col
                      key={a.id}
                      id={`artist-${a.id}`}
                      className={`col-12 col-md-6 col-lg-4 mb-3`}
                    >
                      <ArtistCard artist={a} selected={selectedId === a.id} />
                    </Col>
                  ))
                )}
              </Row>
            )}
          </Col>
        </Row>
      </Container>
    </div>
  );
}
