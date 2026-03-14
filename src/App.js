// src/App.jsx
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
import ArtistOnboarding from './pages/ArtistOnboarding';
import ArtistDashboard from './pages/ArtistDashboard';
import FanDashboard from './pages/FanDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Support from './pages/SupportPage';
import { AuthProvider } from './context/AuthContext';
import RequireAuth from './components/RequireAuth';
import RequireRole from './components/RequireRole';
import EventDetail from './pages/EventDetail';
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import BrowseMusic from './pages/BrowseMusic';

export default function App() {
  return (
    <AuthProvider>
      <div className="d-flex flex-column min-vh-100">
        <Navbar />
        <main className="flex-fill container py-3">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/artist/:id" element={<ArtistDetail />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/orientation" element={<Orientation />} />
            <Route path="/music" element={<BrowseMusic />} />
            <Route path="/terms" element={<TermsAndConditions />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route
              path="/onboard"
              element={
                <RequireAuth>
                  <RequireRole roles={['artist', 'admin']}>
                    <ArtistOnboarding />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/artist/dashboard"
              element={
                <RequireAuth>
                  <RequireRole roles={['artist']}>
                    <ArtistDashboard />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/fan/dashboard"
              element={
                <RequireAuth>
                  <RequireRole roles={['fan']}>
                    <FanDashboard />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <RequireRole roles={['admin']}>
                    <AdminDashboard />
                  </RequireRole>
                </RequireAuth>
              }
            />
            {/* Support route - require auth to create tickets */}
            <Route
              path="/support"
              element={
                <RequireAuth>
                  <Support />
                </RequireAuth>
              }
            />
          </Routes>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}