import React, { useEffect, useState } from 'react';
import axios from '../api/axiosConfig';
import ArtistCard from '../components/ArtistCard';
import MapView from '../components/MapView';
import FeaturedCarousel from '../components/FeaturedCarousel';
import FilterBar from '../components/FilterBar';
import { Button } from 'react-bootstrap';
import Hero from '../components/Hero';

export default function Home() {
  const [artists, setArtists] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [showMap, setShowMap] = useState(window.innerWidth >= 768); // show map on desktop by default
  const [filters, setFilters] = useState({ district: '', genre: '', mood: '' });
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    loadArtists();
    axios.get('/featured')
      .then(res => setFeatured(res.data))
      .catch(() => {});
    // handle window resize to update map default (optional)
    const onResize = () => {
      if (window.innerWidth < 768) setShowMap(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function loadArtists(params = {}) {
    setLoading(true);
    axios.get('/artists', { params })
      .then(res => setArtists(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }

  function applyFilters() {
    const params = {};
    if (filters.district) params.district = filters.district;
    if (filters.genre) params.genre = filters.genre;
    if (filters.q) params.q = filters.q;
    loadArtists(params);
  }

  function clearFilters() {
    setFilters({ district: '', genre: '', mood: '' });
    loadArtists();
  }

  function handleMarkerClick(artist) {
    // highlight & scroll the artist card into view
    setSelectedId(artist.id);
    const el = document.getElementById(`artist-${artist.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // small visual flash via CSS class handled by ArtistCard wrapper (see CSS note)
      el.classList.add('card-highlight');
      setTimeout(() => el.classList.remove('card-highlight'), 1500);
    } else {
      // fallback: navigate to profile if card not present
      window.location.href = `/artist/${artist.id}`;
    }
  }

  return (
    <div>
      {/* Hero / intro section */}
      <Hero />

      <h2 className="mb-3">Discover Local Artists</h2>

      <FeaturedCarousel items={featured} />

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      <div className="d-flex justify-content-end mb-2">
        <Button
          size="sm"
          variant={showMap ? 'outline-success' : 'success'}
          onClick={() => setShowMap(s => !s)}
        >
          {showMap ? 'Hide Map' : 'Show Map'}
        </Button>
      </div>

      <div className="row">
        {showMap && (
          <div className="col-12 col-md-4 mb-3">
            <MapView artists={artists} onMarkerClick={handleMarkerClick} />
          </div>
        )}

        <div className={showMap ? 'col-12 col-md-8' : 'col-12'}>
          {loading ? (
            <div>Loading artists...</div>
          ) : (
            <div className="row mt-1">
              {artists.length === 0 && <div className="col-12">No artists found.</div>}
              {artists.map(a => (
                <div
                  key={a.id}
                  id={`artist-${a.id}`}
                  className={`col-12 col-md-6 col-lg-4 mb-3`}
                >
                  <ArtistCard artist={a} selected={selectedId === a.id} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
