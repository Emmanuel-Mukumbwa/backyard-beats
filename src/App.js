import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import ArtistDetail from './pages/ArtistDetail';
import Events from './pages/Events';
import Login from './pages/Login';
import Register from './pages/Register';
import Orientation from './pages/Orientation';

export default function App() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <main className="flex-fill container py-3"> 
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/artist/:id" element={<ArtistDetail />} />
          <Route path="/events" element={<Events />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/orientation" element={<Orientation />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
