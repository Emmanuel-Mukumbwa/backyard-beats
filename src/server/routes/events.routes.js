// src/server/routes/events.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const eventsCtrl = require('../controllers/events.controller');
const rsvpsCtrl  = require('../controllers/rsvps.controller');
const { imageUpload } = require('../middleware/upload');

// -----------------------
// Public endpoints
// -----------------------
router.get('/', eventsCtrl.listPublicEvents);   // GET /events

// Artist-only listing (authenticated) - returns artist's events including pending/rejected
router.get('/my', auth, eventsCtrl.listEvents); // GET /events/my

router.get('/:id', eventsCtrl.getEventDetail);  // GET /events/:id  (public detail)

// -----------------------
// Authenticated helpers that must be declared before a generic :id capture
// (we attach auth explicitly where needed to avoid route conflicts)
// -----------------------


// -----------------------
// All routes below require authentication
// (artists create/update/delete; fans RSVP)
// -----------------------
router.use(auth);

// Artist event CRUD (image optional in field "image")
router.post('/', imageUpload, eventsCtrl.createEvent);   // POST /events
router.put('/:id', imageUpload, eventsCtrl.updateEvent); // PUT /events/:id
router.delete('/:id', eventsCtrl.deleteEvent);           // DELETE /events/:id

// RSVP endpoints (fan actions)
router.post('/:id/rsvp', rsvpsCtrl.rsvpEvent);       // POST /events/:id/rsvp
router.delete('/:id/rsvp', rsvpsCtrl.cancelRsvp);    // DELETE /events/:id/rsvp

// Helpers for authenticated users
router.get('/my/rsvps', rsvpsCtrl.getMyRsvps);       // GET /events/my/rsvps
router.get('/:id/rsvps', rsvpsCtrl.getEventRsvps);  // GET /events/:id/rsvps (artist-only)

module.exports = router;