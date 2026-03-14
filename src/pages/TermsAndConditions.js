import React, { useEffect, useState } from 'react';
import { Container, Card, Spinner } from 'react-bootstrap';
import axios from '../api/axiosConfig';

export default function TermsAndConditions() {
  const [terms, setTerms] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTerms();
  }, []);

  async function loadTerms() {
    setLoading(true);
    try {
      // public endpoint to fetch active terms (backend provides latest active)
      const res = await axios.get('/public/terms');
      setTerms(res?.data?.terms || null);
    } catch (err) {
      console.error('Failed to load terms', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container className="py-4">
      <h2>Terms & Conditions</h2>
      {loading ? <div className="text-center py-4"><Spinner animation="border" /></div> : null}
      {!loading && !terms ? <div className="text-muted">No Terms & Conditions published yet.</div> : null}
      {terms ? (
        <Card className="mt-3">
          <Card.Body>
            <h4>{terms.title}</h4>
            <div dangerouslySetInnerHTML={{ __html: terms.body }} />
            <div className="text-muted small mt-3">Published: {terms.created_at ? new Date(terms.created_at).toLocaleString() : ''}</div>
          </Card.Body>
        </Card>
      ) : null}
    </Container>
  );
}