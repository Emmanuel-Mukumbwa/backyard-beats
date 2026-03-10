// src/components/MapView.jsx
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * MapView
 * Props:
 *  - artists: array of artist objects which may contain { id, display_name, lat, lng, user_id, ... }
 *  - onMarkerClick: fn(artist)
 *
 * Defensive: only creates markers for entries with valid numeric lat/lng.
 */

const DEFAULT_CENTER = [0, 0]; // safe fallback
const DEFAULT_ZOOM = 2;

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (!points || points.length === 0) {
      // show a safe default view, avoid calling project/latLng with nulls
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const latlngs = points.map(p => [p.lat, p.lng]);
    try {
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } catch (e) {
      // On any failure, fallback to default
      // eslint-disable-next-line no-console
      console.warn('FitBounds failed, using default center', e);
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  }, [map, points]);

  return null;
}

export default function MapView({ artists = [], onMarkerClick = () => {} }) {
  // Build a safe list of points with numeric lat/lng
  const points = (artists || []).map(a => {
    // support both lat/lng or latitude/longitude naming
    const latRaw = a?.lat ?? a?.latitude ?? a?.location?.lat ?? null;
    const lngRaw = a?.lng ?? a?.longitude ?? a?.location?.lng ?? null;

    const lat = latRaw !== null && latRaw !== undefined ? Number(latRaw) : NaN;
    const lng = lngRaw !== null && lngRaw !== undefined ? Number(lngRaw) : NaN;

    return { ...a, lat, lng };
  }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  // Choose initial center / zoom
  const center = points.length > 0 ? [points[0].lat, points[0].lng] : DEFAULT_CENTER;
  const zoom = points.length > 0 ? 12 : DEFAULT_ZOOM;

  // Workaround: default Leaflet icon images when using CRA - configure marker icon
  // (optional but prevents missing marker icon issues)
  useEffect(() => {
    // only configure once
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
      iconUrl: require('leaflet/dist/images/marker-icon.png'),
      shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
    });
  }, []);

  return (
    <div style={{ width: '100%', height: 400 }}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Fit to bounds if we have any points */}
        <FitBounds points={points} />

        {points.map(artist => (
          <Marker
            key={`artist-marker-${artist.id}`}
            position={[artist.lat, artist.lng]}
            eventHandlers={{
              click: () => onMarkerClick(artist)
            }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <strong>{artist.display_name || artist.username || 'Artist'}</strong>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {artist.bio ? (artist.bio.length > 120 ? `${artist.bio.slice(0, 120)}…` : artist.bio) : 'No bio'}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

MapView.propTypes = {
  artists: PropTypes.array,
  onMarkerClick: PropTypes.func
};
 