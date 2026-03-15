// src/server/middleware/upload.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

/**
 * Helper: sanitize a base name (remove special chars, limit length)
 */
function sanitizeBase(name = 'file') {
  const base = name.split('.')[0]; // simple version, remove extension
  return base
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .slice(0, 120);
}

/**
 * Helper: determine Cloudinary folder based on multer field name
 */
function getFolderForField(fieldname) {
  switch (fieldname) {
    case 'file':      return 'tracks';
    case 'artwork':   return 'tracks/artwork';
    case 'image':     return 'events/images';
    case 'photo':     return 'artists/photos';
    default:          return 'others';
  }
}

/**
 * Create a Cloudinary storage engine configured per‑field
 */
const cloudinaryStorage = () => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      const folderPath = getFolderForField(file.fieldname);
      const uid = (req.user && req.user.id) ? String(req.user.id) : 'anon';
      const ts = Date.now();
      const base = sanitizeBase(file.originalname);
      const publicId = `${folderPath}/${uid}-${ts}-${base}`;
      return {
        folder: folderPath,
        public_id: publicId,
        resource_type: file.mimetype.startsWith('audio/') ? 'video' : 'image',
      };
    },
  });
};

/* ------------------------------------------------------------------
   Dedicated single‑purpose uploaders (for routes that expect one file)
   ------------------------------------------------------------------ */

// Image upload (artist photos, etc.) – field name 'image'
const imageUpload = multer({
  storage: cloudinaryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only image files are allowed'));
    }
    cb(null, true);
  }
}).single('image');

// Dedicated event image uploader – field name 'image' (same as above, but with larger limit)
const eventImageUpload = multer({
  storage: cloudinaryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Event image must be an image type'));
    }
    cb(null, true);
  }
}).single('image');

// Audio uploader – field name 'file'
const audioUpload = multer({
  storage: cloudinaryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('audio/')) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only audio files are allowed'));
    }
    cb(null, true);
  }
}).single('file');

/* ------------------------------------------------------------------
   Mixed‑fields uploader (for forms that send multiple files, e.g. track + artwork)
   ------------------------------------------------------------------ */
const routingUpload = multer({
  storage: cloudinaryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'file') {
      if (!file.mimetype || !file.mimetype.startsWith('audio/')) {
        return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Track file must be an audio type'));
      }
    } else if (['artwork', 'image', 'photo'].includes(file.fieldname)) {
      if (!file.mimetype || !file.mimetype.startsWith('image/')) {
        return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Artwork/image must be an image type'));
      }
    }
    cb(null, true);
  }
});

/**
 * Helper to create a fields‑based middleware (for routes needing multiple named files)
 */
function uploadFields(fieldsArray = []) {
  return routingUpload.fields(fieldsArray);
}

/* ------------------------------------------------------------------
   Exports – compatible with existing route files
   ------------------------------------------------------------------ */
module.exports = {
  audioUpload,
  imageUpload,
  eventImageUpload,
  uploadFields,
  // The following low‑level exports are exposed if needed, but most routes won't use them.
  _routingUpload: routingUpload,
};