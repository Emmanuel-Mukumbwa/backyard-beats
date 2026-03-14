// src/components/FilterBar.js
import React, { useEffect, useState } from 'react';
import { Form, Row, Col, InputGroup, Spinner } from 'react-bootstrap';
import axios from '../api/axiosConfig';
import { FaSearch } from 'react-icons/fa';

/**
 * Live filter bar — no Apply / Clear buttons.
 * Props:
 *  - filters: { district, genre, mood, q }
 *  - setFilters: function to update filters
 */
export default function FilterBar({ filters, setFilters }) {
  const [districts, setDistricts] = useState([]);
  const [genres, setGenres] = useState([]);
  const [moods, setMoods] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      setLoadingMeta(true);
      try {
        const [dRes, gRes, mRes] = await Promise.all([
          axios.get('/districts'),
          axios.get('/meta/genres'),
          axios.get('/meta/moods'),
        ]);
        if (cancelled) return;
        setDistricts(dRes.data || []);
        setGenres(gRes.data || []);
        setMoods(mRes.data || []);
      } catch (e) {
        console.warn('Could not load filter metadata', e);
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }
    loadMeta();
    return () => { cancelled = true; };
  }, []);

  return (
    <Form className="mb-3">
      <Row className="g-2 align-items-center">
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="district">
            <Form.Label className="small text-muted">District</Form.Label>
            <Form.Select
              value={filters.district}
              onChange={e => setFilters({ ...filters, district: e.target.value })}
              disabled={loadingMeta}
            >
              <option value="">All districts</option>
              {districts.map(d => <option key={d.id || d.name} value={d.id || d.name}>{d.name || d}</option>)}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col xs={6} md={3} lg={2}>
          <Form.Group controlId="genre">
            <Form.Label className="small text-muted">Genre</Form.Label>
            <Form.Select
              value={filters.genre}
              onChange={e => setFilters({ ...filters, genre: e.target.value })}
              disabled={loadingMeta}
            >
              <option value="">Any</option>
              {genres.map(g => <option key={g.id || g} value={g.name || g}>{g.name || g}</option>)}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col xs={6} md={3} lg={2}>
          <Form.Group controlId="mood">
            <Form.Label className="small text-muted">Mood</Form.Label>
            <Form.Select
              value={filters.mood}
              onChange={e => setFilters({ ...filters, mood: e.target.value })}
              disabled={loadingMeta}
            >
              <option value="">Any</option>
              {moods.map(m => <option key={m.id || m} value={m.name || m}>{m.name || m}</option>)}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col xs={12} md={12} lg={5}>
          <Form.Group controlId="q">
            <Form.Label className="small text-muted">Search</Form.Label>
            <InputGroup>
              <InputGroup.Text><FaSearch /></InputGroup.Text>
              <Form.Control
                placeholder="Search artists or tracks..."
                value={filters.q}
                onChange={e => setFilters({ ...filters, q: e.target.value })}
              />
              {loadingMeta && (
                <InputGroup.Text>
                  <Spinner animation="border" size="sm" />
                </InputGroup.Text>
              )}
            </InputGroup>
          </Form.Group>
        </Col>
      </Row>
    </Form>
  );
}