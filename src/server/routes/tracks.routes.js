const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const controller = require('../controllers/tracks.controller');
const { uploadFields } = require('../middleware/upload');

// Protect all routes
router.use(auth);

// allow both the audio file and optional artwork in one request
// fields: 'file' (audio) and 'artwork' (image)
const fields = uploadFields([{ name: 'file', maxCount: 1 }, { name: 'artwork', maxCount: 1 }]);

router.get('/', controller.listTracks); // returns tracks for the logged-in artist

// Debug middleware placed AFTER Multer has processed the files
router.post('/', fields, (req, res, next) => {
  console.log('Fields received (after multer):', Object.keys(req.body));
  console.log('Files received (after multer):', req.files ? Object.keys(req.files) : 'No files');
  // Optional: log full body and files structure for deep debugging
  // console.log('req.body:', req.body);
  // console.log('req.files:', req.files);
  next();
}, controller.createTrack);

router.put('/:id', fields, controller.updateTrack);
router.delete('/:id', controller.deleteTrack);

module.exports = router;