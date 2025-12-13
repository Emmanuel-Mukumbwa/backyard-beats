import React from 'react';
import { Form, Row, Col, Button } from 'react-bootstrap';
import DISTRICTS from '../data/districts';

const GENRES = ["Any","Afropop","Gospel","Hip-hop","R&B","Reggae","Highlife","Traditional","Dancehall","Jazz","Blues","Electronic"];
const MOODS = ["Any","Upbeat","Chill","Romantic","Energetic","Melancholic","Uplifting","Party"];

export default function FilterBar({ filters, setFilters, onApply, onClear }) {
  return (
    <Form className="mb-3">
      <Row className="g-2 align-items-end">
        <Col xs={12} md={4}>
          <Form.Group controlId="district">
            <Form.Label>District</Form.Label>
            <Form.Select value={filters.district} onChange={e => setFilters({...filters, district: e.target.value})}>
              <option value="">All districts</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col xs={6} md={3}>
          <Form.Group controlId="genre">
            <Form.Label>Genre</Form.Label>
            <Form.Select value={filters.genre} onChange={e => setFilters({...filters, genre: e.target.value})}>
              {GENRES.map(g => <option key={g} value={g === "Any" ? "" : g}>{g}</option>)}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col xs={6} md={3}>
          <Form.Group controlId="mood">
            <Form.Label>Mood</Form.Label>
            <Form.Select value={filters.mood} onChange={e => setFilters({...filters, mood: e.target.value})}>
              {MOODS.map(m => <option key={m} value={m === "Any" ? "" : m}>{m}</option>)}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col xs={12} md={2} className="d-grid">
          <Button variant="success" onClick={onApply}>Apply</Button>
          <Button variant="link" onClick={onClear}>Clear</Button>
        </Col>
      </Row>
    </Form>
  );
}
 