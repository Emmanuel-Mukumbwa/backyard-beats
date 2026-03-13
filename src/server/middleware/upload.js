// src/server/middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Base upload directories (on server filesystem)
const UPLOAD_BASE = path.join(__dirname, '..', 'uploads');
const ARTIST_PHOTOS_DIR = path.join(UPLOAD_BASE, 'artists', 'photos');
const TRACKS_DIR = path.join(UPLOAD_BASE, 'tracks');
const TRACKS_ARTWORK_DIR = path.join(TRACKS_DIR, 'artwork');
const EVENTS_IMAGES_DIR = path.join(UPLOAD_BASE, 'events', 'images');
const OTHERS_DIR = path.join(UPLOAD_BASE, 'others');

// Ensure directories exist (recursive)
[UPLOAD_BASE, ARTIST_PHOTOS_DIR, TRACKS_DIR, TRACKS_ARTWORK_DIR, EVENTS_IMAGES_DIR, OTHERS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}); 
 
// Utility: sanitize filename base
function sanitizeBase(name = 'file') {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  return base
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .slice(0, 120); // keep reasonable length
}

// Utility: build a filename including user id if present
function buildFilename(req, file, prefix = '') {
  const uid = (req.user && req.user.id) ? String(req.user.id) : 'anon';
  const ts = Date.now();
  const ext = path.extname(file.originalname) || '';
  const base = sanitizeBase(file.originalname || `${file.fieldname}`);
  return `${prefix}${uid}-${ts}-${base}${ext}`;
}

/**
 * createStorage(folder, prefix) -> multer.diskStorage instance
 * used for dedicated single-purpose uploaders (audio/image)
 */
function createStorage(folder, prefix = '') {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      // Ensure folder exists (defensive)
      if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
      cb(null, folder);
    },
    filename: (req, file, cb) => {
      cb(null, buildFilename(req, file, prefix));
    }
  });
}

/* ---------------------------
   Dedicated single-purpose uploaders
   --------------------------- */

// Image uploader for artist photos, event images, etc.
// Keep the existing artist photo uploader (img- prefix)
// NOTE: this original imageUpload is bound to single('image') in your current code.
// If you use this middleware in routes for events it will save into ARTIST_PHOTOS_DIR.
// To avoid that, use eventImageUpload (below) specifically for event image uploads.
const imageStorage = createStorage(ARTIST_PHOTOS_DIR, 'img-');
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only image files are allowed'));
    }
    cb(null, true);
  }
}).single('image'); // default middleware is single('image') - keep for backward compatibility

// Dedicated event image uploader -> writes to /uploads/events/images
const eventImageStorage = createStorage(EVENTS_IMAGES_DIR, 'evt-');
const eventImageUpload = multer({
  storage: eventImageStorage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB for event images (adjust as needed)
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Event image must be an image type'));
    }
    cb(null, true);
  }
}).single('image'); // this expects the field name 'image' in the form

// Audio uploader for track files
const audioStorage = createStorage(TRACKS_DIR, 'trk-');
const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('audio/')) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only audio files are allowed'));
    }
    cb(null, true);
  }
}).single('file'); // default middleware is single('file')

/* ---------------------------
   Routing storage for mixed fields (file + artwork + image etc)
   This storage picks destination based on file.fieldname
   --------------------------- */
const routingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = OTHERS_DIR;
    // route by fieldname
    if (file.fieldname === 'file') dest = TRACKS_DIR;
    else if (file.fieldname === 'artwork') dest = TRACKS_ARTWORK_DIR;
    else if (file.fieldname === 'image') dest = EVENTS_IMAGES_DIR;
    else if (file.fieldname === 'photo') dest = ARTIST_PHOTOS_DIR;
    else dest = OTHERS_DIR;

    // ensure exists
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // choose prefix per field
    let prefix = '';
    if (file.fieldname === 'file') prefix = 'trk-';
    else if (file.fieldname === 'artwork') prefix = 'art-';
    else if (file.fieldname === 'image') prefix = 'evt-';
    else if (file.fieldname === 'photo') prefix = 'img-';
    else prefix = '';

    cb(null, buildFilename(req, file, prefix));
  }
});

const routingUpload = multer({
  storage: routingStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max per file (can be adjusted)
  fileFilter: (req, file, cb) => {
    // accept audio for 'file' and images for 'artwork'/'image'/'photo'
    if (file.fieldname === 'file') {
      if (!file.mimetype || !file.mimetype.startsWith('audio/')) {
        return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Track file must be an audio type'));
      }
      return cb(null, true);
    }

    // artwork, image, photo -> accept images
    if (['artwork', 'image', 'photo'].includes(file.fieldname)) {
      if (!file.mimetype || !file.mimetype.startsWith('image/')) {
        return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Artwork/image must be an image type'));
      }
      return cb(null, true);
    }

    // default: accept
    return cb(null, true);
  }
});

/**
 * uploadFields(fieldsArray)
 * fieldsArray example: [{ name: 'file', maxCount: 1 }, { name: 'artwork', maxCount: 1 }]
 * returns middleware function (multer .fields)
 */
function uploadFields(fieldsArray = []) {
  return routingUpload.fields(fieldsArray);
}

/* ---------------------------
   Exports
   --------------------------- */

module.exports = {
  // dedicated single-file middlewares
  audioUpload,     // default: single('file') middleware
  imageUpload,     // original image middleware (writes to artist photos by default)
  eventImageUpload, // new middleware: single('image') -> writes to uploads/events/images

  // helper to create a .fields() middleware for mixed uploads
  uploadFields,    // call like uploadFields([{ name:'file', maxCount:1 }, { name:'artwork', maxCount:1 }])

  // raw routingUpload and routingStorage are also available if you want lower-level control
  _routingUpload: routingUpload,
  _routingStorage: routingStorage,

  // exported paths
  UPLOAD_BASE,
  TRACKS_DIR,
  TRACKS_ARTWORK_DIR, 
  ARTIST_PHOTOS_DIR,
  EVENTS_IMAGES_DIR,
  OTHERS_DIR
};